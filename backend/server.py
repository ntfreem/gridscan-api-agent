from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Depends, Header, Response, Cookie, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from dotenv import load_dotenv
import os
import logging
import asyncio
import uuid
import re
import jwt
import bcrypt
import secrets
from datetime import datetime, timezone, timedelta
from pathlib import Path
import httpx
import hashlib
import contextvars
import time as _time

# Context variable to track which API key initiated a request (set in /v1/chat endpoints)
_current_api_key_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar('api_key_id', default=None)

from emergentintegrations.llm.chat import LlmChat, UserMessage
import resend

import api_integrations_routes
from api_integrations import build_endpoint_selection_context, build_schema_context

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ["JWT_SECRET"]  # Required — no hardcoded fallback
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 7
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]

DISCORD_CLIENT_ID = os.environ.get("DISCORD_CLIENT_ID", "")
DISCORD_CLIENT_SECRET = os.environ.get("DISCORD_CLIENT_SECRET", "")
DISCORD_REDIRECT_URI = os.environ.get("DISCORD_REDIRECT_URI", "")
DISCORD_BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "")
DISCORD_BOT_PERMISSIONS = 68608 | 67108864  # View Channels + Send Messages + Read Message History + Change Nickname
async def get_discord_credentials():
    """Read Discord app credentials from DB. DB is the single source of truth —
    no .env fallback (so clearing in the UI actually clears)."""
    creds = await db.discord_app_config.find_one({"_id": "discord_app"}) or {}
    return {
        "client_id": creds.get("client_id") or "",
        "client_secret": creds.get("client_secret") or "",
        "redirect_uri": creds.get("redirect_uri") or "",
        "bot_token": creds.get("bot_token") or "",
    }

mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]

app = FastAPI()
api_router = APIRouter(prefix="/api")

llm_sessions: Dict[str, LlmChat] = {}
# Conversation history cache for non-Emergent providers (Anthropic SDK, Ollama).
# emergentintegrations' LlmChat manages its own history; for the other providers we keep
# a parallel { session_key: [{"role": "user|assistant", "content": str}, …] } map.
llm_history: Dict[str, List[dict]] = {}

# Anthropic models allowed for the BYO path (allowlist for cost control).
# Map UI short-name → real API model id (verified against Emergent's model catalog).
ALLOWED_ANTHROPIC_MODELS = {
    "claude-haiku-4-5":  "claude-haiku-4-5-20251001",
    "claude-sonnet-4-5": "claude-sonnet-4-5-20250929",
    "claude-opus-4-5":   "claude-opus-4-5-20251101",
    "claude-sonnet-4-6": "claude-sonnet-4-6",
    "claude-opus-4-8":   "claude-opus-4-8",
}
DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6"
DEFAULT_OLLAMA_MODEL = "llama3.1"
DEFAULT_EMERGENT_MODEL = "claude-sonnet-4-6"

ALLOWED_OPENAI_MODELS = {
    "gpt-4o": "gpt-4o",
    "gpt-4.1": "gpt-4.1",
    "gpt-4.1-mini": "gpt-4.1-mini",
    "gpt-5": "gpt-5",
    "gpt-5-mini": "gpt-5-mini",
    "gpt-5.4": "gpt-5.4",
    "gpt-5.4-mini": "gpt-5.4-mini",
    "gpt-5.5": "gpt-5.5",
    "gpt-5.6-terra": "gpt-5.6-terra",
    "o3": "o3",
    "o4-mini": "o4-mini",
}
DEFAULT_OPENAI_MODEL = "gpt-4o"

# Per-instance Discord bot tracking
# Guild-to-instance mapping for shared token routing
guild_instance_map: Dict[str, str] = {}  # {guild_id: instance_id}

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

resend.api_key = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = "noreply@bridgebot.tech"
async def send_verification_email(to_email: str, code: str):
    """Send verification code email via Resend. Falls back to console log if key not set."""
    if not resend.api_key:
        logger.warning("RESEND_API_KEY not set — printing code to logs")
        print(f"\n{'='*50}\nMOCK EMAIL (no Resend key)\nTo: {to_email}\nCode: {code}\n{'='*50}\n")
        return
    try:
        html = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111;color:#fff;padding:32px;border-radius:8px">
          <h2 style="margin:0 0 8px;font-size:22px">BridgeBot</h2>
          <p style="color:#a1a1aa;margin:0 0 28px;font-size:14px">Email Verification</p>
          <p style="font-size:14px;margin:0 0 16px">Your verification code is:</p>
          <div style="background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:20px;text-align:center;margin-bottom:24px">
            <span style="font-family:monospace;font-size:32px;font-weight:700;letter-spacing:0.4em;color:#fff">{code}</span>
          </div>
          <p style="color:#a1a1aa;font-size:13px;margin:0">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
        </div>
        """
        params = {
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": "Your BridgeBot verification code",
            "html": html,
        }
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Verification email sent to {to_email}")
    except Exception as e:
        logger.error(f"Resend error: {e} — falling back to log")
        print(f"\n{'='*50}\nFALLBACK EMAIL\nTo: {to_email}\nCode: {code}\n{'='*50}\n")
async def send_reset_email(to_email: str, code: str):
    """Send password reset code via Resend. Falls back to console log if key not set."""
    if not resend.api_key:
        print(f"\n{'='*50}\nMOCK RESET EMAIL\nTo: {to_email}\nCode: {code}\n{'='*50}\n")
        return
    try:
        html = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111;color:#fff;padding:32px;border-radius:8px">
          <h2 style="margin:0 0 8px;font-size:22px">BridgeBot</h2>
          <p style="color:#a1a1aa;margin:0 0 28px;font-size:14px">Password Reset</p>
          <p style="font-size:14px;margin:0 0 16px">Your password reset code is:</p>
          <div style="background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:20px;text-align:center;margin-bottom:24px">
            <span style="font-family:monospace;font-size:32px;font-weight:700;letter-spacing:0.4em;color:#fff">{code}</span>
          </div>
          <p style="color:#a1a1aa;font-size:13px;margin:0">This code expires in 15 minutes. If you didn't request a reset, ignore this email.</p>
        </div>
        """
        params = {
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": "Reset your BridgeBot password",
            "html": html,
        }
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Password reset email sent to {to_email}")
    except Exception as e:
        logger.error(f"Resend error (reset): {e}")
        print(f"\n{'='*50}\nFALLBACK RESET EMAIL\nTo: {to_email}\nCode: {code}\n{'='*50}\n")
class UserRegister(BaseModel):
    email: str
    password: str
    username: str

class UserLogin(BaseModel):
    email_or_username: str
    password: str

class VerifyEmailBody(BaseModel):
    email: str
    code: str

class ResendCodeBody(BaseModel):
    email: str

class ForgotPasswordBody(BaseModel):
    email: str

class ResetPasswordBody(BaseModel):
    email: str
    code: str
    new_password: str

class BotInstanceCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class AssignUser(BaseModel):
    user_email: str

class BotConfigUpdate(BaseModel):
    name: Optional[str] = None
    persona: Optional[str] = None
    custom_instructions: Optional[str] = None
    tone_instructions: Optional[str] = None
    manual_tone_examples: Optional[List[dict]] = None
    knowledge_gate: Optional[str] = None  # "strict" | "flexible"
    api_query_enabled: Optional[bool] = None
    api_base_url: Optional[str] = None
    api_key_header: Optional[str] = None
    api_key_value: Optional[str] = None
class LLMProviderConfig(BaseModel):
    """Per-instance LLM provider settings. Stored on bot_instances.llm_config."""
    provider: str  # "emergent" | "anthropic" | "ollama" | "openai"
    model: Optional[str] = None
    anthropic_api_key: Optional[str] = None  # only used when provider == "anthropic"
    openai_api_key: Optional[str] = None     # only used when provider == "openai"
    ollama_base_url: Optional[str] = None    # only used when provider == "ollama"; defaults to OLLAMA_BASE_URL env

class FAQEntry(BaseModel):
    title: str
    content: str
    tags: Optional[List[str]] = []
    priority: Optional[int] = 0

class URLEntry(BaseModel):
    url: str
    title: Optional[str] = None
    priority: Optional[int] = 0
    auth_username: Optional[str] = None
    auth_password: Optional[str] = None

class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None
    instance_id: Optional[str] = None

class ApproveBody(BaseModel):
    approved: bool = True

class ScriptedVariant(BaseModel):
    text: str
class ScriptedModeConfig(BaseModel):
    enabled: Optional[bool] = None
    primary_message: Optional[str] = None
    update_message: Optional[str] = None       # 2nd response when same user comes back
    variants: Optional[List[str]] = None
    acknowledgment_replies: Optional[List[str]] = None  # short replies for "thanks/ok/got it" (AI-router pool)
    fallback_message: Optional[str] = None
    max_attempts: Optional[int] = None
    reset_hours: Optional[int] = None
    rephrase_mode: Optional[str] = None   # ai | manual | hybrid
    classify_intent: Optional[bool] = None  # if True, Claude classifies user intent (question/update vs speculation)
class DiscordConfigUpdate(BaseModel):
    bot_token: Optional[str] = None
    is_active: Optional[bool] = None
    listen_mode: Optional[str] = None          # mention_only | all_channels | specific_channels
    monitored_channel_ids: Optional[List[str]] = None
    reply_style: Optional[str] = None          # natural | with_mention
    staff_role_name: Optional[str] = None      # role name for human takeover detection
    handoff_cooldown_minutes: Optional[int] = None  # minutes before bot re-engages after staff reply
    handoff_followup_message: Optional[str] = None  # message bot sends when re-engaging
    passive_mode: Optional[bool] = None        # if True, only reply when bot can answer from KB (skip small-talk)
    scripted_mode: Optional[ScriptedModeConfig] = None
