"""
Connected Account routes — /api/v2/orgs/{org_id}/accounts
CRUD for organisation-owned provider accounts (Discord, Telegram, Zendesk).
Credentials stored securely on backend, never exposed to frontend.
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional

import v2_helpers as h

router = APIRouter(prefix="/v2/orgs", tags=["v2-accounts"])


# ── Models ──

class AccountCreate(BaseModel):
    provider: str  # discord | telegram | zendesk
    name: str
    credentials: dict  # provider-specific, validated per-provider
    metadata: Optional[dict] = {}


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    credentials: Optional[dict] = None  # partial update
    metadata: Optional[dict] = None


# ── Helpers ──

VALID_PROVIDERS = {"discord", "telegram", "zendesk"}

CREDENTIAL_FIELDS = {
    "discord": ["bot_token"],
    "telegram": ["bot_token"],
    "zendesk": ["subdomain", "auth_type", "oauth_access_token", "oauth_refresh_token",
                 "oauth_token_expires_at", "api_token", "user_email"],
}


def _validate_provider(provider: str):
    if provider not in VALID_PROVIDERS:
        raise HTTPException(400, f"Invalid provider: {provider}. Must be one of: {', '.join(VALID_PROVIDERS)}")


def _safe_account(account: dict) -> dict:
    """Return account with credentials masked — never send raw secrets to frontend."""
    safe = {k: v for k, v in account.items() if k != "credentials"}
    creds = account.get("credentials", {})
    masked = {}
    for k, v in creds.items():
        if isinstance(v, str) and ("token" in k or "secret" in k or "key" in k or "password" in k):
            masked[k] = h.mask_credential(v)
        elif k == "subdomain":
            masked[k] = v  # not a secret
        elif k == "auth_type":
            masked[k] = v
        elif k == "user_email":
            masked[k] = v
        else:
            masked[k] = h.mask_credential(str(v)) if isinstance(v, str) and len(str(v)) > 10 else v
    safe["credentials_masked"] = masked
    safe["has_credentials"] = bool(creds)
    return safe


# ── Endpoints ──

@router.get("/{org_id}/accounts")
async def list_accounts(org_id: str, request: Request):
    """List all connected accounts for the organisation."""
    user, org = await h.require_org_member(request)
    accounts = await h._db.connected_accounts.find(
        {"org_id": org_id}, {"_id": 0}
    ).sort("name", 1).to_list(200)

    result = []
    for acc in accounts:
        safe = _safe_account(acc)
        # Count connections using this account
        safe["connection_count"] = await h._db.connections.count_documents({"account_id": acc["id"]})
        safe["active_connection_count"] = await h._db.connections.count_documents(
            {"account_id": acc["id"], "enabled": True}
        )
        result.append(safe)
    return {"accounts": result}


@router.post("/{org_id}/accounts")
async def create_account(org_id: str, body: AccountCreate, request: Request):
    """Connect a new provider account to the organisation."""
    user, org = await h.require_org_member(request)
    _validate_provider(body.provider)

    now = h._now()
    account = {
        "id": h._uuid(),
        "org_id": org_id,
        "provider": body.provider,
        "name": body.name.strip(),
        "status": "connected",
        "credentials": body.credentials,
        "metadata": body.metadata or {},
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now,
    }
    await h._db.connected_accounts.insert_one(account)
    account.pop("_id", None)
    safe = _safe_account(account)
    safe["connection_count"] = 0
    safe["active_connection_count"] = 0
    return safe


@router.get("/{org_id}/accounts/{account_id}")
async def get_account(org_id: str, account_id: str, request: Request):
    """Get account details (credentials masked)."""
    user, org, account = await h.require_account_access(request, account_id)
    safe = _safe_account(account)
    safe["connection_count"] = await h._db.connections.count_documents({"account_id": account_id})
    safe["active_connection_count"] = await h._db.connections.count_documents(
        {"account_id": account_id, "enabled": True}
    )
    # List connections using this account
    connections = await h._db.connections.find(
        {"account_id": account_id}, {"_id": 0}
    ).to_list(100)
    safe["connections"] = connections
    return safe


@router.put("/{org_id}/accounts/{account_id}")
async def update_account(org_id: str, account_id: str, body: AccountUpdate, request: Request):
    """Update account name, credentials, or metadata."""
    user, org, account = await h.require_account_access(request, account_id)
    update = {"updated_at": h._now()}
    if body.name is not None:
        update["name"] = body.name.strip()
    if body.credentials is not None:
        # Merge new credentials with existing (partial update)
        existing_creds = account.get("credentials", {})
        for k, v in body.credentials.items():
            if v is not None and v != "":
                existing_creds[k] = v
        update["credentials"] = existing_creds
        update["status"] = "connected"
    if body.metadata is not None:
        existing_meta = account.get("metadata", {})
        existing_meta.update(body.metadata)
        update["metadata"] = existing_meta
    await h._db.connected_accounts.update_one({"id": account_id}, {"$set": update})
    return {"ok": True}


@router.post("/{org_id}/accounts/{account_id}/disconnect")
async def disconnect_account(org_id: str, account_id: str, request: Request):
    """Mark an account as disconnected. Warns if active connections exist."""
    user, org, account = await h.require_account_access(request, account_id)
    active = await h._db.connections.count_documents({"account_id": account_id, "enabled": True})
    if active > 0:
        # Don't block, but warn
        pass
    await h._db.connected_accounts.update_one(
        {"id": account_id},
        {"$set": {"status": "disconnected", "updated_at": h._now()}}
    )
    # Disable all connections using this account
    await h._db.connections.update_many(
        {"account_id": account_id, "enabled": True},
        {"$set": {"enabled": False, "updated_at": h._now(), "disabled_reason": "account_disconnected"}}
    )
    return {
        "ok": True,
        "warning": f"{active} active connection(s) were disabled" if active > 0 else None,
        "disabled_connections": active,
    }


@router.post("/{org_id}/accounts/{account_id}/reconnect")
async def reconnect_account(org_id: str, account_id: str, request: Request):
    """Mark a disconnected account as connected again."""
    user, org, account = await h.require_account_access(request, account_id)
    if account.get("status") == "connected":
        return {"ok": True, "message": "Already connected"}
    # Verify credentials exist
    creds = account.get("credentials", {})
    if not creds:
        raise HTTPException(400, "No credentials stored. Update credentials first.")
    await h._db.connected_accounts.update_one(
        {"id": account_id},
        {"$set": {"status": "connected", "updated_at": h._now()}}
    )
    return {"ok": True}


@router.post("/{org_id}/accounts/{account_id}/test")
async def test_account(org_id: str, account_id: str, request: Request):
    """Test connectivity for a connected account (provider-specific)."""
    import aiohttp
    user, org, account = await h.require_account_access(request, account_id)
    provider = account.get("provider")
    creds = account.get("credentials", {})

    if provider == "zendesk":
        subdomain = creds.get("subdomain")
        if not subdomain:
            raise HTTPException(400, "No subdomain configured")
        auth_type = creds.get("auth_type", "oauth")
        headers = {"Content-Type": "application/json"}
        if auth_type == "oauth":
            token = creds.get("oauth_access_token")
            if not token:
                raise HTTPException(400, "No OAuth token stored. Reconnect via OAuth.")
            headers["Authorization"] = f"Bearer {token}"
        else:
            email = creds.get("user_email", "")
            api_token = creds.get("api_token", "")
            if not api_token:
                raise HTTPException(400, "No API token configured")
            import base64
            b64 = base64.b64encode(f"{email}/token:{api_token}".encode()).decode()
            headers["Authorization"] = f"Basic {b64}"

        url = f"https://{subdomain}.zendesk.com/api/v2/users/me.json"
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        u = data.get("user", {})
                        return {
                            "ok": True,
                            "subdomain": subdomain,
                            "user_name": u.get("name", "Unknown"),
                            "user_email": u.get("email", ""),
                            "user_role": u.get("role", ""),
                            "auth_type": auth_type,
                        }
                    else:
                        body = await resp.text()
                        raise HTTPException(400, f"Zendesk returned {resp.status}: {body[:200]}")
        except aiohttp.ClientError as e:
            raise HTTPException(400, f"Connection failed: {str(e)}")

    elif provider == "discord":
        token = creds.get("bot_token")
        if not token:
            raise HTTPException(400, "No bot token configured")
        url = "https://discord.com/api/v10/users/@me"
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers={"Authorization": f"Bot {token}"}, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return {"ok": True, "username": data.get("username"), "id": data.get("id")}
                    else:
                        raise HTTPException(400, f"Discord returned {resp.status}")
        except aiohttp.ClientError as e:
            raise HTTPException(400, f"Connection failed: {str(e)}")

    elif provider == "telegram":
        token = creds.get("bot_token")
        if not token:
            raise HTTPException(400, "No bot token configured")
        url = f"https://api.telegram.org/bot{token}/getMe"
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    data = await resp.json()
                    if data.get("ok"):
                        r = data.get("result", {})
                        return {"ok": True, "username": r.get("username"), "first_name": r.get("first_name")}
                    else:
                        raise HTTPException(400, f"Telegram error: {data.get('description', 'Unknown')}")
        except aiohttp.ClientError as e:
            raise HTTPException(400, f"Connection failed: {str(e)}")

    else:
        raise HTTPException(400, f"Test not supported for provider: {provider}")



@router.delete("/{org_id}/accounts/{account_id}")
async def delete_account(org_id: str, account_id: str, request: Request):
    """Delete a connected account. Fails if it has active connections."""
    user, org = await h.require_org_admin(request)
    account = await h._db.connected_accounts.find_one({"id": account_id, "org_id": org_id})
    if not account:
        raise HTTPException(404, "Account not found")
    # Check for active connections using this account
    active_conns = await h._db.connections.count_documents({"account_id": account_id, "enabled": True})
    if active_conns > 0:
        raise HTTPException(400, f"Cannot delete: {active_conns} active connection(s) use this account. Disconnect them first.")
    await h._db.connected_accounts.delete_one({"id": account_id})
    return {"ok": True}
