"""
Workspace routes — /api/v2/workspaces
CRUD for customer workspaces + member management + billing + Discord apps.
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List

import v2_helpers as h

router = APIRouter(prefix="/v2/workspaces", tags=["v2-workspaces"])


# ── Models ──

class WorkspaceCreate(BaseModel):
    name: str
    slug: Optional[str] = None


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None


class WorkspaceMemberAdd(BaseModel):
    user_id: str
    role: Optional[str] = "admin"  # admin (owner is set via transfer)
    permissions: Optional[dict] = None


class WorkspaceMemberRoleUpdate(BaseModel):
    role: str  # admin only (owner via transfer endpoint)
    permissions: Optional[dict] = None


class WorkspaceBillingUpdate(BaseModel):
    plan: Optional[str] = None
    limits: Optional[dict] = None


class WorkspaceDiscordAppCreate(BaseModel):
    name: str
    client_id: str
    client_secret: str
    bot_token: str
    redirect_uri: Optional[str] = ""
    allowed_org_ids: Optional[List[str]] = []


class WorkspaceDiscordAppUpdate(BaseModel):
    name: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    bot_token: Optional[str] = None
    redirect_uri: Optional[str] = None
    allowed_org_ids: Optional[List[str]] = None


# ── Endpoints: Workspace CRUD ──

@router.get("")
async def list_workspaces(request: Request):
    """List workspaces the current user belongs to."""
    user = await h._authed_user(request)
    if h._is_platform_superadmin(user):
        workspaces = await h._db.workspaces.find({}, {"_id": 0}).sort("name", 1).to_list(100)
    else:
        memberships = await h._db.workspace_members.find(
            {"user_id": user["id"]}, {"_id": 0, "workspace_id": 1}
        ).to_list(100)
        ws_ids = [m["workspace_id"] for m in memberships]
        if not ws_ids:
            return {"workspaces": []}
        workspaces = await h._db.workspaces.find(
            {"id": {"$in": ws_ids}}, {"_id": 0}
        ).sort("name", 1).to_list(100)
    # Enrich with counts
    for ws in workspaces:
        ws["org_count"] = await h._db.organisations.count_documents({"workspace_id": ws["id"]})
        ws["member_count"] = await h._db.workspace_members.count_documents({"workspace_id": ws["id"]})
    return {"workspaces": workspaces}


@router.post("")
async def create_workspace(body: WorkspaceCreate, request: Request):
    """Create a new workspace. The creator becomes the workspace owner."""
    user = await h._authed_user(request)
    slug = (body.slug or body.name).strip().lower().replace(" ", "-")
    # Check slug uniqueness
    existing = await h._db.workspaces.find_one({"slug": slug})
    if existing:
        raise HTTPException(409, f"Workspace with slug '{slug}' already exists")
    now = h._now()
    ws = {
        "id": h._uuid(),
        "name": body.name.strip(),
        "slug": slug,
        "owner_id": user["id"],
        "billing": {
            "plan": "free",
            "stripe_customer_id": None,
            "stripe_subscription_id": None,
            "limits": {
                "max_organisations": 3,
                "max_bots_per_org": 3,
                "max_discord_connections": 10,
                "max_monthly_ai_messages": 1000,
                "max_custom_discord_apps": 1,
            },
        },
        "usage": {
            "current_period_start": now,
            "ai_messages_used": 0,
        },
        "created_at": now,
        "updated_at": now,
    }
    await h._db.workspaces.insert_one(ws)
    # Add creator as workspace owner
    await h._db.workspace_members.insert_one({
        "workspace_id": ws["id"],
        "user_id": user["id"],
        "role": "owner",
        "permissions": {"manage_billing": True, "manage_discord_apps": True},
        "invited_by": None,
        "joined_at": now,
    })
    ws.pop("_id", None)
    return ws


@router.get("/{ws_id}")
async def get_workspace(ws_id: str, request: Request):
    """Get workspace detail."""
    user, ws = await h.require_workspace_member(request, ws_id)
    ws["org_count"] = await h._db.organisations.count_documents({"workspace_id": ws["id"]})
    ws["member_count"] = await h._db.workspace_members.count_documents({"workspace_id": ws["id"]})
    return ws


@router.put("/{ws_id}")
async def update_workspace(ws_id: str, body: WorkspaceUpdate, request: Request):
    """Update workspace name."""
    user, ws = await h.require_workspace_admin(request, ws_id)
    update = {"updated_at": h._now()}
    if body.name is not None:
        update["name"] = body.name.strip()
    await h._db.workspaces.update_one({"id": ws_id}, {"$set": update})
    return {"ok": True}


@router.delete("/{ws_id}")
async def delete_workspace(ws_id: str, request: Request):
    """Delete a workspace. Only workspace owner or platform superadmin."""
    user, ws = await h.require_workspace_owner(request, ws_id)
    # Check for remaining orgs
    org_count = await h._db.organisations.count_documents({"workspace_id": ws_id})
    if org_count > 0:
        raise HTTPException(
            400,
            f"Cannot delete workspace with {org_count} organisation(s). Delete or move them first."
        )
    await h._db.workspace_members.delete_many({"workspace_id": ws_id})
    await h._db.workspace_discord_apps.delete_many({"workspace_id": ws_id})
    await h._db.workspaces.delete_one({"id": ws_id})
    return {"ok": True}


# ── Endpoints: Workspace Members ──

@router.get("/{ws_id}/members")
async def list_workspace_members(ws_id: str, request: Request):
    """List workspace members with roles."""
    user, ws = await h.require_workspace_member(request, ws_id)
    members = await h._db.workspace_members.find(
        {"workspace_id": ws_id}, {"_id": 0}
    ).to_list(500)
    # Enrich with user details
    user_ids = [m["user_id"] for m in members]
    users = await h._db.users.find(
        {"id": {"$in": user_ids}},
        {"_id": 0, "hashed_password": 0, "password_hash": 0, "verification_code": 0}
    ).to_list(500)
    user_map = {u["id"]: u for u in users}
    for m in members:
        u = user_map.get(m["user_id"], {})
        m["email"] = u.get("email", "")
        m["username"] = u.get("username", "")
        m["first_name"] = u.get("first_name", "")
        m["last_name"] = u.get("last_name", "")
        m["is_owner"] = m["role"] == "owner"
    return {"members": members}


@router.post("/{ws_id}/members")
async def add_workspace_member(ws_id: str, body: WorkspaceMemberAdd, request: Request):
    """Add a user to the workspace."""
    user, ws = await h.require_workspace_admin(request, ws_id)
    target = await h._db.users.find_one({"id": body.user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "User not found")
    # Cannot assign owner role via this endpoint (use transfer)
    if body.role == "owner":
        raise HTTPException(400, "Use the ownership transfer endpoint to assign owner role")
    existing = await h.get_workspace_membership(ws_id, body.user_id)
    if existing:
        raise HTTPException(409, "User is already a workspace member")
    await h._db.workspace_members.insert_one({
        "workspace_id": ws_id,
        "user_id": body.user_id,
        "role": body.role or "admin",
        "permissions": body.permissions or {"manage_billing": False, "manage_discord_apps": False},
        "invited_by": user["id"],
        "joined_at": h._now(),
    })
    return {"ok": True, "message": f"{target.get('username', target['id'])} added to workspace"}


@router.delete("/{ws_id}/members/{member_id}")
async def remove_workspace_member(ws_id: str, member_id: str, request: Request):
    """Remove a member from the workspace."""
    user, ws = await h.require_workspace_admin(request, ws_id)
    if member_id == ws.get("owner_id"):
        raise HTTPException(400, "Cannot remove the workspace owner. Transfer ownership first.")
    existing = await h.get_workspace_membership(ws_id, member_id)
    if not existing:
        raise HTTPException(404, "User is not a workspace member")
    await h._db.workspace_members.delete_one({"workspace_id": ws_id, "user_id": member_id})
    return {"ok": True}


@router.patch("/{ws_id}/members/{member_id}/role")
async def update_workspace_member_role(ws_id: str, member_id: str, body: WorkspaceMemberRoleUpdate, request: Request):
    """Change a workspace member's role."""
    user, ws = await h.require_workspace_owner(request, ws_id)
    if member_id == ws.get("owner_id") and body.role != "owner":
        raise HTTPException(400, "Cannot demote the workspace owner. Transfer ownership first.")
    if body.role == "owner":
        raise HTTPException(400, "Use the ownership transfer endpoint to assign owner role")
    existing = await h.get_workspace_membership(ws_id, member_id)
    if not existing:
        raise HTTPException(404, "User is not a workspace member")
    update = {"role": body.role}
    if body.permissions is not None:
        update["permissions"] = body.permissions
    await h._db.workspace_members.update_one(
        {"workspace_id": ws_id, "user_id": member_id},
        {"$set": update}
    )
    return {"ok": True}


