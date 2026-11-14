"""
Organisation routes — /api/v2/orgs
CRUD for organisations, membership management.
"""
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional, List

import v2_helpers as h

router = APIRouter(prefix="/v2/orgs", tags=["v2-organisations"])


# ── Models ──

class OrgCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class OrgUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class AddMember(BaseModel):
    user_id: str
    role: Optional[str] = "member"  # member | admin


# ── Endpoints ──

@router.get("")
async def list_orgs(request: Request):
    """List organisations the current user belongs to."""
    user = await h._authed_user(request)
    query = {}
    if user.get("role") != "superadmin":
        query = {"member_ids": user["id"]}
    orgs = await h._db.organisations.find(query, {"_id": 0}).sort("name", 1).to_list(100)
    # Attach bot count for each org
    for org in orgs:
        org["bot_count"] = await h._db.bots.count_documents({"org_id": org["id"]})
        org["member_count"] = len(org.get("member_ids", []))
        org["account_count"] = await h._db.connected_accounts.count_documents({"org_id": org["id"]})
    return {"organisations": orgs}


@router.post("")
async def create_org(body: OrgCreate, request: Request):
    """Create a new organisation. The creator becomes the owner."""
    user = await h._authed_user(request)
    org = {
        "id": h._uuid(),
        "name": body.name.strip(),
        "description": (body.description or "").strip(),
        "owner_id": user["id"],
        "member_ids": [user["id"]],
        "member_roles": {user["id"]: "admin"},
        "created_at": h._now(),
        "updated_at": h._now(),
    }
    await h._db.organisations.insert_one(org)
    org.pop("_id", None)
    return org


@router.get("/{org_id}")
async def get_org(org_id: str, request: Request):
    """Get organisation detail."""
    user, org = await h.require_org_member(request)
    org["bot_count"] = await h._db.bots.count_documents({"org_id": org["id"]})
    org["member_count"] = len(org.get("member_ids", []))
    org["account_count"] = await h._db.connected_accounts.count_documents({"org_id": org["id"]})
    return org


@router.put("/{org_id}")
async def update_org(org_id: str, body: OrgUpdate, request: Request):
    """Update organisation name/description."""
    user, org = await h.require_org_admin(request)
    update = {"updated_at": h._now()}
    if body.name is not None:
        update["name"] = body.name.strip()
    if body.description is not None:
        update["description"] = body.description.strip()
    await h._db.organisations.update_one({"id": org_id}, {"$set": update})
    return {"ok": True}


@router.get("/{org_id}/members")
async def list_members(org_id: str, request: Request):
    """List organisation members with roles."""
    user, org = await h.require_org_member(request)
    member_ids = org.get("member_ids", [])
    member_roles = org.get("member_roles", {})
    users = await h._db.users.find(
        {"id": {"$in": member_ids}},
        {"_id": 0, "password_hash": 0, "hashed_password": 0, "verification_code": 0}
    ).to_list(500)
    for u in users:
        u["org_role"] = member_roles.get(u["id"], "member")
        u["is_owner"] = u["id"] == org.get("owner_id")
    return {"members": users}


@router.post("/{org_id}/members")
async def add_member(org_id: str, body: AddMember, request: Request):
    """Add a user to the organisation."""
    user, org = await h.require_org_admin(request)
    target = await h._db.users.find_one({"id": body.user_id}, {"_id": 0})
    if not target:
        raise h.HTTPException(404, "User not found")
    if body.user_id in org.get("member_ids", []):
        raise h.HTTPException(409, "User is already a member")
    await h._db.organisations.update_one(
        {"id": org_id},
        {
            "$addToSet": {"member_ids": body.user_id},
            "$set": {
                f"member_roles.{body.user_id}": body.role or "member",
                "updated_at": h._now(),
            },
        },
    )
    return {"ok": True, "message": f"{target.get('username', target['id'])} added"}


@router.delete("/{org_id}/members/{member_id}")
async def remove_member(org_id: str, member_id: str, request: Request):
    """Remove a member from the organisation."""
    user, org = await h.require_org_admin(request)
    if member_id == org.get("owner_id"):
        raise h.HTTPException(400, "Cannot remove the organisation owner")
    if member_id not in org.get("member_ids", []):
        raise h.HTTPException(404, "User is not a member")
    await h._db.organisations.update_one(
        {"id": org_id},
        {
            "$pull": {"member_ids": member_id},
            "$unset": {f"member_roles.{member_id}": ""},
            "$set": {"updated_at": h._now()},
        },
    )
    return {"ok": True}


@router.patch("/{org_id}/members/{member_id}/role")
async def update_member_role(org_id: str, member_id: str, body: AddMember, request: Request):
    """Change a member's org role."""
    user, org = await h.require_org_admin(request)
    if member_id not in org.get("member_ids", []):
        raise h.HTTPException(404, "User is not a member")
    if member_id == org.get("owner_id") and body.role != "admin":
        raise h.HTTPException(400, "Cannot demote the owner")
    await h._db.organisations.update_one(
        {"id": org_id},
        {"$set": {f"member_roles.{member_id}": body.role, "updated_at": h._now()}},
    )
    return {"ok": True}


