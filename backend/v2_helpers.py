"""
v2 helpers — shared access control, org resolution, and DB utilities
for the Workspace → Organisation → Bot → Account → Connection model.
"""
from fastapi import HTTPException, Request
from datetime import datetime, timezone
import uuid

_db = None
_get_current_user_from_request = None


def init(db, get_current_user_from_request):
    global _db, _get_current_user_from_request
    _db = db
    _get_current_user_from_request = get_current_user_from_request


def _now():
    return datetime.now(timezone.utc).isoformat()


def _uuid():
    return str(uuid.uuid4())


def _is_platform_superadmin(user: dict) -> bool:
    """Check if user has platform superadmin privileges."""
    return user.get("platform_role") == "superadmin" or user.get("role") == "superadmin"


async def _authed_user(request: Request) -> dict:
    """Extract and validate the JWT-authed user from the request."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(401, "Not authenticated")
    from jose import jwt as jose_jwt
    import os
    try:
        payload = jose_jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await _db.users.find_one({"id": payload.get("sub")}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


# ── Platform-level access ──

async def require_platform_superadmin(request: Request) -> dict:
    """Returns user — raises 403 if not platform superadmin."""
    user = await _authed_user(request)
    if not _is_platform_superadmin(user):
        raise HTTPException(403, "Platform superadmin access required")
    return user


# ── Workspace-level access ──

async def _get_workspace(workspace_id: str) -> dict:
    ws = await _db.workspaces.find_one({"id": workspace_id}, {"_id": 0})
    if not ws:
        raise HTTPException(404, "Workspace not found")
    return ws


async def get_workspace_membership(workspace_id: str, user_id: str):
    """Get a user's workspace membership record, or None."""
    return await _db.workspace_members.find_one(
        {"workspace_id": workspace_id, "user_id": user_id}, {"_id": 0}
    )


async def require_workspace_member(request: Request, ws_id: str = None) -> tuple:
    """Returns (user, workspace) — raises 403 if user has no workspace access."""
    user = await _authed_user(request)
    if not ws_id:
        ws_id = request.path_params.get("ws_id", "").strip()
    if not ws_id:
        ws_id = request.headers.get("X-Workspace-ID", "").strip()
    if not ws_id:
        raise HTTPException(400, "Workspace ID required")
    ws = await _get_workspace(ws_id)
    if _is_platform_superadmin(user):
        return user, ws
    membership = await get_workspace_membership(ws_id, user["id"])
    if not membership:
        raise HTTPException(403, "You are not a member of this workspace")
    return user, ws


async def require_workspace_admin(request: Request, ws_id: str = None) -> tuple:
    """Returns (user, workspace) — requires workspace admin or owner."""
    user, ws = await require_workspace_member(request, ws_id)
    if _is_platform_superadmin(user):
        return user, ws
    membership = await get_workspace_membership(ws["id"], user["id"])
    if not membership or membership["role"] not in ("owner", "admin"):
        raise HTTPException(403, "Workspace admin access required")
    return user, ws


async def require_workspace_owner(request: Request, ws_id: str = None) -> tuple:
    """Returns (user, workspace) — requires workspace owner."""
    user, ws = await require_workspace_member(request, ws_id)
    if _is_platform_superadmin(user):
        return user, ws
    if ws.get("owner_id") != user["id"]:
        raise HTTPException(403, "Workspace owner access required")
    return user, ws


# ── Organisation-level access (updated with workspace inheritance) ──

async def require_org_member(request: Request) -> tuple:
    """Returns (user, org) — raises 403 if user is not an org member.
    Workspace owners/admins get implicit access to all orgs in their workspace."""
    user = await _authed_user(request)
    org_id = request.headers.get("X-Org-ID", "").strip()
    if not org_id:
        raise HTTPException(400, "X-Org-ID header required")
    org = await _db.organisations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(404, "Organisation not found")
    # Platform superadmins have implicit access to all orgs
    if _is_platform_superadmin(user):
        return user, org
    # Workspace owners/admins have implicit access to orgs in their workspace
    ws_id = org.get("workspace_id")
    if ws_id:
        membership = await get_workspace_membership(ws_id, user["id"])
        if membership and membership["role"] in ("owner", "admin"):
            return user, org
    # Direct org membership
    if user["id"] not in org.get("member_ids", []):
        raise HTTPException(403, "You are not a member of this organisation")
    return user, org


async def require_org_admin(request: Request) -> tuple:
    """Returns (user, org) — requires org admin, workspace admin/owner, or superadmin."""
    user, org = await require_org_member(request)
    if _is_platform_superadmin(user):
        return user, org
    # Workspace owner/admin has implicit org admin rights
    ws_id = org.get("workspace_id")
    if ws_id:
        membership = await get_workspace_membership(ws_id, user["id"])
        if membership and membership["role"] in ("owner", "admin"):
            return user, org
    if user["id"] == org.get("owner_id"):
        return user, org
    # Check org-level role
    member_roles = org.get("member_roles", {})
    if member_roles.get(user["id"]) == "admin":
        return user, org
    raise HTTPException(403, "Organisation admin access required")


async def require_bot_access(request: Request, bot_id: str) -> tuple:
    """Returns (user, org, bot) — verifies bot belongs to the org."""
    user, org = await require_org_member(request)
    bot = await _db.bots.find_one({"id": bot_id, "org_id": org["id"]}, {"_id": 0})
    if not bot:
        raise HTTPException(404, "Bot not found in this organisation")
    return user, org, bot


async def require_account_access(request: Request, account_id: str) -> tuple:
    """Returns (user, org, account) — verifies account belongs to the org."""
    user, org = await require_org_member(request)
    account = await _db.connected_accounts.find_one(
        {"id": account_id, "org_id": org["id"]}, {"_id": 0}
    )
    if not account:
        raise HTTPException(404, "Connected account not found in this organisation")
    return user, org, account


def mask_credential(value: str) -> str:
    """Show first 4 + last 4 chars, mask the middle."""
    if not value or len(value) <= 10:
        return "••••••••"
    return value[:4] + "•" * (len(value) - 8) + value[-4:]
