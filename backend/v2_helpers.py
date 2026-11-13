"""
v2 helpers — shared access control, org resolution, and DB utilities
for the new Organisation → Bot → Account → Connection model.
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


async def require_org_member(request: Request) -> tuple:
    """Returns (user, org) — raises 403 if user is not an org member."""
    user = await _authed_user(request)
    org_id = request.headers.get("X-Org-ID", "").strip()
    if not org_id:
        raise HTTPException(400, "X-Org-ID header required")
    org = await _db.organisations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(404, "Organisation not found")
    # Superadmins have implicit access to all orgs
    if user.get("role") == "superadmin":
        return user, org
    if user["id"] not in org.get("member_ids", []):
        raise HTTPException(403, "You are not a member of this organisation")
    return user, org


async def require_org_admin(request: Request) -> tuple:
    """Returns (user, org) — requires org owner or superadmin."""
    user, org = await require_org_member(request)
    if user.get("role") == "superadmin":
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
