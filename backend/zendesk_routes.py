"""
Zendesk integration routes for BridgeBot.
Handles: config CRUD, webhook processing, auto-reply, agent-assist suggestions.
"""
import os
import logging
import secrets
import base64
import hashlib
import hmac
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger("bridgebot.zendesk")

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


# ────────────────── Pydantic models ──────────────────

class ZendeskConfigUpdate(BaseModel):
    subdomain: Optional[str] = None
    email: Optional[str] = None
    api_token: Optional[str] = None
    auto_reply_enabled: Optional[bool] = None
    agent_assist_enabled: Optional[bool] = None
    is_active: Optional[bool] = None


# ────────────────── Zendesk API helper ──────────────────

def _zendesk_auth_header(email: str, api_token: str) -> dict:
    """Build Basic auth header for Zendesk API token auth: {email}/token:{token}."""
    creds = f"{email}/token:{api_token}"
    b64 = base64.b64encode(creds.encode()).decode()
    return {"Authorization": f"Basic {b64}", "Content-Type": "application/json"}


async def _zendesk_request(subdomain: str, email: str, api_token: str,
                           method: str, path: str, body: dict = None):
    """Make a Zendesk API request."""
    url = f"https://{subdomain}.zendesk.com/api/v2{path}"
    headers = _zendesk_auth_header(email, api_token)
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.request(method, url, headers=headers, json=body)
        if resp.status_code == 401:
            raise HTTPException(status_code=400, detail="Zendesk authentication failed. Check your email and API token.")
        if resp.status_code == 404:
            raise HTTPException(status_code=400, detail=f"Zendesk subdomain '{subdomain}' not found or endpoint doesn't exist.")
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


# ────────────────── Admin Config Endpoints ──────────────────

@router.get("/admin/zendesk-config")
async def get_zendesk_config(request: Request):
    instance_id = await _get_instance_access(request)
    cfg = await _db.zendesk_config.find_one({"instance_id": instance_id}, {"_id": 0})
    if not cfg:
        return {
            "instance_id": instance_id, "connected": False,
            "auto_reply_enabled": False, "agent_assist_enabled": True,
            "is_active": False,
        }
    # Mask sensitive fields
    token = cfg.get("api_token", "")
    cfg["api_token_masked"] = f"***{token[-4:]}" if len(token) > 4 else "***"
    cfg.pop("api_token", None)
    cfg.pop("webhook_secret", None)
    cfg["connected"] = bool(cfg.get("subdomain") and cfg.get("email"))
    return cfg


@router.put("/admin/zendesk-config")
async def update_zendesk_config(body: ZendeskConfigUpdate, request: Request):
    instance_id = await _get_instance_access(request)
    existing = await _db.zendesk_config.find_one({"instance_id": instance_id})
    now = datetime.now(timezone.utc).isoformat()
    update_fields = {}

    # If credentials are changing, validate them
    if body.subdomain or body.email or body.api_token:
        subdomain = (body.subdomain or (existing or {}).get("subdomain", "")).strip()
        email = (body.email or (existing or {}).get("email", "")).strip()
        api_token = (body.api_token or (existing or {}).get("api_token", "")).strip()

        if not subdomain or not email or not api_token:
            raise HTTPException(status_code=400, detail="Subdomain, email, and API token are all required.")

        # Validate by calling Zendesk API
        try:
            result = await _zendesk_request(subdomain, email, api_token, "GET", "/users/me.json")
            user_name = result.get("user", {}).get("name", "")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Connection test failed: {str(e)}")

        update_fields["subdomain"] = subdomain
        update_fields["email"] = email
        update_fields["api_token"] = api_token
        update_fields["zendesk_user_name"] = user_name

        # Generate webhook secret on first connection
        if not existing or not existing.get("webhook_secret"):
            update_fields["webhook_secret"] = secrets.token_urlsafe(32)

        # Auto-activate on first connection
        if not existing:
            update_fields["is_active"] = True
            update_fields["agent_assist_enabled"] = True
            update_fields["auto_reply_enabled"] = False

    if body.auto_reply_enabled is not None:
        update_fields["auto_reply_enabled"] = body.auto_reply_enabled
    if body.agent_assist_enabled is not None:
        update_fields["agent_assist_enabled"] = body.agent_assist_enabled
    if body.is_active is not None:
        update_fields["is_active"] = body.is_active

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_fields["updated_at"] = now

    if existing:
        await _db.zendesk_config.update_one({"instance_id": instance_id}, {"$set": update_fields})
    else:
        doc = {
            "instance_id": instance_id,
            "subdomain": "", "email": "", "api_token": "",
            "zendesk_user_name": "",
            "webhook_secret": secrets.token_urlsafe(32),
            "auto_reply_enabled": False,
            "agent_assist_enabled": True,
            "is_active": False,
            "created_at": now, "updated_at": now,
        }
        doc.update(update_fields)
        await _db.zendesk_config.insert_one(doc)

    # Return the webhook URL for the admin to configure in Zendesk
    cfg = await _db.zendesk_config.find_one({"instance_id": instance_id})
    base_url = os.environ.get("REACT_APP_BACKEND_URL", "")
    if not base_url:
        try:
            with open(os.path.join(os.path.dirname(__file__), "..", "frontend", ".env")) as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        base_url = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    webhook_url = f"{base_url}/api/zendesk/webhook/{instance_id}/{cfg.get('webhook_secret', '')}" if base_url else ""

    return {"success": True, "message": "Zendesk configuration updated", "webhook_url": webhook_url}


