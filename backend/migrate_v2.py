"""
Migration: v1 (flat instance model) → v2 (Org → Bot → Account → Connection)

SAFE: Non-destructive. Creates new collections alongside existing ones.
Preserves all legacy data. Sets legacy_instance_id on bots for backward
compatibility. Repeatable — skips records that were already migrated.

Run: python3 migrate_v2.py
"""
import asyncio
import os
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger("migrate_v2")


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc).isoformat()


async def migrate():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    log.info("Starting v2 migration...")

    # ── 1. Ensure indexes ──
    await db.organisations.create_index([("id", 1)], unique=True)
    await db.bots.create_index([("id", 1)], unique=True)
    await db.bots.create_index([("org_id", 1)])
    await db.bots.create_index([("legacy_instance_id", 1)], sparse=True)
    await db.connected_accounts.create_index([("id", 1)], unique=True)
    await db.connected_accounts.create_index([("org_id", 1)])
    await db.connections.create_index([("id", 1)], unique=True)
    await db.connections.create_index([("bot_id", 1)])
    await db.connections.create_index([("account_id", 1)])
    await db.connections.create_index([("org_id", 1)])
    log.info("Indexes ensured.")

    # ── 2. Find the platform admin (org owner) ──
    admin = await db.users.find_one({"role": "superadmin"}, {"_id": 0})
    if not admin:
        log.error("No superadmin user found. Cannot create organisation.")
        return {"error": "No superadmin user found"}
    admin_id = admin["id"]
    log.info(f"Admin: {admin.get('username', admin['id'])}")

    # ── 3. Create or find the default organisation ──
    existing_org = await db.organisations.find_one({"owner_id": admin_id})
    if existing_org:
        org_id = existing_org["id"]
        log.info(f"Using existing org: {existing_org['name']} ({org_id})")
    else:
        org_id = _uuid()
        # Gather all assigned users across all instances
        all_member_ids = {admin_id}
        async for inst in db.bot_instances.find({}, {"assigned_user_ids": 1}):
            for uid in inst.get("assigned_user_ids", []):
                all_member_ids.add(uid)

        org = {
            "id": org_id,
            "name": "Default Organisation",
            "description": "Auto-created during migration from v1",
            "owner_id": admin_id,
            "member_ids": list(all_member_ids),
            "member_roles": {admin_id: "admin"},
            "created_at": _now(),
            "updated_at": _now(),
            "migrated_from_v1": True,
        }
        await db.organisations.insert_one(org)
        log.info(f"Created org: Default Organisation ({org_id}) with {len(all_member_ids)} members")

    # ── 4. Migrate bot_instances → bots ──
    stats = {"bots": 0, "accounts": 0, "connections": 0, "skipped": 0}
    instance_to_bot = {}  # old instance_id → new bot_id

    async for instance in db.bot_instances.find({}, {"_id": 0}):
        instance_id = instance["id"]

        # Check if already migrated
        existing_bot = await db.bots.find_one({"legacy_instance_id": instance_id})
        if existing_bot:
            instance_to_bot[instance_id] = existing_bot["id"]
            log.info(f"  Bot already migrated: {instance['name']} → {existing_bot['id']}")
            stats["skipped"] += 1
            continue

        # Get bot_config for this instance
        config = await db.bot_config.find_one({"instance_id": instance_id}, {"_id": 0}) or {}

        bot_id = _uuid()
        bot = {
            "id": bot_id,
            "org_id": org_id,
            "legacy_instance_id": instance_id,
            "name": instance.get("name", "Unnamed Bot"),
            "description": instance.get("description", ""),
            "persona": config.get("persona", ""),
            "custom_instructions": config.get("custom_instructions", ""),
            "tone_instructions": config.get("tone_instructions", ""),
            "manual_tone_examples": config.get("manual_tone_examples", []),
            "knowledge_gate": config.get("knowledge_gate", "strict"),
            "knowledge_gate_pct": config.get("knowledge_gate_pct", 50),
            "fallback_message": config.get("fallback_message", ""),
            "acknowledgment_replies": instance.get("acknowledgment_replies", {}),
            "llm_config": instance.get("llm_config", {"provider": "emergent", "model": None}),
            "api_query_enabled": config.get("api_query_enabled", False),
            "api_base_url": config.get("api_base_url", ""),
            "api_key_header": config.get("api_key_header", ""),
            "api_key_value": config.get("api_key_value", ""),
            "logo_path": config.get("logo_path", ""),
            "logo_content_type": config.get("logo_content_type", ""),
            "created_by": instance.get("created_by", admin_id),
            "created_at": instance.get("created_at", _now()),
            "updated_at": _now(),
        }
        await db.bots.insert_one(bot)
        instance_to_bot[instance_id] = bot_id
        stats["bots"] += 1
        log.info(f"  Migrated bot: {instance['name']} ({instance_id} → {bot_id})")

    # ── 5. Migrate discord_config → connected_account + connection ──
    async for dc in db.discord_config.find({}, {"_id": 0}):
        instance_id = dc.get("instance_id")
        bot_id = instance_to_bot.get(instance_id)
        if not bot_id:
            log.warning(f"  Discord config for unknown instance {instance_id} — skipping")
            stats["skipped"] += 1
            continue

        # Check if already migrated
        existing = await db.connected_accounts.find_one({
            "org_id": org_id, "provider": "discord",
            "metadata.legacy_instance_id": instance_id
        })
        if existing:
            log.info(f"  Discord account already migrated for instance {instance_id}")
            stats["skipped"] += 1
            continue

        # Get platform Discord credentials (these are global, not per-account)
        platform_creds = await db.discord_app_config.find_one({"_id": "discord_app"}) or {}

        account_id = _uuid()
        account = {
            "id": account_id,
            "org_id": org_id,
            "provider": "discord",
            "name": f"Discord Bot ({instance_id[:8]})",
            "status": "connected" if dc.get("oauth_connected") else "disconnected",
            "credentials": {
                "bot_token": platform_creds.get("bot_token", ""),
                "application_id": platform_creds.get("client_id", ""),
            },
            "metadata": {
                "legacy_instance_id": instance_id,
                "listen_mode": dc.get("listen_mode", "all_channels"),
                "passive_mode": dc.get("passive_mode", False),
                "reply_style": dc.get("reply_style", "natural"),
                "scripted_mode": dc.get("scripted_mode", {}),
                "staff_role_name": dc.get("staff_role_name", ""),
                "handoff_cooldown_minutes": dc.get("handoff_cooldown_minutes", 15),
            },
            "created_at": dc.get("created_at", _now()),
            "updated_at": _now(),
        }
        await db.connected_accounts.insert_one(account)
        stats["accounts"] += 1

        # Create a connection
        conn_id = _uuid()
        connection = {
            "id": conn_id,
            "org_id": org_id,
            "bot_id": bot_id,
            "account_id": account_id,
            "provider": "discord",
            "name": f"Discord — {instance_id[:8]}",
            "enabled": dc.get("is_active", False),
            "destination": {
                "guild_id": dc.get("guild_id", ""),
                "guild_name": dc.get("guild_name", ""),
                "channel_ids": dc.get("monitored_channel_ids", []),
                "listen_mode": dc.get("listen_mode", "all_channels"),
            },
            "response_mode": "auto_reply",
            "overrides": {},
            "override_flags": {},
            "priority": 0,
            "legacy_instance_id": instance_id,
            "created_at": _now(),
            "updated_at": _now(),
        }
        await db.connections.insert_one(connection)
        stats["connections"] += 1
        log.info(f"  Discord: account {account_id[:8]} + connection {conn_id[:8]}")

    # ── 6. Migrate telegram_config → connected_account + connection ──
    async for tc in db.telegram_config.find({}, {"_id": 0}):
        instance_id = tc.get("instance_id")
        bot_id = instance_to_bot.get(instance_id)
        if not bot_id:
            log.warning(f"  Telegram config for unknown instance {instance_id} — skipping")
            stats["skipped"] += 1
            continue

        existing = await db.connected_accounts.find_one({
            "org_id": org_id, "provider": "telegram",
            "metadata.legacy_instance_id": instance_id
        })
        if existing:
            log.info(f"  Telegram account already migrated for instance {instance_id}")
            stats["skipped"] += 1
            continue

        account_id = _uuid()
        account = {
            "id": account_id,
            "org_id": org_id,
            "provider": "telegram",
            "name": tc.get("bot_first_name") or tc.get("bot_username") or f"Telegram Bot ({instance_id[:8]})",
            "status": "connected" if tc.get("bot_token") else "disconnected",
            "credentials": {
                "bot_token": tc.get("bot_token", ""),
            },
            "metadata": {
                "legacy_instance_id": instance_id,
                "bot_username": tc.get("bot_username", ""),
                "bot_first_name": tc.get("bot_first_name", ""),
                "bot_id": tc.get("bot_id"),
                "listen_mode": tc.get("listen_mode", "mention_or_command"),
                "webhook_secret": tc.get("webhook_secret", ""),
            },
            "created_at": tc.get("created_at", _now()),
            "updated_at": _now(),
        }
        await db.connected_accounts.insert_one(account)
        stats["accounts"] += 1

        conn_id = _uuid()
        connection = {
            "id": conn_id,
            "org_id": org_id,
            "bot_id": bot_id,
            "account_id": account_id,
            "provider": "telegram",
            "name": f"Telegram — {tc.get('bot_username') or instance_id[:8]}",
            "enabled": tc.get("is_active", False),
            "destination": {
                "listen_mode": tc.get("listen_mode", "mention_or_command"),
            },
            "response_mode": "auto_reply",
            "overrides": {},
            "override_flags": {},
            "priority": 0,
            "legacy_instance_id": instance_id,
            "created_at": _now(),
            "updated_at": _now(),
        }
        await db.connections.insert_one(connection)
        stats["connections"] += 1
        log.info(f"  Telegram: account {account_id[:8]} + connection {conn_id[:8]}")

    # ── 7. Migrate zendesk_config → connected_account + connection ──
    async for zc in db.zendesk_config.find({}, {"_id": 0}):
        instance_id = zc.get("instance_id")
        bot_id = instance_to_bot.get(instance_id)
        if not bot_id:
            log.warning(f"  Zendesk config for unknown instance {instance_id} — skipping")
            stats["skipped"] += 1
            continue

        existing = await db.connected_accounts.find_one({
            "org_id": org_id, "provider": "zendesk",
            "metadata.legacy_instance_id": instance_id
        })
        if existing:
            log.info(f"  Zendesk account already migrated for instance {instance_id}")
            stats["skipped"] += 1
            continue

        subdomain = zc.get("subdomain", "")
        account_id = _uuid()
        account = {
            "id": account_id,
            "org_id": org_id,
            "provider": "zendesk",
            "name": f"Zendesk — {subdomain}" if subdomain else f"Zendesk ({instance_id[:8]})",
            "status": "connected" if (zc.get("oauth_access_token") or zc.get("api_token")) else "disconnected",
            "credentials": {
                "subdomain": subdomain,
                "auth_type": zc.get("auth_type", "oauth"),
                "oauth_access_token": zc.get("oauth_access_token", ""),
                "oauth_refresh_token": zc.get("oauth_refresh_token", ""),
                "oauth_token_expires_at": zc.get("oauth_token_expires_at", ""),
                "api_token": zc.get("api_token", ""),
                "user_email": zc.get("zendesk_user_email", ""),
                "sidebar_api_key": zc.get("sidebar_api_key", ""),
                "webhook_secret": zc.get("webhook_secret", ""),
            },
            "metadata": {
                "legacy_instance_id": instance_id,
                "zendesk_user_name": zc.get("zendesk_user_name", ""),
                "zendesk_user_email": zc.get("zendesk_user_email", ""),
                "zendesk_user_role": zc.get("zendesk_user_role", ""),
                "oauth_needs_reauth": zc.get("oauth_needs_reauth", False),
            },
            "created_at": zc.get("created_at", _now()),
            "updated_at": _now(),
        }
        await db.connected_accounts.insert_one(account)
        stats["accounts"] += 1

        # Determine response mode from flags
        if zc.get("auto_reply_enabled"):
            response_mode = "auto_reply"
        elif zc.get("agent_assist_enabled"):
            response_mode = "internal_note"
        else:
            response_mode = "sidebar_only"

        conn_id = _uuid()
        connection = {
            "id": conn_id,
            "org_id": org_id,
            "bot_id": bot_id,
            "account_id": account_id,
            "provider": "zendesk",
            "name": f"Zendesk — {subdomain}" if subdomain else f"Zendesk ({instance_id[:8]})",
            "enabled": zc.get("is_active", False),
            "destination": {
                "subdomain": subdomain,
                "ticket_group": "",
                "ticket_tags": [],
            },
            "response_mode": response_mode,
            "overrides": {},
            "override_flags": {},
            "priority": 0,
            "legacy_instance_id": instance_id,
            "created_at": _now(),
            "updated_at": _now(),
        }
        await db.connections.insert_one(connection)
        stats["connections"] += 1
        log.info(f"  Zendesk: account {account_id[:8]} + connection {conn_id[:8]} (mode={response_mode})")

    # ── 8. Update user records with org_ids ──
    member_ids = []
    org_doc = await db.organisations.find_one({"id": org_id}, {"member_ids": 1})
    if org_doc:
        member_ids = org_doc.get("member_ids", [])
    for uid in member_ids:
        await db.users.update_one(
            {"id": uid},
            {"$addToSet": {"org_ids": org_id}}
        )

    log.info(f"\nMigration complete!")
    log.info(f"  Bots created:        {stats['bots']}")
    log.info(f"  Accounts created:    {stats['accounts']}")
    log.info(f"  Connections created:  {stats['connections']}")
    log.info(f"  Skipped (existing):   {stats['skipped']}")
    log.info(f"  Org ID:              {org_id}")

    client.close()
    return stats


if __name__ == "__main__":
    asyncio.run(migrate())
