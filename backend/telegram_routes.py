"""
Telegram Bot integration routes for BridgeBot.
Handles: config CRUD, webhook setup, incoming message processing.
"""
import os
import logging
import secrets
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger("bridgebot.telegram")

router = APIRouter()

# ── These are set by init_telegram_routes() from server.py ───────────────
_db = None
_require_admin = None
_get_instance_access = None
_search_knowledge = None
_build_system_prompt = None
_call_claude = None
_save_conversation = None
_get_tone_examples_text = None
_try_api_query = None


def init_telegram_routes(
    db, require_admin_dep, get_instance_access_dep,
    search_knowledge_fn, build_system_prompt_fn, call_claude_fn,
    save_conversation_fn, get_tone_examples_text_fn, try_api_query_fn,
):
    """Inject shared dependencies from server.py."""
    global _db, _require_admin, _get_instance_access
    global _search_knowledge, _build_system_prompt, _call_claude
    global _save_conversation, _get_tone_examples_text, _try_api_query
    _db = db
    _require_admin = require_admin_dep
    _get_instance_access = get_instance_access_dep
    _search_knowledge = search_knowledge_fn
    _build_system_prompt = build_system_prompt_fn
    _call_claude = call_claude_fn
    _save_conversation = save_conversation_fn
    _get_tone_examples_text = get_tone_examples_text_fn
    _try_api_query = try_api_query_fn


# ────────────────── Pydantic models ──────────────────

class TelegramConfigUpdate(BaseModel):
    bot_token: Optional[str] = None
    listen_mode: Optional[str] = None  # "all" | "mention_or_command" | "dm_only"
    is_active: Optional[bool] = None


# ────────────────── Helper: Telegram API calls ──────────────────

async def _tg_request(token: str, method: str, data: dict = None):
    """Fire a Telegram Bot API call."""
    url = f"https://api.telegram.org/bot{token}/{method}"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(url, json=data or {})
        body = resp.json()
        if not body.get("ok"):
            raise HTTPException(status_code=400, detail=body.get("description", "Telegram API error"))
        return body.get("result")


async def _set_webhook(token: str, instance_id: str, webhook_secret: str):
    """Register webhook URL with Telegram."""
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
    if not base_url:
        raise HTTPException(status_code=500, detail="Cannot determine public URL for webhook registration")

    webhook_url = f"{base_url}/api/telegram/webhook/{instance_id}/{webhook_secret}"
    await _tg_request(token, "setWebhook", {"url": webhook_url, "allowed_updates": ["message"]})
    logger.info(f"Telegram webhook set for instance {instance_id[:12]}: {webhook_url}")


async def _delete_webhook(token: str):
    """Remove webhook from Telegram."""
    try:
        await _tg_request(token, "deleteWebhook")
    except Exception as e:
        logger.warning(f"Failed to delete Telegram webhook: {e}")


# ────────────────── Admin Config Endpoints ──────────────────

@router.get("/admin/telegram-config")
async def get_telegram_config(request: Request):
    """Get Telegram config for the current instance."""
    instance_id = await _get_instance_access(request)
    cfg = await _db.telegram_config.find_one({"instance_id": instance_id}, {"_id": 0})
    if not cfg:
        return {"instance_id": instance_id, "is_active": False, "listen_mode": "mention_or_command", "connected": False}
    # Mask token
    token = cfg.get("bot_token", "")
    cfg["bot_token_masked"] = f"***{token[-6:]}" if len(token) > 6 else "***"
    cfg.pop("bot_token", None)
    cfg.pop("webhook_secret", None)
    cfg["connected"] = bool(cfg.get("bot_username"))
    return cfg