# ==================== JWT AUTH HELPERS ====================

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
async def get_current_user(
    authorization: Optional[str] = Header(None),
    bf_access_token: Optional[str] = Cookie(None)
) -> dict:
    # Prefer Authorization header (curl/API clients), fall back to httpOnly cookie
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    elif bf_access_token:
        token = bf_access_token
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {"id": payload["sub"], "email": payload["email"], "role": payload["role"]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "superadmin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
async def _verify_instance_access(x_instance_id: Optional[str], current_user: dict) -> str:
    if not x_instance_id:
        raise HTTPException(status_code=400, detail="X-Instance-ID header required")
    if current_user["role"] == "superadmin":
        return x_instance_id
    instance = await db.bot_instances.find_one({"id": x_instance_id}, {"_id": 0})
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    if current_user["id"] not in instance.get("assigned_user_ids", []):
        raise HTTPException(status_code=403, detail="Access denied to this instance")
    return x_instance_id
async def get_instance_access(
    x_instance_id: Optional[str] = Header(None, alias="X-Instance-ID"),
    current_user: dict = Depends(get_current_user)
) -> str:
    return await _verify_instance_access(x_instance_id, current_user)

# Initialize API integrations sub-module
async def _get_instance_from_request(request):
    """Extract instance_id from a Request, usable outside Depends()."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    from jose import jwt as jose_jwt
    try:
        payload = jose_jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    inst_id = request.headers.get("X-Instance-ID")
    return await _verify_instance_access(inst_id, user)

api_integrations_routes.init(db, _get_instance_from_request)
api_router.include_router(api_integrations_routes.router)
@api_router.post("/admin/api-test")
async def test_api_query(body: dict, instance_id: str = Depends(get_instance_access)):
    """Admin tool to test an API endpoint directly. Returns raw JSON response."""
    bot_config = await db.bot_config.find_one({"instance_id": instance_id}, {"_id": 0}) or {}
    if not bot_config.get("api_query_enabled"):
        raise HTTPException(status_code=400, detail="Live API queries are not enabled for this instance")
    base_url = (bot_config.get("api_base_url") or "").strip().rstrip("/")
    api_key_header = (bot_config.get("api_key_header") or "").strip()
    api_key_value = (bot_config.get("api_key_value") or "").strip()
    if not base_url:
        raise HTTPException(status_code=400, detail="API base URL is not configured")

    path = (body.get("path") or "").strip()
    if not path.startswith("/api/"):
        path = f"/api/{path.lstrip('/')}"

    full_url = f"{base_url}{path}"
    headers = {"Accept": "application/json"}
    if api_key_header and api_key_value:
        headers[api_key_header] = api_key_value

    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            resp = await http.get(full_url, headers=headers)
        try:
            data = resp.json()
        except Exception:
            data = resp.text[:5000]
        return {"status": resp.status_code, "url": full_url, "data": data}
    except Exception as e:
        return {"status": 0, "url": full_url, "error": str(e)}


# ==================== KNOWLEDGE / TONE HELPERS ====================

async def search_knowledge(query: str, instance_id: str, limit: int = 5) -> str:
    try:
        # ── Step 1: Try MongoDB text search for relevance ──
        text_results = []
        if query and query.strip():
            try:
                text_results = await db.knowledge_sources.find(
                    {"$text": {"$search": query}, "is_active": True, "instance_id": instance_id},
                    {"_id": 0, "score": {"$meta": "textScore"}},
                ).sort([("score", {"$meta": "textScore"})]).to_list(limit)
            except Exception:
                pass  # text index may not exist yet; fall through to brute-force

        # ── Step 2: Fallback — load all active sources sorted by priority ──
        if not text_results:
            all_sources = await db.knowledge_sources.find(
                {"is_active": True, "instance_id": instance_id}, {"_id": 0}
            ).sort([("priority", -1), ("created_at", -1)]).to_list(100)
        else:
            # If text search matched grouped chunks, pull in ALL sibling chunks from same group
            matched_groups = set()
            for r in text_results:
                gid = r.get("group_id")
                if gid:
                    matched_groups.add(gid)
            if matched_groups:
                # Load all chunks from matched groups + keep non-group text results
                group_sources = await db.knowledge_sources.find(
                    {"group_id": {"$in": list(matched_groups)}, "is_active": True, "instance_id": instance_id}, {"_id": 0}
                ).sort([("created_at", 1)]).to_list(200)
                # Add non-grouped text results
                non_group = [r for r in text_results if not r.get("group_id") or r.get("group_id") not in matched_groups]
                all_sources = group_sources + non_group
            else:
                all_sources = text_results

        if not all_sources:
            return "__NO_KB__"  # Signal: no knowledge base configured at all

        # ── Step 3: Extract relevant content windows per source ──
        query_lower = (query or "").lower().split()
        chunks = []
        total_chars = 0
        for r in all_sources:
            title = r.get("title", "Unknown")
            full_content = r.get("content", "")
            pri = r.get("priority", 0)
            pri_label = " [PRIORITY: HIGH]" if pri >= 2 else (" [PRIORITY: MEDIUM]" if pri == 1 else "")

            # For grouped chunks (multi-part sources), include FULL content
            is_grouped = bool(r.get("group_id"))
            if is_grouped:
                content = full_content  # Include everything — chunks are pre-sized at ~8K
            elif len(full_content) > 2500 and query_lower:
                content = _extract_relevant_window(full_content, query_lower, window_size=2500)
            else:
                content = full_content[:2500]

            chunk = f"[{title}]{pri_label}\n{content}"
            if total_chars + len(chunk) > 60000:
                break
            chunks.append(chunk)
            total_chars += len(chunk)
        return "\n\n".join(chunks)
    except Exception as e:
        logger.warning(f"Knowledge search: {e}")
        return ""
def _extract_relevant_window(content: str, query_words: list, window_size: int = 2500) -> str:
    """Find the section of content most relevant to the query and return a window around it."""
    content_lower = content.lower()
    best_pos = 0
    best_score = -1
    # Filter out very short/common words for better matching
    meaningful_words = [w for w in query_words if len(w) > 2]
    if not meaningful_words:
        meaningful_words = query_words

    # Score positions by frequency of query words (not just presence)
    step = 200
    for pos in range(0, max(1, len(content) - window_size), step):
        window = content_lower[pos:pos + window_size]
        score = sum(window.count(w) for w in meaningful_words)
        if score > best_score:
            best_score = score
            best_pos = pos

    # If no matches found, return the start
    if best_score <= 0:
        return content[:window_size]

    # Expand to nearest paragraph boundaries
    start = max(0, best_pos)
    # Try to start at a paragraph/Q&A break
    for sep in ["\nQ: ", "\n\n##", "\n\n"]:
        break_pos = content.rfind(sep, max(0, start - 300), start)
        if break_pos > 0:
            start = break_pos + 1
            break
    end = min(len(content), start + window_size)
    return content[start:end].strip()
async def get_tone_examples_text(instance_id: str, bot_config: dict = None) -> str:
    parts = []
    if bot_config:
        manual = bot_config.get("manual_tone_examples", []) or []
        for ex in manual[:3]:
            if ex.get("user_msg") and ex.get("bot_msg"):
                label = ex.get("label", "")
                header = f"[{label}]" if label else "[Crafted Example]"
                parts.append(f"{header}\nUSER: {ex['user_msg']}\nASSISTANT: {ex['bot_msg']}")
    try:
        examples = await db.conversations.find(
            {"is_approved_for_training": True, "instance_id": instance_id}, {"messages": 1, "_id": 0}
        ).limit(3).to_list(3)
        for ex in examples:
            msgs = ex.get("messages", [])[:6]
            if msgs:
                text = "\n".join([f"{m['role'].upper()}: {m['content'][:400]}" for m in msgs])
                parts.append(text)
    except Exception as e:
        logger.warning(f"Tone examples: {e}")
    if not parts:
        return ""
    return "\n\n---\n\n".join(parts[:5])
def build_system_prompt(bot_config: dict, knowledge_context: str = "", tone_examples: str = "", passive_mode: bool = False, allow_skip: bool = False, knowledge_gate: str = "strict", api_context: str = "", api_sources: list = None) -> str:
    name = bot_config.get("name", "Assistant")
    persona = bot_config.get("persona", "You are a helpful, friendly assistant.")
    custom_instructions = bot_config.get("custom_instructions", "")
    tone_instructions = bot_config.get("tone_instructions", "")
    api_enabled = bot_config.get("api_query_enabled", False)

    parts = [f"You are {name}. {persona}"]

    if knowledge_context == "__NO_KB__":
        parts.append(
            "IMPORTANT — NO KNOWLEDGE BASE CONFIGURED:\n"
            "This bot instance does not have any knowledge base entries configured yet.\n"
            "You MUST NOT answer questions using your general knowledge.\n"
            "For ANY question, respond with something like:\n"
            "\"I don't have any knowledge base configured yet. Please check back later "
            "or contact the administrator to set up my knowledge base.\"\n"
            "Be polite and brief. Do not attempt to answer the question."
        )
    elif knowledge_context:
        if knowledge_gate == "strict":
            parts.append(
                "KNOWLEDGE BASE — YOUR ONLY SOURCE OF TRUTH:\n"
                "The following information is your ONLY source for answering questions. "
                "When a user's question is answered by this knowledge base, respond with full confidence. "
                "State facts directly. DO NOT use hedging phrases like 'I think', 'I believe', 'I'm not sure', "
                "'you may want to verify', or 'I cannot confirm' when the answer is present here.\n\n"
                "KNOWLEDGE GATE — STRICT RULE:\n"
                "You MUST ONLY answer using the knowledge base content provided below. "
                "NEVER supplement, expand, or fill gaps with your general AI training knowledge. "
                "If the user asks about something NOT covered in the knowledge base below, say:\n"
                "\"I don't have information about that in my knowledge base.\"\n"
                "Do NOT offer information from your training data. Do NOT mention other tools, APIs, "
                "services, or resources unless they are explicitly mentioned in the knowledge base below. "
                "If you don't find it below, you don't know it.\n\n"
                f"{knowledge_context}"
            )
        else:
            # Flexible mode: KB-first, but can use general knowledge with clear labeling
            parts.append(
                "KNOWLEDGE BASE — PRIMARY SOURCE:\n"
                "The following information is verified and accurate. When a user's question is answered by "
                "this knowledge base, respond with full confidence. State facts directly. "
                "DO NOT use hedging phrases like 'I think', 'I believe', 'I'm not sure' when the answer is present here.\n\n"
                "KNOWLEDGE GATE — FLEXIBLE RULE:\n"
                "Always check the knowledge base FIRST. If the answer is there, use it with confidence.\n"
                "If the user asks about something NOT in the knowledge base, you MAY answer from your general "
                "knowledge BUT you MUST clearly label it. Prefix your answer with:\n"
                "\"This isn't in my knowledge base, but from my general knowledge:\"\n"
                "Never mix KB facts with general knowledge in the same answer without labeling which is which.\n\n"
                f"{knowledge_context}"
            )
    else:
        if knowledge_gate == "strict":
            parts.append(
                "KNOWLEDGE BASE RESULT: No matching entries were found for the user's query.\n\n"
                "KNOWLEDGE GATE — STRICT RULE:\n"
                "You MUST NOT answer the question using your general AI training knowledge.\n"
                "Respond with something like:\n"
                "\"I don't have information about that in my knowledge base. "
                "Is there something else I can help you with?\"\n"
                "Be polite and brief. Do NOT offer to search elsewhere, expand your search, "
                "or answer from general knowledge. Simply acknowledge you don't have the information."
            )
        else:
            parts.append(
                "KNOWLEDGE BASE RESULT: No matching entries were found for the user's query.\n\n"
                "KNOWLEDGE GATE — FLEXIBLE RULE:\n"
                "No results were found in the knowledge base. You MAY answer from your general knowledge, "
                "but you MUST clearly tell the user the answer is NOT from the knowledge base. Prefix with:\n"
                "\"This isn't in my knowledge base, but from my general knowledge:\"\n"
                "Keep it honest and transparent."
            )

    if tone_examples:
        tone_header = "COMMUNICATION STYLE — MATCH THIS PRECISELY"
        if tone_instructions:
            tone_header += f"\nTone guide: {tone_instructions}"
        parts.append(
            f"{tone_header}\n"
            "Study these examples carefully. Mirror the exact vocabulary, sentence length, "
            f"formality level, and energy from these exchanges:\n\n{tone_examples}"
        )
    elif tone_instructions:
        parts.append(f"COMMUNICATION STYLE:\n{tone_instructions}")

    if custom_instructions:
        parts.append(f"ADDITIONAL INSTRUCTIONS:\n{custom_instructions}")

    # Anti-fabrication rule — always included
    if api_context:
        # Already injected above — just reinforce the no-fabrication rule
        parts.append(
            "RULE: NEVER fabricate data. NEVER generate fake JSON, API responses, or made-up numbers. "
            "Only present data that comes from the API results or Knowledge Base provided above."
        )
    elif bot_config.get("api_query_enabled"):
        parts.append(
            "IMPORTANT — LIVE API CAPABILITY:\n"
            "You can query configured APIs to get live data. When a user asks for real-time data, "
            "ask them for the specific identifier (hash, address, etc.) if they haven't provided one, "
            "and the system will make the API call for you.\n"
            "NEVER fabricate or invent data. If you present data, it must come from an actual API response "
            "provided to you. NEVER generate fake JSON, made-up hashes, or invented numbers."
        )
    else:
        parts.append(
            "RULE: NEVER fabricate data. NEVER generate fake JSON, API responses, or made-up numbers. "
            "If you don't have specific data, help the user with documentation and curl commands instead."
        )

    # Inject live API context when present — unified KB + API reasoning
    if api_context:
        source_list = ", ".join(api_sources or [])
        parts.append(
            "LIVE API DATA — USE THIS ALONGSIDE THE KNOWLEDGE BASE:\n"
            "The system has made live API calls on behalf of the user. The raw results are below.\n"
            "Use documented field descriptions and response schemas to interpret the data accurately.\n"
            "Combine this live data with relevant Knowledge Base information to form a single, "
            "coherent answer. Do NOT return raw JSON — summarize the data in natural language.\n"
            "If an API call returned an error, explain what went wrong using the documented error codes.\n"
            "NEVER fabricate data beyond what is shown below.\n\n"
            f"{api_context}\n\n"
            f"Sources: {source_list}"
        )

    if passive_mode and allow_skip:
        parts.append(
            "PASSIVE MODE — STAY SILENT WHEN UNCERTAIN:\n"
            "You are monitoring a busy channel. You must NOT respond to small talk, statements, "
            "greetings, opinions, jokes, or off-topic chatter.\n"
            "ONLY respond when ALL of the following are true:\n"
            "  1. The message is clearly a question or a request for help, AND\n"
            "  2. The KNOWLEDGE BASE above contains enough information for you to give a useful, "
            "     accurate answer.\n"
            "If either condition is not met, output exactly this single token and nothing else: [SKIP]\n"
            "Do not explain. Do not greet. Do not apologize. Just output [SKIP] on its own.\n"
            "When you do answer, answer normally — do not mention this passive mode."
        )

    return "\n\n".join(parts)
async def _classify_user_intent(user_text: str, session_id: str, instance_id: str) -> str:
    """Quick Claude classification: returns one of `question`, `update`, `ack`, `speculation`, `other`.
    Used by Scripted Mode v2 to decide whether to respond or stay silent."""
    system = (
        "You classify a single user message in a support/incident channel. Output EXACTLY one word from this list:\n"
        "  question     — genuine question or request for information (e.g., \"is the bridge down?\")\n"
        "  update       — asking for an update on a known incident (e.g., \"any update?\", \"still paused?\", \"is it back?\")\n"
        "  ack          — short acknowledgment, thanks, greeting, or closing (e.g., \"thanks\", \"ok\", \"got it\", \"hi\", \"thank you\", \"appreciate it\", \"np\")\n"
        "  speculation  — opinion, commentary, joke, complaint, or off-topic chatter (e.g., \"this is a disaster\", \"lol\", \"team sleeping\")\n"
        "  other        — anything else\n"
        "Output ONLY the single word, lowercase. No punctuation, no preamble."
    )
    try:
        out = await call_claude(
            f"{session_id}_intent_{datetime.now(timezone.utc).timestamp()}",
            user_text,
            system,
            instance_id=instance_id,
            platform="discord",
        )
        cleaned = (out or "").strip().lower().split()[0] if out else ""
        if cleaned in ("question", "update", "ack", "speculation", "other"):
            return cleaned
    except Exception as e:
        logger.warning(f"Intent classify failed: {e}")
    return "other"
async def _ai_pick_variant(user_text: str, options: List[str], session_id: str, instance_id: str) -> int:
    """Ask Claude to pick the index (1-based) of the best pre-written reply from `options`
    for the given user message. Returns the 1-based index, or 0 if nothing fits.
    AI NEVER generates text — it only selects from the admin-defined pool."""
    if not options:
        return 0
    numbered = "\n".join(f"{i+1}. {o}" for i, o in enumerate(options))
    system = (
        "You are a router. Given a USER MESSAGE and a numbered list of pre-written REPLIES, "
        "pick the number of the reply that best fits the user's message. "
        "You MUST NOT write new text — only return a number.\n"
        "Rules:\n"
        "1. Output ONLY the integer (e.g. '1', '2', '3').\n"
        "2. Output '0' if no reply in the list is appropriate for the user message.\n"
        "3. Do not include any other words, punctuation, or explanation."
    )
    prompt = f"USER MESSAGE:\n{user_text}\n\nREPLIES:\n{numbered}\n\nBest reply number:"
    try:
        out = await call_claude(
            f"{session_id}_pick_{datetime.now(timezone.utc).timestamp()}",
            prompt,
            system,
            instance_id=instance_id,
            platform="discord",
        )
        # Scan the entire LLM output for the first signed integer.
        # Handles 'option 2', 'Pick: 1', '  3 ', '2.', etc. Negative values are out-of-range → 0.
        m = re.search(r'-?\d+', out or "")
        if not m:
            return 0
        idx = int(m.group(0))
        if 1 <= idx <= len(options):
            return idx
        return 0
    except Exception as e:
        logger.warning(f"AI pick variant failed: {e}")
        return 0
DEFAULT_ACK_REPLIES = [
    "You're welcome!",
    "Anytime — happy to help!",
    "No problem!",
    "Glad I could help.",
]
async def _decide_scripted_reply(
    scripted_cfg: dict,
    current_count: int,
    used_replies: List[str],
    user_text: str,
    session_id: str,
    instance_id: str,
) -> dict:
    """Pure Scripted Mode v5 decision logic — NO database I/O.

    Returns a dict:
      {
        "reply": str,                 # the chosen response (empty string = silent)
        "pool_name": str,             # primary | update | variant | ack | fallback | silent
        "intent": str | None,         # classified intent (None if not classified)
        "pool_considered": List[str], # the candidate list the router picked from (empty for fixed-verbatim msg1/msg2)
        "skip_reason": str | None,    # set when reply is empty: max_attempts | speculation | exhausted | no_primary | manual_silent
      }

    Used by both the live `build_scripted_response` and the `/discord/scripted-mode/sandbox` endpoint.
    """
    primary = (scripted_cfg.get("primary_message") or "").strip()
    if not primary:
        return {"reply": "", "pool_name": "silent", "intent": None, "pool_considered": [], "skip_reason": "no_primary"}
    update_msg = (scripted_cfg.get("update_message") or "").strip()
    variants = [v.strip() for v in (scripted_cfg.get("variants") or []) if isinstance(v, str) and v.strip()]
    ack_replies_raw = scripted_cfg.get("acknowledgment_replies")
    if not isinstance(ack_replies_raw, list) or not any(isinstance(x, str) and x.strip() for x in ack_replies_raw):
        ack_replies_raw = DEFAULT_ACK_REPLIES
    ack_replies = [a.strip() for a in ack_replies_raw if isinstance(a, str) and a.strip()]
    fallback = (scripted_cfg.get("fallback_message") or "").strip()
    max_attempts = int(scripted_cfg.get("max_attempts") or 10)
    mode = (scripted_cfg.get("rephrase_mode") or "hybrid").lower()
    classify_on = bool(scripted_cfg.get("classify_intent"))
    ai_router_on = mode in ("ai", "hybrid")

    # Hard cap — silent without firing the LLM
    if current_count >= max_attempts:
        return {"reply": "", "pool_name": "silent", "intent": None, "pool_considered": [], "skip_reason": "max_attempts"}

    # Intent classification (only when needed)
    intent = None
    needs_intent = (
        ai_router_on and (current_count >= 2 or (current_count == 1 and not update_msg))
    ) or classify_on
    if needs_intent and user_text:
        try:
            intent = await _classify_user_intent(user_text, session_id, instance_id)
        except Exception as _e:
            logger.warning(f"[SCRIPTED] intent classify exception, treating as 'other': {_e}")
            intent = "other"
        if intent == "speculation":
            return {"reply": "", "pool_name": "silent", "intent": intent, "pool_considered": [], "skip_reason": "speculation"}

    # Fixed verbatim Reply 1 and Reply 2 (never AI for these)
    if current_count == 0:
        return {"reply": primary, "pool_name": "primary", "intent": intent, "pool_considered": [primary], "skip_reason": None}
    if current_count == 1 and update_msg:
        return {"reply": update_msg, "pool_name": "update", "intent": intent, "pool_considered": [update_msg], "skip_reason": None}

    # Msg 3+ (or msg 2 if update_msg is blank) — AI router OR manual-mode silence
    if not ai_router_on:
        return {"reply": "", "pool_name": "silent", "intent": intent, "pool_considered": [], "skip_reason": "manual_silent"}

    # Acknowledgment → pick from ack pool (cycles once exhausted)
    if intent == "ack" and ack_replies:
        unused = [a for a in ack_replies if a not in used_replies] or ack_replies
        idx = await _ai_pick_variant(user_text, unused, session_id, instance_id)
        reply = unused[idx - 1] if idx > 0 else unused[0]
        return {"reply": reply, "pool_name": "ack", "intent": intent, "pool_considered": unused, "skip_reason": None}

    # Question / update / other → variants pool (filtered)
    unused_variants = [v for v in variants if v not in used_replies]
    if unused_variants:
        idx = await _ai_pick_variant(user_text, unused_variants, session_id, instance_id)
        if idx > 0:
            return {"reply": unused_variants[idx - 1], "pool_name": "variant", "intent": intent, "pool_considered": unused_variants, "skip_reason": None}

    # Nothing fits — fallback (once per conversation)
    if fallback and fallback not in used_replies:
        return {"reply": fallback, "pool_name": "fallback", "intent": intent, "pool_considered": [fallback], "skip_reason": None}

    # Pool exhausted, stay silent until cooldown
    return {"reply": "", "pool_name": "silent", "intent": intent, "pool_considered": unused_variants, "skip_reason": "exhausted"}
async def build_scripted_response(
    instance_id: str,
    channel_id: str,
    user_id: str,
    scripted_cfg: dict,
    session_id: str,
    user_text: str = "",
) -> str:
    """Scripted Mode v5 — DB-backed wrapper around _decide_scripted_reply.
    Handles idle reset, persistence, and speculation skip logging."""
    reset_hours = int(scripted_cfg.get("reset_hours") or 24)
    primary_present = bool((scripted_cfg.get("primary_message") or "").strip())
    if not primary_present:
        return ""

    key = {"instance_id": instance_id, "channel_id": channel_id, "user_id": user_id}
    now = datetime.now(timezone.utc)
    existing = await db.scripted_counters.find_one(key) or {}
    # Idle reset
    last_iso = existing.get("last_at")
    if last_iso:
        try:
            last_dt = datetime.fromisoformat(last_iso)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            if (now - last_dt).total_seconds() / 3600.0 >= reset_hours:
                await db.scripted_counters.update_one(key, {"$set": {"count": 0, "used_replies": []}})
                existing = {**existing, "count": 0, "used_replies": []}
        except Exception:
            pass
    current_count = int(existing.get("count") or 0)
    used_replies = existing.get("used_replies") if isinstance(existing.get("used_replies"), list) else []

    decision = await _decide_scripted_reply(scripted_cfg, current_count, used_replies, user_text, session_id, instance_id)

    if decision["skip_reason"] == "speculation":
        logger.info(f"[SCRIPTED] silent — speculation/commentary detected from user={user_id[:8]}")
        try:
            await db.scripted_skips.insert_one({
                "instance_id": instance_id,
                "channel_id": channel_id,
                "user_id": user_id,
                "reason": "speculation",
                "preview": user_text[:200],
                "timestamp": now.isoformat(),
            })
        except Exception:
            pass
    elif decision["skip_reason"] == "max_attempts":
        logger.info(f"[SCRIPTED] silent — max_attempts reached for user={user_id[:8]}")
    elif decision["reply"]:
        logger.info(f"[SCRIPTED] reply pool={decision['pool_name']} intent={decision.get('intent')} count={current_count}")

    if not decision["reply"]:
        return ""

    # Persist counter + used reply (acks excluded from used_replies so they can naturally cycle)
    update_ops = {
        "$inc": {"count": 1},
        "$set": {**key, "last_at": now.isoformat()},
    }
    if decision["pool_name"] != "ack":
        update_ops["$push"] = {"used_replies": decision["reply"]}
    await db.scripted_counters.update_one(key, update_ops, upsert=True)
    return decision["reply"]
async def _ai_rephrase(primary_text: str, session_id: str, instance_id: str) -> str:
    """Ask Claude to rephrase the primary message slightly while keeping every key fact."""
    system = (
        "You rephrase a maintenance/incident message slightly so the user doesn't see the exact same text twice. "
        "Strict rules:\n"
        "1. Keep EVERY fact, number, status, instruction, and product name identical.\n"
        "2. Do not add new information that isn't in the original.\n"
        "3. Do not apologize beyond what's in the original.\n"
        "4. Keep length within ±20% of the original.\n"
        "5. Output ONLY the rephrased message — no preamble, no quotes, no commentary."
    )
    try:
        out = await call_claude(
            f"{session_id}_rephrase_{datetime.now(timezone.utc).timestamp()}",
            f"Original message:\n{primary_text}",
            system,
            instance_id=instance_id,
            platform="discord",
        )
        return (out or "").strip()
    except Exception as e:
        logger.warning(f"AI rephrase failed: {e}")
        return ""
async def _resolve_llm_config(instance_id: str) -> dict:
    """Read the per-instance LLM provider config. Falls back to {provider: 'emergent'} when absent."""
    inst = await db.bot_instances.find_one({"id": instance_id}, {"llm_config": 1}) or {}
    cfg = inst.get("llm_config") or {}
    if not isinstance(cfg, dict) or not cfg.get("provider"):
        return {"provider": "emergent", "model": DEFAULT_EMERGENT_MODEL}
    cfg = dict(cfg)
    cfg.setdefault("provider", "emergent")
    return cfg
async def _call_emergent(session_id: str, user_message: str, system_prompt: str,
                          instance_id: str, model: str) -> tuple:
    """LLM call via emergentintegrations + Emergent Universal Key. Returns (text, in_tok, out_tok).
    Tokens are estimated heuristically since the library does not expose Anthropic usage."""
    api_key = os.environ.get("CLAUDE_API_KEY") or os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="Emergent LLM key not configured")
    key = f"{session_id}_{instance_id}_emergent_{model}"
    if key not in llm_sessions:
        llm_sessions[key] = LlmChat(api_key=api_key, session_id=key, system_message=system_prompt).with_model("anthropic", model)
    else:
        try:
            session = llm_sessions[key]
            messages = getattr(session, "messages", None)
            if messages and isinstance(messages, list) and messages and isinstance(messages[0], dict):
                if messages[0].get("role") == "system":
                    messages[0] = {"role": "system", "content": system_prompt}
                else:
                    messages.insert(0, {"role": "system", "content": system_prompt})
        except Exception as _e:
            logger.warning(f"[session-refresh] non-fatal: {_e}")
    text = await llm_sessions[key].send_message(UserMessage(text=user_message))
    in_tok = _estimate_tokens(system_prompt) + _estimate_tokens(user_message)
    out_tok = _estimate_tokens(text)
    return text, in_tok, out_tok
async def _call_anthropic(session_id: str, user_message: str, system_prompt: str,
                          instance_id: str, model_short: str, api_key: str) -> tuple:
    """LLM call via direct Anthropic SDK. Returns (text, in_tok, out_tok) using real usage."""
    if not api_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured for this instance")
    api_model = ALLOWED_ANTHROPIC_MODELS.get(model_short)
    if not api_model:
        raise HTTPException(status_code=500, detail=f"Model '{model_short}' is not in the Anthropic allowlist")
    import anthropic as _anthropic
    client = _anthropic.AsyncAnthropic(api_key=api_key)
    key = f"{session_id}_{instance_id}_anthropic_{model_short}"
    history = llm_history.get(key) or []
    history.append({"role": "user", "content": user_message})
    try:
        resp = await client.messages.create(
            model=api_model,
            max_tokens=8096,
            system=system_prompt,
            messages=history,
        )
    except _anthropic.AuthenticationError as e:
        raise HTTPException(status_code=401, detail=f"Anthropic auth failed: {e}")
    except _anthropic.RateLimitError as e:
        raise HTTPException(status_code=429, detail=f"Anthropic rate limit: {e}")
    except _anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {e}")
    text = "".join(block.text for block in resp.content if getattr(block, "type", "") == "text")
    history.append({"role": "assistant", "content": text})
    llm_history[key] = history[-40:]
    usage = getattr(resp, "usage", None)
    in_tok = int(getattr(usage, "input_tokens", 0) or 0) if usage else _estimate_tokens(system_prompt) + _estimate_tokens(user_message)
    out_tok = int(getattr(usage, "output_tokens", 0) or 0) if usage else _estimate_tokens(text)
    return text, in_tok, out_tok
async def _call_ollama(session_id: str, user_message: str, system_prompt: str,
                       instance_id: str, model: str, base_url: str) -> tuple:
    """LLM call via Ollama. Returns (text, in_tok, out_tok). Ollama returns eval counts directly."""
    base_url = (base_url or os.environ.get("OLLAMA_BASE_URL") or "http://localhost:11434").rstrip("/")
    key = f"{session_id}_{instance_id}_ollama_{model}"
    history = llm_history.get(key) or []
    history.append({"role": "user", "content": user_message})
    messages = [{"role": "system", "content": system_prompt}] + history
    payload = {"model": model, "messages": messages, "stream": False}
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            r = await client.post(f"{base_url}/api/chat", json=payload)
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Ollama error {e.response.status_code}: {e.response.text[:200]}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Ollama unreachable at {base_url}: {e}")
    data = r.json()
    text = (data.get("message") or {}).get("content") or ""
    history.append({"role": "assistant", "content": text})
    llm_history[key] = history[-40:]
    in_tok = int(data.get("prompt_eval_count") or 0) or _estimate_tokens(system_prompt) + _estimate_tokens(user_message)
    out_tok = int(data.get("eval_count") or 0) or _estimate_tokens(text)
    return text, in_tok, out_tok
async def _call_openai(session_id: str, user_message: str, system_prompt: str,
                       instance_id: str, model: str, api_key: str) -> tuple:
    """LLM call via direct OpenAI SDK. Returns (text, in_tok, out_tok) using real usage."""
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured for this instance")
    api_model = ALLOWED_OPENAI_MODELS.get(model)
    if not api_model:
        raise HTTPException(status_code=500, detail=f"Model '{model}' is not in the OpenAI allowlist")
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)
    key = f"{session_id}_{instance_id}_openai_{model}"
    history = llm_history.get(key) or []
    history.append({"role": "user", "content": user_message})
    messages = [{"role": "system", "content": system_prompt}] + history
    try:
        resp = await client.chat.completions.create(model=api_model, messages=messages, max_tokens=8096)
    except Exception as e:
        err_str = str(e)
        if "authentication" in err_str.lower() or "api key" in err_str.lower():
            raise HTTPException(status_code=401, detail=f"OpenAI auth failed: {err_str[:200]}")
        if "rate" in err_str.lower() or "429" in err_str:
            raise HTTPException(status_code=429, detail=f"OpenAI rate limit: {err_str[:200]}")
        raise HTTPException(status_code=502, detail=f"OpenAI API error: {err_str[:200]}")
    text = resp.choices[0].message.content or ""
    history.append({"role": "assistant", "content": text})
    llm_history[key] = history[-40:]
    usage = resp.usage
    in_tok = usage.prompt_tokens if usage else _estimate_tokens(system_prompt) + _estimate_tokens(user_message)
    out_tok = usage.completion_tokens if usage else _estimate_tokens(text)
    return text, in_tok, out_tok
async def call_claude(session_id: str, user_message: str, system_prompt: str,
                      instance_id: str = "default", platform: str = "web") -> str:
    """Multi-provider LLM dispatcher. Routes to Emergent / Anthropic-direct / Ollama based on
    the per-instance `llm_config` saved on bot_instances. Preserves the legacy retry+fallback
    behavior for the Emergent path (Opus → Sonnet) for backward compatibility."""
    cfg = await _resolve_llm_config(instance_id)
    provider = (cfg.get("provider") or "emergent").lower()
    retry_count = 0

    if provider == "openai":
        model = cfg.get("model") or DEFAULT_OPENAI_MODEL
        api_key = cfg.get("openai_api_key") or ""
        t0 = _time.monotonic()
        try:
            text, in_tok, out_tok = await _call_openai(session_id, user_message, system_prompt, instance_id, model, api_key)
            dur = int((_time.monotonic() - t0) * 1000)
            await _log_llm_usage(instance_id, session_id, platform, f"openai:{model}", f"openai:{model}", True, 0, False, None, in_tok, out_tok, dur)
            return text
        except HTTPException:
            dur = int((_time.monotonic() - t0) * 1000)
            await _log_llm_usage(instance_id, session_id, platform, f"openai:{model}", f"openai:{model}", False, 0, False, "openai_error", duration_ms=dur)
            raise
        except Exception as e:
            dur = int((_time.monotonic() - t0) * 1000)
            logger.error(f"OpenAI call failed: {e}")
            await _log_llm_usage(instance_id, session_id, platform, f"openai:{model}", f"openai:{model}", False, 0, False, "unknown", duration_ms=dur)
            raise HTTPException(status_code=500, detail="AI service temporarily unavailable. Please try again in a moment.")

    if provider == "anthropic":
        model_short = cfg.get("model") or DEFAULT_ANTHROPIC_MODEL
        api_key = cfg.get("anthropic_api_key") or ""
        t0 = _time.monotonic()
        try:
            text, in_tok, out_tok = await _call_anthropic(session_id, user_message, system_prompt, instance_id, model_short, api_key)
            dur = int((_time.monotonic() - t0) * 1000)
            await _log_llm_usage(instance_id, session_id, platform, f"anthropic:{model_short}", f"anthropic:{model_short}", True, 0, False, None, in_tok, out_tok, dur)
            return text
        except HTTPException:
            dur = int((_time.monotonic() - t0) * 1000)
            await _log_llm_usage(instance_id, session_id, platform, f"anthropic:{model_short}", f"anthropic:{model_short}", False, 0, False, "anthropic_error", duration_ms=dur)
            raise
        except Exception as e:
            dur = int((_time.monotonic() - t0) * 1000)
            logger.error(f"Anthropic call failed: {e}")
            await _log_llm_usage(instance_id, session_id, platform, f"anthropic:{model_short}", f"anthropic:{model_short}", False, 0, False, "unknown", duration_ms=dur)
            raise HTTPException(status_code=500, detail="AI service temporarily unavailable. Please try again in a moment.")

    if provider == "ollama":
        model = cfg.get("model") or DEFAULT_OLLAMA_MODEL
        base_url = cfg.get("ollama_base_url") or ""
        t0 = _time.monotonic()
        try:
            text, in_tok, out_tok = await _call_ollama(session_id, user_message, system_prompt, instance_id, model, base_url)
            dur = int((_time.monotonic() - t0) * 1000)
            await _log_llm_usage(instance_id, session_id, platform, f"ollama:{model}", f"ollama:{model}", True, 0, False, None, in_tok, out_tok, dur)
            return text
        except HTTPException:
            dur = int((_time.monotonic() - t0) * 1000)
            await _log_llm_usage(instance_id, session_id, platform, f"ollama:{model}", f"ollama:{model}", False, 0, False, "ollama_error", duration_ms=dur)
            raise

    # ── EMERGENT (default) — legacy retry + Opus→Sonnet fallback ───────────────
    api_key = os.environ.get("CLAUDE_API_KEY") or os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM API key not configured")

    primary_model = cfg.get("model") or "claude-sonnet-4-6"
    fallback_model = "claude-sonnet-4-5-20250929"
    max_retries = 2
    used_fallback = False
    last_error = None  # noqa: F841
    error_type = None

    async def _attempt(model: str) -> tuple:
        nonlocal retry_count
        return await _call_emergent(session_id, user_message, system_prompt, instance_id, model)

    # Try primary model with retries
    t0 = _time.monotonic()
    for attempt in range(max_retries + 1):
        try:
            text, in_tok, out_tok = await _attempt(primary_model)
            dur = int((_time.monotonic() - t0) * 1000)
            await _log_llm_usage(instance_id, session_id, platform, primary_model,
                                 primary_model, True, retry_count, False, None, in_tok, out_tok, dur)
            return text
        except Exception as e:
            last_error = e  # noqa: F841
            err_str = str(e).lower()
            error_type = ("rate_limit" if "rate" in err_str or "429" in err_str
                          else "balance" if "credit" in err_str or "balance" in err_str or "payment" in err_str
                          else "timeout" if "timeout" in err_str or "timed out" in err_str
                          else "unknown")
            if attempt < max_retries:
                retry_count += 1
                logger.warning(f"Claude primary attempt {attempt+1} failed ({error_type}), retrying...")
                await asyncio.sleep(1.5 ** attempt)
            else:
                logger.error(f"Claude primary exhausted retries: {e}")

    # Fallback to Sonnet
    try:
        used_fallback = True  # noqa: F841
        text, in_tok, out_tok = await _attempt(fallback_model)
        dur = int((_time.monotonic() - t0) * 1000)
        logger.info(f"Fallback to {fallback_model} succeeded for session {session_id}")
        await _log_llm_usage(instance_id, session_id, platform, fallback_model,
                             primary_model, True, retry_count, True, error_type, in_tok, out_tok, dur)
        return text
    except Exception as e:
        dur = int((_time.monotonic() - t0) * 1000)
        logger.error(f"Fallback model also failed: {e}")
        await _log_llm_usage(instance_id, session_id, platform, fallback_model,
                             primary_model, False, retry_count, True, error_type, duration_ms=dur)
        raise HTTPException(status_code=500, detail="AI service temporarily unavailable. Please try again in a moment.")
async def _log_llm_usage(instance_id: str, session_id: str, platform: str,
                          model_used: str, model_attempted: str, success: bool,
                          retry_count: int, used_fallback: bool, error_type: str,
                          input_tokens: int = 0, output_tokens: int = 0,
                          duration_ms: int = 0):
    try:
        api_key_id = _current_api_key_id.get(None)
        await db.llm_usage.insert_one({
            "id": str(uuid.uuid4()),
            "instance_id": instance_id,
            "session_id": session_id,
            "platform": platform,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model_attempted": model_attempted,
            "model_used": model_used,
            "success": success,
            "retry_count": retry_count,
            "used_fallback": used_fallback,
            "error_type": error_type,
            "input_tokens": int(input_tokens or 0),
            "output_tokens": int(output_tokens or 0),
            "duration_ms": int(duration_ms or 0),
            "api_key_id": api_key_id,
        })
    except Exception as e:
        logger.warning(f"Failed to log LLM usage: {e}")
# Anthropic published pricing per 1M tokens (Feb 2026). Used to estimate cost on the
# admin dashboard. Ollama (self-hosted) is treated as $0. For unknown models we
# fall back to Sonnet pricing as a conservative estimate.
LLM_PRICING = {
    # Anthropic 4-5 series (date suffixes verified against Emergent catalog)
    "claude-haiku-4-5":            {"in": 1.00,  "out": 5.00},
    "claude-haiku-4-5-20251001":   {"in": 1.00,  "out": 5.00},
    "claude-sonnet-4-5":           {"in": 3.00,  "out": 15.00},
    "claude-sonnet-4-5-20250929":  {"in": 3.00,  "out": 15.00},
    "claude-opus-4-5":             {"in": 15.00, "out": 75.00},
    "claude-opus-4-5-20251101":    {"in": 15.00, "out": 75.00},
    # Newer 4-6 / 4-7 / 4-8 series
    "claude-sonnet-4-6":           {"in": 3.00,  "out": 15.00},
    "claude-opus-4-6":             {"in": 15.00, "out": 75.00},
    "claude-opus-4-7":             {"in": 15.00, "out": 75.00},
    "claude-opus-4-8":             {"in": 15.00, "out": 75.00},
    # Legacy 3.5
    "claude-3-5-haiku-20241022":   {"in": 0.80,  "out": 4.00},
    "claude-3-5-sonnet-20241022":  {"in": 3.00,  "out": 15.00},
    # OpenAI
    "gpt-4o":         {"in": 2.50,  "out": 10.00},
    "gpt-4.1":        {"in": 2.00,  "out": 8.00},
    "gpt-4.1-mini":   {"in": 0.40,  "out": 1.60},
    "gpt-5":          {"in": 5.00,  "out": 20.00},
    "gpt-5-mini":     {"in": 1.00,  "out": 4.00},
    "gpt-5.4":        {"in": 3.00,  "out": 12.00},
    "gpt-5.4-mini":   {"in": 0.60,  "out": 2.40},
    "gpt-5.5":        {"in": 5.00,  "out": 20.00},
    "gpt-5.6-terra":  {"in": 5.00,  "out": 20.00},
    "o3":             {"in": 10.00, "out": 40.00},
    "o4-mini":        {"in": 1.10,  "out": 4.40},
}
DEFAULT_PRICING = {"in": 3.00, "out": 15.00}  # Sonnet-equivalent
def _estimate_tokens(text: str) -> int:
    """Cheap heuristic for tokens when the provider doesn't return real usage.
    Anthropic averages ~3.6 chars per token in English; we use 4 to be conservative."""
    return max(1, len(text or "") // 4)
def _cost_for(model: str, input_tokens: int, output_tokens: int) -> float:
    """Compute USD cost from token counts. Provider-prefixed model strings
    (e.g. 'anthropic:claude-sonnet-4-5', 'ollama:llama3.1') are stripped before lookup.
    Ollama is always $0."""
    if not model:
        return 0.0
    m = model.split(":", 1)[1] if ":" in model else model
    if model.startswith("ollama:"):
        return 0.0
    price = LLM_PRICING.get(m, DEFAULT_PRICING)
    return round(((input_tokens or 0) / 1_000_000) * price["in"] +
                 ((output_tokens or 0) / 1_000_000) * price["out"], 6)
async def save_conversation(session_id: str, user_message: str, bot_response: str,
                            platform: str = "web", metadata: dict = None, instance_id: str = "default"):
    timestamp = datetime.now(timezone.utc).isoformat()
    api_key_id = _current_api_key_id.get(None)
    new_messages = [
        {"role": "user", "content": user_message, "timestamp": timestamp},
        {"role": "assistant", "content": bot_response, "timestamp": timestamp}
    ]
    existing = await db.conversations.find_one({"session_id": session_id})
    if existing:
        update_set = {"updated_at": timestamp}
        if api_key_id and not existing.get("api_key_id"):
            update_set["api_key_id"] = api_key_id
        await db.conversations.update_one(
            {"session_id": session_id},
            {"$push": {"messages": {"$each": new_messages}}, "$set": update_set}
        )
    else:
        doc = {
            "session_id": session_id, "platform": platform,
            "instance_id": instance_id,
            "messages": new_messages, "is_approved_for_training": False,
            "created_at": timestamp, "updated_at": timestamp,
            "metadata": metadata or {}
        }
        if api_key_id:
            doc["api_key_id"] = api_key_id
        await db.conversations.insert_one(doc)

# ==================== STREAMING LLM ====================

import json as _json

async def _stream_anthropic(session_id: str, user_message: str, system_prompt: str,
                            instance_id: str, model_short: str, api_key: str):
    """Yield text chunks from Anthropic streaming API. Returns (async_generator, finalize_fn).
    finalize_fn must be called after consuming the generator to get (full_text, in_tok, out_tok)."""
    import anthropic as _anthropic
    client = _anthropic.AsyncAnthropic(api_key=api_key)
    api_model = ALLOWED_ANTHROPIC_MODELS.get(model_short)
    if not api_model:
        raise HTTPException(status_code=500, detail=f"Model '{model_short}' not in allowlist")
    key = f"{session_id}_{instance_id}_anthropic_{model_short}"
    history = llm_history.get(key) or []
    history.append({"role": "user", "content": user_message})

    full_text_parts = []
    in_tok = 0
    out_tok = 0

    async def generate():
        nonlocal in_tok, out_tok
        try:
            async with client.messages.stream(
                model=api_model, max_tokens=8096,
                system=system_prompt, messages=history,
            ) as stream:
                async for text in stream.text_stream:
                    full_text_parts.append(text)
                    yield text
                resp = await stream.get_final_message()
                usage = getattr(resp, "usage", None)
                in_tok = int(getattr(usage, "input_tokens", 0) or 0) if usage else _estimate_tokens(system_prompt + user_message)
                out_tok = int(getattr(usage, "output_tokens", 0) or 0) if usage else _estimate_tokens("".join(full_text_parts))
        except _anthropic.AuthenticationError as e:
            yield f"\n[Error: Anthropic auth failed: {e}]"
        except _anthropic.RateLimitError as e:
            yield f"\n[Error: Rate limited: {e}]"
        except Exception as e:
            logger.error(f"Anthropic stream error: {e}")
            yield f"\n[Error: AI service temporarily unavailable]"

    async def finalize():
        full = "".join(full_text_parts)
        history.append({"role": "assistant", "content": full})
        llm_history[key] = history[-40:]
        return full, in_tok, out_tok

    return generate(), finalize


async def _stream_ollama(session_id: str, user_message: str, system_prompt: str,
                         instance_id: str, model: str, base_url: str):
    """Yield text chunks from Ollama streaming. Returns (async_generator, finalize_fn)."""
    base_url = (base_url or os.environ.get("OLLAMA_BASE_URL") or "http://localhost:11434").rstrip("/")
    key = f"{session_id}_{instance_id}_ollama_{model}"
    history = llm_history.get(key) or []
    history.append({"role": "user", "content": user_message})
    messages = [{"role": "system", "content": system_prompt}] + history
    payload = {"model": model, "messages": messages, "stream": True}

    full_text_parts = []
    in_tok = 0
    out_tok = 0

    async def generate():
        nonlocal in_tok, out_tok
        try:
            async with httpx.AsyncClient(timeout=120.0) as hclient:
                async with hclient.stream("POST", f"{base_url}/api/chat", json=payload) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            chunk = _json.loads(line)
                        except Exception:
                            continue
                        token = (chunk.get("message") or {}).get("content", "")
                        if token:
                            full_text_parts.append(token)
                            yield token
                        if chunk.get("done"):
                            in_tok = int(chunk.get("prompt_eval_count") or 0) or _estimate_tokens(system_prompt + user_message)
                            out_tok = int(chunk.get("eval_count") or 0) or _estimate_tokens("".join(full_text_parts))
        except Exception as e:
            logger.error(f"Ollama stream error: {e}")
            yield f"\n[Error: Ollama unavailable: {e}]"

    async def finalize():
        full = "".join(full_text_parts)
        history.append({"role": "assistant", "content": full})
        llm_history[key] = history[-40:]
        return full, in_tok, out_tok

    return generate(), finalize


async def _stream_openai(session_id: str, user_message: str, system_prompt: str,
                         instance_id: str, model: str, api_key: str):
    """Yield text chunks from OpenAI streaming API. Returns (async_generator, finalize_fn)."""
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured for this instance")
    api_model = ALLOWED_OPENAI_MODELS.get(model)
    if not api_model:
        raise HTTPException(status_code=500, detail=f"Model '{model}' not in allowlist")
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)
    key = f"{session_id}_{instance_id}_openai_{model}"
    history = llm_history.get(key) or []
    history.append({"role": "user", "content": user_message})
    messages = [{"role": "system", "content": system_prompt}] + history

    full_text_parts = []
    in_tok = 0
    out_tok = 0

    async def generate():
        nonlocal in_tok, out_tok
        try:
            stream = await client.chat.completions.create(
                model=api_model, messages=messages, max_tokens=8096, stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    full_text_parts.append(delta.content)
                    yield delta.content
                if hasattr(chunk, "usage") and chunk.usage:
                    in_tok = chunk.usage.prompt_tokens or 0
                    out_tok = chunk.usage.completion_tokens or 0
        except Exception as e:
            logger.error(f"OpenAI stream error: {e}")
            yield f"\n[Error: OpenAI service error: {str(e)[:100]}]"

    async def finalize():
        full = "".join(full_text_parts)
        history.append({"role": "assistant", "content": full})
        llm_history[key] = history[-40:]
        if not in_tok:
            return full, _estimate_tokens(system_prompt + user_message), _estimate_tokens(full)
        return full, in_tok, out_tok

    return generate(), finalize


async def _simulate_stream(text: str):
    """Yield a pre-fetched response in word-sized chunks to simulate streaming."""
    words = text.split(" ")
    for i, word in enumerate(words):
        chunk = word if i == 0 else " " + word
        yield chunk
        await asyncio.sleep(0.02)  # ~50 words/sec, fast but visible


async def _sse_event(event: str, data: dict) -> str:
    """Format a Server-Sent Event."""
    return f"event: {event}\ndata: {_json.dumps(data)}\n\n"


async def stream_chat_response(session_id: str, user_message: str, instance_id: str, platform: str = "web"):
    """SSE generator for streaming chat. Yields SSE-formatted events."""
    # Emit session ID first
    yield await _sse_event("session", {"session_id": session_id})

    bot_config = await db.bot_config.find_one({"instance_id": instance_id}, {"_id": 0}) or {}
    knowledge = await search_knowledge(user_message, instance_id)

    if knowledge == "__NO_KB__":
        response = "I don't have any knowledge base configured yet. Please check back later or contact the administrator to set up my knowledge base."
        async for chunk in _simulate_stream(response):
            yield await _sse_event("token", {"token": chunk})
        yield await _sse_event("done", {"full_response": response})
        await save_conversation(session_id, user_message, response, platform=platform, instance_id=instance_id)
        return

    # Try live API query — returns (api_context, sources) or None
    api_result = await _try_api_query(user_message, bot_config, knowledge, instance_id, session_id)
    api_context = ""
    api_sources = []
    if api_result:
        api_context, api_sources = api_result

    # LLM streaming — unified KB + API context
    tone = await get_tone_examples_text(instance_id, bot_config)
    system_prompt = build_system_prompt(bot_config, knowledge, tone, knowledge_gate=bot_config.get("knowledge_gate", "strict"),
                                       api_context=api_context, api_sources=api_sources)
    cfg = await _resolve_llm_config(instance_id)
    provider = (cfg.get("provider") or "emergent").lower()

    full_response = ""
    try:
        if provider == "anthropic":
            model_short = cfg.get("model") or DEFAULT_ANTHROPIC_MODEL
            api_key = cfg.get("anthropic_api_key") or ""
            gen, finalize = await _stream_anthropic(session_id, user_message, system_prompt, instance_id, model_short, api_key)
            async for chunk in gen:
                yield await _sse_event("token", {"token": chunk})
            full_response, in_tok, out_tok = await finalize()
            await _log_llm_usage(instance_id, session_id, platform, f"anthropic:{model_short}",
                                 f"anthropic:{model_short}", True, 0, False, None, in_tok, out_tok)

        elif provider == "openai":
            model = cfg.get("model") or DEFAULT_OPENAI_MODEL
            api_key = cfg.get("openai_api_key") or ""
            gen, finalize = await _stream_openai(session_id, user_message, system_prompt, instance_id, model, api_key)
            async for chunk in gen:
                yield await _sse_event("token", {"token": chunk})
            full_response, in_tok, out_tok = await finalize()
            await _log_llm_usage(instance_id, session_id, platform, f"openai:{model}",
                                 f"openai:{model}", True, 0, False, None, in_tok, out_tok)

        elif provider == "ollama":
            model = cfg.get("model") or DEFAULT_OLLAMA_MODEL
            base_url = cfg.get("ollama_base_url") or ""
            gen, finalize = await _stream_ollama(session_id, user_message, system_prompt, instance_id, model, base_url)
            async for chunk in gen:
                yield await _sse_event("token", {"token": chunk})
            full_response, in_tok, out_tok = await finalize()
            await _log_llm_usage(instance_id, session_id, platform, f"ollama:{model}",
                                 f"ollama:{model}", True, 0, False, None, in_tok, out_tok)

        else:
            # Emergent path — no native streaming, fetch full then simulate
            full_response = await call_claude(session_id, user_message, system_prompt,
                                             instance_id=instance_id, platform=platform)
            async for chunk in _simulate_stream(full_response):
                yield await _sse_event("token", {"token": chunk})

    except HTTPException as he:
        err_msg = he.detail or "AI service error"
        yield await _sse_event("error", {"message": err_msg})
        return
    except Exception as e:
        logger.error(f"Stream error: {e}")
        yield await _sse_event("error", {"message": "AI service temporarily unavailable"})
        return

    yield await _sse_event("done", {"full_response": full_response})
    await save_conversation(session_id, user_message, full_response, platform=platform, instance_id=instance_id)

# ==================== DISCORD BOT ====================

# Shared client and handoff state
_shared_discord_client = None
_shared_discord_task = None
_handoff_channels: Dict[str, datetime] = {}  # {channel_id: last_staff_timestamp}
async def _resolve_instance_for_guild(guild_id: str) -> Optional[str]:
    """Find which instance owns this guild."""
    if guild_id in guild_instance_map:
        return guild_instance_map[guild_id]
    config = await db.discord_config.find_one({"guild_id": guild_id, "is_active": True}, {"_id": 0})
    if config:
        iid = config.get("instance_id")
        guild_instance_map[guild_id] = iid
        return iid
    return None
async def _sync_guild_nickname(token: str, guild_id: str, name: str):
    """Set bot nickname in a specific guild. Safe — never raises."""
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.patch(
                f"https://discord.com/api/v10/guilds/{guild_id}/members/@me",
                headers={"Authorization": f"Bot {token}"},
                json={"nick": name}
            ) as resp:
                if resp.status == 200:
                    logger.info(f"Nickname synced to '{name}' in guild {guild_id}")
                elif resp.status == 429:
                    logger.warning(f"Rate limited syncing nickname to guild {guild_id}")
                else:
                    body = await resp.text()
                    logger.warning(f"Nickname sync failed in guild {guild_id} ({resp.status}): {body}")
    except Exception as e:
        logger.warning(f"Nickname sync exception for guild {guild_id}: {e}")
async def start_shared_discord_bot(token: str):
    """Start a single shared Discord client that routes messages to the correct instance."""
    global _shared_discord_client

    try:
        import discord
        intents = discord.Intents.default()
        intents.message_content = True
        intents.members = True
        _shared_discord_client = discord.Client(intents=intents)

        @_shared_discord_client.event
        async def on_ready():
            logger.info(f"Shared Discord bot online: {_shared_discord_client.user}")
            # Build guild→instance map first (critical for message routing)
            active_configs = await db.discord_config.find({"is_active": True}, {"_id": 0}).to_list(50)
            for cfg in active_configs:
                iid = cfg.get("instance_id")
                gid = cfg.get("guild_id")
                if iid and gid:
                    guild_instance_map[gid] = iid
            logger.info(f"Guild map built: {len(guild_instance_map)} guilds mapped")
            # Sync nicknames separately — failures must not break message handling
            for cfg in active_configs:
                iid = cfg.get("instance_id")
                gid = cfg.get("guild_id")
                if iid and gid:
                    try:
                        bot_config = await db.bot_config.find_one({"instance_id": iid}, {"_id": 0})
                        name = (bot_config or {}).get("name", "").strip()
                        if name:
                            await _sync_guild_nickname(token, gid, name)
                    except Exception as e:
                        logger.warning(f"Nickname sync failed for instance {iid[:12]}: {e}")

        @_shared_discord_client.event
        async def on_message(message):
            if message.author.bot:
                return
            # Cluster-wide dedup via MongoDB. Even if multiple backend pods receive
            # the same Discord event (e.g. HA replicas, deploy overlap), only the
            # first pod to insert wins. Subsequent pods get DuplicateKeyError and skip.
            try:
                msg_key = str(message.id)
                now_dt = datetime.now(timezone.utc)
                try:
                    await db.processed_discord_messages.insert_one({
                        "_id": msg_key,
                        "processed_at": now_dt,  # datetime so TTL index can expire it
                        "channel_id": str(message.channel.id),
                    })
                except DuplicateKeyError:
                    logger.info(f"[DEDUP] cluster-wide: skipped duplicate Discord message id={msg_key}")
                    return
            except Exception as _e:
                # Don't fail open silently; if Mongo is sick, log but continue (better to risk a dup than miss replies)
                logger.warning(f"[DEDUP] mongo dedup error (will process anyway): {_e}")
            is_dm = isinstance(message.channel, discord.DMChannel)
            if is_dm:
                first_cfg = await db.discord_config.find_one({"is_active": True}, {"_id": 0})
                instance_id = (first_cfg or {}).get("instance_id", "default")
            else:
                guild_id = str(message.guild.id) if message.guild else None
                if not guild_id:
                    return
                instance_id = await _resolve_instance_for_guild(guild_id)
                if not instance_id:
                    return
            live_cfg = await db.discord_config.find_one({"instance_id": instance_id}, {"_id": 0}) or {}
            listen_mode = live_cfg.get("listen_mode", "mention_only")
            monitored_ids = set(live_cfg.get("monitored_channel_ids") or [])
            reply_style = live_cfg.get("reply_style", "natural")
            staff_role_name = (live_cfg.get("staff_role_name") or "").strip().lower()
            # Normalize: remove extra spaces and special chars for fuzzy matching
            staff_role_normalized = "".join(staff_role_name.split()).replace("-", "").replace("_", "")
            cooldown_minutes = live_cfg.get("handoff_cooldown_minutes", 15) or 15
            followup_msg = live_cfg.get("handoff_followup_message") or "Is there anything else I can help with?"
            if not live_cfg.get("is_active", True):
                return
            channel_id = str(message.channel.id)
            logger.info(f"[MSG] from={message.author.name} instance={instance_id[:12]} staff_role_cfg='{staff_role_name}' mode={listen_mode}")
            if message.content.strip().lower() == "!bot resume":
                if channel_id in _handoff_channels:
                    del _handoff_channels[channel_id]
                    await message.channel.send("I'm back! How can I help?")
                return
            if message.content.strip().lower() == "!bot status":
                in_handoff = channel_id in _handoff_channels
                if in_handoff:
                    elapsed = (datetime.now(timezone.utc) - _handoff_channels[channel_id]).total_seconds() / 60.0
                    remaining = max(0, cooldown_minutes - elapsed)
                    msg = (
                        f"**Bot Status — silent (handoff active)**\n"
                        f"Cooldown remaining: ~{remaining:.1f} min\n"
                        f"Listen mode: `{listen_mode}` · Passive mode: `{bool(live_cfg.get('passive_mode', False))}`\n"
                        f"Type `!bot resume` to clear handoff immediately."
                    )
                else:
                    msg = (
                        f"**Bot Status — active**\n"
                        f"Listen mode: `{listen_mode}` · Passive mode: `{bool(live_cfg.get('passive_mode', False))}`\n"
                        f"Staff role: `{staff_role_name or 'not configured'}`"
                    )
                await message.channel.send(msg)
                return
            is_staff = False
            if staff_role_name and not is_dm and message.guild:
                try:
                    import aiohttp
                    async with aiohttp.ClientSession() as http_session:
                        member_url = f"https://discord.com/api/v10/guilds/{message.guild.id}/members/{message.author.id}"
                        async with http_session.get(
                            member_url,
                            headers={"Authorization": f"Bot {token}"}
                        ) as member_resp:
                            logger.info(f"[ROLE CHECK] user={message.author.name} guild={message.guild.id} member_api_status={member_resp.status}")
                            if member_resp.status == 200:
                                member_data = await member_resp.json()
                                member_role_ids = set(member_data.get("roles", []))
                                logger.info(f"[ROLE CHECK] user={message.author.name} role_ids={member_role_ids}")
                                async with http_session.get(
                                    f"https://discord.com/api/v10/guilds/{message.guild.id}/roles",
                                    headers={"Authorization": f"Bot {token}"}
                                ) as roles_resp:
                                    if roles_resp.status == 200:
                                        guild_roles = await roles_resp.json()
                                        role_names = {r["id"]: r["name"] for r in guild_roles}
                                        logger.info(f"[ROLE CHECK] guild_roles={role_names} looking_for='{staff_role_name}'")
                                        user_role_names = [role_names.get(rid, "?") for rid in member_role_ids]
                                        logger.info(f"[ROLE CHECK] user_role_names={user_role_names}")
                                        for role in guild_roles:
                                            role_name_lower = role["name"].lower()
                                            role_normalized = "".join(role_name_lower.split()).replace("-", "").replace("_", "")
                                            if role["id"] in member_role_ids and (role_name_lower == staff_role_name or role_normalized == staff_role_normalized):
                                                is_staff = True
                                                logger.info(f"[ROLE CHECK] MATCH FOUND: role='{role['name']}' config='{staff_role_name}'")
                                                break
                                        if not is_staff:
                                            logger.info(f"[ROLE CHECK] NO MATCH for '{staff_role_name}' in user roles {user_role_names}")
                                    else:
                                        logger.warning(f"[ROLE CHECK] Guild roles fetch failed: {roles_resp.status}")
                            else:
                                body = await member_resp.text()
                                logger.warning(f"[ROLE CHECK] Member fetch failed ({member_resp.status}): {body}")
                except Exception as e:
                    logger.warning(f"[ROLE CHECK] Exception: {e}")
            if is_staff and not is_dm:
                _handoff_channels[channel_id] = datetime.now(timezone.utc)
                logger.info(f"Human takeover: '{message.author.name}' has role '{staff_role_name}' in channel {channel_id}")
                return
            if not is_staff and staff_role_name and not is_dm:
                logger.debug(f"User '{message.author.name}' does NOT have role '{staff_role_name}' — bot will respond")
            if channel_id in _handoff_channels:
                elapsed = (datetime.now(timezone.utc) - _handoff_channels[channel_id]).total_seconds() / 60.0
                if elapsed < cooldown_minutes:
                    if is_staff:
                        # Staff still active — refresh timer, stay silent
                        _handoff_channels[channel_id] = datetime.now(timezone.utc)
                        return
                    # Non-staff message during handoff — clear and let bot respond to this message
                    del _handoff_channels[channel_id]
                    logger.info(f"Handoff cleared in channel {channel_id} — non-staff message received")
                else:
                    del _handoff_channels[channel_id]
                    try:
                        await message.channel.send(followup_msg)
                    except Exception:
                        pass
            is_mentioned = (_shared_discord_client.user in message.mentions if _shared_discord_client.user else False)
            if is_dm:
                should_respond = True
            elif listen_mode == "mention_only":
                should_respond = is_mentioned
            elif listen_mode == "all_channels":
                should_respond = True
            elif listen_mode == "specific_channels":
                should_respond = (str(message.channel.id) in monitored_ids) or is_mentioned
            else:
                should_respond = is_mentioned
            if not should_respond:
                return
            user_text = message.content.strip()
            if _shared_discord_client.user:
                user_text = user_text.replace(f"<@{_shared_discord_client.user.id}>", "").strip()
                user_text = user_text.replace(f"<@!{_shared_discord_client.user.id}>", "").strip()
            if not user_text:
                return
            session_id = f"discord_{message.author.id}"
            try:
                # ─── SCRIPTED MODE check (runs BEFORE LLM, BEFORE KB lookup) ───
                scripted_cfg = (live_cfg.get("scripted_mode") or {}) if isinstance(live_cfg.get("scripted_mode"), dict) else {}
                if scripted_cfg.get("enabled") and scripted_cfg.get("primary_message"):
                    # Passive Mode still gates Scripted Mode (Q3=b): if passive is on, run [SKIP] gate first via Claude
                    passive_mode = bool(live_cfg.get("passive_mode", False))
                    if passive_mode and not is_mentioned and not is_dm:
                        skip_prompt = (
                            "Look at the user message below. If it is a real question or a request for help, output exactly: KEEP\n"
                            "If it is small talk, greeting, statement, joke, or off-topic chatter, output exactly: SKIP\n"
                            "Do not output anything else."
                        )
                        try:
                            verdict = await call_claude(f"{session_id}_skipcheck", user_text, skip_prompt, instance_id=instance_id, platform="discord")
                            if verdict and verdict.strip().upper().startswith("SKIP"):
                                logger.info(f"[SCRIPTED+PASSIVE] instance={instance_id[:12]} skipped non-question")
                                return
                        except Exception:
                            pass  # if gate check fails, fall through and send scripted reply

                    response = await build_scripted_response(
                        instance_id=instance_id,
                        channel_id=channel_id,
                        user_id=str(message.author.id),
                        scripted_cfg=scripted_cfg,
                        session_id=session_id,
                        user_text=user_text,
                    )
                    if not response:
                        # Scripted mode opted to stay silent (speculation, past 2nd message, etc.)
                        return
                    if response:
                        # Apply reply style (mention vs natural)
                        if reply_style == "with_mention" and not is_dm:
                            response = f"{message.author.mention} {response}"
                        if len(response) > 1990:
                            for i in range(0, len(response), 1990):
                                await message.channel.send(response[i:i+1990])
                        else:
                            await message.channel.send(response)
                        await save_conversation(session_id=session_id, user_message=user_text, bot_response=response, platform="discord", instance_id=instance_id, metadata={"username": str(message.author.name), "user_id": str(message.author.id), "scripted": True})
                        return

                bot_config = await db.bot_config.find_one({"instance_id": instance_id}, {"_id": 0}) or {}
                knowledge = await search_knowledge(user_text, instance_id)
                if knowledge == "__NO_KB__":
                    bot_name = bot_config.get("name", "I")
                    response = f"I don't have any knowledge base configured yet. Please check back later or contact the administrator to set up my knowledge base."
                else:
                    tone = await get_tone_examples_text(instance_id, bot_config)
                    passive_mode = bool(live_cfg.get("passive_mode", False))
                    # In passive mode, allow the LLM to skip unless the user @mentioned the bot or DM'd it
                    allow_skip = passive_mode and not is_mentioned and not is_dm
                    # Try live API query first
                    api_result = await _try_api_query(user_text, bot_config, knowledge, instance_id, session_id)
                    api_context = ""
                    api_sources = []
                    if api_result:
                        api_context, api_sources = api_result
                    system_prompt = build_system_prompt(bot_config, knowledge, tone, passive_mode=passive_mode, allow_skip=allow_skip, knowledge_gate=bot_config.get("knowledge_gate", "strict"),
                                                       api_context=api_context, api_sources=api_sources)
                    async with message.channel.typing():
                        response = await call_claude(session_id, user_text, system_prompt, instance_id=instance_id, platform="discord")
                    # Passive mode: detect [SKIP] sentinel and stay silent
                    if allow_skip and response and response.strip().upper().startswith("[SKIP]"):
                        logger.info(f"[PASSIVE] instance={instance_id[:12]} channel={channel_id} — skipped (no confident answer)")
                        try:
                            await db.passive_skips.insert_one({
                                "instance_id": instance_id,
                                "channel_id": channel_id,
                                "guild_id": guild_id,
                                "user_id": str(message.author.id),
                                "username": str(message.author.name),
                                "message_preview": user_text[:200],
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            })
                        except Exception as _e:
                            logger.warning(f"Failed to log passive skip: {_e}")
                        return
                await save_conversation(session_id=session_id, user_message=user_text, bot_response=response, platform="discord", instance_id=instance_id, metadata={"username": str(message.author.name), "user_id": str(message.author.id)})
                if reply_style == "with_mention" and not is_dm:
                    response = f"{message.author.mention} {response}"
                if len(response) > 1990:
                    for i in range(0, len(response), 1990):
                        await message.channel.send(response[i:i+1990])
                else:
                    await message.channel.send(response)
            except Exception as e:
                logger.error(f"Discord message error (instance={instance_id}): {type(e).__name__}: {e}", exc_info=True)
                err_kind = type(e).__name__
                short = str(e)[:120]
                await message.channel.send(
                    f"Sorry, I hit an error while generating a reply.\n"
                    f"Diagnostic: `{err_kind}: {short}`\n"
                    f"If this persists, an admin should check **Analytics → LLM Usage** on the BridgeBot dashboard."
                )

        await _shared_discord_client.start(token)
    except asyncio.CancelledError:
        logger.info("Shared Discord bot task cancelled")
    except Exception as e:
        logger.error(f"Discord bot startup error: {e}")
    finally:
        _shared_discord_client = None
# ==================== STARTUP / SHUTDOWN ====================

@app.on_event("startup")
async def startup_event():
    try:
        await db.knowledge_sources.create_index([("title", "text"), ("content", "text")])
        await db.knowledge_sources.create_index([("instance_id", 1)])
        await db.conversations.create_index([("session_id", 1)])
        await db.conversations.create_index([("created_at", -1)])
        await db.conversations.create_index([("instance_id", 1)])
        await db.bot_config.create_index([("instance_id", 1)])
        await db.bot_instances.create_index([("id", 1)])
        await db.llm_usage.create_index([("instance_id", 1)])
        await db.llm_usage.create_index([("timestamp", -1)])
        await db.users.create_index([("email", 1)], unique=True)
        await db.users.create_index([("id", 1)])
        # TTL index: dedup records expire 5 minutes after creation (well past any sane Discord retry window)
        await db.processed_discord_messages.create_index(
            [("processed_at", 1)], expireAfterSeconds=300
        )
    except Exception as e:
        logger.warning(f"Index creation: {e}")

    # Seed admin user
    if not await db.users.find_one({"email": ADMIN_EMAIL}):
        hashed_pw = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "username": "administrator",
            "hashed_password": hashed_pw,
            "is_verified": True,
            "verification_code": None,
            "role": "superadmin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Seeded admin: {ADMIN_EMAIL}")
    else:
        # Ensure existing admin has username
        await db.users.update_one(
            {"email": ADMIN_EMAIL, "username": {"$exists": False}},
            {"$set": {"username": "administrator"}}
        )

    # Migrate single-tenant data to multi-tenant if needed
    # (updates any existing docs that lack instance_id — safe to run on every startup)
    first_instance = await db.bot_instances.find_one({}, {"id": 1})
    if first_instance:
        migrate_id = first_instance["id"]
        for col in [db.bot_config, db.knowledge_sources, db.conversations, db.discord_config]:
            await col.update_many({"instance_id": {"$exists": False}}, {"$set": {"instance_id": migrate_id}})

    # Start shared Discord bot (one client, routes to all instances by guild)
    global _shared_discord_task
    app_creds = await get_discord_credentials()
    bot_token = app_creds.get("bot_token")
    # Build guild→instance map
    active_configs = await db.discord_config.find({"is_active": True}, {"_id": 0}).to_list(50)
    for cfg in active_configs:
        gid = cfg.get("guild_id")
        iid = cfg.get("instance_id")
        if gid and iid:
            guild_instance_map[gid] = iid
        # Use per-instance token if available, otherwise app token
        if not bot_token:
            bot_token = cfg.get("bot_token")
    if bot_token:
        _shared_discord_task = asyncio.create_task(start_shared_discord_bot(bot_token))
        logger.info(f"Starting shared Discord bot ({len(active_configs)} active instances)")
@app.on_event("shutdown")
async def shutdown_event():
    global _shared_discord_client, _shared_discord_task
    if _shared_discord_client:
        try:
            await _shared_discord_client.close()
        except Exception:
            pass
    if _shared_discord_task:
        _shared_discord_task.cancel()
    mongo_client.close()
# ==================== AUTH ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "BridgeBot API", "version": "2.0.0"}
@api_router.post("/auth/register")
async def register(body: UserRegister):
    if not body.email or not body.password or not body.username:
        raise HTTPException(status_code=400, detail="Email, username, and password required")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    username_lower = body.username.strip().lower()
    if not username_lower:
        raise HTTPException(status_code=400, detail="Username cannot be empty")
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if await db.users.find_one({"username": username_lower}):
        raise HTTPException(status_code=400, detail="Username already taken")
    code = str(secrets.randbelow(900000) + 100000)
    expiry = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    hashed_pw = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    user_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": user_id,
        "email": body.email.lower(),
        "username": username_lower,
        "hashed_password": hashed_pw,
        "is_verified": False,
        "verification_code": code,
        "verification_code_expiry": expiry,
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    await send_verification_email(body.email, code)
    return {"message": "Verification code sent to your email."}
@api_router.post("/auth/resend-code")
async def resend_code(body: ResendCodeBody):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or user.get("is_verified"):
        return {"message": "If this email is registered and unverified, a new code has been sent"}
    code = str(secrets.randbelow(900000) + 100000)
    expiry = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    await db.users.update_one(
        {"email": body.email.lower()},
        {"$set": {"verification_code": code, "verification_code_expiry": expiry}}
    )
    await send_verification_email(body.email, code)
    return {"message": "New verification code sent"}
@api_router.post("/auth/verify")
async def verify_email(body: VerifyEmailBody):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("is_verified"):
        return {"message": "Email already verified"}
    if user.get("verification_code") != body.code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    expiry_str = user.get("verification_code_expiry")
    if expiry_str and datetime.fromisoformat(expiry_str) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Code expired. Request a new one.")
    await db.users.update_one(
        {"email": body.email.lower()},
        {"$set": {"is_verified": True, "verification_code": None, "verification_code_expiry": None}}
    )
    return {"message": "Email verified successfully"}
@api_router.post("/auth/login")
async def login(body: UserLogin, response: Response):
    identifier = body.email_or_username.strip().lower()
    # Try email first, then username
    user = await db.users.find_one({"email": identifier})
    if not user:
        user = await db.users.find_one({"username": identifier})
    if not user or not bcrypt.checkpw(body.password.encode(), user["hashed_password"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("is_verified"):
        raise HTTPException(status_code=403, detail="Email not verified. Check your email for the verification code.")
    token = create_access_token(user["id"], user["email"], user["role"])
    # Set httpOnly cookie — JS cannot read this, protecting against XSS token theft
    response.set_cookie(
        key="bf_access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=True,
        max_age=JWT_EXPIRY_DAYS * 24 * 60 * 60,
        path="/",
    )
    if user["role"] == "superadmin":
        instances = await db.bot_instances.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    else:
        instances = await db.bot_instances.find(
            {"assigned_user_ids": user["id"]}, {"_id": 0, "id": 1, "name": 1}
        ).to_list(100)
        if not instances:
            raise HTTPException(
                status_code=403,
                detail="No instances assigned to your account. Contact your admin."
            )
    return {
        "token": token,  # Kept for curl/API client use — frontend uses cookie
        "user": {"id": user["id"], "email": user["email"], "role": user["role"], "username": user.get("username", "")},
        "instances": instances
    }
@api_router.post("/auth/logout")
async def logout_user(response: Response):
    response.delete_cookie(key="bf_access_token", path="/")
    return {"success": True}
@api_router.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordBody):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    # Always return success to avoid revealing whether an email is registered
    if user and user.get("is_verified"):
        code = str(secrets.randbelow(900000) + 100000)
        expires = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.users.update_one(
            {"email": email},
            {"$set": {"reset_code": code, "reset_code_expires": expires}}
        )
        await send_reset_email(email, code)
    return {"message": "If that email is registered, a reset code has been sent."}
@api_router.post("/auth/reset-password")
async def reset_password(body: ResetPasswordBody):
    email = body.email.lower().strip()
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    user = await db.users.find_one({"email": email})
    if not user or not user.get("reset_code") or user.get("reset_code") != body.code:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    expires_str = user.get("reset_code_expires", "")
    if expires_str and datetime.fromisoformat(expires_str) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset code has expired. Request a new one.")
    hashed = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    await db.users.update_one(
        {"email": email},
        {"$set": {"hashed_password": hashed}, "$unset": {"reset_code": "", "reset_code_expires": ""}}
    )
    return {"message": "Password reset successful. You can now log in."}
@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one(
        {"id": current_user["id"]},
        {"_id": 0, "hashed_password": 0, "verification_code": 0,
         "verification_code_expiry": 0, "reset_code": 0, "reset_code_expires": 0}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user["role"] == "superadmin":
        instances = await db.bot_instances.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    else:
        instances = await db.bot_instances.find(
            {"assigned_user_ids": current_user["id"]}, {"_id": 0, "id": 1, "name": 1}
        ).to_list(100)
    return {**user, "instances": instances}
# ==================== INSTANCE MANAGEMENT (SUPERADMIN) ====================

@api_router.get("/admin/users")
async def list_all_users(current_user: dict = Depends(require_admin)):
    """Return all registered users with their assigned instances."""
    users = await db.users.find(
        {},
        {"_id": 0, "hashed_password": 0, "verification_code": 0,
         "verification_code_expiry": 0, "reset_code": 0, "reset_code_expires": 0}
    ).to_list(1000)
    instances = await db.bot_instances.find(
        {}, {"_id": 0, "id": 1, "name": 1, "assigned_user_ids": 1}
    ).to_list(100)
    user_instance_map = {}
    for inst in instances:
        for uid in inst.get("assigned_user_ids", []):
            user_instance_map.setdefault(uid, []).append({"id": inst["id"], "name": inst["name"]})
    for user in users:
        user["assigned_instances"] = user_instance_map.get(user["id"], [])
    return users
@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_admin)):
    """Delete a user (admin only). Cannot delete yourself."""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "superadmin":
        raise HTTPException(status_code=400, detail="Cannot delete admin accounts")
    # Remove user from all instance assignments
    await db.bot_instances.update_many(
        {"assigned_user_ids": user_id},
        {"$pull": {"assigned_user_ids": user_id}}
    )
    # Delete user
    await db.users.delete_one({"id": user_id})
    return {"success": True, "message": f"User {user.get('email', '')} deleted"}
@api_router.get("/admin/instances")
async def list_instances(current_user: dict = Depends(require_admin)):
    instances = await db.bot_instances.find({}, {"_id": 0}).to_list(100)
    # Batch user lookup — single query instead of N+1
    all_user_ids = set()
    for inst in instances:
        all_user_ids.update(inst.get("assigned_user_ids", []))
    if all_user_ids:
        users_list = await db.users.find(
            {"id": {"$in": list(all_user_ids)}},
            {"_id": 0, "id": 1, "email": 1, "is_verified": 1}
        ).to_list(1000)
        user_map = {u["id"]: u for u in users_list}
    else:
        user_map = {}
    for inst in instances:
        inst["assigned_users"] = [
            user_map[uid] for uid in inst.get("assigned_user_ids", []) if uid in user_map
        ]
    return instances
@api_router.post("/admin/instances")
async def create_instance(body: BotInstanceCreate, current_user: dict = Depends(require_admin)):
    instance_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    instance = {
        "id": instance_id,
        "name": body.name,
        "description": body.description or "",
        "created_by": current_user["email"],
        "assigned_user_ids": [],
        "created_at": now
    }
    await db.bot_instances.insert_one(instance)
    instance.pop("_id", None)
    await db.bot_config.insert_one({
        "instance_id": instance_id,
        "name": body.name,
        "persona": "You are a helpful, friendly, and knowledgeable assistant. Provide clear, accurate answers based on available information. Be concise but thorough.",
        "custom_instructions": "",
        "tone_instructions": "",
        "manual_tone_examples": [],
        "created_at": now
    })
    return instance
@api_router.put("/admin/instances/{instance_id}")
async def update_instance(instance_id: str, body: BotInstanceCreate, current_user: dict = Depends(require_admin)):
    result = await db.bot_instances.update_one(
        {"id": instance_id},
        {"$set": {"name": body.name, "description": body.description or "",
                  "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Instance not found")
    return {"success": True}
@api_router.delete("/admin/instances/{instance_id}")
async def delete_instance(instance_id: str, current_user: dict = Depends(require_admin)):
    result = await db.bot_instances.delete_one({"id": instance_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Instance not found")
    for col in [db.bot_config, db.knowledge_sources, db.conversations, db.discord_config]:
        await col.delete_many({"instance_id": instance_id})
    return {"success": True}
# ── Per-instance LLM provider configuration ─────────────────────────────────────

@api_router.get("/admin/instances/{instance_id}/llm-config")
async def get_instance_llm_config(instance_id: str, current_user: dict = Depends(require_admin)):
    """Return the per-instance LLM provider settings. Secret values are masked."""
    inst = await db.bot_instances.find_one({"id": instance_id}, {"_id": 0, "llm_config": 1})
    if inst is None:
        raise HTTPException(status_code=404, detail="Instance not found")
    cfg = inst.get("llm_config") or {}
    provider = cfg.get("provider") or "emergent"
    anthropic_key = cfg.get("anthropic_api_key") or ""
    openai_key = cfg.get("openai_api_key") or ""
    return {
        "provider": provider,
        "model": cfg.get("model") or "",
        "anthropic_api_key_set": bool(anthropic_key),
        "anthropic_api_key_preview": (anthropic_key[:7] + "…" + anthropic_key[-4:]) if len(anthropic_key) > 12 else "",
        "openai_api_key_set": bool(openai_key),
        "openai_api_key_preview": (openai_key[:7] + "…" + openai_key[-4:]) if len(openai_key) > 12 else "",
        "ollama_base_url": cfg.get("ollama_base_url") or "",
        "allowed_anthropic_models": list(ALLOWED_ANTHROPIC_MODELS.keys()),
        "allowed_openai_models": list(ALLOWED_OPENAI_MODELS.keys()),
        "default_models": {
            "emergent": DEFAULT_EMERGENT_MODEL,
            "anthropic": DEFAULT_ANTHROPIC_MODEL,
            "openai": DEFAULT_OPENAI_MODEL,
            "ollama": DEFAULT_OLLAMA_MODEL,
        },
    }
@api_router.put("/admin/instances/{instance_id}/llm-config")
async def put_instance_llm_config(instance_id: str, body: LLMProviderConfig, current_user: dict = Depends(require_admin)):
    """Save per-instance LLM provider. When `anthropic_api_key` is empty in the body, the existing
    stored key is preserved (lets admins update other fields without re-pasting the secret)."""
    inst = await db.bot_instances.find_one({"id": instance_id}, {"_id": 0, "llm_config": 1})
    if inst is None:
        raise HTTPException(status_code=404, detail="Instance not found")
    provider = (body.provider or "").lower()
    if provider not in ("emergent", "anthropic", "ollama", "openai"):
        raise HTTPException(status_code=400, detail="provider must be one of: emergent, anthropic, ollama, openai")
    existing = inst.get("llm_config") or {}
    model = (body.model or "").strip() or None
    # Reject API keys accidentally pasted into the Model field (sk-, bbk_, etc.)
    if model and re.match(r"^(sk-|bbk_)", model, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="Model must be a model name (e.g. claude-sonnet-4-5), not an API key.")
    if provider == "anthropic" and model and model not in ALLOWED_ANTHROPIC_MODELS:
        raise HTTPException(status_code=400, detail=f"Anthropic model must be one of: {list(ALLOWED_ANTHROPIC_MODELS.keys())}")
    if provider == "openai" and model and model not in ALLOWED_OPENAI_MODELS:
        raise HTTPException(status_code=400, detail=f"OpenAI model must be one of: {list(ALLOWED_OPENAI_MODELS.keys())}")
    new_cfg = {
        "provider": provider,
        "model": model,
        # Preserve existing key when caller omits it (so admins can update model without re-pasting the secret)
        "anthropic_api_key": (body.anthropic_api_key.strip() if body.anthropic_api_key else None) or existing.get("anthropic_api_key"),
        "openai_api_key": (body.openai_api_key.strip() if body.openai_api_key else None) or existing.get("openai_api_key"),
        "ollama_base_url": (body.ollama_base_url or "").strip() or None,
    }
    await db.bot_instances.update_one(
        {"id": instance_id},
        {"$set": {"llm_config": new_cfg, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    # Clear any cached LLM sessions for this instance — provider change invalidates them
    for k in list(llm_sessions.keys()):
        if f"_{instance_id}_" in k:
            llm_sessions.pop(k, None)
    for k in list(llm_history.keys()):
        if f"_{instance_id}_" in k:
            llm_history.pop(k, None)
    logger.info(f"[LLM] instance={instance_id} provider={provider} model={model}")
    # Return the saved config (masked) for consistency
    anthropic_key = new_cfg.get("anthropic_api_key") or ""
    openai_key = new_cfg.get("openai_api_key") or ""
    return {
        "success": True,
        "provider": provider,
        "model": model or "",
        "anthropic_api_key_set": bool(anthropic_key),
        "anthropic_api_key_preview": (anthropic_key[:7] + "…" + anthropic_key[-4:]) if len(anthropic_key) > 12 else "",
        "openai_api_key_set": bool(openai_key),
        "openai_api_key_preview": (openai_key[:7] + "…" + openai_key[-4:]) if len(openai_key) > 12 else "",
        "ollama_base_url": new_cfg.get("ollama_base_url") or "",
    }
@api_router.post("/admin/instances/{instance_id}/llm-config/test")
async def test_instance_llm_config(instance_id: str, current_user: dict = Depends(require_admin)):
    """Send a one-shot 'ping' through the configured provider to verify credentials work."""
    try:
        out = await call_claude(
            session_id=f"healthcheck_{datetime.now(timezone.utc).timestamp()}",
            user_message="Reply with exactly the word: pong",
            system_prompt="You are a health check responder. Reply with exactly one word: pong",
            instance_id=instance_id,
            platform="healthcheck",
        )
        return {"success": True, "response": (out or "").strip()[:200]}
    except HTTPException as e:
        return {"success": False, "error": str(e.detail), "status_code": e.status_code}
    except Exception as e:
        return {"success": False, "error": str(e)}
@api_router.get("/admin/instances/{instance_id}/reply-defaults")
async def get_reply_defaults(instance_id: str, current_user: dict = Depends(require_admin)):
    """Return the instance-level acknowledgment replies and fallback message."""
    inst = await db.bot_instances.find_one({"id": instance_id}, {"acknowledgment_replies": 1, "fallback_message": 1}) or {}
    ack_raw = inst.get("acknowledgment_replies")
    fallback = inst.get("fallback_message")
    # Migrate from scripted_mode if instance-level values are missing
    needs_discord_fallback = (
        (not isinstance(ack_raw, list) or not any(isinstance(x, str) and x.strip() for x in ack_raw))
        or (not isinstance(fallback, str) or not fallback.strip())
    )
    if needs_discord_fallback:
        dc = await db.discord_config.find_one({"instance_id": instance_id}) or {}
        sm = dc.get("scripted_mode") if isinstance(dc.get("scripted_mode"), dict) else {}
        if not isinstance(ack_raw, list) or not any(isinstance(x, str) and x.strip() for x in ack_raw):
            sm_acks = (sm or {}).get("acknowledgment_replies")
            ack_raw = sm_acks if isinstance(sm_acks, list) and any(isinstance(x, str) and x.strip() for x in sm_acks) else list(DEFAULT_ACK_REPLIES)
        if not isinstance(fallback, str) or not fallback.strip():
            fallback = (sm or {}).get("fallback_message") or ""
    return {
        "acknowledgment_replies": ack_raw,
        "fallback_message": fallback,
    }
@api_router.put("/admin/instances/{instance_id}/reply-defaults")
async def update_reply_defaults(instance_id: str, body: dict, current_user: dict = Depends(require_admin)):
    """Save instance-level acknowledgment replies and fallback message."""
    inst = await db.bot_instances.find_one({"id": instance_id})
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")
    update_fields = {}
    if "acknowledgment_replies" in body:
        acks = body["acknowledgment_replies"]
        if isinstance(acks, list):
            update_fields["acknowledgment_replies"] = [a for a in acks if isinstance(a, str)]
    if "fallback_message" in body:
        update_fields["fallback_message"] = str(body["fallback_message"] or "")
    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.bot_instances.update_one({"id": instance_id}, {"$set": update_fields})
    return {"success": True}
@api_router.post("/admin/instances/{instance_id}/assign-user")
async def assign_user(instance_id: str, body: AssignUser, current_user: dict = Depends(require_admin)):
    instance = await db.bot_instances.find_one({"id": instance_id})
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    user = await db.users.find_one({"email": body.user_email.lower()})
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{body.user_email}' not found. They must register first.")
    await db.bot_instances.update_one(
        {"id": instance_id},
        {"$addToSet": {"assigned_user_ids": user["id"]}}
    )
    return {"success": True, "user": {"id": user["id"], "email": user["email"]}}
@api_router.delete("/admin/instances/{instance_id}/unassign-user/{user_id}")
async def unassign_user(instance_id: str, user_id: str, current_user: dict = Depends(require_admin)):
    result = await db.bot_instances.update_one(
        {"id": instance_id},
        {"$pull": {"assigned_user_ids": user_id}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Instance not found")
    return {"success": True}
# ==================== UNIFIED API QUERY ENGINE ====================

import api_integrations as _api_mod

API_ROUTE_PROMPT = """You are an API routing engine. Given a user question and available API endpoints, decide whether a live API call is needed and if so, which endpoints to call.

AVAILABLE ENDPOINTS:
{endpoints}

USER QUESTION: {question}

Respond with JSON only. Examples:
- No API needed: {{"action": "none", "reason": "This is a knowledge question"}}
- Single API call: {{"action": "call_api", "calls": [{{"endpoint_id": "abc123", "parameters": {{"pool_id": "pool1xyz"}}}}]}}
- Multiple calls: {{"action": "call_api", "calls": [{{"endpoint_id": "abc", "parameters": {{}}}}, {{"endpoint_id": "def", "parameters": {{}}}}]}}

Rules:
- Only select from the AVAILABLE ENDPOINTS listed above by their [endpoint_id].
- Fill in parameter values from the user's question when possible.
- If the user provides an address, hash, pool ID, etc., use it as a parameter value.
- Maximum {max_calls} API calls per question.
- If unsure whether an API call helps, prefer "none".
- Output ONLY valid JSON, no explanation."""


async def _try_api_query(user_message: str, bot_config: dict, knowledge_context: str, instance_id: str, session_id: str):
    """Unified API orchestrator. Queries enabled endpoints across all integrations.
    Returns (api_context_str, source_list) if API data was fetched, or None."""

    endpoints = await api_integrations_routes.get_enabled_endpoints_for_instance(instance_id)
    if not endpoints:
        return None

    endpoint_listing = build_endpoint_selection_context(endpoints)
    if not endpoint_listing.strip():
        return None

    logger.info(f"[API_QUERY] {len(endpoints)} enabled endpoints, routing: {user_message[:80]}")

    # Step 1: Ask LLM which endpoints to call
    route_prompt = API_ROUTE_PROMPT.format(
        endpoints=endpoint_listing[:12000],
        question=user_message,
        max_calls=_api_mod.MAX_API_CALLS_PER_MESSAGE,
    )
    try:
        route_response = await call_claude(
            f"{session_id}_route", user_message, route_prompt,
            instance_id=instance_id, platform="api_router"
        )
        clean = route_response.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        clean = clean.replace("\u201c", '"').replace("\u201d", '"').replace("\u2018", "'").replace("\u2019", "'")
        json_start = clean.find("{")
        json_end = clean.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            clean = clean[json_start:json_end]
        route = _json.loads(clean)
        if not isinstance(route, dict):
            return None
        logger.info(f"[API_QUERY] Route: {route.get('action')} — {route.get('reason', '')[:80]}")
    except Exception as e:
        logger.warning(f"[API_QUERY] Route parse failed: {e}")
        return None

    if route.get("action") not in ("call_api",):
        return None

    calls = route.get("calls", [])
    if not calls:
        return None

    # Step 2: Execute via registered endpoint system
    results = await api_integrations_routes.execute_selected_endpoints(calls, instance_id)
    if not results:
        return None

    # Step 3: Build combined context for the final LLM answer
    api_context_parts = []
    sources = []
    has_data = False

    for r in results:
        if r.get("error"):
            api_context_parts.append(f"API ERROR: {r['error']}")
            continue
        ep = r.get("endpoint", {})
        result = r.get("result", {})
        schema_ctx = r.get("schema_context", "")

        if result.get("success"):
            has_data = True
            data_str = _json.dumps(result.get("data", ""), indent=2)[:8000]
            part = f"--- API RESULT: {ep['method']} {ep['path']} ---\n"
            if schema_ctx:
                part += f"Schema info:\n{schema_ctx}\n\n"
            part += f"HTTP {result.get('status', 200)} — Response data:\n{data_str}"
            api_context_parts.append(part)
            sources.append(f"`{ep['method']} {ep['path']}`")
        else:
            status = result.get("status", 0)
            error = result.get("error", "Unknown error")
            err_schema = (ep.get("error_responses") or {}).get(str(status), {})
            err_desc = err_schema.get("description", "")
            part = f"--- API ERROR: {ep['method']} {ep['path']} → HTTP {status} ---\n"
            if err_desc:
                part += f"Documented error: {err_desc}\n"
            part += f"Error: {error}"
            api_context_parts.append(part)
            sources.append(f"`{ep['method']} {ep['path']}` (error)")

    if not has_data and not api_context_parts:
        return None

    return "\n\n".join(api_context_parts), sources


# ==================== CHAT (PUBLIC) ====================

@api_router.post("/chat/send")
async def send_chat_message(body: ChatMessage):
    session_id = body.session_id or str(uuid.uuid4())
    instance_id = body.instance_id or "default"
    bot_config = await db.bot_config.find_one({"instance_id": instance_id}, {"_id": 0}) or {}
    knowledge = await search_knowledge(body.message, instance_id)
    if knowledge == "__NO_KB__":
        response = "I don't have any knowledge base configured yet. Please check back later or contact the administrator to set up my knowledge base."
    else:
        # Unified KB + API reasoning: gather API context, then let the LLM synthesize
        api_result = await _try_api_query(body.message, bot_config, knowledge, instance_id, session_id)
        api_context = ""
        api_sources = []
        if api_result:
            api_context, api_sources = api_result
        tone = await get_tone_examples_text(instance_id, bot_config)
        system_prompt = build_system_prompt(bot_config, knowledge, tone,
                                           knowledge_gate=bot_config.get("knowledge_gate", "strict"),
                                           api_context=api_context, api_sources=api_sources)
        response = await call_claude(session_id, body.message, system_prompt,
                                    instance_id=instance_id, platform="web")
    await save_conversation(session_id, body.message, response, platform="web", instance_id=instance_id)
    return {"response": response, "session_id": session_id}

@api_router.post("/chat/stream")
async def stream_chat_message(body: ChatMessage):
    """Streaming version of /chat/send. Returns SSE (text/event-stream)."""
    session_id = body.session_id or str(uuid.uuid4())
    instance_id = body.instance_id or "default"
    return StreamingResponse(
        stream_chat_response(session_id, body.message, instance_id, platform="web"),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

@api_router.get("/chat/history/{session_id}")
async def get_chat_history(session_id: str):
    conv = await db.conversations.find_one({"session_id": session_id}, {"_id": 0})
    return conv or {"messages": [], "session_id": session_id}
# ==================== BOT CONFIG (PROTECTED) ====================

@api_router.get("/admin/bot-config")
async def get_bot_config(instance_id: str = Depends(get_instance_access)):
    config = await db.bot_config.find_one({"instance_id": instance_id}, {"_id": 0})
    if not config:
        return {}
    # Mask sensitive API key value
    if config.get("api_key_value"):
        config["api_key_value_set"] = True
        config["api_key_value"] = ""
    return config
@api_router.put("/admin/bot-config")
async def update_bot_config(body: BotConfigUpdate, instance_id: str = Depends(get_instance_access)):
    update_data = {}
    for k, v in body.dict().items():
        if v is not None:
            update_data[k] = v
    # Don't overwrite saved API key with empty string
    if "api_key_value" in update_data and not update_data["api_key_value"].strip():
        del update_data["api_key_value"]
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided")
    if update_data.get("knowledge_gate") and update_data["knowledge_gate"] not in ("strict", "flexible"):
        raise HTTPException(status_code=422, detail="knowledge_gate must be 'strict' or 'flexible'")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.bot_config.update_one({"instance_id": instance_id}, {"$set": update_data}, upsert=True)
    # Mask api_key_value in response
    config = await db.bot_config.find_one({"instance_id": instance_id}, {"_id": 0})
    if config and config.get("api_key_value"):
        config["api_key_value_set"] = True
        config["api_key_value"] = ""
    return config

# ==================== EXTERNAL API (PUBLIC — authenticated via bbk_ keys) ====================

def _generate_api_key() -> str:
    """Generate a bbk_ prefixed API key."""
    import secrets as _secrets
    return f"bbk_{_secrets.token_hex(24)}"
@api_router.post("/admin/api-keys")
async def create_api_key(body: dict, current_user: dict = Depends(require_admin)):
    """Create a new API key for an instance."""
    instance_id = body.get("instance_id")
    label = body.get("label", "")
    if not instance_id:
        raise HTTPException(status_code=400, detail="instance_id is required")
    inst = await db.bot_instances.find_one({"id": instance_id})
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")
    key = _generate_api_key()

    key_hash = hashlib.sha256(key.encode()).hexdigest()
    doc = {
        "id": str(uuid.uuid4()),
        "instance_id": instance_id,
        "key_hash": key_hash,
        "key_prefix": key[:12],
        "label": label.strip()[:100] if label else "",
        "created_by": current_user.get("email", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True,
        "last_used_at": None,
        "usage_count": 0,
    }
    await db.api_keys.insert_one(doc)
    doc.pop("_id", None)
    doc["key"] = key  # Return the full key only on creation
    return doc
@api_router.get("/admin/api-keys")
async def list_api_keys(instance_id: str = Depends(get_instance_access)):
    """List API keys for an instance (never returns the full key)."""
    keys = await db.api_keys.find(
        {"instance_id": instance_id}, {"_id": 0, "key_hash": 0}
    ).sort("created_at", -1).to_list(50)
    return keys
@api_router.delete("/admin/api-keys/{key_id}")
async def revoke_api_key(key_id: str, current_user: dict = Depends(require_admin)):
    result = await db.api_keys.delete_one({"id": key_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"success": True}
@api_router.patch("/admin/api-keys/{key_id}/toggle")
async def toggle_api_key(key_id: str, current_user: dict = Depends(require_admin)):
    doc = await db.api_keys.find_one({"id": key_id})
    if not doc:
        raise HTTPException(status_code=404, detail="API key not found")
    new_status = not doc.get("is_active", True)
    await db.api_keys.update_one({"id": key_id}, {"$set": {"is_active": new_status}})
    return {"is_active": new_status}

# ==================== API KEY ANALYTICS ====================

@api_router.get("/admin/api-key-analytics")
async def api_key_analytics_list(
    instance_id: str = Depends(get_instance_access),
    days: int = 30
):
    """Overview analytics for all API keys of an instance."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    keys = await db.api_keys.find({"instance_id": instance_id}, {"_id": 0, "key_hash": 0}).to_list(100)

    result = []
    for k in keys:
        kid = k["id"]
        # Count requests from llm_usage
        total = await db.llm_usage.count_documents({"api_key_id": kid, "timestamp": {"$gte": cutoff}})
        success = await db.llm_usage.count_documents({"api_key_id": kid, "success": True, "timestamp": {"$gte": cutoff}})
        failed = total - success
        # Token totals
        pipeline = [
            {"$match": {"api_key_id": kid, "timestamp": {"$gte": cutoff}}},
            {"$group": {"_id": None,
                        "total_input": {"$sum": "$input_tokens"},
                        "total_output": {"$sum": "$output_tokens"},
                        "avg_duration": {"$avg": "$duration_ms"}}},
        ]
        agg = await db.llm_usage.aggregate(pipeline).to_list(1)
        tokens = agg[0] if agg else {}
        result.append({
            **k,
            "analytics": {
                "period_days": days,
                "total_requests": total,
                "successful": success,
                "failed": failed,
                "total_input_tokens": tokens.get("total_input", 0),
                "total_output_tokens": tokens.get("total_output", 0),
                "avg_duration_ms": round(tokens.get("avg_duration", 0)),
            }
        })
    return result


@api_router.get("/admin/api-key-analytics/{key_id}")
async def api_key_analytics_detail(
    key_id: str,
    days: int = 30,
    instance_id: str = Depends(get_instance_access),
):
    """Detailed analytics for a single API key."""
    key_doc = await db.api_keys.find_one({"id": key_id, "instance_id": instance_id}, {"_id": 0, "key_hash": 0})
    if not key_doc:
        raise HTTPException(status_code=404, detail="API key not found")

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    base_match = {"api_key_id": key_id, "timestamp": {"$gte": cutoff}}

    # 1. Requests per day
    requests_by_day = await db.llm_usage.aggregate([
        {"$match": base_match},
        {"$addFields": {"day": {"$substr": ["$timestamp", 0, 10]}}},
        {"$group": {
            "_id": "$day",
            "total": {"$sum": 1},
            "successful": {"$sum": {"$cond": ["$success", 1, 0]}},
            "failed": {"$sum": {"$cond": ["$success", 0, 1]}},
            "input_tokens": {"$sum": "$input_tokens"},
            "output_tokens": {"$sum": "$output_tokens"},
            "avg_duration": {"$avg": "$duration_ms"},
        }},
        {"$sort": {"_id": 1}},
    ]).to_list(days + 1)

    # 2. Model/endpoint breakdown
    model_breakdown = await db.llm_usage.aggregate([
        {"$match": base_match},
        {"$group": {
            "_id": "$model_used",
            "count": {"$sum": 1},
            "input_tokens": {"$sum": "$input_tokens"},
            "output_tokens": {"$sum": "$output_tokens"},
            "avg_duration": {"$avg": "$duration_ms"},
        }},
        {"$sort": {"count": -1}},
    ]).to_list(20)

    # 3. Platform breakdown
    platform_breakdown = await db.llm_usage.aggregate([
        {"$match": base_match},
        {"$group": {"_id": "$platform", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]).to_list(10)

    # 4. Success vs failure totals
    totals_pipeline = [
        {"$match": base_match},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "successful": {"$sum": {"$cond": ["$success", 1, 0]}},
            "failed": {"$sum": {"$cond": ["$success", 0, 1]}},
            "total_input_tokens": {"$sum": "$input_tokens"},
            "total_output_tokens": {"$sum": "$output_tokens"},
            "avg_duration": {"$avg": "$duration_ms"},
            "max_duration": {"$max": "$duration_ms"},
            "min_duration": {"$min": "$duration_ms"},
        }},
    ]
    totals = (await db.llm_usage.aggregate(totals_pipeline).to_list(1))
    t = totals[0] if totals else {}

    # 5. Error type breakdown
    error_breakdown = await db.llm_usage.aggregate([
        {"$match": {**base_match, "success": False, "error_type": {"$ne": None}}},
        {"$group": {"_id": "$error_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]).to_list(10)

    # 6. Recent requests (last 50)
    recent = await db.llm_usage.find(
        {"api_key_id": key_id},
        {"_id": 0, "id": 1, "timestamp": 1, "model_used": 1, "success": 1,
         "input_tokens": 1, "output_tokens": 1, "duration_ms": 1, "error_type": 1, "platform": 1}
    ).sort("timestamp", -1).to_list(50)

    # 7. Cost estimation
    total_cost = 0.0
    for day in requests_by_day:
        # Approximate cost — we use per-model breakdown for more accuracy
        pass
    # Calculate cost per model
    cost_by_model = []
    for m in model_breakdown:
        model_name = m["_id"] or "unknown"
        cost = _cost_for(model_name, m.get("input_tokens", 0), m.get("output_tokens", 0))
        total_cost += cost
        cost_by_model.append({"model": model_name, "cost": round(cost, 4), "requests": m["count"],
                              "input_tokens": m.get("input_tokens", 0), "output_tokens": m.get("output_tokens", 0)})

    return {
        "key": key_doc,
        "period_days": days,
        "summary": {
            "total_requests": t.get("total", 0),
            "successful": t.get("successful", 0),
            "failed": t.get("failed", 0),
            "success_rate": round(t.get("successful", 0) / max(t.get("total", 1), 1) * 100, 1),
            "total_input_tokens": t.get("total_input_tokens", 0),
            "total_output_tokens": t.get("total_output_tokens", 0),
            "avg_duration_ms": round(t.get("avg_duration", 0)),
            "max_duration_ms": t.get("max_duration", 0),
            "min_duration_ms": t.get("min_duration", 0),
            "estimated_cost_usd": round(total_cost, 4),
        },
        "requests_by_day": [{"date": d["_id"], "total": d["total"], "successful": d["successful"],
                             "failed": d["failed"], "input_tokens": d["input_tokens"],
                             "output_tokens": d["output_tokens"],
                             "avg_duration_ms": round(d.get("avg_duration", 0))} for d in requests_by_day],
        "model_breakdown": [{"model": m["_id"], "count": m["count"],
                             "input_tokens": m.get("input_tokens", 0), "output_tokens": m.get("output_tokens", 0),
                             "avg_duration_ms": round(m.get("avg_duration", 0))} for m in model_breakdown],
        "platform_breakdown": [{"platform": p["_id"], "count": p["count"]} for p in platform_breakdown],
        "error_breakdown": [{"error_type": e["_id"], "count": e["count"]} for e in error_breakdown],
        "cost_by_model": cost_by_model,
        "recent_requests": recent,
    }

async def _authenticate_api_key(request: Request) -> dict:
    """Validate a bbk_ API key from the Authorization header. Returns {instance_id, key_id}."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer bbk_"):
        raise HTTPException(status_code=401, detail="Invalid API key. Must be a Bearer bbk_... token.")
    key = auth.replace("Bearer ", "").strip()

    key_hash = hashlib.sha256(key.encode()).hexdigest()
    doc = await db.api_keys.find_one({"key_hash": key_hash})
    if not doc:
        raise HTTPException(status_code=401, detail="Invalid API key.")
    if not doc.get("is_active", True):
        raise HTTPException(status_code=403, detail="API key is disabled.")
    # Update usage stats
    await db.api_keys.update_one(
        {"key_hash": key_hash},
        {"$set": {"last_used_at": datetime.now(timezone.utc).isoformat()}, "$inc": {"usage_count": 1}}
    )
    return {"instance_id": doc["instance_id"], "key_id": doc["id"]}
class ExternalChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class EmbedConfigUpdate(BaseModel):
    custom_css_url: Optional[str] = None
    theme: Optional[dict] = None  # CSS variable overrides

# ==================== EMBED CONFIG ====================

@api_router.get("/embed/config/{instance_id}")
async def get_embed_config(instance_id: str):
    """Public endpoint — returns embed theming config for an instance."""
    config = await db.embed_configs.find_one({"instance_id": instance_id}, {"_id": 0})
    if not config:
        return {"instance_id": instance_id, "custom_css_url": "", "theme": {}}
    return config

@api_router.put("/admin/embed-config")
async def update_embed_config(body: EmbedConfigUpdate, instance_id: str = Depends(get_instance_access)):
    """Save embed configuration (custom CSS URL, theme variables) for an instance."""
    update_data = {"instance_id": instance_id, "updated_at": datetime.now(timezone.utc).isoformat()}
    if body.custom_css_url is not None:
        update_data["custom_css_url"] = body.custom_css_url.strip()
    if body.theme is not None:
        update_data["theme"] = body.theme
    await db.embed_configs.update_one(
        {"instance_id": instance_id}, {"$set": update_data}, upsert=True
    )
    config = await db.embed_configs.find_one({"instance_id": instance_id}, {"_id": 0})
    return config

@api_router.get("/embed.js")
async def serve_embed_script(request: Request, instance: str = "", mode: str = "popup"):
    """Serve the embeddable JavaScript loader. Modes: popup, inline, fullpage."""
    from fastapi.responses import Response as FastResponse
    # Derive origin from the request so it works in any environment
    origin = str(request.base_url).rstrip("/")
    script = f"""
(function() {{
  var BRIDGE_INSTANCE = "{instance}";
  var BRIDGE_MODE = "{mode}";
  var BRIDGE_ORIGIN = "{origin}" || window.location.origin;
  var widgetUrl = BRIDGE_ORIGIN + "/widget?instance=" + encodeURIComponent(BRIDGE_INSTANCE) + "&mode=" + BRIDGE_MODE;

  if (BRIDGE_MODE === "inline") {{
    var target = document.getElementById("bridgebot-container") || document.querySelector("[data-bridgebot]");
    if (!target) {{ console.warn("BridgeBot: No #bridgebot-container or [data-bridgebot] element found."); return; }}
    var iframe = document.createElement("iframe");
    iframe.src = widgetUrl;
    iframe.title = "BridgeBot Chat";
    iframe.style.cssText = "width:100%;height:100%;border:none;min-height:500px;";
    iframe.setAttribute("data-testid", "bridgebot-inline-iframe");
    target.innerHTML = "";
    target.appendChild(iframe);
    return;
  }}

  if (BRIDGE_MODE === "fullpage") {{
    var iframe = document.createElement("iframe");
    iframe.src = widgetUrl;
    iframe.title = "BridgeBot Chat";
    iframe.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:99999;";
    iframe.setAttribute("data-testid", "bridgebot-fullpage-iframe");
    document.body.appendChild(iframe);
    return;
  }}

  // Default: popup mode
  var isOpen = false;
  var btn = document.createElement("div");
  btn.setAttribute("data-testid", "bridgebot-popup-trigger");
  btn.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:99998;cursor:pointer;width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.2);transition:transform 0.2s ease;background:var(--bb-accent,#3B82F6);";
  btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 11.5C21 16.75 16.75 21 11.5 21C6.25 21 2 16.75 2 11.5C2 6.25 6.25 2 11.5 2" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 2L15 9" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 2H22V7" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  btn.onmouseenter = function() {{ btn.style.transform = "scale(1.08)"; }};
  btn.onmouseleave = function() {{ btn.style.transform = "scale(1)"; }};

  var panel = document.createElement("div");
  panel.setAttribute("data-testid", "bridgebot-popup-panel");
  panel.style.cssText = "position:fixed;bottom:88px;right:20px;z-index:99999;width:380px;height:580px;border-radius:12px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.25);opacity:0;transform:translateY(16px) scale(0.96);transition:opacity 0.25s ease,transform 0.25s ease;pointer-events:none;";
  var iframe = document.createElement("iframe");
  iframe.src = widgetUrl;
  iframe.title = "BridgeBot Chat";
  iframe.style.cssText = "width:100%;height:100%;border:none;";
  iframe.setAttribute("data-testid", "bridgebot-popup-iframe");
  panel.appendChild(iframe);

  document.body.appendChild(panel);
  document.body.appendChild(btn);

  btn.addEventListener("click", function() {{
    isOpen = !isOpen;
    if (isOpen) {{
      panel.style.opacity = "1";
      panel.style.transform = "translateY(0) scale(1)";
      panel.style.pointerEvents = "auto";
      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>';
    }} else {{
      panel.style.opacity = "0";
      panel.style.transform = "translateY(16px) scale(0.96)";
      panel.style.pointerEvents = "none";
      btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 11.5C21 16.75 16.75 21 11.5 21C6.25 21 2 16.75 2 11.5C2 6.25 6.25 2 11.5 2" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 2L15 9" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 2H22V7" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }}
  }});
}})();
"""
    return FastResponse(content=script.strip(), media_type="application/javascript")

@api_router.post("/v1/chat")
async def external_chat(body: ExternalChatRequest, request: Request):
    """Public chat endpoint authenticated via bbk_ API key.
    Send messages to a bot instance's knowledge base and get AI responses."""
    auth_info = await _authenticate_api_key(request)
    instance_id = auth_info["instance_id"]
    _current_api_key_id.set(auth_info["key_id"])
    session_id = body.session_id or str(uuid.uuid4())

    bot_config = await db.bot_config.find_one({"instance_id": instance_id}, {"_id": 0}) or {}
    knowledge = await search_knowledge(body.message, instance_id)

    if knowledge == "__NO_KB__":
        response = "I don't have any knowledge base configured yet."
    else:
        # Unified KB + API reasoning
        api_result = await _try_api_query(body.message, bot_config, knowledge, instance_id, session_id)
        api_context = ""
        api_sources = []
        if api_result:
            api_context, api_sources = api_result
        tone = await get_tone_examples_text(instance_id, bot_config)
        gate = bot_config.get("knowledge_gate", "strict")
        system_prompt = build_system_prompt(bot_config, knowledge, tone, knowledge_gate=gate,
                                           api_context=api_context, api_sources=api_sources)
        response = await call_claude(session_id, body.message, system_prompt,
                                    instance_id=instance_id, platform="api")

    await save_conversation(session_id, body.message, response, platform="api", instance_id=instance_id)
    _current_api_key_id.set(None)
    return {
        "response": response,
        "session_id": session_id,
        "instance_id": instance_id,
    }

@api_router.post("/v1/chat/stream")
async def external_chat_stream(body: ExternalChatRequest, request: Request):
    """Streaming version of /v1/chat. Authenticated via bbk_ API key. Returns SSE."""
    auth_info = await _authenticate_api_key(request)
    instance_id = auth_info["instance_id"]
    _current_api_key_id.set(auth_info["key_id"])
    session_id = body.session_id or str(uuid.uuid4())
    return StreamingResponse(
        stream_chat_response(session_id, body.message, instance_id, platform="api"),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

# ==================== KNOWLEDGE SOURCES (PROTECTED) ====================

@api_router.get("/knowledge/sources")
async def get_knowledge_sources(instance_id: str = Depends(get_instance_access)):
    # Include content only for char-count calculation; project to minimize transfer
    sources = await db.knowledge_sources.find(
        {"instance_id": instance_id}, {"_id": 0}
    ).sort([("priority", -1), ("created_at", -1)]).to_list(500)

    # Group chunked URL sources by group_id or url
    groups = {}
    ungrouped = []
    backfill_groups = {}  # url -> new_group_id for legacy sources without group_id
    for s in sources:
        content_len = len(s.get("content", "") or "")
        existing_gid = s.get("group_id")
        legacy_url_group = s.get("url") if not existing_gid and s.get("type") == "url" and "(part " in (s.get("title") or "") else None
        gid = existing_gid or legacy_url_group
        if gid:
            # For legacy sources grouped by URL, generate a stable group_id
            if legacy_url_group and not existing_gid:
                if legacy_url_group not in backfill_groups:
                    backfill_groups[legacy_url_group] = str(uuid.uuid4())
                gid = backfill_groups[legacy_url_group]
            if gid not in groups:
                groups[gid] = {
                    "group_id": gid,
                    "type": s["type"],
                    "title": re.sub(r'\s*\(part \d+/\d+\)$', '', s.get("title", "")),
                    "url": s.get("url", ""),
                    "priority": s.get("priority", 0),
                    "category": s.get("category", ""),
                    "is_active": s.get("is_active", True),
                    "created_at": s.get("created_at", ""),
                    "parts": [],
                    "total_chars": 0,
                }
            groups[gid]["parts"].append(s["id"])
            groups[gid]["total_chars"] += content_len
            if not s.get("is_active"):
                groups[gid]["is_active"] = False
        else:
            s.pop("content", None)  # strip content from response for ungrouped
            ungrouped.append({
                **s,
                "parts": [s["id"]],
                "total_parts": 1,
                "total_chars": content_len,
            })

    # Backfill group_id on legacy sources (fire-and-forget)
    for url, new_gid in backfill_groups.items():
        parts_in_group = groups.get(new_gid, {}).get("parts", [])
        if parts_in_group:
            await db.knowledge_sources.update_many(
                {"id": {"$in": parts_in_group}, "instance_id": instance_id},
                {"$set": {"group_id": new_gid}}
            )

    grouped_list = []
    for g in groups.values():
        g["total_parts"] = len(g["parts"])
        grouped_list.append(g)
    result = sorted(grouped_list + ungrouped, key=lambda x: (-x.get("priority", 0), x.get("created_at", "") or ""))
    return result
@api_router.post("/knowledge/sources/faq")
async def add_faq(entry: FAQEntry, instance_id: str = Depends(get_instance_access)):
    doc = {
        "id": str(uuid.uuid4()), "type": "faq", "title": entry.title,
        "content": entry.content, "tags": entry.tags or [],
        "instance_id": instance_id, "priority": entry.priority or 0,
        "is_active": True, "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.knowledge_sources.insert_one(doc)
    doc.pop("_id", None)
    return doc

def _split_into_chunks(text: str, max_chunk: int = 8000) -> list:
    """Split large text into chunks, preferring section/Q&A boundaries."""
    if len(text) <= max_chunk:
        return [text]
    chunks = []
    remaining = text
    while remaining:
        if len(remaining) <= max_chunk:
            chunks.append(remaining)
            break
        # Find the best split point near the max_chunk boundary
        candidate = remaining[:max_chunk]
        split_at = max_chunk
        # Prefer splitting at section headers or Q&A boundaries
        for sep in ["\n\n## ", "\n\nQ: ", "\n\n"]:
            pos = candidate.rfind(sep, max_chunk // 2)
            if pos > 0:
                split_at = pos
                break
        chunks.append(remaining[:split_at].strip())
        remaining = remaining[split_at:].strip()
    return [c for c in chunks if c]

def _extract_nextjs_content(html: str) -> str:
    """Extract readable text from Next.js __NEXT_DATA__ embedded JSON.
    Handles Sanity portable text blocks (common in Next.js/Sanity CMS sites)."""
    import json as _json
    idx = html.index("__NEXT_DATA__")
    json_start = html.index("{", idx)
    depth = 0
    for i, c in enumerate(html[json_start:json_start + 2_000_000]):
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        if depth == 0:
            data = _json.loads(html[json_start:json_start + i + 1])
            break
    else:
        return ""

    # Walk the JSON tree and extract all readable text
    parts = []

    def _extract_text_from_blocks(blocks):
        """Extract text from Sanity portable text blocks."""
        texts = []
        if not isinstance(blocks, list):
            return ""
        for block in blocks:
            if not isinstance(block, dict):
                continue
            children = block.get("children", [])
            for child in children if isinstance(children, list) else []:
                if isinstance(child, dict) and child.get("text"):
                    texts.append(child["text"])
            # Handle list items
            if block.get("listItem"):
                texts.append("")  # line break for list items
        return " ".join(t for t in texts if t).strip()

    def _walk(obj, depth=0):
        """Recursively walk the JSON and extract Q&A, titles, and text."""
        if depth > 15:
            return
        if isinstance(obj, dict):
            # FAQ-style item with question + answer
            question = obj.get("question") or obj.get("title") or ""
            answer_blocks = obj.get("answer") or obj.get("body") or obj.get("content")
            if question and isinstance(answer_blocks, list) and answer_blocks:
                answer_text = _extract_text_from_blocks(answer_blocks)
                if answer_text:
                    parts.append(f"Q: {question}\nA: {answer_text}")
                    return  # don't recurse further into this item
            # Group with title
            if obj.get("_type") in ("faqGroup", "group", "section") and obj.get("title"):
                parts.append(f"\n## {obj['title']}")
            for v in obj.values():
                _walk(v, depth + 1)
        elif isinstance(obj, list):
            for item in obj:
                _walk(item, depth + 1)

    page_props = data.get("props", {}).get("pageProps", {})
    _walk(page_props)
    return "\n\n".join(parts)


def _parse_openapi_spec(data: dict) -> str:
    """Parse an OpenAPI JSON spec into readable KB text with all endpoints."""
    parts = []
    info = data.get("info", {})
    title = info.get("title", "API")
    desc = info.get("description", "")
    version = info.get("version", "")
    servers = data.get("servers", [])

    parts.append(f"# {title} (v{version})")
    if desc:
        parts.append(desc.strip())
    if servers:
        parts.append(f"Base URL: {servers[0].get('url', '')} — {servers[0].get('description', '')}")

    paths = data.get("paths", {})
    # Group by tag
    tagged = {}
    for path, methods in paths.items():
        for method, details in methods.items():
            if method in ("get", "post", "put", "patch", "delete"):
                tags = details.get("tags", ["Other"])
                tag = tags[0] if tags else "Other"
                if tag not in tagged:
                    tagged[tag] = []
                params = details.get("parameters", [])
                param_strs = []
                for p in params:
                    name = p.get("name", "")
                    loc = p.get("in", "")
                    required = p.get("required", False)
                    schema = p.get("schema", {})
                    ptype = schema.get("type", "")
                    default = schema.get("default")
                    desc_p = p.get("description", "")
                    s = f"  - {name} ({loc}, {ptype}"
                    if required:
                        s += ", required"
                    if default is not None:
                        s += f", default={default}"
                    s += ")"
                    if desc_p:
                        s += f" — {desc_p}"
                    param_strs.append(s)

                entry = f"{method.upper()} {path}"
                summary = details.get("summary", "")
                description = details.get("description", "")
                deprecated = details.get("deprecated", False)
                if deprecated:
                    entry += " [DEPRECATED]"
                lines = [entry]
                if summary:
                    lines.append(f"  Summary: {summary}")
                if description:
                    lines.append(f"  {description.strip()}")
                if param_strs:
                    lines.append("  Parameters:")
                    lines.extend(param_strs)
                tagged[tag].append("\n".join(lines))

    for tag in sorted(tagged.keys()):
        parts.append(f"\n## {tag}")
        parts.extend(tagged[tag])

    endpoint_count = sum(len(v) for v in tagged.values())
    parts.append(f"\n---\nTotal endpoints: {endpoint_count}")
    return "\n\n".join(parts)


async def _try_zendesk_api(url: str) -> tuple:
    """Try Zendesk Help Center API for /hc/ article URLs. Returns (text, title)."""
    # Extract article ID from URL like /hc/en-us/articles/360000776490-Title
    match = re.search(r'/hc/([^/]+)/articles/(\d+)', url)
    if not match:
        return ("", "")
    locale, article_id = match.group(1), match.group(2)
    api_url = re.sub(r'/hc/.*', f'/api/v2/help_center/{locale}/articles/{article_id}.json', url)
    async with httpx.AsyncClient(timeout=20.0) as http:
        resp = await http.get(api_url, headers={"Accept": "application/json"})
        if resp.status_code != 200:
            return ("", "")
        data = resp.json()
        article = data.get("article", {})
        title = article.get("title", "")
        body_html = article.get("body", "")
        if not body_html:
            return ("", title)
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(body_html, "html.parser")
        text = soup.get_text(separator="\n", strip=True)
        return (text, title)
async def _try_cloudscraper(url: str) -> tuple:
    """Try cloudscraper to bypass Cloudflare challenges. Returns (html, text)."""
    import asyncio
    def _scrape():
        import cloudscraper
        scraper = cloudscraper.create_scraper()
        resp = scraper.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    html = await asyncio.get_event_loop().run_in_executor(None, _scrape)
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
        tag.decompose()
    text = soup.get_text(separator="\n", strip=True)
    return (html, text)
@api_router.post("/knowledge/sources/url")
async def scrape_url_source(entry: URLEntry, instance_id: str = Depends(get_instance_access)):
    try:
        auth = None
        if entry.auth_username and entry.auth_password:
            auth = httpx.BasicAuth(entry.auth_username, entry.auth_password)
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        }
        resp = None
        got_403 = False
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, auth=auth) as http:
                    resp = await http.get(entry.url, headers=headers)
                    if resp.status_code == 429:
                        wait = int(resp.headers.get("Retry-After", 5 * (attempt + 1)))
                        logger.warning(f"Rate limited on {entry.url}, waiting {wait}s (attempt {attempt+1}/3)")
                        import asyncio
                        await asyncio.sleep(wait)
                        continue
                    if resp.status_code == 403:
                        got_403 = True
                        break  # don't retry 403s, try fallback strategies instead
                    resp.raise_for_status()
                    break
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429 and attempt < 2:
                    import asyncio
                    await asyncio.sleep(5 * (attempt + 1))
                    continue
                if e.response.status_code == 403:
                    got_403 = True
                    break
                raise
        if resp is None or resp.status_code == 429:
            raise HTTPException(status_code=429, detail="Website is rate limiting requests. Try again in a few minutes.")

        html_text = resp.text if resp and resp.status_code == 200 else ""
        text = ""
        page_title = ""

        # ── Fallback A: Zendesk Help Center API (for /hc/ URLs returning 403) ──
        if (got_403 or not html_text) and "/hc/" in entry.url and "/articles/" in entry.url:
            try:
                text, page_title = await _try_zendesk_api(entry.url)
                if text:
                    logger.info(f"[SCRAPE] Zendesk API extracted {len(text)} chars for {entry.url}")
            except Exception as e:
                logger.warning(f"[SCRAPE] Zendesk API fallback failed: {e}")

        # ── Fallback B: cloudscraper for Cloudflare-protected sites ──
        if (got_403 or not html_text) and not text:
            try:
                html_text, text = await _try_cloudscraper(entry.url)
                if text:
                    logger.info(f"[SCRAPE] cloudscraper extracted {len(text)} chars for {entry.url}")
            except Exception as e:
                logger.warning(f"[SCRAPE] cloudscraper fallback failed: {e}")

        # If still 403 with no content, raise clear error
        if got_403 and not text and not html_text:
            raise HTTPException(status_code=403, detail="This website blocks automated scraping (Cloudflare/bot protection). Try adding the content manually as an FAQ entry instead.")

        # ── Strategy 0: OpenAPI JSON spec detection ──
        if not text and html_text:
            content_type = (resp.headers.get("content-type", "") if resp else "").lower()
            is_json = "application/json" in content_type or entry.url.rstrip("/").endswith(".json")
            if is_json:
                try:
                    import json as _json
                    json_data = _json.loads(html_text)
                    if isinstance(json_data, dict) and ("openapi" in json_data or "swagger" in json_data):
                        text = _parse_openapi_spec(json_data)
                        page_title = json_data.get("info", {}).get("title", "") or "API Spec"
                        logger.info(f"[SCRAPE] Parsed OpenAPI spec: {len(text)} chars for {entry.url}")
                except (ValueError, KeyError) as e:
                    logger.warning(f"[SCRAPE] JSON/OpenAPI parsing failed: {e}")

        # ── Strategy 1: Extract structured data from Next.js __NEXT_DATA__ ──
        if not text and html_text and "__NEXT_DATA__" in html_text:
            try:
                text = _extract_nextjs_content(html_text)
                if text:
                    logger.info(f"[SCRAPE] Extracted {len(text)} chars from __NEXT_DATA__ for {entry.url}")
            except Exception as e:
                logger.warning(f"[SCRAPE] __NEXT_DATA__ extraction failed: {e}")

        # ── Strategy 2: Standard BeautifulSoup extraction ──
        if (not text or len(text) < 200) and html_text:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html_text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
                tag.decompose()
            text = soup.get_text(separator="\n", strip=True)

        text = re.sub(r'\n{3,}', '\n\n', text).strip()
        if not page_title:
            from bs4 import BeautifulSoup as BS2
            soup2 = BS2(html_text or "", "html.parser")
            page_title = entry.title or (soup2.title.string.strip() if soup2.title and soup2.title.string else entry.url)
        else:
            page_title = entry.title or page_title

        # ── Chunk large content into multiple KB entries ──
        CHUNK_SIZE = 8000
        group_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        docs = []
        if len(text) <= CHUNK_SIZE:
            doc = {
                "id": str(uuid.uuid4()), "type": "url", "title": str(page_title)[:150],
                "content": text, "url": entry.url, "instance_id": instance_id,
                "priority": entry.priority or 0, "group_id": group_id, "total_parts": 1,
                "is_active": True, "created_at": now,
            }
            await db.knowledge_sources.insert_one(doc)
            doc.pop("_id", None)
            docs.append(doc)
        else:
            chunks = _split_into_chunks(text, CHUNK_SIZE)
            for idx_c, chunk in enumerate(chunks):
                chunk_title = f"{str(page_title)[:120]} (part {idx_c + 1}/{len(chunks)})"
                doc = {
                    "id": str(uuid.uuid4()), "type": "url", "title": chunk_title,
                    "content": chunk, "url": entry.url, "instance_id": instance_id,
                    "priority": entry.priority or 0, "group_id": group_id, "total_parts": len(chunks),
                    "is_active": True, "created_at": now,
                }
                await db.knowledge_sources.insert_one(doc)
                doc.pop("_id", None)
                docs.append(doc)
            logger.info(f"[SCRAPE] Split {len(text)} chars into {len(chunks)} chunks for {entry.url}")

        return docs[0] if len(docs) == 1 else {"chunks": len(docs), "total_chars": len(text), "sources": docs}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"URL scraping failed: {str(e)}")
@api_router.post("/knowledge/sources/upload")
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    priority: int = Form(0),
    x_instance_id: Optional[str] = Header(None, alias="X-Instance-ID"),
    authorization: Optional[str] = Header(None)
):
    current_user = await get_current_user(authorization)
    instance_id = await _verify_instance_access(x_instance_id, current_user)
    try:
        content_bytes = await file.read()
        filename = file.filename or ""
        text = ""
        if filename.lower().endswith(".txt"):
            text = content_bytes.decode("utf-8", errors="ignore")
        elif filename.lower().endswith(".pdf"):
            try:
                import io
                import PyPDF2
                reader = PyPDF2.PdfReader(io.BytesIO(content_bytes))
                text = "\n".join([page.extract_text() or "" for page in reader.pages])
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"PDF parse error: {str(e)}")
        else:
            raise HTTPException(status_code=400, detail="Only .txt and .pdf files are supported")
        text = re.sub(r'\n{3,}', '\n\n', text).strip()[:50000]
        doc = {
            "id": str(uuid.uuid4()), "type": "document", "title": title or filename,
            "content": text, "filename": filename, "instance_id": instance_id,
            "priority": priority,
            "is_active": True, "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.knowledge_sources.insert_one(doc)
        doc.pop("_id", None)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
class PriorityUpdate(BaseModel):
    priority: int = Field(ge=0, le=2)
@api_router.post("/knowledge/sources/bulk-delete")
async def bulk_delete_sources(body: dict, instance_id: str = Depends(get_instance_access)):
    """Delete multiple sources/groups in one call.
    Accepts { "items": [{"type": "group", "id": "gid"}, {"type": "source", "id": "sid"}, ...] }
    """
    items = body.get("items", [])
    if not items:
        raise HTTPException(status_code=400, detail="No items provided")
    total_deleted = 0
    for item in items:
        item_type = item.get("type", "source")
        item_id = item.get("id", "")
        if not item_id:
            continue
        if item_type == "group":
            r = await db.knowledge_sources.delete_many({"group_id": item_id, "instance_id": instance_id})
            if r.deleted_count == 0:
                r = await db.knowledge_sources.delete_many({"url": item_id, "instance_id": instance_id})
            total_deleted += r.deleted_count
        else:
            r = await db.knowledge_sources.delete_one({"id": item_id, "instance_id": instance_id})
            total_deleted += r.deleted_count
    return {"success": True, "deleted": total_deleted}

@api_router.delete("/knowledge/sources/{source_id}")
async def delete_source(source_id: str, instance_id: str = Depends(get_instance_access)):
    result = await db.knowledge_sources.delete_one({"id": source_id, "instance_id": instance_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Source not found")
    return {"success": True}
@api_router.delete("/knowledge/sources/group/{group_id}")
async def delete_source_group(group_id: str, instance_id: str = Depends(get_instance_access)):
    """Delete all chunks in a group (all parts of a URL scrape)."""
    result = await db.knowledge_sources.delete_many({"group_id": group_id, "instance_id": instance_id})
    if result.deleted_count == 0:
        # Fallback: try matching by URL for legacy ungrouped sources
        result = await db.knowledge_sources.delete_many({"url": group_id, "instance_id": instance_id})
    return {"success": True, "deleted": result.deleted_count}
@api_router.patch("/knowledge/sources/group/{group_id}/category")
async def update_group_category(group_id: str, body: dict, instance_id: str = Depends(get_instance_access)):
    """Update category for all chunks in a group."""
    category = (body.get("category") or "").strip()
    result = await db.knowledge_sources.update_many(
        {"group_id": group_id, "instance_id": instance_id},
        {"$set": {"category": category}}
    )
    if result.matched_count == 0:
        result = await db.knowledge_sources.update_many(
            {"url": group_id, "instance_id": instance_id},
            {"$set": {"category": category}}
        )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"success": True, "category": category}
@api_router.patch("/knowledge/sources/group/{group_id}/toggle")
async def toggle_source_group(group_id: str, instance_id: str = Depends(get_instance_access)):
    """Toggle active state for all chunks in a group."""
    sample = await db.knowledge_sources.find_one(
        {"$or": [{"group_id": group_id}, {"url": group_id}], "instance_id": instance_id}
    )
    if not sample:
        raise HTTPException(status_code=404, detail="Group not found")
    new_status = not sample.get("is_active", True)
    await db.knowledge_sources.update_many(
        {"$or": [{"group_id": group_id}, {"url": group_id}], "instance_id": instance_id},
        {"$set": {"is_active": new_status}}
    )
    return {"is_active": new_status}
@api_router.patch("/knowledge/sources/group/{group_id}/priority")
async def update_group_priority(group_id: str, body: PriorityUpdate, instance_id: str = Depends(get_instance_access)):
    """Update priority for all chunks in a group."""
    result = await db.knowledge_sources.update_many(
        {"$or": [{"group_id": group_id}, {"url": group_id}], "instance_id": instance_id},
        {"$set": {"priority": body.priority}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"success": True, "priority": body.priority}
@api_router.patch("/knowledge/sources/{source_id}/category")
async def update_source_category(source_id: str, body: dict, instance_id: str = Depends(get_instance_access)):
    """Update category for a single source."""
    category = (body.get("category") or "").strip()
    result = await db.knowledge_sources.update_one(
        {"id": source_id, "instance_id": instance_id},
        {"$set": {"category": category}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Source not found")
    return {"success": True, "category": category}
@api_router.patch("/knowledge/sources/{source_id}/toggle")
async def toggle_source(source_id: str, instance_id: str = Depends(get_instance_access)):
    source = await db.knowledge_sources.find_one({"id": source_id, "instance_id": instance_id}, {"_id": 0})
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    new_status = not source.get("is_active", True)
    await db.knowledge_sources.update_one({"id": source_id}, {"$set": {"is_active": new_status}})
    return {"is_active": new_status}
class SourceUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    url: Optional[str] = None
    priority: Optional[int] = None

@api_router.patch("/knowledge/sources/{source_id}/priority")
async def update_source_priority(source_id: str, body: PriorityUpdate, instance_id: str = Depends(get_instance_access)):
    result = await db.knowledge_sources.update_one(
        {"id": source_id, "instance_id": instance_id},
        {"$set": {"priority": body.priority}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Source not found")
    return {"success": True, "priority": body.priority}
@api_router.put("/knowledge/sources/{source_id}")
async def update_source(source_id: str, body: SourceUpdate, instance_id: str = Depends(get_instance_access)):
    source = await db.knowledge_sources.find_one({"id": source_id, "instance_id": instance_id}, {"_id": 0})
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    update = {k: v for k, v in body.dict().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.knowledge_sources.update_one({"id": source_id, "instance_id": instance_id}, {"$set": update})
    updated = await db.knowledge_sources.find_one({"id": source_id}, {"_id": 0})
    return updated
@api_router.get("/knowledge/categories")
async def get_knowledge_categories(instance_id: str = Depends(get_instance_access)):
    """Return all unique categories used by knowledge sources in this instance."""
    cats = await db.knowledge_sources.distinct("category", {"instance_id": instance_id})
    return [c for c in cats if c and isinstance(c, str) and c.strip()]
# ==================== CONVERSATIONS (PROTECTED) ====================

@api_router.get("/conversations")
async def get_conversations(
    platform: Optional[str] = None, approved: Optional[bool] = None,
    page: int = 1, limit: int = 20,
    instance_id: str = Depends(get_instance_access)
):
    query = {"instance_id": instance_id}
    if platform:
        query["platform"] = platform
    if approved is not None:
        query["is_approved_for_training"] = approved
    skip = (page - 1) * limit
    total = await db.conversations.count_documents(query)
    convs = await db.conversations.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"conversations": convs, "total": total, "page": page, "limit": limit}
@api_router.get("/conversations/{session_id}")
async def get_conversation(session_id: str, instance_id: str = Depends(get_instance_access)):
    conv = await db.conversations.find_one({"session_id": session_id, "instance_id": instance_id}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Not found")
    return conv
@api_router.patch("/conversations/{session_id}/approve")
async def approve_conversation(session_id: str, body: ApproveBody,
                                instance_id: str = Depends(get_instance_access)):
    result = await db.conversations.update_one(
        {"session_id": session_id, "instance_id": instance_id},
        {"$set": {"is_approved_for_training": body.approved}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"success": True, "is_approved_for_training": body.approved}
@api_router.delete("/conversations/{session_id}")
async def delete_conversation(session_id: str, instance_id: str = Depends(get_instance_access)):
    llm_sessions.pop(session_id, None)
    result = await db.conversations.delete_one({"session_id": session_id, "instance_id": instance_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"success": True}
# ==================== ANALYTICS (PROTECTED) ====================

@api_router.get("/analytics/overview")
async def analytics_overview(instance_id: str = Depends(get_instance_access)):
    q = {"instance_id": instance_id}
    total_convs = await db.conversations.count_documents(q)
    approved_training = await db.conversations.count_documents({**q, "is_approved_for_training": True})
    knowledge_count = await db.knowledge_sources.count_documents({"is_active": True, "instance_id": instance_id})
    pipeline = [
        {"$match": q},
        {"$project": {"msg_count": {"$size": {"$ifNull": ["$messages", []]}}}},
        {"$group": {"_id": None, "total": {"$sum": "$msg_count"}}}
    ]
    msg_result = await db.conversations.aggregate(pipeline).to_list(1)
    total_messages = msg_result[0]["total"] if msg_result else 0
    web_count = await db.conversations.count_documents({**q, "platform": "web"})
    discord_count = await db.conversations.count_documents({**q, "platform": "discord"})
    return {
        "total_conversations": total_convs, "total_messages": total_messages,
        "approved_for_training": approved_training, "knowledge_sources": knowledge_count,
        "platform_breakdown": {"web": web_count, "discord": discord_count}
    }
@api_router.get("/analytics/daily")
async def analytics_daily(instance_id: str = Depends(get_instance_access)):
    now = datetime.now(timezone.utc)
    days = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        base_q = {
            "instance_id": instance_id,
            "created_at": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()}
        }
        count = await db.conversations.count_documents(base_q)
        pipeline = [
            {"$match": base_q},
            {"$project": {"msg_count": {"$size": {"$ifNull": ["$messages", []]}}}},
            {"$group": {"_id": None, "total": {"$sum": "$msg_count"}}}
        ]
        msg_res = await db.conversations.aggregate(pipeline).to_list(1)
        msg_count = msg_res[0]["total"] if msg_res else 0
        days.append({"date": day_start.strftime("%m/%d"), "conversations": count, "messages": msg_count})
    return days
@api_router.get("/analytics/llm-usage")
async def analytics_llm_usage(instance_id: str = Depends(get_instance_access)):
    """API usage, retry attempts, fallbacks and error breakdown for the selected instance."""
    q = {"instance_id": instance_id}
    now = datetime.now(timezone.utc)

    total = await db.llm_usage.count_documents(q)
    successful = await db.llm_usage.count_documents({**q, "success": True})
    failed = await db.llm_usage.count_documents({**q, "success": False})
    fallbacks = await db.llm_usage.count_documents({**q, "used_fallback": True})

    # Sum retry_count across all docs
    pipeline_retries = [
        {"$match": q},
        {"$group": {"_id": None, "total_retries": {"$sum": "$retry_count"}}}
    ]
    retry_res = await db.llm_usage.aggregate(pipeline_retries).to_list(1)
    total_retries = retry_res[0]["total_retries"] if retry_res else 0

    # Error type breakdown
    pipeline_errors = [
        {"$match": {**q, "success": False, "error_type": {"$ne": None}}},
        {"$group": {"_id": "$error_type", "count": {"$sum": 1}}}
    ]
    error_docs = await db.llm_usage.aggregate(pipeline_errors).to_list(20)
    error_breakdown = {d["_id"]: d["count"] for d in error_docs}

    # Daily breakdown — last 7 days
    daily = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        day_q = {**q, "timestamp": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()}}
        calls = await db.llm_usage.count_documents(day_q)
        errors = await db.llm_usage.count_documents({**day_q, "success": False})
        retries_pipeline = [
            {"$match": day_q},
            {"$group": {"_id": None, "total": {"$sum": "$retry_count"}}}
        ]
        r = await db.llm_usage.aggregate(retries_pipeline).to_list(1)
        daily.append({
            "date": day_start.strftime("%m/%d"),
            "calls": calls,
            "errors": errors,
            "retries": r[0]["total"] if r else 0,
        })

    return {
        "total_calls": total,
        "successful_calls": successful,
        "failed_calls": failed,
        "retry_attempts": total_retries,
        "fallback_used": fallbacks,
        "success_rate": round((successful / total * 100), 1) if total else 100.0,
        "error_breakdown": error_breakdown,
        "daily": daily,
    }
@api_router.get("/analytics/llm-cost")
async def analytics_llm_cost(instance_id: str = Depends(get_instance_access)):
    """Per-instance LLM cost dashboard.
    Returns:
      - month_to_date: total cost (USD), total tokens, calls
      - by_model: list of {model, calls, input_tokens, output_tokens, cost_usd}
      - daily: 30-day sparkline of cost
      - forecast_month_end: projected total based on current daily run-rate
    """
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    q_month = {
        "instance_id": instance_id,
        "success": True,
        "timestamp": {"$gte": month_start.isoformat()},
    }

    # Per-model breakdown (month to date)
    pipeline = [
        {"$match": q_month},
        {"$group": {
            "_id": "$model_used",
            "calls": {"$sum": 1},
            "input_tokens": {"$sum": {"$ifNull": ["$input_tokens", 0]}},
            "output_tokens": {"$sum": {"$ifNull": ["$output_tokens", 0]}},
        }},
        {"$sort": {"calls": -1}},
    ]
    by_model_raw = await db.llm_usage.aggregate(pipeline).to_list(50)
    by_model = []
    total_cost = 0.0
    total_in = 0
    total_out = 0
    total_calls = 0
    for row in by_model_raw:
        model = row["_id"] or "unknown"
        in_tok = int(row.get("input_tokens") or 0)
        out_tok = int(row.get("output_tokens") or 0)
        calls = int(row.get("calls") or 0)
        cost = _cost_for(model, in_tok, out_tok)
        provider = model.split(":", 1)[0] if ":" in model else "emergent"
        by_model.append({
            "model": model, "provider": provider,
            "calls": calls,
            "input_tokens": in_tok, "output_tokens": out_tok,
            "cost_usd": cost,
        })
        total_cost += cost
        total_in += in_tok
        total_out += out_tok
        total_calls += calls

    # Daily sparkline — last 30 days
    daily = []
    series_total_30d = 0.0
    for i in range(29, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        day_q = {
            "instance_id": instance_id,
            "success": True,
            "timestamp": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()},
        }
        day_pipeline = [
            {"$match": day_q},
            {"$group": {
                "_id": "$model_used",
                "input_tokens": {"$sum": {"$ifNull": ["$input_tokens", 0]}},
                "output_tokens": {"$sum": {"$ifNull": ["$output_tokens", 0]}},
            }},
        ]
        day_rows = await db.llm_usage.aggregate(day_pipeline).to_list(50)
        day_cost = sum(_cost_for(r["_id"] or "", int(r.get("input_tokens") or 0), int(r.get("output_tokens") or 0)) for r in day_rows)
        series_total_30d += day_cost
        daily.append({
            "date": day_start.strftime("%m/%d"),
            "cost_usd": round(day_cost, 4),
        })

    # Month-end forecast based on month-to-date run rate
    day_of_month = now.day
    days_in_month = (month_start.replace(month=month_start.month % 12 + 1, day=1) - timedelta(days=1)).day if month_start.month < 12 else 31
    forecast = round((total_cost / day_of_month) * days_in_month, 2) if day_of_month > 0 else 0.0

    return {
        "month_to_date": {
            "cost_usd": round(total_cost, 4),
            "input_tokens": total_in,
            "output_tokens": total_out,
            "calls": total_calls,
            "day_of_month": day_of_month,
            "days_in_month": days_in_month,
        },
        "by_model": by_model,
        "daily": daily,
        "forecast_month_end_usd": forecast,
        "last_30d_cost_usd": round(series_total_30d, 4),
    }
@api_router.get("/analytics/passive-skips")
async def analytics_passive_skips(instance_id: str = Depends(get_instance_access)):
    """Stats for Passive Mode — how many Discord messages the bot intentionally stayed silent on."""
    q = {"instance_id": instance_id}
    now = datetime.now(timezone.utc)
    total = await db.passive_skips.count_documents(q)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today = await db.passive_skips.count_documents({**q, "timestamp": {"$gte": today_start.isoformat()}})
    week_start = today_start - timedelta(days=6)
    week = await db.passive_skips.count_documents({**q, "timestamp": {"$gte": week_start.isoformat()}})
    recent = await db.passive_skips.find(q, {"_id": 0}).sort("timestamp", -1).limit(10).to_list(length=10)
    return {"total": total, "today": today, "last_7_days": week, "recent": recent}
# ==================== DISCORD (PROTECTED) ====================
@api_router.get("/discord/app-config")
async def get_discord_app_config(current_user: dict = Depends(require_admin)):
    """Get Discord app credentials (admin only). Secrets are masked."""
    creds = await get_discord_credentials()
    raw = await db.discord_app_config.find_one({"_id": "discord_app"}) or {}
    return {
        "client_id": creds["client_id"],
        "client_secret": ("***" + creds["client_secret"][-4:]) if len(creds.get("client_secret", "")) > 4 else ("***" if creds.get("client_secret") else ""),
        "redirect_uri": creds["redirect_uri"],
        "bot_token": ("***" + creds["bot_token"][-4:]) if len(creds.get("bot_token", "")) > 4 else ("***" if creds.get("bot_token") else ""),
        "has_client_id": bool(creds["client_id"]),
        "has_client_secret": bool(creds["client_secret"]),
        "has_redirect_uri": bool(creds["redirect_uri"]),
        "has_bot_token": bool(creds["bot_token"]),
        "updated_at": raw.get("updated_at"),
    }
class DiscordAppConfigUpdate(BaseModel):
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    redirect_uri: Optional[str] = None
    bot_token: Optional[str] = None

@api_router.put("/discord/app-config")
async def update_discord_app_config(body: DiscordAppConfigUpdate, current_user: dict = Depends(require_admin)):
    """Update Discord app credentials (admin only). Stored in DB."""
    update = {k: v.strip() for k, v in body.dict().items() if v is not None and v.strip()}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.discord_app_config.update_one(
        {"_id": "discord_app"}, {"$set": update}, upsert=True
    )
    return {"success": True, "message": "Discord credentials updated"}
@api_router.get("/discord/app-config/connections")
async def list_discord_connections(current_user: dict = Depends(require_admin)):
    """List every instance currently mapped to a Discord guild. Used by Discord App Setup to
    preview the impact of clearing app credentials."""
    rows = await db.discord_config.find({"guild_id": {"$exists": True, "$ne": ""}}).to_list(length=None)
    out = []
    for r in rows:
        inst = await db.bot_instances.find_one({"id": r.get("instance_id")})
        out.append({
            "instance_id": r.get("instance_id"),
            "instance_name": (inst or {}).get("name") or "(deleted instance)",
            "guild_id": r.get("guild_id"),
            "guild_name": r.get("guild_name") or "",
        })
    return {"connections": out, "count": len(out)}
@api_router.delete("/discord/app-config")
async def clear_discord_app_config(
    clear_connections: bool = False,
    current_user: dict = Depends(require_admin),
):
    """Clear the Discord App credentials (admin only).
    If clear_connections=true, also wipe every instance ↔ guild mapping in discord_config."""
    await db.discord_app_config.delete_one({"_id": "discord_app"})
    connections_cleared = 0
    if clear_connections:
        result = await db.discord_config.update_many(
            {"guild_id": {"$exists": True, "$ne": ""}},
            {"$unset": {"guild_id": "", "guild_name": ""}},
        )
        connections_cleared = result.modified_count
    # Stop the running shared bot so the new token (when configured) takes effect cleanly.
    global _shared_discord_task
    try:
        if _shared_discord_task and not _shared_discord_task.done():
            _shared_discord_task.cancel()
    except Exception:
        pass
    _shared_discord_task = None
    return {
        "success": True,
        "message": "Discord app credentials cleared",
        "connections_cleared": connections_cleared,
    }
@api_router.get("/discord/oauth-url")
async def get_discord_oauth_url(instance_id: str = Depends(get_instance_access)):
    """Generate Discord OAuth2 URL to invite the bot to a server."""
    creds = await get_discord_credentials()
    if not creds["client_id"]:
        raise HTTPException(status_code=400, detail="Discord Client ID not configured")
    if not creds["redirect_uri"]:
        raise HTTPException(status_code=400, detail="Discord Redirect URI not configured")
    from urllib.parse import urlencode
    params = {
        "client_id": creds["client_id"],
        "permissions": str(DISCORD_BOT_PERMISSIONS),
        "scope": "bot",
        "redirect_uri": creds["redirect_uri"],
        "response_type": "code",
        "state": instance_id,
    }
    url = f"https://discord.com/oauth2/authorize?{urlencode(params)}"
    return {"url": url}
@api_router.get("/discord/share-oauth-url")
async def get_discord_share_oauth_url(instance_id: str = Depends(get_instance_access)):
    """Generate a shareable Discord OAuth2 URL for a third-party admin to invite the bot
    to their server. The bot becomes assigned to the inviting admin's instance, but the
    third-party user lands on a public friendly success page instead of the admin login wall."""
    creds = await get_discord_credentials()
    if not creds["client_id"]:
        raise HTTPException(status_code=400, detail="Discord Client ID not configured")
    if not creds["redirect_uri"]:
        raise HTTPException(status_code=400, detail="Discord Redirect URI not configured")
    from urllib.parse import urlencode
    params = {
        "client_id": creds["client_id"],
        "permissions": str(DISCORD_BOT_PERMISSIONS),
        "scope": "bot",
        "redirect_uri": creds["redirect_uri"],
        "response_type": "code",
        "state": f"share:{instance_id}",
    }
    url = f"https://discord.com/oauth2/authorize?{urlencode(params)}"
    return {"url": url}
class SendInviteEmailBody(BaseModel):
    to_email: str
    recipient_name: Optional[str] = None
    invite_url: str
    custom_note: Optional[str] = None
@api_router.post("/discord/send-invite-email")
async def send_discord_invite_email(body: SendInviteEmailBody, instance_id: str = Depends(get_instance_access)):
    """Send a Discord bot invite link to a third-party server admin via Resend."""
    if not resend.api_key:
        raise HTTPException(status_code=503, detail="Email service not configured (Resend API key missing)")
    if not body.to_email or "@" not in body.to_email:
        raise HTTPException(status_code=400, detail="Valid recipient email is required")
    if not body.invite_url:
        raise HTTPException(status_code=400, detail="Invite URL is required")
    inst = await db.bot_instances.find_one({"id": instance_id}, {"_id": 0}) or {}
    bot_cfg = await db.bot_config.find_one({"instance_id": instance_id}, {"_id": 0}) or {}
    bot_name = bot_cfg.get("name") or inst.get("name") or "BridgeBot"
    recipient = (body.recipient_name or "there").strip()
    note_html = ""
    if body.custom_note and body.custom_note.strip():
        safe_note = body.custom_note.strip().replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>")
        note_html = f'<div style="margin:16px 0;padding:14px 16px;background:#F3F4F6;border-left:3px solid #3B82F6;border-radius:6px;color:#334155;"><em>"{safe_note}"</em></div>'
    html = f"""<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F8FAFC;margin:0;padding:24px;color:#0F172A;">
<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;padding:32px;">
<h1 style="margin:0 0 8px;font-size:22px;color:#0F172A;">You{"'"}re invited to add {bot_name} to your Discord server</h1>
<p style="margin:0 0 20px;color:#475569;line-height:1.6;">Hi {recipient}, the BridgeBot admin has invited you to install our Discord bot on a server you manage.</p>
{note_html}
<a href="{body.invite_url}" style="display:inline-block;padding:14px 28px;background:#5865F2;color:#FFFFFF;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">Invite Bot to Your Server</a>
<p style="margin:24px 0 8px;color:#64748B;font-size:12px;line-height:1.6;">You{"'"}ll need <strong>Manage Server</strong> permission on the Discord server you want to add the bot to. After clicking the button, Discord will ask you to authorize the bot. No BridgeBot account needed — the admin will configure the bot{"'"}s knowledge base and behavior on their end.</p>
<p style="margin:16px 0 0;color:#94A3B8;font-size:11px;">If the button doesn{"'"}t work, copy this link into your browser:<br><code style="word-break:break-all;color:#475569;">{body.invite_url}</code></p>
<div style="margin-top:28px;padding-top:16px;border-top:1px solid #E2E8F0;color:#94A3B8;font-size:11px;">Sent via BridgeBot · This invite was prepared by your contact.</div>
</div></body></html>"""
    try:
        result = resend.Emails.send({
            "from": "BridgeBot <noreply@bridgebot.tech>",
            "to": [body.to_email.strip()],
            "subject": f"Invite {bot_name} to your Discord server",
            "html": html,
        })
        logger.info(f"Discord invite email sent to {body.to_email} for instance {instance_id[:12]}")
        return {"success": True, "message_id": result.get("id") if isinstance(result, dict) else None}
    except Exception as e:
        logger.error(f"Resend send failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {type(e).__name__}")
@api_router.get("/discord/callback")
async def discord_oauth_callback(
    request: Request,
    code: str = None,
    guild_id: str = None,
    state: str = None,
    error: str = None,
    error_description: str = None,
):
    """Handle Discord OAuth2 callback after bot is invited to a server."""
    creds = await get_discord_credentials()
    redirect_uri = creds["redirect_uri"]
    frontend_base = redirect_uri.replace("/api/discord/callback", "") if redirect_uri else ""

    if error:
        logger.warning(f"Discord OAuth error: {error} - {error_description}")
        return RedirectResponse(url=f"{frontend_base}/admin/discord?oauth=error&reason={error}")

    if not code:
        return RedirectResponse(url=f"{frontend_base}/admin/discord?oauth=error&reason=no_code")

    instance_id = state or "default"
    is_share = True  # Treat ALL invite callbacks as share-style so the user always lands on the
                     # public success page — never the login wall. Admins can still open /admin/discord
                     # afterwards from their own session.
    if instance_id.startswith("share:"):
        instance_id = instance_id[len("share:"):]

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://discord.com/api/oauth2/token",
                data={
                    "client_id": creds["client_id"],
                    "client_secret": creds["client_secret"],
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            if resp.status_code != 200:
                logger.error(f"Discord token exchange failed: {resp.status_code} {resp.text} | redirect_uri={redirect_uri} | client_id={creds['client_id'][:8]}...")
                return RedirectResponse(url=f"{frontend_base}/admin/discord?oauth=error&reason=token_exchange_failed")

            data = resp.json()
            guild = data.get("guild", {})
            bot_info = data.get("bot", {})

            update_fields = {
                "oauth_connected": True,
                "guild_id": guild.get("id", guild_id or ""),
                "guild_name": guild.get("name", ""),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "instance_id": instance_id,
                "is_active": True,
            }

            # If the token exchange returned a bot token, save it
            if bot_info.get("token"):
                update_fields["bot_token"] = bot_info["token"]

            await db.discord_config.update_one(
                {"instance_id": instance_id},
                {"$set": update_fields},
                upsert=True,
            )

            logger.info(f"Discord OAuth success: bot invited to guild {guild.get('name', 'unknown')}")

            # Auto-start/restart the shared bot and update guild mapping
            config = await db.discord_config.find_one({"instance_id": instance_id}, {"_id": 0})
            app_creds = await get_discord_credentials()
            bot_token = (config or {}).get("bot_token") or app_creds["bot_token"]
            if bot_token:
                guild_instance_map[guild.get("id", "")] = instance_id
                global _shared_discord_client, _shared_discord_task
                if _shared_discord_client:
                    try:
                        await _shared_discord_client.close()
                    except Exception:
                        pass
                if _shared_discord_task:
                    _shared_discord_task.cancel()
                _shared_discord_task = asyncio.create_task(start_shared_discord_bot(bot_token))

            bot_name = (await db.bot_config.find_one({'instance_id': instance_id}, {'_id': 0}) or {}).get('name', 'BridgeBot')
            return RedirectResponse(
                url=f"{frontend_base}/discord/invited?guild={guild.get('name', '')}&bot={bot_name}"
            )

    except Exception as e:
        logger.error(f"Discord OAuth callback error: {e}")
        return RedirectResponse(url=f"{frontend_base}/discord/invited?error=1")
@api_router.post("/discord/disconnect")
async def disconnect_discord_guild(instance_id: str = Depends(get_instance_access)):
    """Clear the guild mapping for this instance. Idempotent — never 404s even if
    no connection exists. Use when the bot was removed from a Discord server
    externally (e.g., via Discord's Integrations page) and the UI still shows
    the stale connection."""
    config = await db.discord_config.find_one({"instance_id": instance_id}, {"_id": 0}) or {}
    guild_id = config.get("guild_id")
    await db.discord_config.update_one(
        {"instance_id": instance_id},
        {"$unset": {"guild_id": "", "guild_name": ""}},
        upsert=True,
    )
    if guild_id and guild_id in guild_instance_map:
        del guild_instance_map[guild_id]
    return {"success": True, "cleared_guild_id": guild_id}
@api_router.post("/discord/purge-all-connections")
async def purge_all_discord_connections(current_user: dict = Depends(require_admin)):
    """ADMIN-ONLY: Wipe every guild mapping across every instance. Useful after
    revoking/rotating a Discord App, removing the bot from many servers at once,
    or cleaning up after testing. Does NOT touch knowledge bases, users, or other
    bot settings — only the `guild_id` / `guild_name` fields on `discord_config`."""
    result = await db.discord_config.update_many(
        {"guild_id": {"$exists": True, "$ne": ""}},
        {"$unset": {"guild_id": "", "guild_name": ""}},
    )
    # Flush the entire in-memory routing map
    guild_instance_map.clear()
    return {
        "success": True,
        "connections_cleared": result.modified_count,
    }
@api_router.post("/discord/sync-name")
async def sync_discord_name(instance_id: str = Depends(get_instance_access)):
    """Push the bot_config name to Discord as the bot's nickname in connected guilds."""
    import aiohttp
    config = await db.discord_config.find_one({"instance_id": instance_id}, {"_id": 0})
    app_creds = await get_discord_credentials()
    token = (config or {}).get("bot_token") or app_creds["bot_token"]
    if not token:
        raise HTTPException(status_code=400, detail="Bot token not configured")
    bot_config = await db.bot_config.find_one({"instance_id": instance_id}, {"_id": 0})
    name = (bot_config or {}).get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Bot name not set. Configure it in Bot Settings first.")
    headers = {"Authorization": f"Bot {token}"}
    results = []
    async with aiohttp.ClientSession() as session:
        # Set nickname in the connected guild for this instance only
        guild_id = (config or {}).get("guild_id")
        if guild_id:
            async with session.patch(
                f"https://discord.com/api/v10/guilds/{guild_id}/members/@me",
                headers=headers,
                json={"nick": name}
            ) as resp:
                if resp.status == 200:
                    results.append(f"Server nickname set to '{name}'")
                    logger.info(f"Discord guild nickname updated to '{name}' in guild {guild_id}")
                else:
                    body = await resp.json()
                    err = body.get("message", "unknown error")
                    logger.warning(f"Guild nickname update failed ({resp.status}): {err}")
                    if resp.status == 403:
                        results.append("Missing 'Change Nickname' permission in server — re-invite the bot to fix this")
                    else:
                        results.append(f"Guild nickname failed: {err}")
        else:
            results.append("No guild connected for this instance. Invite the bot to a server first.")

    if not results:
        raise HTTPException(status_code=400, detail="No guilds found to update nickname")
    return {"success": True, "message": " | ".join(results)}
@api_router.get("/discord/channels")
async def get_discord_channels(instance_id: str = Depends(get_instance_access)):
    """Fetch text channels from this instance's connected guild only."""
    import aiohttp
    config = await db.discord_config.find_one({"instance_id": instance_id}, {"_id": 0})
    app_creds = await get_discord_credentials()
    token = (config or {}).get("bot_token") or app_creds["bot_token"]
    if not token:
        raise HTTPException(status_code=400, detail="Bot token not configured. Save your token first.")
    guild_id = (config or {}).get("guild_id")
    if not guild_id:
        raise HTTPException(status_code=400, detail="No Discord server connected to this instance. Invite the bot first.")
    headers = {"Authorization": f"Bot {token}"}
    all_channels = []
    try:
        async with aiohttp.ClientSession() as session:
            # Fetch guild name
            guild_name = (config or {}).get("guild_name", "Server")
            async with session.get(
                f"https://discord.com/api/v10/guilds/{guild_id}/channels", headers=headers
            ) as resp:
                if resp.status == 401:
                    raise HTTPException(status_code=400, detail="Invalid bot token")
                if resp.status != 200:
                    raise HTTPException(status_code=400, detail="Failed to fetch channels from Discord")
                channels = await resp.json()
                for c in channels:
                    if c.get("type") == 0:  # GUILD_TEXT only
                        all_channels.append({
                            "id": str(c["id"]),
                            "name": c["name"],
                            "guild_id": guild_id,
                            "guild_name": guild_name,
                        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Discord channel fetch error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch channels from Discord")
    return all_channels
@api_router.get("/discord/config")
async def get_discord_config(instance_id: str = Depends(get_instance_access)):
    config = await db.discord_config.find_one({"instance_id": instance_id}, {"_id": 0})
    app_creds = await get_discord_credentials()
    if config:
        token = config.get("bot_token", "")
        has_token = bool(token or app_creds["bot_token"])
        if token:
            config["bot_token_display"] = token[:8] + "..." + token[-4:] if len(token) > 12 else "***"
        elif app_creds["bot_token"]:
            config["bot_token_display"] = "Configured via app settings"
        config["has_bot_token"] = has_token
        config.pop("bot_token", None)
        config.pop("oauth_access_token", None)
    else:
        config = {"is_active": False, "has_bot_token": bool(app_creds["bot_token"]), "oauth_connected": False}
    config["oauth_enabled"] = bool(app_creds["client_id"])
    # Auto-seed acknowledgment_replies with defaults so admins see them pre-populated
    sm = config.get("scripted_mode") or {}
    if isinstance(sm, dict):
        acks = sm.get("acknowledgment_replies")
        if not isinstance(acks, list) or not any(isinstance(x, str) and x.strip() for x in acks):
            sm["acknowledgment_replies"] = list(DEFAULT_ACK_REPLIES)
            config["scripted_mode"] = sm
    return config
@api_router.put("/discord/config")
async def update_discord_config(body: DiscordConfigUpdate, instance_id: str = Depends(get_instance_access)):
    update = {k: v for k, v in body.dict().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    update["instance_id"] = instance_id
    await db.discord_config.update_one({"instance_id": instance_id}, {"$set": update}, upsert=True)
    return {"success": True}
@api_router.get("/discord/scripted-counters/count")
async def get_scripted_counters_count(instance_id: str = Depends(get_instance_access)):
    """Return how many users currently have an active Scripted Mode conversation.
    `active_counters` filters by `last_at` within the cooldown window (uses instance's
    configured `reset_hours`, defaulting to 24). `total_counters` is the raw row count
    (includes stale rows that will reset on the user's next message)."""
    cfg = await db.discord_config.find_one({"instance_id": instance_id}) or {}
    scripted_cfg = cfg.get("scripted_mode") or {}
    reset_hours = int(scripted_cfg.get("reset_hours") or 24)
    cutoff_iso = (datetime.now(timezone.utc) - timedelta(hours=reset_hours)).isoformat()
    total = await db.scripted_counters.count_documents({"instance_id": instance_id})
    active = await db.scripted_counters.count_documents({
        "instance_id": instance_id,
        "last_at": {"$gte": cutoff_iso},
    })
    skips_24h = 0
    try:
        cutoff_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        skips_24h = await db.scripted_skips.count_documents({
            "instance_id": instance_id,
            "timestamp": {"$gte": cutoff_24h},
        })
    except Exception:
        pass
    return {
        "active_counters": active,
        "total_counters": total,
        "stale_counters": max(0, total - active),
        "skips_last_24h": skips_24h,
        "reset_hours": reset_hours,
    }
async def _run_sandbox_simulation(scripted_cfg: dict, messages: List[str], instance_id: str) -> List[dict]:
    """Run a sequence of user messages through the Scripted Mode decision helper
    in pure simulation mode (NO writes to scripted_counters). Returns the turn list
    that both the /sandbox endpoint and scenario runner consume."""
    session_id = f"sandbox_{instance_id}_{datetime.now(timezone.utc).timestamp()}"
    count = 0
    used_replies: List[str] = []
    turns = []
    for msg in messages:
        if not isinstance(msg, str) or not msg.strip():
            continue
        decision = await _decide_scripted_reply(scripted_cfg, count, list(used_replies), msg.strip(), session_id, instance_id)
        turn = {
            "user_message": msg.strip(),
            "intent": decision.get("intent"),
            "pool_name": decision.get("pool_name"),
            "pool_considered": decision.get("pool_considered", []),
            "bot_reply": decision.get("reply", ""),
            "skip_reason": decision.get("skip_reason"),
        }
        if decision.get("reply"):
            count += 1
            if decision.get("pool_name") != "ack":
                used_replies.append(decision["reply"])
        turn["count_after"] = count
        turn["used_replies_after"] = list(used_replies)
        turns.append(turn)
    return turns
def _compare_against_golden(turns: List[dict], golden_turns: List[dict]) -> List[dict]:
    """Compare actual turns to golden turns. Returns a list of failure dicts.
    Match on (pool_name, intent) — the specific variant string is non-deterministic
    when AI picks from a pool, so we don't compare bot_reply text."""
    failures = []
    if len(turns) != len(golden_turns):
        failures.append({
            "turn_index": -1, "field": "turn_count",
            "expected": len(golden_turns), "actual": len(turns),
        })
        return failures
    for i, (actual, golden) in enumerate(zip(turns, golden_turns)):
        if actual.get("pool_name") != golden.get("pool_name"):
            failures.append({
                "turn_index": i, "field": "pool_name",
                "expected": golden.get("pool_name"), "actual": actual.get("pool_name"),
            })
        # Intent comparison: only enforce if the golden recorded one (skip None)
        if golden.get("intent") is not None and actual.get("intent") != golden.get("intent"):
            failures.append({
                "turn_index": i, "field": "intent",
                "expected": golden.get("intent"), "actual": actual.get("intent"),
            })
    return failures
@api_router.post("/discord/scripted-mode/sandbox")
async def scripted_mode_sandbox(body: dict, instance_id: str = Depends(get_instance_access)):
    """Dry-run a sequence of user messages through Scripted Mode and see what the bot
    would reply at each step. Does NOT touch `scripted_counters` — purely simulated.

    Body:
      {
        "messages": ["is the bridge down?", "any update?", "thanks!"],
        "scripted_config": {...}   # optional — overrides saved config for testing unsaved edits
      }
    """
    messages = body.get("messages") or []
    if not isinstance(messages, list) or len(messages) == 0:
        raise HTTPException(status_code=400, detail="`messages` must be a non-empty list")
    if len(messages) > 25:
        raise HTTPException(status_code=400, detail="Sandbox is capped at 25 messages per run")
    override = body.get("scripted_config")
    if isinstance(override, dict):
        scripted_cfg = override
    else:
        cfg = await db.discord_config.find_one({"instance_id": instance_id}) or {}
        scripted_cfg = cfg.get("scripted_mode") or {}
    turns = await _run_sandbox_simulation(scripted_cfg, messages, instance_id)
    return {"turns": turns}
# ── Saved Scenarios — regression tests for Scripted Mode copy ──────────────────────

class ScenarioCreate(BaseModel):
    name: str
    messages: List[str]
    description: Optional[str] = None
@api_router.get("/discord/scripted-mode/scenarios")
async def list_scenarios(instance_id: str = Depends(get_instance_access)):
    """List all saved Scripted Mode scenarios for this instance."""
    rows = await db.scripted_scenarios.find(
        {"instance_id": instance_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    return {"scenarios": rows}
@api_router.post("/discord/scripted-mode/scenarios")
async def create_scenario(body: ScenarioCreate, instance_id: str = Depends(get_instance_access)):
    """Create a new saved scenario. `golden_turns` is captured on the FIRST `/run`."""
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="`name` is required")
    msgs = [m.strip() for m in (body.messages or []) if isinstance(m, str) and m.strip()]
    if not msgs:
        raise HTTPException(status_code=400, detail="`messages` must have at least one non-empty entry")
    if len(msgs) > 25:
        raise HTTPException(status_code=400, detail="Scenarios are capped at 25 messages")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "instance_id": instance_id,
        "name": name,
        "description": (body.description or "").strip() or None,
        "messages": msgs,
        "golden_turns": None,
        "last_run": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.scripted_scenarios.insert_one(dict(doc))
    return doc
@api_router.delete("/discord/scripted-mode/scenarios/{scenario_id}")
async def delete_scenario(scenario_id: str, instance_id: str = Depends(get_instance_access)):
    """Delete a saved scenario."""
    result = await db.scripted_scenarios.delete_one({"id": scenario_id, "instance_id": instance_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return {"success": True}
async def _run_scenario_doc(scenario: dict, scripted_cfg: dict, instance_id: str) -> dict:
    """Run one scenario's messages, compare to its golden_turns, persist last_run.
    Returns the full run result."""
    turns = await _run_sandbox_simulation(scripted_cfg, scenario.get("messages") or [], instance_id)
    golden = scenario.get("golden_turns")
    now = datetime.now(timezone.utc).isoformat()
    if not golden:
        # First run — auto-capture as golden (admin can re-save later via /save-golden)
        await db.scripted_scenarios.update_one(
            {"id": scenario["id"]},
            {"$set": {
                "golden_turns": [{"pool_name": t["pool_name"], "intent": t.get("intent"), "bot_reply": t.get("bot_reply", "")} for t in turns],
                "last_run": {"status": "captured_golden", "ran_at": now, "turns": turns, "failures": []},
                "updated_at": now,
            }}
        )
        return {"status": "captured_golden", "ran_at": now, "turns": turns, "failures": []}

    failures = _compare_against_golden(turns, golden)
    status = "pass" if not failures else "fail"
    last_run = {"status": status, "ran_at": now, "turns": turns, "failures": failures}
    await db.scripted_scenarios.update_one(
        {"id": scenario["id"]},
        {"$set": {"last_run": last_run, "updated_at": now}}
    )
    return last_run
async def _load_scripted_cfg(instance_id: str, override: Optional[dict] = None) -> dict:
    if isinstance(override, dict):
        return override
    cfg = await db.discord_config.find_one({"instance_id": instance_id}) or {}
    return cfg.get("scripted_mode") or {}
@api_router.post("/discord/scripted-mode/scenarios/{scenario_id}/run")
async def run_scenario(scenario_id: str, body: Optional[dict] = None, instance_id: str = Depends(get_instance_access)):
    """Run one scenario. Body may include `scripted_config` to test unsaved form values."""
    scenario = await db.scripted_scenarios.find_one({"id": scenario_id, "instance_id": instance_id}, {"_id": 0})
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    scripted_cfg = await _load_scripted_cfg(instance_id, (body or {}).get("scripted_config"))
    result = await _run_scenario_doc(scenario, scripted_cfg, instance_id)
    return result
@api_router.post("/discord/scripted-mode/scenarios/{scenario_id}/save-golden")
async def save_scenario_golden(scenario_id: str, instance_id: str = Depends(get_instance_access)):
    """Promote the most recent `last_run` to be the new golden baseline.
    Use after intentional Variant/Ack copy changes."""
    scenario = await db.scripted_scenarios.find_one({"id": scenario_id, "instance_id": instance_id}, {"_id": 0})
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    last_run = scenario.get("last_run")
    if not last_run or not last_run.get("turns"):
        raise HTTPException(status_code=400, detail="No last run found — run the scenario first")
    new_golden = [{"pool_name": t["pool_name"], "intent": t.get("intent"), "bot_reply": t.get("bot_reply", "")} for t in last_run["turns"]]
    now = datetime.now(timezone.utc).isoformat()
    await db.scripted_scenarios.update_one(
        {"id": scenario_id},
        {"$set": {"golden_turns": new_golden, "updated_at": now}}
    )
    return {"success": True, "golden_turns": new_golden}
@api_router.post("/discord/scripted-mode/scenarios/run-all")
async def run_all_scenarios(body: Optional[dict] = None, instance_id: str = Depends(get_instance_access)):
    """Run every scenario sequentially. Returns a per-scenario pass/fail summary."""
    scenarios = await db.scripted_scenarios.find({"instance_id": instance_id}, {"_id": 0}).to_list(200)
    scripted_cfg = await _load_scripted_cfg(instance_id, (body or {}).get("scripted_config"))
    results = []
    passed = failed = captured = 0
    for s in scenarios:
        try:
            r = await _run_scenario_doc(s, scripted_cfg, instance_id)
            status = r.get("status", "fail")
            if status == "pass":
                passed += 1
            elif status == "captured_golden":
                captured += 1
            else:
                failed += 1
            results.append({
                "id": s["id"], "name": s["name"], "status": status,
                "failures_count": len(r.get("failures", [])),
            })
        except Exception as e:
            failed += 1
            results.append({"id": s["id"], "name": s["name"], "status": "error", "error": str(e)})
    return {
        "total": len(scenarios), "passed": passed, "failed": failed,
        "captured_golden": captured, "results": results,
    }
@api_router.post("/discord/scripted-counters/reset")
async def reset_scripted_counters(instance_id: str = Depends(get_instance_access)):
    """Wipe all Scripted Mode per-user counters for this instance.
    Lets admins re-test the Primary → Update → Silent sequence without waiting for `reset_hours`.
    Does NOT touch the scripted_skips analytics history."""
    result = await db.scripted_counters.delete_many({"instance_id": instance_id})
    logger.info(f"[SCRIPTED] reset_counters instance={instance_id} cleared={result.deleted_count}")
    return {"success": True, "cleared": result.deleted_count}
@api_router.post("/discord/restart")
async def restart_discord_bot_endpoint(instance_id: str = Depends(get_instance_access)):
    global _shared_discord_client, _shared_discord_task
    # Restart the shared bot (reconnects and re-syncs all guilds)
    if _shared_discord_client:
        try:
            await _shared_discord_client.close()
        except Exception:
            pass
    if _shared_discord_task:
        _shared_discord_task.cancel()
    app_creds = await get_discord_credentials()
    config = await db.discord_config.find_one({"instance_id": instance_id}, {"_id": 0})
    token = (config or {}).get("bot_token") or app_creds["bot_token"]
    if not token:
        raise HTTPException(status_code=400, detail="Discord bot token not configured")
    # Update guild mapping for this instance
    guild_id = (config or {}).get("guild_id")
    if guild_id:
        guild_instance_map[guild_id] = instance_id
    _shared_discord_task = asyncio.create_task(start_shared_discord_bot(token))
    return {"success": True, "message": "Discord bot restarting..."}
@api_router.get("/discord/handoff-status")
async def get_handoff_status(instance_id: str = Depends(get_instance_access)):
    """List channels currently in human-takeover silence for this instance."""
    config = await db.discord_config.find_one({"instance_id": instance_id}, {"_id": 0}) or {}
    guild_id = config.get("guild_id")
    cooldown_minutes = config.get("handoff_cooldown_minutes", 15) or 15
    if not guild_id or not _shared_discord_client:
        return {"channels": [], "guild_id": guild_id}
    out = []
    try:
        guild = _shared_discord_client.get_guild(int(guild_id))
        channel_ids_in_guild = {str(c.id) for c in (guild.text_channels if guild else [])}
    except Exception:
        channel_ids_in_guild = set()
    now = datetime.now(timezone.utc)
    for ch_id, ts in list(_handoff_channels.items()):
        if ch_id not in channel_ids_in_guild:
            continue
        elapsed = (now - ts).total_seconds() / 60.0
        remaining = max(0, cooldown_minutes - elapsed)
        ch_name = None
        try:
            ch = guild.get_channel(int(ch_id)) if guild else None
            ch_name = ch.name if ch else None
        except Exception:
            pass
        out.append({
            "channel_id": ch_id,
            "channel_name": ch_name,
            "elapsed_min": round(elapsed, 1),
            "remaining_min": round(remaining, 1),
        })
    return {"channels": out, "guild_id": guild_id, "cooldown_minutes": cooldown_minutes}
@api_router.post("/discord/handoff-resume")
async def resume_handoff(instance_id: str = Depends(get_instance_access)):
    """Clear all human-takeover silences for this instance's guild — bot resumes immediately."""
    config = await db.discord_config.find_one({"instance_id": instance_id}, {"_id": 0}) or {}
    guild_id = config.get("guild_id")
    if not guild_id or not _shared_discord_client:
        return {"success": True, "cleared": 0}
    try:
        guild = _shared_discord_client.get_guild(int(guild_id))
        channel_ids_in_guild = {str(c.id) for c in (guild.text_channels if guild else [])}
    except Exception:
        channel_ids_in_guild = set()
    cleared = 0
    for ch_id in list(_handoff_channels.keys()):
        if ch_id in channel_ids_in_guild:
            del _handoff_channels[ch_id]
            cleared += 1
    return {"success": True, "cleared": cleared}
@api_router.get("/discord/status")
async def get_discord_status(instance_id: str = Depends(get_instance_access)):
    if _shared_discord_client and _shared_discord_client.is_ready():
        config = await db.discord_config.find_one({"instance_id": instance_id}, {"_id": 0})
        guild_id = (config or {}).get("guild_id")
        display_name = None
        if guild_id:
            guild = _shared_discord_client.get_guild(int(guild_id))
            if guild and guild.me:
                display_name = guild.me.nick or guild.me.display_name
        # If no guild nickname found, show the bot_config name for this instance
        if not display_name:
            bot_config = await db.bot_config.find_one({"instance_id": instance_id}, {"_id": 0})
            display_name = (bot_config or {}).get("name") or str(_shared_discord_client.user)
        return {"status": "online", "bot_name": display_name}
    return {"status": "offline", "bot_name": None}
@api_router.post("/discord/rename-global")
async def rename_global_bot(current_user: dict = Depends(require_admin)):
    """Rename the Discord bot's global username (admin only). Limit: 2 per hour."""
    import aiohttp
    from fastapi import Body
    body = await db.discord_app_config.find_one({"_id": "discord_app"}) or {}
    # Read name from request
    from starlette.requests import Request
    return {"error": "Use the direct endpoint with name parameter"}
@api_router.post("/discord/rename-global/{new_name}")
async def rename_global_bot_name(new_name: str, current_user: dict = Depends(require_admin)):
    """Rename the Discord bot's global username (admin only). Limit: 2 per hour."""
    import aiohttp
    if len(new_name) < 2 or len(new_name) > 32:
        raise HTTPException(status_code=400, detail="Name must be 2-32 characters")
    app_creds = await get_discord_credentials()
    bot_token = app_creds.get("bot_token")
    if not bot_token:
        raise HTTPException(status_code=400, detail="No bot token configured")
    async with aiohttp.ClientSession() as session:
        async with session.patch(
            "https://discord.com/api/v10/users/@me",
            headers={"Authorization": f"Bot {bot_token}"},
            json={"username": new_name}
        ) as resp:
            body = await resp.json()
            if resp.status == 200:
                return {"success": True, "new_username": body.get("username"), "discriminator": body.get("discriminator")}
            elif resp.status == 429:
                retry_after = body.get("retry_after", "unknown")
                raise HTTPException(status_code=429, detail=f"Rate limited. Try again in {retry_after} seconds. Discord allows 2 name changes per hour.")
            else:
                raise HTTPException(status_code=400, detail=body.get("message", "Discord API error"))
@api_router.get("/discord/debug-roles")
async def debug_discord_roles(instance_id: str = Depends(get_instance_access)):
    """Debug endpoint: check role detection for this instance's guild."""
    import aiohttp
    config = await db.discord_config.find_one({"instance_id": instance_id}, {"_id": 0})
    if not config:
        return {"error": "No discord config for this instance"}
    guild_id = config.get("guild_id")
    staff_role_name = (config.get("staff_role_name") or "").strip().lower()
    app_creds = await get_discord_credentials()
    # DB is the single source of truth — env vars are not used as a fallback.
    db_token = app_creds.get("bot_token", "")
    bot_token = db_token
    result = {
        "guild_id": guild_id,
        "staff_role_name_config": config.get("staff_role_name"),
        "staff_role_name_lowered": staff_role_name,
        "token_source": "db" if db_token else "none",
        "token_length": len(bot_token),
        "shared_client_ready": _shared_discord_client is not None and _shared_discord_client.is_ready() if _shared_discord_client else False,
    }
    if not bot_token:
        result["error"] = "No bot token available"
        return result
    if not guild_id:
        result["error"] = "No guild_id configured"
        return result
    try:
        async with aiohttp.ClientSession() as session:
            # Fetch guild roles
            async with session.get(
                f"https://discord.com/api/v10/guilds/{guild_id}/roles",
                headers={"Authorization": f"Bot {bot_token}"}
            ) as resp:
                result["roles_api_status"] = resp.status
                if resp.status == 200:
                    roles = await resp.json()
                    result["guild_roles"] = [{"id": r["id"], "name": r["name"]} for r in roles if r["name"] != "@everyone"]
                    matching = [r for r in roles if r["name"].lower() == staff_role_name]
                    result["matching_roles"] = matching
                else:
                    body = await resp.text()
                    result["roles_error"] = body
            # Fetch guild members (first 10)
            async with session.get(
                f"https://discord.com/api/v10/guilds/{guild_id}/members?limit=10",
                headers={"Authorization": f"Bot {bot_token}"}
            ) as resp:
                result["members_api_status"] = resp.status
                if resp.status == 200:
                    members = await resp.json()
                    result["members"] = []
                    for m in members:
                        user = m.get("user", {})
                        result["members"].append({
                            "username": user.get("username"),
                            "id": user.get("id"),
                            "role_ids": m.get("roles", []),
                            "is_bot": user.get("bot", False),
                        })
                else:
                    body = await resp.text()
                    result["members_error"] = body
    except Exception as e:
        result["exception"] = str(e)
    return result

# ==================== APP SETUP ====================

app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
