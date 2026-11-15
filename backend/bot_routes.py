"""
Bot routes — /api/v2/orgs/{org_id}/bots
CRUD for AI bots within an organisation.
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict

import v2_helpers as h

router = APIRouter(prefix="/v2/orgs", tags=["v2-bots"])


# ── Models ──

class BotCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    persona: Optional[str] = "You are a helpful, friendly, and knowledgeable assistant."
    custom_instructions: Optional[str] = ""


class BotUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    persona: Optional[str] = None
    custom_instructions: Optional[str] = None
    tone_instructions: Optional[str] = None
    manual_tone_examples: Optional[list] = None
    knowledge_gate: Optional[str] = None
    knowledge_gate_pct: Optional[int] = None
    fallback_message: Optional[str] = None


class BotSettingsUpdate(BaseModel):
    """Full behaviour settings update."""
    persona: Optional[str] = None
    custom_instructions: Optional[str] = None
    tone_instructions: Optional[str] = None
    manual_tone_examples: Optional[list] = None
    knowledge_gate: Optional[str] = None
    knowledge_gate_pct: Optional[int] = None
    acknowledgment_replies: Optional[dict] = None
    fallback_message: Optional[str] = None
    api_query_enabled: Optional[bool] = None
    api_base_url: Optional[str] = None
    api_key_header: Optional[str] = None
    api_key_value: Optional[str] = None
    llm_config: Optional[dict] = None


# ── Endpoints ──

@router.get("/{org_id}/bots")
async def list_bots(org_id: str, request: Request):
    """List all bots in the organisation."""
    user, org = await h.require_org_member(request)
    bots = await h._db.bots.find(
        {"org_id": org_id}, {"_id": 0}
    ).sort("name", 1).to_list(100)

    # Attach connection counts per bot
    for bot in bots:
        bot["connection_count"] = await h._db.connections.count_documents({"bot_id": bot["id"]})
        bot["active_connection_count"] = await h._db.connections.count_documents(
            {"bot_id": bot["id"], "enabled": True}
        )
    return {"bots": bots}


@router.post("/{org_id}/bots")
async def create_bot(org_id: str, body: BotCreate, request: Request):
    """Create a new AI bot in the organisation."""
    user, org = await h.require_org_member(request)
    now = h._now()
    bot = {
        "id": h._uuid(),
        "org_id": org_id,
        "name": body.name.strip(),
        "description": (body.description or "").strip(),
        "persona": body.persona or "",
        "custom_instructions": body.custom_instructions or "",
        "tone_instructions": "",
        "manual_tone_examples": [],
        "knowledge_gate": "strict",
        "knowledge_gate_pct": 50,
        "fallback_message": "",
        "acknowledgment_replies": {},
        "llm_config": {"provider": "emergent", "model": None},
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now,
    }
    await h._db.bots.insert_one(bot)
    bot.pop("_id", None)
    bot["connection_count"] = 0
    bot["active_connection_count"] = 0
    return bot


@router.post("/{org_id}/bots/{bot_id}/clone")
async def clone_bot(org_id: str, bot_id: str, request: Request):
    """Clone a bot's settings into a new bot (no connections/knowledge/conversations)."""
    user, org, source = await h.require_bot_access(request, bot_id)
    now = h._now()
    clone = {
        "id": h._uuid(),
        "org_id": org_id,
        "name": f"{source['name']} (Copy)",
        "description": source.get("description", ""),
        "persona": source.get("persona", ""),
        "custom_instructions": source.get("custom_instructions", ""),
        "tone_instructions": source.get("tone_instructions", ""),
        "manual_tone_examples": source.get("manual_tone_examples", []),
        "knowledge_gate": source.get("knowledge_gate", "strict"),
        "knowledge_gate_pct": source.get("knowledge_gate_pct", 50),
        "fallback_message": source.get("fallback_message", ""),
        "acknowledgment_replies": source.get("acknowledgment_replies", {}),
        "llm_config": source.get("llm_config", {"provider": "emergent", "model": None}),
        "created_by": user["id"],
        "cloned_from": bot_id,
        "created_at": now,
        "updated_at": now,
    }
    await h._db.bots.insert_one(clone)
    clone.pop("_id", None)
    clone["connection_count"] = 0
    clone["active_connection_count"] = 0
    return clone


@router.get("/{org_id}/bots/{bot_id}")
async def get_bot(org_id: str, bot_id: str, request: Request):
    """Get bot details including connection summary."""
    user, org, bot = await h.require_bot_access(request, bot_id)
    bot["connection_count"] = await h._db.connections.count_documents({"bot_id": bot_id})
    bot["active_connection_count"] = await h._db.connections.count_documents(
        {"bot_id": bot_id, "enabled": True}
    )
    # Get knowledge source count
    legacy_instance_id = bot.get("legacy_instance_id")
    if legacy_instance_id:
        bot["knowledge_source_count"] = await h._db.knowledge_sources.count_documents(
            {"instance_id": legacy_instance_id}
        )
    else:
        bot["knowledge_source_count"] = await h._db.knowledge_sources.count_documents(
            {"instance_id": bot["id"]}
        )
    return bot


@router.put("/{org_id}/bots/{bot_id}")
async def update_bot(org_id: str, bot_id: str, body: BotUpdate, request: Request):
    """Update bot name, persona, or instructions."""
    user, org, bot = await h.require_bot_access(request, bot_id)
    update = {"updated_at": h._now()}
    for field in ["name", "description", "persona", "custom_instructions",
                   "tone_instructions", "manual_tone_examples", "knowledge_gate",
                   "knowledge_gate_pct", "fallback_message"]:
        val = getattr(body, field, None)
        if val is not None:
            update[field] = val.strip() if isinstance(val, str) else val
    await h._db.bots.update_one({"id": bot_id}, {"$set": update})
    return {"ok": True}