@router.put("/admin/telegram-config")
async def update_telegram_config(body: TelegramConfigUpdate, request: Request):
    """Create or update Telegram config. Validates token with Telegram API."""
    instance_id = await _get_instance_access(request)
    existing = await _db.telegram_config.find_one({"instance_id": instance_id})
    now = datetime.now(timezone.utc).isoformat()

    update_fields = {}

    # If token is changing, validate it
    if body.bot_token and body.bot_token.strip():
        token = body.bot_token.strip()
        try:
            me = await _tg_request(token, "getMe")
        except HTTPException:
            raise HTTPException(status_code=400, detail="Invalid Telegram bot token. Please check your token from @BotFather.")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not validate token: {str(e)}")

        bot_username = me.get("username", "")
        bot_first_name = me.get("first_name", "")

        update_fields["bot_token"] = token
        update_fields["bot_username"] = bot_username
        update_fields["bot_first_name"] = bot_first_name
        update_fields["bot_id"] = me.get("id")

        # Generate webhook secret and register
        webhook_secret = secrets.token_urlsafe(32)
        update_fields["webhook_secret"] = webhook_secret

        # Delete old webhook if token changed
        if existing and existing.get("bot_token") and existing["bot_token"] != token:
            await _delete_webhook(existing["bot_token"])

        # Set new webhook
        await _set_webhook(token, instance_id, webhook_secret)

        # Auto-activate on first connection
        if not existing:
            update_fields["is_active"] = True

    if body.listen_mode is not None:
        if body.listen_mode not in ("all", "mention_or_command", "dm_only"):
            raise HTTPException(status_code=400, detail="listen_mode must be 'all', 'mention_or_command', or 'dm_only'")
        update_fields["listen_mode"] = body.listen_mode

    if body.is_active is not None:
        update_fields["is_active"] = body.is_active
        # If deactivating and we have a token, delete webhook
        if not body.is_active and existing and existing.get("bot_token"):
            await _delete_webhook(existing["bot_token"])
        # If activating and we have a token, re-register webhook
        if body.is_active and existing and existing.get("bot_token"):
            ws = existing.get("webhook_secret") or secrets.token_urlsafe(32)
            if not existing.get("webhook_secret"):
                update_fields["webhook_secret"] = ws
            await _set_webhook(existing["bot_token"], instance_id, ws)

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_fields["updated_at"] = now

    if existing:
        await _db.telegram_config.update_one({"instance_id": instance_id}, {"$set": update_fields})
    else:
        doc = {
            "instance_id": instance_id,
            "bot_token": "",
            "bot_username": "",
            "bot_first_name": "",
            "bot_id": None,
            "webhook_secret": "",
            "listen_mode": "mention_or_command",
            "is_active": False,
            "created_at": now,
            "updated_at": now,
        }
        doc.update(update_fields)
        await _db.telegram_config.insert_one(doc)

    return {"success": True, "message": "Telegram configuration updated"}


@router.delete("/admin/telegram-config")
async def delete_telegram_config(request: Request):
    """Disconnect Telegram bot from this instance."""
    instance_id = await _get_instance_access(request)
    existing = await _db.telegram_config.find_one({"instance_id": instance_id})
    if existing and existing.get("bot_token"):
        await _delete_webhook(existing["bot_token"])
    await _db.telegram_config.delete_one({"instance_id": instance_id})
    return {"success": True, "message": "Telegram integration removed"}


@router.post("/admin/telegram-config/test")
async def test_telegram_token(request: Request):
    """Test the saved Telegram bot token."""
    instance_id = await _get_instance_access(request)
    cfg = await _db.telegram_config.find_one({"instance_id": instance_id})
    if not cfg or not cfg.get("bot_token"):
        raise HTTPException(status_code=400, detail="No Telegram token configured")
    try:
        me = await _tg_request(cfg["bot_token"], "getMe")
        return {"success": True, "bot_username": me.get("username"), "bot_name": me.get("first_name")}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Token test failed: {str(e)}")


# ────────────────── Webhook Handler ──────────────────

