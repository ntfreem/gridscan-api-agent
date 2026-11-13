"""
Connection routes — /api/v2/orgs/{org_id}/bots/{bot_id}/connections
Links an AI bot to a provider account + destination.
Supports behaviour overrides with clear inheritance semantics.
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict

import v2_helpers as h

router = APIRouter(prefix="/v2/orgs", tags=["v2-connections"])


# ── Models ──

class ConnectionCreate(BaseModel):
    account_id: str  # references connected_accounts
    name: str
    destination: dict  # provider-specific destination config
    response_mode: Optional[str] = "agent_assist"  # auto_reply | agent_assist | internal_note
    overrides: Optional[dict] = None  # behaviour overrides
    override_flags: Optional[dict] = None  # which overrides are intentional
    priority: Optional[int] = 0
    enabled: Optional[bool] = True


class ConnectionUpdate(BaseModel):
    name: Optional[str] = None
    destination: Optional[dict] = None
    response_mode: Optional[str] = None
    overrides: Optional[dict] = None
    override_flags: Optional[dict] = None
    priority: Optional[int] = None
    enabled: Optional[bool] = None


# ── Helpers ──

RESPONSE_MODES = {"auto_reply", "agent_assist", "internal_note", "sidebar_only"}

# Provider-specific destination keys
DESTINATION_KEYS = {
    "discord": ["guild_id", "guild_name", "channel_id", "channel_name"],
    "telegram": ["chat_id", "chat_title", "chat_type"],
    "zendesk": ["ticket_group", "ticket_tags", "ticket_filter"],
}


async def _check_overlap(org_id: str, bot_id: str, account_id: str, destination: dict,
                          exclude_conn_id: str = None):
    """Check for overlapping active routes — same account + same destination."""
    query = {
        "org_id": org_id,
        "account_id": account_id,
        "enabled": True,
    }
    # Check destination overlap based on provider
    if destination.get("channel_id"):
        query["destination.channel_id"] = destination["channel_id"]
    elif destination.get("chat_id"):
        query["destination.chat_id"] = destination["chat_id"]
    elif destination.get("ticket_group"):
        query["destination.ticket_group"] = destination["ticket_group"]
    else:
        # No specific destination — can't check overlap
        return []

    if exclude_conn_id:
        query["id"] = {"$ne": exclude_conn_id}

    overlaps = await h._db.connections.find(query, {"_id": 0}).to_list(10)
    return overlaps


def _resolve_settings(bot: dict, connection: dict) -> dict:
    """Resolve effective settings: connection overrides > bot defaults.
    Uses override_flags to distinguish 'not set' from 'intentionally empty'."""
    override_flags = connection.get("override_flags", {}) or {}
    overrides = connection.get("overrides", {}) or {}

    effective = {}
    for key in ["persona", "custom_instructions", "tone_instructions",
                 "knowledge_gate", "knowledge_gate_pct", "fallback_message"]:
        if override_flags.get(key, False):
            # Explicitly overridden — use the override value even if empty/false
            effective[key] = overrides.get(key, "")
        else:
            # Inherit from bot
            effective[key] = bot.get(key, "")

    effective["response_mode"] = connection.get("response_mode", "agent_assist")
    return effective


# ── Endpoints ──

@router.get("/{org_id}/bots/{bot_id}/connections")
async def list_connections(org_id: str, bot_id: str, request: Request):
    """List all connections for a bot."""
    user, org, bot = await h.require_bot_access(request, bot_id)
    connections = await h._db.connections.find(
        {"bot_id": bot_id, "org_id": org_id}, {"_id": 0}
    ).sort("name", 1).to_list(200)

    # Enrich with account info
    account_ids = list({c["account_id"] for c in connections})
    accounts = {}
    if account_ids:
        accs = await h._db.connected_accounts.find(
            {"id": {"$in": account_ids}}, {"_id": 0, "credentials": 0}
        ).to_list(200)
        accounts = {a["id"]: a for a in accs}

    for conn in connections:
        acc = accounts.get(conn["account_id"], {})
        conn["account_name"] = acc.get("name", "Unknown")
        conn["account_provider"] = acc.get("provider", "unknown")
        conn["account_status"] = acc.get("status", "unknown")
        conn["effective_settings"] = _resolve_settings(bot, conn)

    return {"connections": connections, "bot_defaults": {
        "persona": bot.get("persona", ""),
        "custom_instructions": bot.get("custom_instructions", ""),
        "tone_instructions": bot.get("tone_instructions", ""),
        "knowledge_gate": bot.get("knowledge_gate", "strict"),
    }}


@router.post("/{org_id}/bots/{bot_id}/connections")
async def create_connection(org_id: str, bot_id: str, body: ConnectionCreate, request: Request):
    """Create a new connection linking a bot to a provider account + destination."""
    user, org, bot = await h.require_bot_access(request, bot_id)

    # Verify account belongs to this org
    account = await h._db.connected_accounts.find_one(
        {"id": body.account_id, "org_id": org_id}, {"_id": 0}
    )
    if not account:
        raise HTTPException(404, "Connected account not found in this organisation")
    if account.get("status") != "connected":
        raise HTTPException(400, f"Account '{account['name']}' is not connected")

    if body.response_mode and body.response_mode not in RESPONSE_MODES:
        raise HTTPException(400, f"Invalid response_mode. Must be one of: {', '.join(RESPONSE_MODES)}")

    # Check for overlapping routes
    overlaps = await _check_overlap(org_id, bot_id, body.account_id, body.destination)
    if overlaps:
        overlap_names = [o.get("name", o["id"]) for o in overlaps]
        raise HTTPException(
            409,
            f"Overlapping route detected with: {', '.join(overlap_names)}. "
            "Set different destinations or adjust priority."
        )

    now = h._now()
    connection = {
        "id": h._uuid(),
        "org_id": org_id,
        "bot_id": bot_id,
        "account_id": body.account_id,
        "provider": account["provider"],
        "name": body.name.strip(),
        "enabled": body.enabled if body.enabled is not None else True,
        "destination": body.destination,
        "response_mode": body.response_mode or "agent_assist",
        "overrides": body.overrides or {},
        "override_flags": body.override_flags or {},
        "priority": body.priority or 0,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now,
    }
    await h._db.connections.insert_one(connection)
    connection.pop("_id", None)
    connection["account_name"] = account["name"]
    connection["account_provider"] = account["provider"]
    connection["account_status"] = account["status"]
    connection["effective_settings"] = _resolve_settings(bot, connection)
    return connection


@router.get("/{org_id}/bots/{bot_id}/connections/{conn_id}")
async def get_connection(org_id: str, bot_id: str, conn_id: str, request: Request):
    """Get connection details with effective (resolved) settings."""
    user, org, bot = await h.require_bot_access(request, bot_id)
    conn = await h._db.connections.find_one(
        {"id": conn_id, "bot_id": bot_id, "org_id": org_id}, {"_id": 0}
    )
    if not conn:
        raise HTTPException(404, "Connection not found")

    # Enrich
    account = await h._db.connected_accounts.find_one(
        {"id": conn["account_id"]}, {"_id": 0, "credentials": 0}
    ) or {}
    conn["account_name"] = account.get("name", "Unknown")
    conn["account_provider"] = account.get("provider", "unknown")
    conn["account_status"] = account.get("status", "unknown")
    conn["effective_settings"] = _resolve_settings(bot, conn)
    conn["bot_defaults"] = {
        "persona": bot.get("persona", ""),
        "custom_instructions": bot.get("custom_instructions", ""),
        "tone_instructions": bot.get("tone_instructions", ""),
        "knowledge_gate": bot.get("knowledge_gate", "strict"),
    }
    return conn


@router.put("/{org_id}/bots/{bot_id}/connections/{conn_id}")
async def update_connection(org_id: str, bot_id: str, conn_id: str,
                            body: ConnectionUpdate, request: Request):
    """Update a connection's settings."""
    user, org, bot = await h.require_bot_access(request, bot_id)
    conn = await h._db.connections.find_one(
        {"id": conn_id, "bot_id": bot_id, "org_id": org_id}, {"_id": 0}
    )
    if not conn:
        raise HTTPException(404, "Connection not found")

    update = {"updated_at": h._now()}

    if body.response_mode is not None:
        if body.response_mode not in RESPONSE_MODES:
            raise HTTPException(400, f"Invalid response_mode")
        update["response_mode"] = body.response_mode

    if body.destination is not None:
        # Check overlap with new destination
        overlaps = await _check_overlap(
            org_id, bot_id, conn["account_id"], body.destination, exclude_conn_id=conn_id
        )
        if overlaps:
            overlap_names = [o.get("name", o["id"]) for o in overlaps]
            raise HTTPException(409, f"Overlapping route: {', '.join(overlap_names)}")
        update["destination"] = body.destination

    for field in ["name", "priority", "enabled"]:
        val = getattr(body, field, None)
        if val is not None:
            update[field] = val.strip() if isinstance(val, str) else val

    if body.overrides is not None:
        update["overrides"] = body.overrides
    if body.override_flags is not None:
        update["override_flags"] = body.override_flags

    await h._db.connections.update_one({"id": conn_id}, {"$set": update})
    return {"ok": True}