@router.delete("/{org_id}/bots/{bot_id}")
async def delete_bot(org_id: str, bot_id: str, request: Request):
    """Delete a bot and its connections (not the accounts)."""
    user, org, bot = await h.require_bot_access(request, bot_id)
    active = await h._db.connections.count_documents({"bot_id": bot_id, "enabled": True})
    if active > 0:
        raise HTTPException(
            400,
            f"Bot has {active} active connection(s). Disable them first or use force=true."
        )
    # Delete connections
    await h._db.connections.delete_many({"bot_id": bot_id})
    # Delete the bot
    await h._db.bots.delete_one({"id": bot_id})
    return {"ok": True, "deleted_connections": active}


@router.get("/{org_id}/bots/{bot_id}/settings")
async def get_bot_settings(org_id: str, bot_id: str, request: Request):
    """Get full bot behaviour settings (persona, LLM config, etc.)."""
    user, org, bot = await h.require_bot_access(request, bot_id)
    # Return settings subset (never expose internal fields)
    return {
        "id": bot["id"],
        "name": bot["name"],
        "persona": bot.get("persona", ""),
        "custom_instructions": bot.get("custom_instructions", ""),
        "tone_instructions": bot.get("tone_instructions", ""),
        "manual_tone_examples": bot.get("manual_tone_examples", []),
        "knowledge_gate": bot.get("knowledge_gate", "strict"),
        "knowledge_gate_pct": bot.get("knowledge_gate_pct", 50),
        "fallback_message": bot.get("fallback_message", ""),
        "acknowledgment_replies": bot.get("acknowledgment_replies", {}),
        "llm_config": bot.get("llm_config", {}),
        "api_query_enabled": bot.get("api_query_enabled", False),
        "api_base_url": bot.get("api_base_url", ""),
    }


@router.put("/{org_id}/bots/{bot_id}/settings")
async def update_bot_settings(org_id: str, bot_id: str, body: BotSettingsUpdate, request: Request):
    """Update bot behaviour settings."""
    user, org, bot = await h.require_bot_access(request, bot_id)
    update = {"updated_at": h._now()}
    for field in body.model_fields_set:
        val = getattr(body, field)
        if val is not None:
            update[field] = val
    if len(update) > 1:  # more than just updated_at
        await h._db.bots.update_one({"id": bot_id}, {"$set": update})
    return {"ok": True}


# ── Template fields to snapshot ──
_TEMPLATE_FIELDS = [
    "persona", "custom_instructions", "tone_instructions",
    "manual_tone_examples", "knowledge_gate", "knowledge_gate_pct",
    "fallback_message", "acknowledgment_replies", "llm_config",
]


# ── Template endpoints ──

@router.post("/{org_id}/bots/{bot_id}/save-as-template")
async def save_bot_as_template(org_id: str, bot_id: str, request: Request):
    """Snapshot a bot's config into a reusable template."""
    user, org, bot = await h.require_bot_access(request, bot_id)
    body = await request.json() if request.headers.get("content-length", "0") != "0" else {}
    template_name = (body.get("name") or f"{bot['name']} Template").strip()
    description = (body.get("description") or "").strip()

    now = h._now()
    template = {
        "id": h._uuid(),
        "org_id": org_id,
        "name": template_name,
        "description": description,
        "source_bot_id": bot_id,
        "source_bot_name": bot.get("name", ""),
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now,
    }
    for field in _TEMPLATE_FIELDS:
        template[field] = bot.get(field, "" if isinstance(bot.get(field, ""), str) else bot.get(field))

    await h._db.bot_templates.insert_one(template)
    template.pop("_id", None)
    return template


@router.get("/{org_id}/templates")
async def list_templates(org_id: str, request: Request):
    """List all saved bot templates in the organisation."""
    user, org = await h.require_org_member(request)
    templates = await h._db.bot_templates.find(
        {"org_id": org_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"templates": templates}


@router.post("/{org_id}/templates/{template_id}/create-bot")
async def create_bot_from_template(org_id: str, template_id: str, request: Request):
    """Create a new bot from a saved template."""
    user, org = await h.require_org_member(request)
    template = await h._db.bot_templates.find_one({"id": template_id, "org_id": org_id})
    if not template:
        raise HTTPException(404, "Template not found")

    body = await request.json() if request.headers.get("content-length", "0") != "0" else {}
    bot_name = (body.get("name") or f"{template['name']}").strip()

    now = h._now()
    bot = {
        "id": h._uuid(),
        "org_id": org_id,
        "name": bot_name,
        "description": template.get("description", ""),
        "created_by": user["id"],
        "created_from_template": template_id,
        "created_at": now,
        "updated_at": now,
    }
    for field in _TEMPLATE_FIELDS:
        bot[field] = template.get(field, "" if field not in ("manual_tone_examples", "acknowledgment_replies", "llm_config") else template.get(field))

    # Ensure defaults for complex fields
    if not bot.get("manual_tone_examples"):
        bot["manual_tone_examples"] = []
    if not bot.get("acknowledgment_replies"):
        bot["acknowledgment_replies"] = {}
    if not bot.get("llm_config"):
        bot["llm_config"] = {"provider": "emergent", "model": None}

    await h._db.bots.insert_one(bot)
    bot.pop("_id", None)
    bot["connection_count"] = 0
    bot["active_connection_count"] = 0
    return bot


@router.delete("/{org_id}/templates/{template_id}")
async def delete_template(org_id: str, template_id: str, request: Request):
    """Delete a bot template."""
    user, org = await h.require_org_member(request)
    result = await h._db.bot_templates.delete_one({"id": template_id, "org_id": org_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Template not found")
    return {"ok": True}