@router.delete("/admin/zendesk-config")
async def delete_zendesk_config(request: Request):
    instance_id = await _get_instance_access(request)
    await _db.zendesk_config.delete_one({"instance_id": instance_id})
    await _db.zendesk_suggestions.delete_many({"instance_id": instance_id})
    return {"success": True, "message": "Zendesk integration removed"}


@router.post("/admin/zendesk-config/test")
async def test_zendesk_connection(request: Request):
    instance_id = await _get_instance_access(request)
    cfg = await _db.zendesk_config.find_one({"instance_id": instance_id})
    if not cfg or not cfg.get("subdomain"):
        raise HTTPException(status_code=400, detail="No Zendesk config found")
    try:
        result = await _zendesk_request(
            cfg["subdomain"], cfg["email"], cfg["api_token"], "GET", "/users/me.json"
        )
        user = result.get("user", {})
        return {
            "success": True,
            "user_name": user.get("name"),
            "user_email": user.get("email"),
            "subdomain": cfg["subdomain"],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Connection test failed: {str(e)}")


@router.get("/admin/zendesk-config/webhook-url")
async def get_zendesk_webhook_url(request: Request):
    """Return the webhook URL the admin needs to configure in Zendesk."""
    instance_id = await _get_instance_access(request)
    cfg = await _db.zendesk_config.find_one({"instance_id": instance_id})
    if not cfg or not cfg.get("webhook_secret"):
        raise HTTPException(status_code=400, detail="Connect Zendesk first")
    base_url = os.environ.get("REACT_APP_BACKEND_URL", "")
    if not base_url:
        try:
            with open(os.path.join(os.path.dirname(__file__), "..", "frontend", ".env")) as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        base_url = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    webhook_url = f"{base_url}/api/zendesk/webhook/{instance_id}/{cfg['webhook_secret']}"
    return {"webhook_url": webhook_url}


# ────────────────── Agent-Assist Suggestion Endpoint ──────────────────

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
    """Return recent Zendesk tickets processed by BridgeBot."""
    instance_id = await _get_instance_access(request)
    tickets = await _db.zendesk_suggestions.find(
        {"instance_id": instance_id}
    ).sort("created_at", -1).limit(20).to_list(20)
    for t in tickets:
        t.pop("_id", None)
    return {"tickets": tickets}


# ────────────────── Webhook Handler ──────────────────

@router.post("/zendesk/webhook/{instance_id}/{webhook_secret}")
async def zendesk_webhook(
    instance_id: str, webhook_secret: str,
    request: Request, background_tasks: BackgroundTasks,
):
    """Receive new ticket notifications from Zendesk."""
    cfg = await _db.zendesk_config.find_one({"instance_id": instance_id})
    if not cfg:
        raise HTTPException(status_code=404, detail="Not found")
    if cfg.get("webhook_secret") != webhook_secret:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not cfg.get("is_active", False):
        return {"ok": True, "skipped": "inactive"}

    try:
        event = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    ticket_id = event.get("ticket_id") or event.get("id")
    if not ticket_id:
        raise HTTPException(status_code=400, detail="ticket_id required")

    # Deduplication check
    event_id = event.get("event_id", f"ticket:{ticket_id}:created")
    existing_event = await _db.zendesk_events.find_one(
        {"instance_id": instance_id, "event_id": str(event_id)}
    )
    if existing_event:
        return {"ok": True, "skipped": "duplicate"}

    # Record event for dedup
    await _db.zendesk_events.insert_one({
        "instance_id": instance_id,
        "event_id": str(event_id),
        "ticket_id": str(ticket_id),
        "received_at": datetime.now(timezone.utc).isoformat(),
    })

    # Process in background to acknowledge quickly
    background_tasks.add_task(
        _process_zendesk_ticket, instance_id, str(ticket_id), cfg, event
    )
    return {"ok": True, "accepted": True}


async def _process_zendesk_ticket(instance_id: str, ticket_id: str, cfg: dict, event: dict):
    """Fetch ticket, run AI pipeline, post reply or store suggestion."""
    try:
        # Get ticket details from Zendesk
        ticket_data = await _zendesk_request(
            cfg["subdomain"], cfg["email"], cfg["api_token"],
            "GET", f"/tickets/{ticket_id}.json"
        )
        ticket = ticket_data.get("ticket", {})
        subject = ticket.get("subject", "")
        description = ticket.get("description", "")
        requester_id = ticket.get("requester_id")

        # Get ticket comments for full context
        comments_data = await _zendesk_request(
            cfg["subdomain"], cfg["email"], cfg["api_token"],
            "GET", f"/tickets/{ticket_id}/comments.json"
        )
        comments = comments_data.get("comments", [])
        # Build the user query from subject + last comment
        user_query = f"Subject: {subject}\n\n{description}"
        if len(comments) > 1:
            latest_comment = comments[-1].get("plain_body", comments[-1].get("body", ""))
            user_query = f"Subject: {subject}\n\nLatest message: {latest_comment}"

        # Run through AI pipeline
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
            # Add Zendesk-specific instructions
            system_prompt += """
You are responding to a Zendesk support ticket. Write a helpful, professional support response.
Be concise and actionable. If you don't have enough information to fully resolve the issue,
acknowledge the customer's concern and outline what you can help with.
Do not mention that you are an AI unless directly asked."""
            ai_response = await _call_claude(session_id, user_query, system_prompt,
                                             instance_id=instance_id, platform="zendesk")

        # Save conversation
        await _save_conversation(
            session_id=session_id,
            user_message=user_query,
            bot_response=ai_response,
            platform="zendesk",
            instance_id=instance_id,
            metadata={"ticket_id": ticket_id, "subject": subject, "requester_id": str(requester_id or "")},
        )

        now = datetime.now(timezone.utc).isoformat()

        # Store suggestion (always, for agent-assist sidebar)
        await _db.zendesk_suggestions.update_one(
            {"instance_id": instance_id, "ticket_id": ticket_id},
            {"$set": {
                "instance_id": instance_id,
                "ticket_id": ticket_id,
                "subject": subject,
                "suggestion": ai_response,
                "action_taken": "",
                "created_at": now,
            }},
            upsert=True,
        )

        # Auto-reply: Post public comment
        if cfg.get("auto_reply_enabled"):
            try:
                await _zendesk_request(
                    cfg["subdomain"], cfg["email"], cfg["api_token"],
                    "PUT", f"/tickets/{ticket_id}.json",
                    {"ticket": {"comment": {"body": ai_response, "public": True},
                                "tags": ["ai_processed", "bridgebot"]}}
                )
                # Post internal audit note
                await _zendesk_request(
                    cfg["subdomain"], cfg["email"], cfg["api_token"],
                    "PUT", f"/tickets/{ticket_id}.json",
                    {"ticket": {"comment": {
                        "body": f"[BridgeBot] AI auto-reply posted for ticket #{ticket_id}.",
                        "public": False,
                    }}}
                )
                await _db.zendesk_suggestions.update_one(
                    {"instance_id": instance_id, "ticket_id": ticket_id},
                    {"$set": {"action_taken": "auto_reply"}}
                )
                logger.info(f"Zendesk auto-reply posted for ticket {ticket_id} (instance {instance_id[:12]})")
            except Exception as e:
                logger.error(f"Failed to post Zendesk auto-reply for ticket {ticket_id}: {e}")
                await _db.zendesk_suggestions.update_one(
                    {"instance_id": instance_id, "ticket_id": ticket_id},
                    {"$set": {"action_taken": "auto_reply_failed", "error": str(e)}}
                )

        elif cfg.get("agent_assist_enabled"):
            await _db.zendesk_suggestions.update_one(
                {"instance_id": instance_id, "ticket_id": ticket_id},
                {"$set": {"action_taken": "agent_assist"}}
            )
            logger.info(f"Zendesk suggestion stored for ticket {ticket_id} (instance {instance_id[:12]})")

    except Exception as e:
        logger.error(f"Zendesk ticket processing error (instance={instance_id}, ticket={ticket_id}): {e}", exc_info=True)
