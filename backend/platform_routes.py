"""
Platform Admin routes — /api/v2/platform
Superadmin-only endpoints for cross-org management.
"""
from fastapi import APIRouter, Request, HTTPException

import v2_helpers as h

router = APIRouter(prefix="/v2/platform", tags=["v2-platform-admin"])


async def _require_superadmin(request: Request):
    user = await h._authed_user(request)
    if user.get("role") != "superadmin":
        raise HTTPException(403, "Superadmin access required")
    return user


# ── Platform Stats ──

@router.get("/stats")
async def platform_stats(request: Request):
    """High-level platform stats for admin dashboards."""
    await _require_superadmin(request)

    org_count = await h._db.organisations.count_documents({})
    bot_count = await h._db.bots.count_documents({})
    account_count = await h._db.connected_accounts.count_documents({})
    connection_count = await h._db.connections.count_documents({})
    user_count = await h._db.users.count_documents({})
    suggestion_count = await h._db.v2_suggestions.count_documents({})

    # Connection breakdown by provider
    pipeline = [
        {"$group": {"_id": "$provider", "count": {"$sum": 1}}},
    ]
    provider_breakdown = {}
    async for doc in h._db.connections.aggregate(pipeline):
        provider_breakdown[doc["_id"]] = doc["count"]

    # Connection breakdown by response_mode
    mode_pipeline = [
        {"$group": {"_id": "$response_mode", "count": {"$sum": 1}}},
    ]
    mode_breakdown = {}
    async for doc in h._db.connections.aggregate(mode_pipeline):
        mode_breakdown[doc["_id"]] = doc["count"]

    return {
        "orgs": org_count,
        "bots": bot_count,
        "accounts": account_count,
        "connections": connection_count,
        "users": user_count,
        "suggestions": suggestion_count,
        "provider_breakdown": provider_breakdown,
        "mode_breakdown": mode_breakdown,
    }


# ── Workspaces (Orgs) Admin View ──

@router.get("/workspaces")
async def list_all_workspaces(request: Request):
    """List all organisations with stats for platform admin."""
    await _require_superadmin(request)

    orgs = await h._db.organisations.find({}, {"_id": 0}).sort("name", 1).to_list(500)

    # Enrich with bot/account/connection counts
    for org in orgs:
        org_id = org["id"]
        org["bot_count"] = await h._db.bots.count_documents({"org_id": org_id})
        org["account_count"] = await h._db.connected_accounts.count_documents({"org_id": org_id})
        org["connection_count"] = await h._db.connections.count_documents({"org_id": org_id})
        org["member_count"] = len(org.get("member_ids", []))

    return {"workspaces": orgs}


@router.get("/workspaces/{org_id}/detail")
async def workspace_detail(org_id: str, request: Request):
    """Detailed view of a workspace: members, bots, accounts."""
    await _require_superadmin(request)

    org = await h._db.organisations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(404, "Organisation not found")

    bots = await h._db.bots.find({"org_id": org_id}, {"_id": 0}).to_list(100)
    accounts = await h._db.connected_accounts.find(
        {"org_id": org_id}, {"_id": 0, "id": 1, "provider": 1, "name": 1, "status": 1}
    ).to_list(100)

    # Get member details
    member_ids = org.get("member_ids", [])
    members = []
    if member_ids:
        users = await h._db.users.find(
            {"id": {"$in": member_ids}},
            {"_id": 0, "id": 1, "username": 1, "email": 1, "role": 1}
        ).to_list(100)
        member_roles = org.get("member_roles", {})
        for u in users:
            u["org_role"] = member_roles.get(u["id"], "member")
        members = users

    return {
        "org": org,
        "bots": bots,
        "accounts": accounts,
        "members": members,
    }


# ── Provider Apps ──

@router.get("/provider-apps")
async def list_provider_apps(request: Request):
    """List provider app configurations across the platform."""
    await _require_superadmin(request)

    # Count accounts by provider and status
    pipeline = [
        {"$group": {
            "_id": {"provider": "$provider", "status": "$status"},
            "count": {"$sum": 1},
        }},
    ]
    provider_stats = {}
    async for doc in h._db.connected_accounts.aggregate(pipeline):
        prov = doc["_id"]["provider"]
        status = doc["_id"]["status"]
        if prov not in provider_stats:
            provider_stats[prov] = {"connected": 0, "disconnected": 0, "error": 0, "total": 0}
        provider_stats[prov][status] = provider_stats[prov].get(status, 0) + doc["count"]
        provider_stats[prov]["total"] += doc["count"]

    # Count connections by provider
    conn_pipeline = [
        {"$group": {
            "_id": {"provider": "$provider", "enabled": "$enabled"},
            "count": {"$sum": 1},
        }},
    ]
    conn_stats = {}
    async for doc in h._db.connections.aggregate(conn_pipeline):
        prov = doc["_id"]["provider"]
        enabled = doc["_id"]["enabled"]
        if prov not in conn_stats:
            conn_stats[prov] = {"enabled": 0, "disabled": 0, "total": 0}
        key = "enabled" if enabled else "disabled"
        conn_stats[prov][key] = doc["count"]
        conn_stats[prov]["total"] += doc["count"]

    # Get provider-specific app configurations
    discord_app = await h._db.provider_apps.find_one({"provider": "discord"}, {"_id": 0})
    telegram_app = await h._db.provider_apps.find_one({"provider": "telegram"}, {"_id": 0})
    zendesk_app = await h._db.provider_apps.find_one({"provider": "zendesk"}, {"_id": 0})

    providers = []
    for prov_key, label in [("discord", "Discord"), ("telegram", "Telegram"), ("zendesk", "Zendesk")]:
        acct_stats = provider_stats.get(prov_key, {"connected": 0, "disconnected": 0, "total": 0})
        c_stats = conn_stats.get(prov_key, {"enabled": 0, "disabled": 0, "total": 0})
        providers.append({
            "provider": prov_key,
            "label": label,
            "accounts": acct_stats,
            "connections": c_stats,
        })

    return {
        "providers": providers,
        "apps": {
            "discord": discord_app,
            "telegram": telegram_app,
            "zendesk": zendesk_app,
        },
    }
