"""
V2 Webhook Router — resolves incoming provider messages to V2 connections.

Supports multi-route resolution: one incoming message can match multiple
bot connections (e.g., one auto-replies, another logs an agent-assist suggestion).

Priority rules:
- Connections are sorted by `priority` descending.
- Only the highest-priority `auto_reply` connection actually sends a response.
- All `agent_assist` / `internal_note` connections generate stored suggestions.
- If no V2 connections match, callers fall back to legacy V1 routing.

Rate limiting:
- A per-account asyncio.Semaphore prevents concurrent outbound calls from
  overwhelming a single provider account's rate limits.
"""
import asyncio
import logging
from typing import List, Optional, Dict, Tuple

logger = logging.getLogger("bitbotpro.webhook_router")

_db = None
_connection_routes_resolve = None  # Reference to connection_routes._resolve_settings


def init(db):
    global _db
    _db = db


# ── Per-account rate limiters ────────────────────────────────────────────
_account_semaphores: Dict[str, asyncio.Semaphore] = {}
MAX_CONCURRENT_PER_ACCOUNT = 3


def get_account_semaphore(account_id: str) -> asyncio.Semaphore:
    """Return a semaphore for the given account, creating one if needed."""
    if account_id not in _account_semaphores:
        _account_semaphores[account_id] = asyncio.Semaphore(MAX_CONCURRENT_PER_ACCOUNT)
    return _account_semaphores[account_id]


# ── Connection context loading ───────────────────────────────────────────

async def load_connection_context(connection: dict) -> Optional[dict]:
    """Enrich a connection with its bot config and account credentials.

    Returns a dict with:
      - connection: the raw connection document
      - bot: the V2 bot document
      - bot_config: legacy bot_config (for KB search, LLM config, etc.)
      - account: the connected_account (with raw credentials)
      - effective_settings: resolved overrides > bot defaults
      - instance_id: the legacy instance_id for backward-compat KB/conversation lookup
    """
    bot = await _db.bots.find_one({"id": connection["bot_id"]}, {"_id": 0})
    if not bot:
        logger.warning(f"[V2 ROUTER] Bot {connection['bot_id']} not found for connection {connection['id']}")
        return None

    account = await _db.connected_accounts.find_one({"id": connection["account_id"]}, {"_id": 0})
    if not account:
        logger.warning(f"[V2 ROUTER] Account {connection['account_id']} not found for connection {connection['id']}")
        return None

    # Resolve effective settings (connection overrides > bot defaults)
    effective = _resolve_effective_settings(bot, connection)

    # Legacy instance_id — needed for KB search, conversation storage, LLM config
    instance_id = bot.get("legacy_instance_id", bot["id"])

    # Load legacy bot_config for KB search / LLM pipeline
    bot_config = await _db.bot_config.find_one({"instance_id": instance_id}, {"_id": 0}) or {}
    # Merge V2 bot fields into bot_config for the pipeline (V2 fields take precedence)
    for field in ["persona", "custom_instructions", "tone_instructions", "knowledge_gate",
                  "knowledge_gate_pct", "fallback_message"]:
        if effective.get(field):
            bot_config[field] = effective[field]

    return {
        "connection": connection,
        "bot": bot,
        "bot_config": bot_config,
        "account": account,
        "effective_settings": effective,
        "instance_id": instance_id,
        "response_mode": connection.get("response_mode", "auto_reply"),
    }


def _resolve_effective_settings(bot: dict, connection: dict) -> dict:
    """Resolve effective settings: connection overrides > bot defaults."""
    override_flags = connection.get("override_flags", {}) or {}
    overrides = connection.get("overrides", {}) or {}

    effective = {}
    for key in ["persona", "custom_instructions", "tone_instructions",
                 "knowledge_gate", "knowledge_gate_pct", "fallback_message"]:
        if override_flags.get(key, False):
            effective[key] = overrides.get(key, "")
        else:
            effective[key] = bot.get(key, "")

    effective["response_mode"] = connection.get("response_mode", "agent_assist")
    return effective


# ── Discord route resolution ─────────────────────────────────────────────

async def resolve_discord_routes(guild_id: str, channel_id: str) -> List[dict]:
    """Find all enabled V2 connections matching this Discord guild + channel.

    Returns connections sorted by priority (highest first).
    Empty list means no V2 routes — caller should fall back to V1.
    """
    connections = await _db.connections.find({
        "provider": "discord",
        "enabled": True,
        "destination.guild_id": guild_id,
    }).sort("priority", -1).to_list(50)

    if not connections:
        return []

    matched = []
    for conn in connections:
        dest = conn.get("destination", {})
        listen_mode = dest.get("listen_mode", "all_channels")
        channel_ids = dest.get("channel_ids", [])

        if listen_mode == "all_channels":
            matched.append(conn)
        elif listen_mode == "specific_channels":
            if channel_id in channel_ids:
                matched.append(conn)
        elif listen_mode == "mention_only":
            # Always include — mention check happens in the message handler
            matched.append(conn)
        else:
            matched.append(conn)

    return matched