# ── Endpoints: Workspace Orgs ──

@router.get("/{ws_id}/orgs")
async def list_workspace_orgs(ws_id: str, request: Request):
    """List organisations in a workspace."""
    user, ws = await h.require_workspace_member(request, ws_id)
    orgs = await h._db.organisations.find(
        {"workspace_id": ws_id}, {"_id": 0}
    ).sort("name", 1).to_list(100)
    for org in orgs:
        org["bot_count"] = await h._db.bots.count_documents({"org_id": org["id"]})
        org["member_count"] = len(org.get("member_ids", []))
        org["account_count"] = await h._db.connected_accounts.count_documents({"org_id": org["id"]})
    return {"organisations": orgs}


# ── Endpoints: Workspace Billing ──

@router.get("/{ws_id}/billing")
async def get_workspace_billing(ws_id: str, request: Request):
    """Get workspace billing info."""
    user, ws = await h.require_workspace_member(request, ws_id)
    return {
        "billing": ws.get("billing", {}),
        "usage": ws.get("usage", {}),
    }


@router.put("/{ws_id}/billing")
async def update_workspace_billing(ws_id: str, body: WorkspaceBillingUpdate, request: Request):
    """Update workspace billing settings. Requires owner or admin with billing permission."""
    user, ws = await h.require_workspace_member(request, ws_id)
    # Check permission: owner, platform superadmin, or admin with manage_billing
    if not h._is_platform_superadmin(user) and ws.get("owner_id") != user["id"]:
        membership = await h.get_workspace_membership(ws_id, user["id"])
        if not membership or not membership.get("permissions", {}).get("manage_billing"):
            raise HTTPException(403, "Billing management permission required")
    update = {"updated_at": h._now()}
    if body.plan is not None:
        update["billing.plan"] = body.plan
    if body.limits is not None:
        for k, v in body.limits.items():
            update[f"billing.limits.{k}"] = v
    await h._db.workspaces.update_one({"id": ws_id}, {"$set": update})
    return {"ok": True}