# ── Org-scoped Dashboard ──

@router.get("/{org_id}/overview")
async def org_overview(org_id: str, request: Request):
    """Aggregated dashboard data for an organisation — bots, connections,
    conversations, knowledge sources, suggestions, and recent activity."""
    user, org = await h.require_org_member(request)

    # Counts
    bots = await h._db.bots.find({"org_id": org_id}, {"_id": 0}).to_list(100)
    bot_ids = [b["id"] for b in bots]
    legacy_ids = [b.get("legacy_instance_id", b["id"]) for b in bots]

    account_count = await h._db.connected_accounts.count_documents({"org_id": org_id})
    connection_count = await h._db.connections.count_documents({"org_id": org_id})
    active_connections = await h._db.connections.count_documents({"org_id": org_id, "enabled": True})
    suggestion_count = await h._db.v2_suggestions.count_documents({"bot_id": {"$in": bot_ids}})
    pending_suggestions = await h._db.v2_suggestions.count_documents({"bot_id": {"$in": bot_ids}, "status": "pending"})

    # Conversation stats across all bots in the org
    total_conversations = 0
    total_messages = 0
    knowledge_sources = 0
    platform_breakdown = {}
    recent_conversations = []

    for lid in legacy_ids:
        conv_count = await h._db.conversations.count_documents({"instance_id": lid})
        total_conversations += conv_count

        # KB sources
        kb_count = await h._db.knowledge_base.count_documents({"instance_id": lid})
        knowledge_sources += kb_count

    # Platform breakdown and message count
    if legacy_ids:
        pipeline = [
            {"$match": {"instance_id": {"$in": legacy_ids}}},
            {"$group": {
                "_id": "$platform",
                "count": {"$sum": 1},
                "messages": {"$sum": {"$size": {"$ifNull": ["$messages", []]}}},
            }},
        ]
        async for doc in h._db.conversations.aggregate(pipeline):
            plat = doc["_id"] or "web"
            platform_breakdown[plat] = doc["count"]
            total_messages += doc["messages"]

        # Recent conversations (last 8 across all bots)
        recent = await h._db.conversations.find(
            {"instance_id": {"$in": legacy_ids}},
            {"_id": 0, "session_id": 1, "platform": 1, "created_at": 1,
             "updated_at": 1, "messages": 1, "instance_id": 1}
        ).sort("updated_at", -1).limit(8).to_list(8)

        # Attach bot name to each conversation
        lid_to_bot = {}
        for b in bots:
            lid = b.get("legacy_instance_id", b["id"])
            lid_to_bot[lid] = b["name"]

        for conv in recent:
            conv["bot_name"] = lid_to_bot.get(conv.get("instance_id"), "Unknown")
            conv["message_count"] = len(conv.pop("messages", []))
        recent_conversations = recent

    # Connection breakdown by provider
    conn_pipeline = [
        {"$match": {"org_id": org_id}},
        {"$group": {"_id": "$provider", "total": {"$sum": 1},
                    "active": {"$sum": {"$cond": ["$enabled", 1, 0]}}}},
    ]
    provider_breakdown = {}
    async for doc in h._db.connections.aggregate(conn_pipeline):
        provider_breakdown[doc["_id"]] = {"total": doc["total"], "active": doc["active"]}

    # Connection breakdown by response_mode
    mode_pipeline = [
        {"$match": {"org_id": org_id}},
        {"$group": {"_id": "$response_mode", "count": {"$sum": 1}}},
    ]
    mode_breakdown = {}
    async for doc in h._db.connections.aggregate(mode_pipeline):
        mode_breakdown[doc["_id"]] = doc["count"]

    # Per-bot summary
    bot_summaries = []
    for b in bots:
        lid = b.get("legacy_instance_id", b["id"])
        bot_conns = await h._db.connections.count_documents({"bot_id": b["id"], "enabled": True})
        bot_convos = await h._db.conversations.count_documents({"instance_id": lid})
        bot_kb = await h._db.knowledge_base.count_documents({"instance_id": lid})
        bot_summaries.append({
            "id": b["id"], "name": b["name"],
            "active_connections": bot_conns, "conversations": bot_convos,
            "knowledge_sources": bot_kb,
        })

    return {
        "org": {"id": org["id"], "name": org["name"]},
        "bots": len(bots),
        "accounts": account_count,
        "connections": connection_count,
        "active_connections": active_connections,
        "total_conversations": total_conversations,
        "total_messages": total_messages,
        "knowledge_sources": knowledge_sources,
        "suggestions": suggestion_count,
        "pending_suggestions": pending_suggestions,
        "platform_breakdown": platform_breakdown,
        "provider_breakdown": provider_breakdown,
        "mode_breakdown": mode_breakdown,
        "bot_summaries": bot_summaries,
        "recent_conversations": recent_conversations,
    }