# ── Telegram route resolution ────────────────────────────────────────────

async def resolve_telegram_routes_by_instance(instance_id: str, chat_id: str = None) -> List[dict]:
    """Find V2 connections for a Telegram instance (legacy webhook pattern).

    Looks up via legacy_instance_id on the connection, then optionally filters
    by destination.chat_id if specific routing is configured.
    """
    # First find connections via legacy_instance_id
    connections = await _db.connections.find({
        "provider": "telegram",
        "enabled": True,
        "legacy_instance_id": instance_id,
    }).sort("priority", -1).to_list(50)

    if not connections:
        # Try finding through bot → connection chain
        bot = await _db.bots.find_one({"legacy_instance_id": instance_id}, {"_id": 0})
        if bot:
            connections = await _db.connections.find({
                "provider": "telegram",
                "enabled": True,
                "bot_id": bot["id"],
            }).sort("priority", -1).to_list(50)

    if not connections or not chat_id:
        return connections

    # Filter by destination.chat_id if configured
    matched = []
    for conn in connections:
        dest = conn.get("destination", {})
        dest_chat_id = dest.get("chat_id")
        if dest_chat_id and str(dest_chat_id) != str(chat_id):
            continue
        matched.append(conn)

    return matched if matched else connections


# ── Zendesk route resolution ─────────────────────────────────────────────

async def resolve_zendesk_routes_by_instance(instance_id: str, ticket: dict = None) -> List[dict]:
    """Find V2 connections for a Zendesk instance (legacy webhook pattern).

    Filters by ticket_group and ticket_tags if configured on the connection.
    """
    connections = await _db.connections.find({
        "provider": "zendesk",
        "enabled": True,
        "legacy_instance_id": instance_id,
    }).sort("priority", -1).to_list(50)

    if not connections:
        bot = await _db.bots.find_one({"legacy_instance_id": instance_id}, {"_id": 0})
        if bot:
            connections = await _db.connections.find({
                "provider": "zendesk",
                "enabled": True,
                "bot_id": bot["id"],
            }).sort("priority", -1).to_list(50)

    if not connections or not ticket:
        return connections

    # Filter by ticket_group / ticket_tags
    matched = []
    for conn in connections:
        dest = conn.get("destination", {})
        group_filter = dest.get("ticket_group", "")
        tag_filter = dest.get("ticket_tags", [])

        if group_filter:
            ticket_group = str(ticket.get("group_id", ""))
            if ticket_group and ticket_group != str(group_filter):
                continue

        if tag_filter:
            ticket_tags = set(ticket.get("tags", []))
            if not ticket_tags.intersection(set(tag_filter)):
                continue

        matched.append(conn)

    return matched if matched else connections


# ── Multi-route processing helpers ───────────────────────────────────────

def select_auto_reply_connection(connections: List[dict]) -> Optional[dict]:
    """From a list of matched connections, return the highest-priority auto_reply one.

    Only ONE connection should auto-reply to avoid duplicate messages.
    Returns None if no auto_reply connections exist.
    """
    for conn in connections:  # already sorted by priority desc
        if conn.get("response_mode") == "auto_reply":
            return conn
    return None


def get_suggestion_connections(connections: List[dict]) -> List[dict]:
    """Return all connections that should generate suggestions (agent_assist, internal_note).

    These connections produce stored AI suggestions but do NOT send outbound messages.
    """
    return [
        conn for conn in connections
        if conn.get("response_mode") in ("agent_assist", "internal_note", "sidebar_only")
    ]


# ── Conversation tagging ─────────────────────────────────────────────────

async def save_v2_suggestion(connection_id: str, bot_id: str, instance_id: str,
                              platform: str, user_message: str, ai_response: str,
                              metadata: dict = None):
    """Store an AI suggestion generated by an agent_assist/internal_note connection.

    These are NOT sent to the end-user — they're stored for human agents to review.
    """
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "connection_id": connection_id,
        "bot_id": bot_id,
        "instance_id": instance_id,
        "platform": platform,
        "user_message": user_message[:2000],
        "ai_suggestion": ai_response,
        "status": "pending",  # pending | accepted | dismissed
        "metadata": metadata or {},
        "created_at": now,
    }
    await _db.v2_suggestions.insert_one(doc)
    logger.info(f"[V2 ROUTER] Stored suggestion for connection {connection_id[:12]} ({platform})")


async def tag_conversation_v2(session_id: str, connection_id: str, bot_id: str):
    """Add V2 connection_id and bot_id to an existing conversation document."""
    await _db.conversations.update_one(
        {"session_id": session_id},
        {"$set": {
            "metadata.connection_id": connection_id,
            "metadata.v2_bot_id": bot_id,
        }}
    )