# ── Endpoints: Workspace Discord Apps ──

@router.get("/{ws_id}/discord-apps")
async def list_workspace_discord_apps(ws_id: str, request: Request):
    """List customer-owned Discord apps for a workspace."""
    user, ws = await h.require_workspace_member(request, ws_id)
    apps = await h._db.workspace_discord_apps.find(
        {"workspace_id": ws_id}, {"_id": 0}
    ).to_list(50)
    # Mask secrets
    for app in apps:
        app["client_secret"] = h.mask_credential(app.get("client_secret", ""))
        app["bot_token"] = h.mask_credential(app.get("bot_token", ""))
    return {"discord_apps": apps}


@router.post("/{ws_id}/discord-apps")
async def create_workspace_discord_app(ws_id: str, body: WorkspaceDiscordAppCreate, request: Request):
    """Add a customer-owned Discord app to the workspace."""
    user, ws = await h.require_workspace_member(request, ws_id)
    # Check permission: owner, platform superadmin, or admin with manage_discord_apps
    if not h._is_platform_superadmin(user) and ws.get("owner_id") != user["id"]:
        membership = await h.get_workspace_membership(ws_id, user["id"])
        if not membership or not membership.get("permissions", {}).get("manage_discord_apps"):
            raise HTTPException(403, "Discord app management permission required")
    # Check limit
    current_count = await h._db.workspace_discord_apps.count_documents({"workspace_id": ws_id})
    limit = ws.get("billing", {}).get("limits", {}).get("max_custom_discord_apps", 1)
    if current_count >= limit:
        raise HTTPException(400, f"Custom Discord app limit reached ({limit})")
    now = h._now()
    app = {
        "id": h._uuid(),
        "workspace_id": ws_id,
        "name": body.name.strip(),
        "source": "custom",
        "client_id": body.client_id.strip(),
        "client_secret": body.client_secret.strip(),
        "bot_token": body.bot_token.strip(),
        "redirect_uri": (body.redirect_uri or "").strip(),
        "allowed_org_ids": body.allowed_org_ids or [],
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now,
    }
    await h._db.workspace_discord_apps.insert_one(app)
    app.pop("_id", None)
    # Mask secrets in response
    app["client_secret"] = h.mask_credential(app["client_secret"])
    app["bot_token"] = h.mask_credential(app["bot_token"])
    return app


