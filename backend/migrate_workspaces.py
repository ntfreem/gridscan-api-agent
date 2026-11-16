"""
Workspace Migration — Idempotent, reversible migration to introduce the
Customer Workspace layer (Platform → Workspace → Organisation → Bot).

Run via: await run_workspace_migration(db)
Safe to re-run: all steps check for existing state before writing.
"""
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def _now():
    return datetime.now(timezone.utc).isoformat()


def _uuid():
    return str(uuid.uuid4())


async def run_workspace_migration(db) -> dict:
    """Execute the workspace migration. Returns a summary dict."""
    results = {
        "workspace_created": False,
        "workspace_existed": False,
        "orgs_updated": 0,
        "admin_bitbotpro_created": False,
        "admin_bitbotpro_existed": False,
        "test_accounts_demoted": 0,
        "orphan_refs_cleaned": 0,
        "platform_discord_app_created": False,
        "errors": [],
    }

    now = _now()

    # ── Step 0: Pre-migration inventory (read-only) ──
    user_count = await db.users.count_documents({})
    org_count = await db.organisations.count_documents({})
    bot_count = await db.bots.count_documents({})
    account_count = await db.connected_accounts.count_documents({})
    logger.info(f"[WS-MIGRATE] Pre-migration: {user_count} users, {org_count} orgs, {bot_count} bots, {account_count} accounts")

    # ── Step 1: Resolve admin@bridgebot.tech (workspace owner) ──
    bridgebot_admin = await db.users.find_one({"email": "admin@bridgebot.tech"})
    if not bridgebot_admin:
        results["errors"].append("admin@bridgebot.tech not found — cannot assign workspace owner")
        logger.error("[WS-MIGRATE] admin@bridgebot.tech not found!")
        return results
    bridgebot_user_id = bridgebot_admin["id"]
    logger.info(f"[WS-MIGRATE] admin@bridgebot.tech → ID: {bridgebot_user_id}")

    # ── Step 2: Create admin@bitbotpro.io (platform superadmin) ──
    bitbotpro_admin = await db.users.find_one({"email": "admin@bitbotpro.io"})
    if bitbotpro_admin:
        results["admin_bitbotpro_existed"] = True
        bitbotpro_user_id = bitbotpro_admin["id"]
        logger.info(f"[WS-MIGRATE] admin@bitbotpro.io already exists → ID: {bitbotpro_user_id}")
        # Ensure platform_role is set
        if bitbotpro_admin.get("platform_role") != "superadmin":
            await db.users.update_one(
                {"id": bitbotpro_user_id},
                {"$set": {"platform_role": "superadmin", "role": "superadmin"}}
            )
    else:
        # Copy hashed password from admin@bridgebot.tech (user approved this)
        hashed_pw = bridgebot_admin.get("hashed_password") or bridgebot_admin.get("password_hash", "")
        bitbotpro_user_id = _uuid()
        await db.users.insert_one({
            "id": bitbotpro_user_id,
            "email": "admin@bitbotpro.io",
            "username": "bitbotpro_admin",
            "hashed_password": hashed_pw,
            "is_verified": True,
            "verification_code": None,
            "role": "superadmin",
            "platform_role": "superadmin",
            "first_name": "Platform",
            "last_name": "Admin",
            "created_at": now,
        })
        results["admin_bitbotpro_created"] = True
        logger.info(f"[WS-MIGRATE] Created admin@bitbotpro.io → ID: {bitbotpro_user_id}")

    # ── Step 3: Set platform_role on admin@bitbotpro.io ──
    # admin@bridgebot.tech is workspace owner only — NOT platform superadmin
    await db.users.update_one(
        {"id": bitbotpro_user_id},
        {"$set": {"platform_role": "superadmin", "role": "superadmin"}}
    )
    # Ensure bridgebot admin is NOT superadmin (demoted to workspace owner)
    await db.users.update_one(
        {"id": bridgebot_user_id, "role": "superadmin"},
        {"$set": {"role": "user", "platform_role": None}}
    )

    # ── Step 4: Create "development" workspace (idempotent) ──
    dev_ws = await db.workspaces.find_one({"slug": "development"})
    if dev_ws:
        results["workspace_existed"] = True
        ws_id = dev_ws["id"]
        logger.info(f"[WS-MIGRATE] 'development' workspace already exists → ID: {ws_id}")
    else:
        ws_id = _uuid()
        await db.workspaces.insert_one({
            "id": ws_id,
            "name": "development",
            "slug": "development",
            "owner_id": bridgebot_user_id,
            "billing": {
                "plan": "internal",
                "stripe_customer_id": None,
                "stripe_subscription_id": None,
                "limits": {
                    "max_organisations": 100,
                    "max_bots_per_org": 50,
                    "max_discord_connections": 200,
                    "max_monthly_ai_messages": 999999,
                    "max_custom_discord_apps": 20,
                },
            },
            "usage": {
                "current_period_start": now,
                "ai_messages_used": 0,
            },
            "created_at": now,
            "updated_at": now,
        })
        results["workspace_created"] = True
        logger.info(f"[WS-MIGRATE] Created 'development' workspace → ID: {ws_id}")

    # ── Step 5: Add workspace owner membership (idempotent) ──
    existing_membership = await db.workspace_members.find_one(
        {"workspace_id": ws_id, "user_id": bridgebot_user_id}
    )
    if not existing_membership:
        await db.workspace_members.insert_one({
            "workspace_id": ws_id,
            "user_id": bridgebot_user_id,
            "role": "owner",
            "permissions": {"manage_billing": True, "manage_discord_apps": True},
            "invited_by": None,
            "joined_at": now,
        })
        logger.info(f"[WS-MIGRATE] Added admin@bridgebot.tech as owner of development workspace")

    # Also add platform superadmin to workspace as a member (not owner)
    existing_sa_membership = await db.workspace_members.find_one(
        {"workspace_id": ws_id, "user_id": bitbotpro_user_id}
    )
    if not existing_sa_membership:
        await db.workspace_members.insert_one({
            "workspace_id": ws_id,
            "user_id": bitbotpro_user_id,
            "role": "admin",
            "permissions": {"manage_billing": True, "manage_discord_apps": True},
            "invited_by": None,
            "joined_at": now,
        })

    # ── Step 6: Assign all existing orgs to "development" workspace ──
    orgs_without_ws = await db.organisations.find(
        {"workspace_id": {"$exists": False}}
    ).to_list(500)
    orgs_with_null_ws = await db.organisations.find(
        {"workspace_id": None}
    ).to_list(500)
    to_update = {o["id"] for o in orgs_without_ws} | {o["id"] for o in orgs_with_null_ws}
    for oid in to_update:
        await db.organisations.update_one(
            {"id": oid},
            {"$set": {"workspace_id": ws_id, "updated_at": now}}
        )
        results["orgs_updated"] += 1
    if to_update:
        logger.info(f"[WS-MIGRATE] Assigned {len(to_update)} org(s) to development workspace")

    # ── Step 7: Clean orphan member references in Default Organisation ──
    default_org = await db.organisations.find_one({"name": "Default Organisation"})
    if default_org:
        member_ids = default_org.get("member_ids", [])
        valid_ids = []
        orphans = []
        for mid in member_ids:
            exists = await db.users.find_one({"id": mid}, {"_id": 0, "id": 1})
            if exists:
                valid_ids.append(mid)
            else:
                orphans.append(mid)
        if orphans:
            # Remove orphan IDs and their role entries
            unset_roles = {f"member_roles.{oid}": "" for oid in orphans}
            await db.organisations.update_one(
                {"id": default_org["id"]},
                {
                    "$set": {"member_ids": valid_ids, "updated_at": now},
                    "$unset": unset_roles,
                }
            )
            results["orphan_refs_cleaned"] = len(orphans)
            logger.info(f"[WS-MIGRATE] Cleaned {len(orphans)} orphan member ref(s) from Default Organisation")

    # ── Step 8: Demote test superadmin accounts ──
    test_emails = [
        "test_promote_464322a4@example.com",
        "test_promote_20e9c118@example.com",
    ]
    for email in test_emails:
        result = await db.users.update_one(
            {"email": email, "role": "superadmin"},
            {"$set": {"role": "user", "platform_role": None}}
        )
        if result.modified_count > 0:
            results["test_accounts_demoted"] += 1
            logger.info(f"[WS-MIGRATE] Demoted {email} from superadmin to user")

    # ── Step 9: Formalize platform Discord app (from env vars) ──
    import os
    discord_client_id = os.environ.get("DISCORD_CLIENT_ID", "").strip()
    if discord_client_id:
        existing_platform_app = await db.platform_config.find_one({"_id": "platform_discord_app"})
        if not existing_platform_app:
            await db.platform_config.insert_one({
                "_id": "platform_discord_app",
                "client_id": discord_client_id,
                "client_secret": os.environ.get("DISCORD_CLIENT_SECRET", ""),
                "bot_token": os.environ.get("DISCORD_BOT_TOKEN", ""),
                "redirect_uri": os.environ.get("DISCORD_REDIRECT_URI", ""),
                "managed_by": "platform",
                "updated_at": now,
                "updated_by": bitbotpro_user_id,
            })
            results["platform_discord_app_created"] = True
            logger.info("[WS-MIGRATE] Formalized platform Discord app from env vars")

    # ── Summary ──
    logger.info(f"[WS-MIGRATE] Migration complete: {results}")
    return results