@router.post("/telegram/webhook/{instance_id}/{webhook_secret}")
async def telegram_webhook(instance_id: str, webhook_secret: str, request: Request):
    """Receive and process incoming Telegram messages."""
    cfg = await _db.telegram_config.find_one({"instance_id": instance_id})
    if not cfg:
        raise HTTPException(status_code=404, detail="Not found")
    if cfg.get("webhook_secret") != webhook_secret:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not cfg.get("is_active", False):
        return {"ok": True, "skipped": "inactive"}

    try:
        update = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    message = update.get("message")
    if not message:
        return {"ok": True}

    text = message.get("text", "").strip()
    if not text:
        return {"ok": True}

    chat = message.get("chat", {})
    chat_id = chat.get("id")
    chat_type = chat.get("type", "private")
    from_user = message.get("from", {})
    username = from_user.get("username", from_user.get("first_name", "Unknown"))

    bot_username = cfg.get("bot_username", "")
    listen_mode = cfg.get("listen_mode", "mention_or_command")
    is_private = chat_type == "private"
    is_mentioned = f"@{bot_username}" in text if bot_username else False
    is_command = text.startswith("/ask ") or text.startswith(f"/ask@{bot_username}")

    # Check if this is a reply to the bot's own message
    reply_to = message.get("reply_to_message")
    is_reply_to_bot = reply_to and reply_to.get("from", {}).get("username") == bot_username

    # Apply listen mode filter
    if listen_mode == "dm_only" and not is_private:
        return {"ok": True}

    if listen_mode == "mention_or_command" and not is_private:
        if not is_mentioned and not is_command and not is_reply_to_bot:
            return {"ok": True}

    # Clean up the message text (remove @mention and /ask prefix)
    clean_text = text
    if is_command:
        clean_text = text.split(" ", 1)[1] if " " in text else ""
    if is_mentioned and bot_username:
        clean_text = clean_text.replace(f"@{bot_username}", "").strip()

    if not clean_text:
        await _send_telegram_reply(cfg["bot_token"], chat_id,
            f"Send me a question! Use /ask followed by your question, or mention me with @{bot_username}")
        return {"ok": True}

    # Process in background so we return 200 immediately to Telegram
    import asyncio
    asyncio.create_task(_process_telegram_message(
        instance_id=instance_id,
        chat_id=chat_id,
        user_text=clean_text,
        username=username,
        user_id=str(from_user.get("id", "")),
        bot_token=cfg["bot_token"],
        message_id=message.get("message_id"),
    ))

    return {"ok": True}


async def _process_telegram_message(
    instance_id: str, chat_id: int, user_text: str,
    username: str, user_id: str, bot_token: str, message_id: int = None,
):
    """Process a Telegram message through the BridgeBot AI pipeline."""
    session_id = f"tg_{chat_id}_{instance_id}"

    try:
        # Send "typing" action
        await _tg_request(bot_token, "sendChatAction", {"chat_id": chat_id, "action": "typing"})

        bot_config = await _db.bot_config.find_one({"instance_id": instance_id}, {"_id": 0}) or {}
        knowledge = await _search_knowledge(user_text, instance_id)

        has_api_integrations = await _db.api_integrations.count_documents(
            {"instance_id": instance_id, "enabled": True}
        ) > 0

        if knowledge == "__NO_KB__" and not has_api_integrations:
            response = "I don't have any knowledge base configured yet. Please check back later."
        else:
            api_result = await _try_api_query(user_text, bot_config, knowledge, instance_id, session_id)
            api_context = ""
            api_sources = []
            if api_result:
                api_context, api_sources = api_result
            tone = await _get_tone_examples_text(instance_id, bot_config)
            system_prompt = _build_system_prompt(
                bot_config, knowledge, tone,
                knowledge_gate=bot_config.get("knowledge_gate", "strict"),
                api_context=api_context, api_sources=api_sources,
                has_api_integrations=has_api_integrations,
            )
            response = await _call_claude(session_id, user_text, system_prompt,
                                          instance_id=instance_id, platform="telegram")

        # Save conversation
        await _save_conversation(
            session_id=session_id,
            user_message=user_text,
            bot_response=response,
            platform="telegram",
            instance_id=instance_id,
            metadata={"username": username, "user_id": user_id, "chat_id": str(chat_id)},
        )

        # Send reply
        await _send_telegram_reply(bot_token, chat_id, response, reply_to=message_id)

    except Exception as e:
        logger.error(f"Telegram message processing error (instance={instance_id}): {e}", exc_info=True)
        try:
            await _send_telegram_reply(
                bot_token, chat_id,
                "Sorry, I encountered an error processing your message. Please try again.",
                reply_to=message_id,
            )
        except Exception:
            pass


async def _send_telegram_reply(token: str, chat_id: int, text: str, reply_to: int = None):
    """Send a message back to Telegram. Handles long messages by splitting."""
    MAX_LEN = 4096
    chunks = [text[i:i+MAX_LEN] for i in range(0, len(text), MAX_LEN)] if len(text) > MAX_LEN else [text]

    for i, chunk in enumerate(chunks):
        data = {"chat_id": chat_id, "text": chunk, "parse_mode": "Markdown"}
        if reply_to and i == 0:
            data["reply_to_message_id"] = reply_to
        try:
            await _tg_request(token, "sendMessage", data)
        except Exception:
            # Fallback: send without Markdown if parsing fails
            data.pop("parse_mode", None)
            try:
                await _tg_request(token, "sendMessage", data)
            except Exception as e:
                logger.error(f"Failed to send Telegram message: {e}")