@router.put("/{ws_id}/discord-apps/{app_id}")
async def update_workspace_discord_app(ws_id: str, app_id: str, body: WorkspaceDiscordAppUpdate, request: Request):
    """Update a customer-owned Discord app."""
    user, ws = await h.require_workspace_member(request, ws_id)
    if not h._is_platform_superadmin(user) and ws.get("owner_id") != user["id"]:
        membership = await h.get_workspace_membership(ws_id, user["id"])
        if not membership or not membership.get("permissions", {}).get("manage_discord_apps"):
            raise HTTPException(403, "Discord app management permission required")
    app = await h._db.workspace_discord_apps.find_one({"id": app_id, "workspace_id": ws_id})
    if not app:
        raise HTTPException(404, "Discord app not found in this workspace")
    update = {"updated_at": h._now()}
    if body.name is not None:
        update["name"] = body.name.strip()
    if body.client_id is not None:
        update["client_id"] = body.client_id.strip()
    if body.client_secret is not None:
        update["client_secret"] = body.client_secret.strip()
    if body.bot_token is not None:
        update["bot_token"] = body.bot_token.strip()
    if body.redirect_uri is not None:
        update["redirect_uri"] = body.redirect_uri.strip()
    if body.allowed_org_ids is not None:
        update["allowed_org_ids"] = body.allowed_org_ids
    await h._db.workspace_discord_apps.update_one({"id": app_id}, {"$set": update})
    return {"ok": True}


@router.delete("/{ws_id}/discord-apps/{app_id}")
async def delete_workspace_discord_app(ws_id: str, app_id: str, request: Request):
    """Delete a customer-owned Discord app."""
    user, ws = await h.require_workspace_owner(request, ws_id)
    app = await h._db.workspace_discord_apps.find_one({"id": app_id, "workspace_id": ws_id})
    if not app:
        raise HTTPException(404, "Discord app not found in this workspace")
    # Check if any connected accounts reference this app
    ref_count = await h._db.connected_accounts.count_documents({"discord_app_id": app_id})
    if ref_count > 0:
        raise HTTPException(
            400,
            f"Cannot delete: {ref_count} connected account(s) use this Discord app. Disconnect them first."
        )
    await h._db.workspace_discord_apps.delete_one({"id": app_id})
    return {"ok": True}
