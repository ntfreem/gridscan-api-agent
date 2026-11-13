"""
Zendesk integration routes for BitBot Pro.
Supports OAuth 2.0 authorization-code flow (preferred) with PKCE,
and legacy API-token auth for existing connections.
"""
import os
import logging
import secrets
import base64
import hashlib
import hmac
import httpx
import urllib.parse
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger("bitbotpro.zendesk")

router = APIRouter()

# ── Injected from server.py via init_zendesk_routes() ───────────────
_db = None
_get_instance_access = None
_search_knowledge = None
_build_system_prompt = None
_call_claude = None
_save_conversation = None
_get_tone_examples_text = None
_try_api_query = None


def init_zendesk_routes(
    db, get_instance_access_dep,
    search_knowledge_fn, build_system_prompt_fn, call_claude_fn,
    save_conversation_fn, get_tone_examples_text_fn, try_api_query_fn,
):
    global _db, _get_instance_access
    global _search_knowledge, _build_system_prompt, _call_claude
    global _save_conversation, _get_tone_examples_text, _try_api_query
    _db = db
    _get_instance_access = get_instance_access_dep
    _search_knowledge = search_knowledge_fn
    _build_system_prompt = build_system_prompt_fn
    _call_claude = call_claude_fn
    _save_conversation = save_conversation_fn
    _get_tone_examples_text = get_tone_examples_text_fn
    _try_api_query = try_api_query_fn


# ────────────────── Constants ──────────────────

OAUTH_SCOPES = "tickets:read tickets:write users:read"
OAUTH_ACCESS_TOKEN_EXPIRY = 28800       # 8 hours
OAUTH_REFRESH_TOKEN_EXPIRY = 2592000    # 30 days
OAUTH_STATE_TTL = 600                   # 10 min validity for state param


# ────────────────── Pydantic Models ──────────────────

class ZendeskConfigUpdate(BaseModel):
    auto_reply_enabled: Optional[bool] = None
    agent_assist_enabled: Optional[bool] = None
    is_active: Optional[bool] = None


class ZendeskOAuthStartRequest(BaseModel):
    subdomain: str


class ZendeskOAuthClientConfig(BaseModel):
    client_id: str
    client_secret: str


# ────────────────── Helpers ──────────────────

def _normalize_subdomain(raw: str) -> str:
    """Normalize 'midnight-gd.zendesk.com', 'https://midnight-gd.zendesk.com/', etc. → 'midnight-gd'."""
    s = raw.strip().rstrip("/")
    if "://" in s:
        s = s.split("://", 1)[1]
    if ".zendesk.com" in s:
        s = s.split(".zendesk.com", 1)[0]
    s = s.split("/")[0].lower()
    return s


def _generate_pkce() -> tuple:
    """Return (code_verifier, code_challenge) for PKCE S256."""
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


def _get_base_url() -> str:
    """Derive the app's public base URL from env."""
    base = os.environ.get("REACT_APP_BACKEND_URL", "")
    if not base:
        try:
            env_path = os.path.join(os.path.dirname(__file__), "..", "frontend", ".env")
            with open(env_path) as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        base = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    return base.rstrip("/")


def _get_oauth_credentials() -> tuple:
    """Return (client_id, client_secret) from environment."""
    return (
        os.environ.get("ZENDESK_OAUTH_CLIENT_ID", ""),
        os.environ.get("ZENDESK_OAUTH_CLIENT_SECRET", ""),
    )


async def _get_oauth_credentials_async() -> tuple:
    """Return (client_id, client_secret) — checks DB first, then env vars."""
    if _db is not None:
        doc = await _db.zendesk_oauth_client.find_one({"_id": "credentials"})
        if doc and doc.get("client_id") and doc.get("client_secret"):
            return doc["client_id"], doc["client_secret"]
    return _get_oauth_credentials()