@router.patch("/{org_id}/bots/{bot_id}/connections/{conn_id}/toggle")
async def toggle_connection(org_id: str, bot_id: str, conn_id: str, request: Request):
    """Toggle a connection's enabled state."""
    user, org, bot = await h.require_bot_access(request, bot_id)
    conn = await h._db.connections.find_one(
        {"id": conn_id, "bot_id": bot_id, "org_id": org_id}, {"_id": 0}
    )
    if not conn:
        raise HTTPException(404, "Connection not found")
    new_state = not conn.get("enabled", True)
    await h._db.connections.update_one(
        {"id": conn_id}, {"$set": {"enabled": new_state, "updated_at": h._now()}}
    )
    return {"ok": True, "enabled": new_state}


@router.get("/{org_id}/bots/{bot_id}/connections/{conn_id}/activity")
async def connection_activity(org_id: str, bot_id: str, conn_id: str, request: Request):
    """Get recent conversation activity for a connection."""
    user, org, bot = await h.require_bot_access(request, bot_id)
    conn = await h._db.connections.find_one(
        {"id": conn_id, "bot_id": bot_id, "org_id": org_id}, {"_id": 0}
    )
    if not conn:
        raise HTTPException(404, "Connection not found")

    # Get recent conversations tagged with this connection_id
    legacy_instance_id = bot.get("legacy_instance_id", bot["id"])
    conversations = await h._db.conversations.find(
        {"instance_id": legacy_instance_id, "metadata.connection_id": conn_id},
        {"_id": 0}
    ).sort("updated_at", -1).limit(20).to_list(20)

    # Also get V2 suggestions for agent_assist/internal_note connections
    suggestions = await h._db.v2_suggestions.find(
        {"connection_id": conn_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)

    return {
        "activity": conversations,
        "suggestions": suggestions,
        "connection_id": conn_id,
        "response_mode": conn.get("response_mode", "auto_reply"),
    }