def _zendesk_basic_auth_header(email: str, api_token: str) -> dict:
    """Legacy Basic auth header: {email}/token:{token}."""
    creds = f"{email}/token:{api_token}"
    b64 = base64.b64encode(creds.encode()).decode()
    return {"Authorization": f"Basic {b64}", "Content-Type": "application/json"}


# ────────────────── Token Management ──────────────────

async def _ensure_valid_token(cfg: dict) -> str:
    """Return a valid OAuth access token, refreshing transparently if needed."""
    instance_id = cfg["instance_id"]

    # Check if the current token is still good (with 5-min buffer)
    expires_str = cfg.get("oauth_token_expires_at")
    if expires_str:
        try:
            exp = datetime.fromisoformat(expires_str)
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) < exp - timedelta(minutes=5):
                return cfg["oauth_access_token"]
        except (ValueError, TypeError):
            pass

    # Need a refresh
    refresh_token = cfg.get("oauth_refresh_token")
    if not refresh_token:
        await _db.zendesk_config.update_one(
            {"instance_id": instance_id},
            {"$set": {"oauth_needs_reauth": True}},
        )
        raise HTTPException(401, "Zendesk authorization expired. Please reconnect.")

    client_id, client_secret = await _get_oauth_credentials_async()
    if not client_id or not client_secret:
        raise HTTPException(500, "Zendesk OAuth is not configured. Set the Client ID and Secret in the Zendesk settings page.")

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"https://{cfg['subdomain']}.zendesk.com/oauth/tokens",
                json={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": client_id,
                    "client_secret": client_secret,
                },
            )
            if resp.status_code != 200:
                logger.warning("Zendesk token refresh failed (%s)", resp.status_code)
                await _db.zendesk_config.update_one(
                    {"instance_id": instance_id},
                    {"$set": {"oauth_needs_reauth": True, "updated_at": datetime.now(timezone.utc).isoformat()}},
                )
                raise HTTPException(401, "Zendesk authorization expired. Please reconnect.")

            data = resp.json()
            new_access = data["access_token"]
            new_refresh = data.get("refresh_token", refresh_token)
            expires_in = data.get("expires_in", OAUTH_ACCESS_TOKEN_EXPIRY)
            new_exp = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()

            await _db.zendesk_config.update_one(
                {"instance_id": instance_id},
                {"$set": {
                    "oauth_access_token": new_access,
                    "oauth_refresh_token": new_refresh,
                    "oauth_token_expires_at": new_exp,
                    "oauth_needs_reauth": False,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            cfg["oauth_access_token"] = new_access
            cfg["oauth_refresh_token"] = new_refresh
            cfg["oauth_token_expires_at"] = new_exp
            return new_access

    except httpx.HTTPError as exc:
        logger.error("Zendesk token refresh network error: %s", exc)
        raise HTTPException(502, "Could not reach Zendesk to refresh the token. Please try again.")


# ────────────────── Unified API Caller ──────────────────

async def _zendesk_request(cfg: dict, method: str, path: str, body: dict = None):
    """Zendesk API call. Auto-selects Bearer (OAuth) or Basic (legacy) auth."""
    subdomain = cfg.get("subdomain", "")
    url = f"https://{subdomain}.zendesk.com/api/v2{path}"

    if cfg.get("auth_type") == "oauth":
        token = await _ensure_valid_token(cfg)
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    else:
        email = cfg.get("email", "")
        api_token = cfg.get("api_token", "")
        if not email or not api_token:
            raise HTTPException(400, "Zendesk credentials are missing.")
        headers = _zendesk_basic_auth_header(email, api_token)

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.request(method, url, headers=headers, json=body)
        if resp.status_code == 401:
            detail = "Zendesk authorization expired. Please reconnect." if cfg.get("auth_type") == "oauth" else "Zendesk authentication failed. Check your email and API token."
            raise HTTPException(401, detail)
        if resp.status_code == 403:
            raise HTTPException(403, "Insufficient Zendesk permissions. The connected account needs access to this resource.")
        if resp.status_code == 404:
            raise HTTPException(400, f"Zendesk resource not found on {subdomain}.zendesk.com.")
        resp.raise_for_status()
        return resp.json() if resp.content else None


async def _verify_zendesk_webhook(raw_body: bytes, signature: str, timestamp: str, secret: str) -> bool:
    """Verify Zendesk webhook HMAC-SHA256 signature."""
    if not signature or not timestamp:
        return False
    try:
        ts = int(timestamp)
        if abs(datetime.now(timezone.utc).timestamp() - ts) > 300:
            return False
    except (ValueError, TypeError):
        return False
    digest = hmac.new(secret.encode(), timestamp.encode() + raw_body, hashlib.sha256).digest()
    return hmac.compare_digest(base64.b64encode(digest).decode(), signature)


# ══════════════════════════════════════════════════════════════
#  OAuth 2.0 Authorization-Code Flow (with PKCE)
# ══════════════════════════════════════════════════════════════

@router.post("/admin/zendesk/oauth/start")
async def zendesk_oauth_start(body: ZendeskOAuthStartRequest, request: Request):
    """Generate the Zendesk authorization URL and return it to the frontend."""
    instance_id = await _get_instance_access(request)
    subdomain = _normalize_subdomain(body.subdomain)
    if not subdomain:
        raise HTTPException(400, "A valid Zendesk subdomain is required.")

    client_id, client_secret = await _get_oauth_credentials_async()
    if not client_id or not client_secret:
        raise HTTPException(
            400,
            "Zendesk OAuth is not configured yet. Enter the Client ID and Secret on this page first.",
        )

    base_url = _get_base_url()
    if not base_url:
        raise HTTPException(500, "Could not determine the application's public URL for the OAuth callback.")

    redirect_uri = f"{base_url}/api/zendesk/oauth/callback"
    state = secrets.token_urlsafe(32)
    code_verifier, code_challenge = _generate_pkce()

    # Persist the pending OAuth state
    await _db.zendesk_oauth_states.delete_many({"instance_id": instance_id})
    await _db.zendesk_oauth_states.insert_one({
        "state": state,
        "instance_id": instance_id,
        "subdomain": subdomain,
        "code_verifier": code_verifier,
        "redirect_uri": redirect_uri,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    params = urllib.parse.urlencode({
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": OAUTH_SCOPES,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    })
    auth_url = f"https://{subdomain}.zendesk.com/oauth/authorizations/new?{params}"
    return {"redirect_url": auth_url, "subdomain": subdomain}


@router.get("/zendesk/oauth/callback")
async def zendesk_oauth_callback(request: Request):
    """Zendesk redirects here after the user authorizes (or denies)."""
    params = dict(request.query_params)
    state = params.get("state", "")
    code = params.get("code", "")
    error = params.get("error", "")
    error_desc = params.get("error_description", "")

    frontend_base = _get_base_url()
    redirect_target = f"{frontend_base}/admin/zendesk"

    def _err_redirect(msg: str):
        qs = urllib.parse.urlencode({"oauth": "error", "message": msg})
        return RedirectResponse(f"{redirect_target}?{qs}", status_code=302)

    # ── Handle user-denied / Zendesk errors ──
    if error:
        if error == "access_denied":
            return _err_redirect("You denied the authorization request. No connection was made.")
        return _err_redirect(error_desc or f"Zendesk returned an error: {error}")

    if not state or not code:
        return _err_redirect("Missing authorization code or state. Please try again.")

    # ── Validate state ──
    pending = await _db.zendesk_oauth_states.find_one({"state": state})
    if not pending:
        return _err_redirect("Invalid or expired authorization state. Please start the connection again.")

    created = datetime.fromisoformat(pending["created_at"])
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - created > timedelta(seconds=OAUTH_STATE_TTL):
        await _db.zendesk_oauth_states.delete_one({"state": state})
        return _err_redirect("The authorization request timed out. Please try again.")

    instance_id = pending["instance_id"]
    subdomain = pending["subdomain"]
    code_verifier = pending["code_verifier"]
    redirect_uri = pending["redirect_uri"]

    # Delete state (single-use)
    await _db.zendesk_oauth_states.delete_one({"state": state})

    # ── Exchange code for tokens ──
    client_id, client_secret = await _get_oauth_credentials_async()
    token_payload = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "scope": OAUTH_SCOPES,
        "code_verifier": code_verifier,
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"https://{subdomain}.zendesk.com/oauth/tokens",
                json=token_payload,
            )
            if resp.status_code != 200:
                logger.warning("Zendesk token exchange failed (%s): %s", resp.status_code, resp.text[:300])
                detail = "Token exchange failed."
                try:
                    err_data = resp.json()
                    if "invalid_scope" in str(err_data):
                        detail = "Scope rejected. Ensure the OAuth client allows: " + OAUTH_SCOPES
                    elif "invalid_grant" in str(err_data):
                        detail = "Authorization code expired. Please try again."
                    else:
                        detail = err_data.get("error_description", detail)
                except Exception:
                    pass
                return _err_redirect(detail)

            token_data = resp.json()
    except httpx.HTTPError as exc:
        logger.error("Zendesk token exchange network error: %s", exc)
        return _err_redirect("Could not reach Zendesk to complete authorization. Please try again.")

    access_token = token_data["access_token"]
    refresh_token = token_data.get("refresh_token", "")
    expires_in = token_data.get("expires_in", OAUTH_ACCESS_TOKEN_EXPIRY)
    token_exp = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()

    refresh_exp_in = token_data.get("refresh_token_expires_in", OAUTH_REFRESH_TOKEN_EXPIRY)
    refresh_exp = (datetime.now(timezone.utc) + timedelta(seconds=refresh_exp_in)).isoformat()

    # ── Verify the token works — fetch the authenticated user ──
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            me_resp = await client.get(
                f"https://{subdomain}.zendesk.com/api/v2/users/me.json",
                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            )
            if me_resp.status_code == 403:
                return _err_redirect("The Zendesk account that authorized does not have permission to read users. An agent or admin role is required.")
            me_resp.raise_for_status()
            me_data = me_resp.json().get("user", {})
    except httpx.HTTPError as exc:
        logger.error("Zendesk /users/me validation error: %s", exc)
        return _err_redirect("Connected to Zendesk but could not verify the account. Please try again.")

    # ── Persist the connection ──
    now = datetime.now(timezone.utc).isoformat()
    existing = await _db.zendesk_config.find_one({"instance_id": instance_id})

    oauth_doc = {
        "instance_id": instance_id,
        "subdomain": subdomain,
        "auth_type": "oauth",
        "oauth_access_token": access_token,
        "oauth_refresh_token": refresh_token,
        "oauth_token_expires_at": token_exp,
        "oauth_refresh_expires_at": refresh_exp,
        "oauth_scopes": OAUTH_SCOPES,
        "oauth_needs_reauth": False,
        "zendesk_user_id": str(me_data.get("id", "")),
        "zendesk_user_name": me_data.get("name", ""),
        "zendesk_user_email": me_data.get("email", ""),
        "zendesk_user_role": me_data.get("role", ""),
        "updated_at": now,
    }

    if existing:
        await _db.zendesk_config.update_one(
            {"instance_id": instance_id},
            {"$set": oauth_doc},
        )
    else:
        oauth_doc.update({
            "auto_reply_enabled": False,
            "agent_assist_enabled": True,
            "is_active": True,
            "webhook_secret": secrets.token_urlsafe(32),
            "created_at": now,
            "email": "",
            "api_token": "",
        })
        await _db.zendesk_config.insert_one(oauth_doc)

    logger.info("Zendesk OAuth connected for instance %s (subdomain=%s, user=%s)", instance_id[:12], subdomain, me_data.get("email", ""))
    qs = urllib.parse.urlencode({"oauth": "success"})
    return RedirectResponse(f"{redirect_target}?{qs}", status_code=302)


# ══════════════════════════════════════════════════════════════
#  Admin Config Endpoints
# ══════════════════════════════════════════════════════════════

@router.post("/admin/zendesk/oauth/client-config")
async def save_oauth_client_config(body: ZendeskOAuthClientConfig, request: Request):
    """Save Zendesk OAuth client credentials (admin only). Stored in DB, not env vars."""
    await _get_instance_access(request)
    cid = body.client_id.strip()
    cs = body.client_secret.strip()
    if not cid or not cs:
        raise HTTPException(400, "Both Client ID and Client Secret are required.")
    now = datetime.now(timezone.utc).isoformat()
    await _db.zendesk_oauth_client.update_one(
        {"_id": "credentials"},
        {"$set": {"client_id": cid, "client_secret": cs, "updated_at": now}},
        upsert=True,
    )
    return {"success": True, "message": "Zendesk OAuth client credentials saved."}


@router.get("/admin/zendesk/oauth/client-config")
async def get_oauth_client_config(request: Request):
    """Check if OAuth client credentials are configured (admin only). Never returns the secret."""
    await _get_instance_access(request)
    client_id, _ = await _get_oauth_credentials_async()
    return {"configured": bool(client_id), "client_id_masked": f"{client_id[:4]}***" if len(client_id) > 4 else ("***" if client_id else "")}


@router.delete("/admin/zendesk/oauth/client-config")
async def delete_oauth_client_config(request: Request):
    """Remove stored OAuth client credentials (admin only)."""
    await _get_instance_access(request)
    await _db.zendesk_oauth_client.delete_one({"_id": "credentials"})
    return {"success": True, "message": "OAuth client credentials removed."}


@router.get("/admin/zendesk-config")
async def get_zendesk_config(request: Request):
    instance_id = await _get_instance_access(request)

    # Provide OAuth configuration status
    client_id, _ = await _get_oauth_credentials_async()
    oauth_configured = bool(client_id)

    cfg = await _db.zendesk_config.find_one({"instance_id": instance_id}, {"_id": 0})
    if not cfg:
        return {
            "instance_id": instance_id,
            "connected": False,
            "auth_type": None,
            "oauth_configured": oauth_configured,
            "auto_reply_enabled": False,
            "agent_assist_enabled": True,
            "is_active": False,
        }

    auth_type = cfg.get("auth_type", "api_token")
    connected = False
    if auth_type == "oauth":
        connected = bool(cfg.get("oauth_access_token"))
    else:
        connected = bool(cfg.get("subdomain") and cfg.get("email"))

    # Build safe response (strip secrets)
    safe = {
        "instance_id": instance_id,
        "connected": connected,
        "auth_type": auth_type,
        "oauth_configured": oauth_configured,
        "subdomain": cfg.get("subdomain", ""),
        "auto_reply_enabled": cfg.get("auto_reply_enabled", False),
        "agent_assist_enabled": cfg.get("agent_assist_enabled", True),
        "is_active": cfg.get("is_active", False),
    }

    if auth_type == "oauth":
        safe["zendesk_user_name"] = cfg.get("zendesk_user_name", "")
        safe["zendesk_user_email"] = cfg.get("zendesk_user_email", "")
        safe["zendesk_user_role"] = cfg.get("zendesk_user_role", "")
        safe["oauth_scopes"] = cfg.get("oauth_scopes", "")
        safe["oauth_needs_reauth"] = cfg.get("oauth_needs_reauth", False)
        exp_str = cfg.get("oauth_token_expires_at", "")
        if exp_str:
            try:
                exp = datetime.fromisoformat(exp_str)
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                safe["oauth_token_valid"] = datetime.now(timezone.utc) < exp
            except (ValueError, TypeError):
                safe["oauth_token_valid"] = False
        else:
            safe["oauth_token_valid"] = False
    else:
        token = cfg.get("api_token", "")
        safe["email"] = cfg.get("email", "")
        safe["api_token_masked"] = f"***{token[-4:]}" if len(token) > 4 else "***"
        safe["zendesk_user_name"] = cfg.get("zendesk_user_name", "")

    return safe


@router.put("/admin/zendesk-config")
async def update_zendesk_config(body: ZendeskConfigUpdate, request: Request):
    """Update Zendesk settings (auto-reply, agent-assist, active toggle). Credentials are handled via OAuth flow."""
    instance_id = await _get_instance_access(request)
    existing = await _db.zendesk_config.find_one({"instance_id": instance_id})
    if not existing:
        raise HTTPException(400, "Connect Zendesk first before changing settings.")

    update_fields = {}
    if body.auto_reply_enabled is not None:
        update_fields["auto_reply_enabled"] = body.auto_reply_enabled
    if body.agent_assist_enabled is not None:
        update_fields["agent_assist_enabled"] = body.agent_assist_enabled
    if body.is_active is not None:
        update_fields["is_active"] = body.is_active

    if not update_fields:
        raise HTTPException(400, "No fields to update.")

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    await _db.zendesk_config.update_one({"instance_id": instance_id}, {"$set": update_fields})
    return {"success": True, "message": "Zendesk settings updated."}


@router.delete("/admin/zendesk-config")
async def delete_zendesk_config(request: Request):
    instance_id = await _get_instance_access(request)

    cfg = await _db.zendesk_config.find_one({"instance_id": instance_id})
    if cfg and cfg.get("auth_type") == "oauth" and cfg.get("oauth_access_token"):
        # Attempt to revoke the OAuth token at Zendesk (best-effort)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.delete(
                    f"https://{cfg['subdomain']}.zendesk.com/api/v2/oauth/tokens/current.json",
                    headers={"Authorization": f"Bearer {cfg['oauth_access_token']}"},
                )
        except Exception:
            pass

    await _db.zendesk_config.delete_one({"instance_id": instance_id})
    await _db.zendesk_suggestions.delete_many({"instance_id": instance_id})
    await _db.zendesk_oauth_states.delete_many({"instance_id": instance_id})
    return {"success": True, "message": "Zendesk integration disconnected."}


@router.post("/admin/zendesk-config/test")
async def test_zendesk_connection(request: Request):
    instance_id = await _get_instance_access(request)
    cfg = await _db.zendesk_config.find_one({"instance_id": instance_id})
    if not cfg or not cfg.get("subdomain"):
        raise HTTPException(400, "No Zendesk connection found.")

    try:
        result = await _zendesk_request(cfg, "GET", "/users/me.json")
        user = result.get("user", {})
        return {
            "success": True,
            "user_name": user.get("name"),
            "user_email": user.get("email"),
            "user_role": user.get("role"),
            "subdomain": cfg["subdomain"],
            "auth_type": cfg.get("auth_type", "api_token"),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"Connection test failed: {exc}")


@router.get("/admin/zendesk-config/webhook-url")
async def get_zendesk_webhook_url(request: Request):
    """Return the webhook URL the admin needs to configure in Zendesk."""
    instance_id = await _get_instance_access(request)
    cfg = await _db.zendesk_config.find_one({"instance_id": instance_id})
    if not cfg or not cfg.get("webhook_secret"):
        # Generate one on the fly
        ws = secrets.token_urlsafe(32)
        if cfg:
            await _db.zendesk_config.update_one({"instance_id": instance_id}, {"$set": {"webhook_secret": ws}})
        else:
            raise HTTPException(400, "Connect Zendesk first.")
        secret = ws
    else:
        secret = cfg["webhook_secret"]
    base_url = _get_base_url()
    return {"webhook_url": f"{base_url}/api/zendesk/webhook/{instance_id}/{secret}"}


@router.get("/admin/zendesk/oauth/callback-url")
async def get_oauth_callback_url(request: Request):
    """Return the OAuth callback URL needed during Zendesk admin setup."""
    await _get_instance_access(request)
    base_url = _get_base_url()
    return {"callback_url": f"{base_url}/api/zendesk/oauth/callback"}


# ────────────────── Agent-Assist Suggestion ──────────────────

@router.get("/zendesk/suggestion/{instance_id}/{ticket_id}")
async def get_suggestion(instance_id: str, ticket_id: str):
    """Public endpoint for ZAF sidebar app to fetch AI suggestion for a ticket."""
    suggestion = await _db.zendesk_suggestions.find_one(
        {"instance_id": instance_id, "ticket_id": str(ticket_id)}, {"_id": 0}
    )
    return suggestion or {"suggestion": None, "ticket_id": ticket_id}


# ────────────────── Recent Tickets (Admin View) ──────────────────

@router.get("/admin/zendesk-tickets")
async def get_recent_zendesk_tickets(request: Request):
    """Return recent Zendesk tickets processed by BitBot Pro."""
    instance_id = await _get_instance_access(request)
    tickets = await _db.zendesk_suggestions.find(
        {"instance_id": instance_id}
    ).sort("created_at", -1).limit(20).to_list(20)
    for t in tickets:
        t.pop("_id", None)
    return {"tickets": tickets}


# ══════════════════════════════════════════════════════════════
#  Webhook Handler
# ══════════════════════════════════════════════════════════════

@router.post("/zendesk/webhook/{instance_id}/{webhook_secret}")
async def zendesk_webhook(
    instance_id: str, webhook_secret: str,
    request: Request, background_tasks: BackgroundTasks,
):
    """Receive new-ticket notifications from Zendesk."""
    cfg = await _db.zendesk_config.find_one({"instance_id": instance_id})
    if not cfg:
        raise HTTPException(404, "Not found")
    if cfg.get("webhook_secret") != webhook_secret:
        raise HTTPException(403, "Forbidden")
    if not cfg.get("is_active", False):
        return {"ok": True, "skipped": "inactive"}

    try:
        event = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")

    ticket_id = event.get("ticket_id") or event.get("id")
    if not ticket_id:
        raise HTTPException(400, "ticket_id required")

    event_id = event.get("event_id", f"ticket:{ticket_id}:created")
    if await _db.zendesk_events.find_one({"instance_id": instance_id, "event_id": str(event_id)}):
        return {"ok": True, "skipped": "duplicate"}

    await _db.zendesk_events.insert_one({
        "instance_id": instance_id,
        "event_id": str(event_id),
        "ticket_id": str(ticket_id),
        "received_at": datetime.now(timezone.utc).isoformat(),
    })

    background_tasks.add_task(_process_zendesk_ticket, instance_id, str(ticket_id), event)
    return {"ok": True, "accepted": True}


async def _process_zendesk_ticket(instance_id: str, ticket_id: str, event: dict):
    """Fetch ticket, run AI pipeline, post reply or store suggestion."""
    try:
        # Reload config from DB to get the freshest tokens
        cfg = await _db.zendesk_config.find_one({"instance_id": instance_id})
        if not cfg:
            logger.warning("Zendesk config missing for instance %s during ticket processing", instance_id[:12])
            return

        ticket_data = await _zendesk_request(cfg, "GET", f"/tickets/{ticket_id}.json")
        ticket = ticket_data.get("ticket", {})
        subject = ticket.get("subject", "")
        description = ticket.get("description", "")
        requester_id = ticket.get("requester_id")

        comments_data = await _zendesk_request(cfg, "GET", f"/tickets/{ticket_id}/comments.json")
        comments = comments_data.get("comments", [])
        user_query = f"Subject: {subject}\n\n{description}"
        if len(comments) > 1:
            latest = comments[-1].get("plain_body", comments[-1].get("body", ""))
            user_query = f"Subject: {subject}\n\nLatest message: {latest}"

        session_id = f"zd_{ticket_id}_{instance_id}"
        bot_config = await _db.bot_config.find_one({"instance_id": instance_id}, {"_id": 0}) or {}
        knowledge = await _search_knowledge(user_query, instance_id)

        has_api_integrations = await _db.api_integrations.count_documents(
            {"instance_id": instance_id, "enabled": True}
        ) > 0

        if knowledge == "__NO_KB__" and not has_api_integrations:
            ai_response = "Thank you for reaching out. Our team will review your request and get back to you shortly."
        else:
            api_result = await _try_api_query(user_query, bot_config, knowledge, instance_id, session_id)
            api_context, api_sources = ("", [])
            if api_result:
                api_context, api_sources = api_result
            tone = await _get_tone_examples_text(instance_id, bot_config)
            system_prompt = _build_system_prompt(
                bot_config, knowledge, tone,
                knowledge_gate=bot_config.get("knowledge_gate", "strict"),
                api_context=api_context, api_sources=api_sources,
                has_api_integrations=has_api_integrations,
            )
            system_prompt += "\nYou are responding to a Zendesk support ticket. Write a helpful, professional support response. Be concise and actionable. If you don't have enough information to fully resolve the issue, acknowledge the customer's concern and outline what you can help with. Do not mention that you are an AI unless directly asked."
            ai_response = await _call_claude(session_id, user_query, system_prompt, instance_id=instance_id, platform="zendesk")

        await _save_conversation(
            session_id=session_id, user_message=user_query, bot_response=ai_response,
            platform="zendesk", instance_id=instance_id,
            metadata={"ticket_id": ticket_id, "subject": subject, "requester_id": str(requester_id or "")},
        )

        now = datetime.now(timezone.utc).isoformat()
        await _db.zendesk_suggestions.update_one(
            {"instance_id": instance_id, "ticket_id": ticket_id},
            {"$set": {
                "instance_id": instance_id, "ticket_id": ticket_id,
                "subject": subject, "suggestion": ai_response,
                "action_taken": "", "created_at": now,
            }},
            upsert=True,
        )

        if cfg.get("auto_reply_enabled"):
            try:
                await _zendesk_request(
                    cfg, "PUT", f"/tickets/{ticket_id}.json",
                    {"ticket": {"comment": {"body": ai_response, "public": True}, "tags": ["ai_processed", "bitbotpro"]}},
                )
                await _zendesk_request(
                    cfg, "PUT", f"/tickets/{ticket_id}.json",
                    {"ticket": {"comment": {"body": f"[BitBot Pro] AI auto-reply posted for ticket #{ticket_id}.", "public": False}}},
                )
                await _db.zendesk_suggestions.update_one(
                    {"instance_id": instance_id, "ticket_id": ticket_id},
                    {"$set": {"action_taken": "auto_reply"}},
                )
                logger.info("Zendesk auto-reply posted for ticket %s (instance %s)", ticket_id, instance_id[:12])
            except Exception as exc:
                logger.error("Failed to post Zendesk auto-reply for ticket %s: %s", ticket_id, exc)
                await _db.zendesk_suggestions.update_one(
                    {"instance_id": instance_id, "ticket_id": ticket_id},
                    {"$set": {"action_taken": "auto_reply_failed", "error": str(exc)}},
                )
        elif cfg.get("agent_assist_enabled"):
            await _db.zendesk_suggestions.update_one(
                {"instance_id": instance_id, "ticket_id": ticket_id},
                {"$set": {"action_taken": "agent_assist"}},
            )
            logger.info("Zendesk suggestion stored for ticket %s (instance %s)", ticket_id, instance_id[:12])

    except Exception as exc:
        logger.error("Zendesk ticket processing error (instance=%s, ticket=%s): %s", instance_id, ticket_id, exc, exc_info=True)
