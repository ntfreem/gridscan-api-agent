"""
API Integrations Router — CRUD, discovery, execution, activity logging.
Mounted as a sub-router of the main api_router in server.py.
"""

import uuid
import json as _json
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Depends, Request

from api_integrations import (
    IntegrationCreate, IntegrationUpdate, EndpointUpdate, EndpointBulkUpdate,
    EndpointTestRequest,
    encrypt_value, decrypt_value,
    parse_openapi_spec, parse_gridscan_reference,
    safe_api_request, build_endpoint_selection_context, build_schema_context,
    MAX_API_CALLS_PER_MESSAGE,
)

logger = logging.getLogger("bridgebot.api_integrations")

router = APIRouter(prefix="/integrations", tags=["API Integrations"])

# ── These are set by init() from server.py ───────────────────────────────
_db = None
_get_instance_access = None

def init(database, instance_access_dep):
    global _db, _get_instance_access
    _db = database
    _get_instance_access = instance_access_dep

def _require_db():
    if _db is None:
        raise RuntimeError("api_integrations_routes not initialized")
    return _db


# ── Auth headers / params helpers ────────────────────────────────────────

def _build_auth_headers(integration: dict) -> dict:
    headers = {"Accept": "application/json"}
    auth_type = integration.get("auth_type", "none")
    encrypted = integration.get("auth_encrypted_value", "")
    raw_value = decrypt_value(encrypted) if encrypted else ""
    if not raw_value:
        return headers
    if auth_type == "api_key_header":
        hname = integration.get("auth_header_name", "Authorization")
        headers[hname] = raw_value
    elif auth_type == "bearer":
        headers["Authorization"] = f"Bearer {raw_value}"
    return headers

def _build_auth_params(integration: dict) -> dict:
    auth_type = integration.get("auth_type", "none")
    if auth_type != "api_key_query":
        return {}
    encrypted = integration.get("auth_encrypted_value", "")
    raw_value = decrypt_value(encrypted) if encrypted else ""
    param_name = integration.get("auth_query_param", "api_key")
    return {param_name: raw_value} if raw_value and param_name else {}


# ══════════════════════════════════════════════════════════════════════════
# CRUD: Integrations
# ══════════════════════════════════════════════════════════════════════════

@router.get("")
async def list_integrations(request: Request):
    db = _require_db()
    instance_id = await _get_instance_access(request)
    cursor = db.api_integrations.find(
        {"instance_id": instance_id},
        {"_id": 0, "auth_encrypted_value": 0}
    )
    return await cursor.to_list(100)


@router.get("/{integration_id}")
async def get_integration(integration_id: str, request: Request):
    db = _require_db()
    instance_id = await _get_instance_access(request)
    doc = await db.api_integrations.find_one(
        {"id": integration_id, "instance_id": instance_id},
        {"_id": 0, "auth_encrypted_value": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Integration not found")
    return doc


@router.post("")
async def create_integration(body: IntegrationCreate, request: Request):
    db = _require_db()
    instance_id = await _get_instance_access(request)
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "instance_id": instance_id,
        "name": body.name.strip(),
        "description": body.description.strip(),
        "base_url": body.base_url.strip().rstrip("/"),
        "auth_type": body.auth_type,
        "auth_header_name": body.auth_header_name.strip(),
        "auth_query_param": body.auth_query_param.strip(),
        "auth_encrypted_value": encrypt_value(body.auth_value) if body.auth_value else "",
        "auth_value_set": bool(body.auth_value),
        "doc_source_type": body.doc_source_type,
        "doc_source_url": body.doc_source_url.strip(),
        "enabled": body.enabled,
        "endpoint_count": 0,
        "enabled_endpoint_count": 0,
        "last_connection_test": None,
        "last_doc_sync": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.api_integrations.insert_one(doc)
    safe = {k: v for k, v in doc.items() if k not in ("_id", "auth_encrypted_value")}
    return safe


@router.put("/{integration_id}")
async def update_integration(integration_id: str, body: IntegrationUpdate, request: Request):
    db = _require_db()
    instance_id = await _get_instance_access(request)
    existing = await db.api_integrations.find_one({"id": integration_id, "instance_id": instance_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Integration not found")

    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    for field in ("name", "description", "base_url", "auth_type", "auth_header_name",
                  "auth_query_param", "doc_source_type", "doc_source_url", "enabled"):
        val = getattr(body, field, None)
        if val is not None:
            updates[field] = val.strip() if isinstance(val, str) else val
            if field == "base_url":
                updates[field] = updates[field].rstrip("/")

    if body.auth_value is not None and body.auth_value != "":
        updates["auth_encrypted_value"] = encrypt_value(body.auth_value)
        updates["auth_value_set"] = True

    await db.api_integrations.update_one({"id": integration_id}, {"$set": updates})
    if body.enabled is not None:
        await _refresh_endpoint_counts(integration_id, instance_id)

    doc = await db.api_integrations.find_one(
        {"id": integration_id}, {"_id": 0, "auth_encrypted_value": 0}
    )
    return doc


@router.delete("/{integration_id}")
async def delete_integration(integration_id: str, request: Request):
    db = _require_db()
    instance_id = await _get_instance_access(request)
    result = await db.api_integrations.delete_one({"id": integration_id, "instance_id": instance_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Integration not found")
    await db.api_endpoints.delete_many({"integration_id": integration_id, "instance_id": instance_id})
    return {"success": True}


@router.post("/{integration_id}/test-connection")
async def test_connection(integration_id: str, request: Request):
    db = _require_db()
    instance_id = await _get_instance_access(request)
    intg = await db.api_integrations.find_one({"id": integration_id, "instance_id": instance_id})
    if not intg:
        raise HTTPException(status_code=404, detail="Integration not found")

    headers = _build_auth_headers(intg)
    params = _build_auth_params(intg)
    result = await safe_api_request("GET", intg["base_url"], headers=headers, params=params, timeout=10.0)
    now = datetime.now(timezone.utc).isoformat()
    await db.api_integrations.update_one({"id": integration_id}, {"$set": {"last_connection_test": now}})
    return {
        "success": result["success"], "status": result.get("status"),
        "duration_ms": result.get("duration_ms"), "error": result.get("error"), "tested_at": now,
    }


# ══════════════════════════════════════════════════════════════════════════
# Endpoint Discovery
# ══════════════════════════════════════════════════════════════════════════

@router.post("/{integration_id}/discover")
async def discover_endpoints(integration_id: str, request: Request):
    db = _require_db()
    instance_id = await _get_instance_access(request)
    intg = await db.api_integrations.find_one({"id": integration_id, "instance_id": instance_id})
    if not intg:
        raise HTTPException(status_code=404, detail="Integration not found")

    doc_type = intg.get("doc_source_type", "openapi")
    doc_url = intg.get("doc_source_url", "")
    headers = _build_auth_headers(intg)

    if not doc_url and doc_type != "manual":
        raise HTTPException(status_code=400, detail="No documentation source URL configured")

    parsed_endpoints = []
    try:
        if doc_type in ("openapi", "swagger"):
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(doc_url, headers=headers)
                resp.raise_for_status()
                spec = resp.json()
            parsed_endpoints = parse_openapi_spec(spec)

        elif doc_type == "custom_reference":
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(doc_url, headers=headers)
                resp.raise_for_status()
                data = resp.json()
            if isinstance(data, list):
                parsed_endpoints = parse_gridscan_reference(data)
            elif isinstance(data, dict) and "endpoints" in data:
                parsed_endpoints = parse_gridscan_reference(data["endpoints"])
            elif isinstance(data, dict):
                all_eps = []
                for v in data.values():
                    if isinstance(v, list):
                        all_eps.extend(v)
                if all_eps:
                    parsed_endpoints = parse_gridscan_reference(all_eps)
        else:
            raise HTTPException(status_code=400, detail=f"Cannot auto-discover for doc type '{doc_type}'")

    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch docs: {str(e)[:200]}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse docs: {str(e)[:200]}")

    if not parsed_endpoints:
        raise HTTPException(status_code=400, detail="No endpoints found in the documentation")

    # Get existing endpoints to preserve admin settings during refresh
    existing = {}
    cursor = db.api_endpoints.find({"integration_id": integration_id, "instance_id": instance_id}, {"_id": 0})
    async for doc in cursor:
        key = f"{doc['method']}:{doc['path']}"
        existing[key] = doc

    now = datetime.now(timezone.utc).isoformat()
    new_count = 0
    updated_count = 0

    for ep in parsed_endpoints:
        key = f"{ep['method']}:{ep['path']}"
        old = existing.get(key)

        if old:
            # Update documentation but preserve admin settings (enabled, manual_overrides)
            update_fields = {
                "summary": ep.get("summary") or old.get("summary", ""),
                "description": ep.get("description") or old.get("description", ""),
                "parameters": ep.get("parameters") or old.get("parameters", []),
                "response_schema": ep.get("response_schema") or old.get("response_schema", {}),
                "response_examples": ep.get("response_examples") or old.get("response_examples", {}),
                "error_responses": ep.get("error_responses") or old.get("error_responses", {}),
                "last_synced": now,
            }
            if not old.get("manual_overrides"):
                update_fields["category"] = ep.get("category", old.get("category", "uncategorized"))
            await db.api_endpoints.update_one({"id": old["id"]}, {"$set": update_fields})
            updated_count += 1
        else:
            ep_doc = {
                "id": str(uuid.uuid4()),
                "instance_id": instance_id,
                "integration_id": integration_id,
                **ep,
                "manual_overrides": {},
                "doc_source": doc_type,
                "last_synced": now,
                "created_at": now,
            }
            await db.api_endpoints.insert_one(ep_doc)
            new_count += 1

    await _refresh_endpoint_counts(integration_id, instance_id)
    await db.api_integrations.update_one(
        {"id": integration_id}, {"$set": {"last_doc_sync": now, "updated_at": now}}
    )
    return {"new": new_count, "updated": updated_count, "total": new_count + updated_count}


async def _refresh_endpoint_counts(integration_id: str, instance_id: str):
    db = _require_db()
    total = await db.api_endpoints.count_documents({"integration_id": integration_id, "instance_id": instance_id})
    enabled = await db.api_endpoints.count_documents(
        {"integration_id": integration_id, "instance_id": instance_id, "enabled": True}
    )
    await db.api_integrations.update_one(
        {"id": integration_id},
        {"$set": {"endpoint_count": total, "enabled_endpoint_count": enabled}}
    )


# ══════════════════════════════════════════════════════════════════════════
# CRUD: Endpoints
# ══════════════════════════════════════════════════════════════════════════

@router.get("/{integration_id}/endpoints")
async def list_endpoints(integration_id: str, request: Request,
                         category: str = None, enabled_only: bool = False, search: str = None):
    db = _require_db()
    instance_id = await _get_instance_access(request)
    filt = {"integration_id": integration_id, "instance_id": instance_id}
    if category:
        filt["category"] = category
    if enabled_only:
        filt["enabled"] = True

    cursor = db.api_endpoints.find(filt, {"_id": 0}).sort("path", 1)
    endpoints = await cursor.to_list(500)

    if search:
        s = search.lower()
        endpoints = [e for e in endpoints if s in f"{e.get('path','')} {e.get('summary','')} {e.get('description','')}".lower()]

    categories = sorted({e.get("category", "uncategorized") for e in endpoints})
    return {"endpoints": endpoints, "categories": categories, "total": len(endpoints)}


@router.get("/{integration_id}/endpoints/{endpoint_id}")
async def get_endpoint(integration_id: str, endpoint_id: str, request: Request):
    db = _require_db()
    instance_id = await _get_instance_access(request)
    doc = await db.api_endpoints.find_one(
        {"id": endpoint_id, "integration_id": integration_id, "instance_id": instance_id},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    return doc


@router.put("/{integration_id}/endpoints/{endpoint_id}")
async def update_endpoint(integration_id: str, endpoint_id: str, body: EndpointUpdate, request: Request):
    db = _require_db()
    instance_id = await _get_instance_access(request)
    filt = {"id": endpoint_id, "integration_id": integration_id, "instance_id": instance_id}
    existing = await db.api_endpoints.find_one(filt)
    if not existing:
        raise HTTPException(status_code=404, detail="Endpoint not found")

    updates = {}
    if body.enabled is not None:
        updates["enabled"] = body.enabled
    if body.description is not None:
        overrides = existing.get("manual_overrides") or {}
        overrides["description"] = body.description
        updates["manual_overrides"] = overrides
    if body.manual_notes is not None:
        overrides = existing.get("manual_overrides") or {}
        overrides["manual_notes"] = body.manual_notes
        updates["manual_overrides"] = overrides

    if updates:
        await db.api_endpoints.update_one(filt, {"$set": updates})
        await _refresh_endpoint_counts(integration_id, instance_id)

    return await db.api_endpoints.find_one(filt, {"_id": 0})


@router.post("/{integration_id}/endpoints/bulk")
async def bulk_update_endpoints(integration_id: str, body: EndpointBulkUpdate, request: Request):
    db = _require_db()
    instance_id = await _get_instance_access(request)
    if not body.endpoint_ids:
        raise HTTPException(status_code=400, detail="No endpoint IDs provided")

    filt = {"integration_id": integration_id, "instance_id": instance_id, "id": {"$in": body.endpoint_ids}}
    updates = {}
    if body.enabled is not None:
        updates["enabled"] = body.enabled
    if body.category is not None:
        updates["category"] = body.category

    if updates:
        result = await db.api_endpoints.update_many(filt, {"$set": updates})
        await _refresh_endpoint_counts(integration_id, instance_id)
        return {"matched": result.matched_count, "modified": result.modified_count}
    return {"matched": 0, "modified": 0}


# ══════════════════════════════════════════════════════════════════════════
# Endpoint Testing
# ══════════════════════════════════════════════════════════════════════════

@router.post("/test-endpoint")
async def test_endpoint(body: EndpointTestRequest, request: Request):
    db = _require_db()
    instance_id = await _get_instance_access(request)
    intg = await db.api_integrations.find_one({"id": body.integration_id, "instance_id": instance_id})
    if not intg:
        raise HTTPException(status_code=404, detail="Integration not found")
    if not intg.get("enabled"):
        raise HTTPException(status_code=400, detail="Integration is disabled")

    ep = await db.api_endpoints.find_one(
        {"id": body.endpoint_id, "integration_id": body.integration_id, "instance_id": instance_id}
    )
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")

    result = await execute_endpoint(intg, ep, body.parameters)
    await _log_api_request(instance_id, body.integration_id, body.endpoint_id,
                           result.get("status", 0), result.get("duration_ms", 0),
                           result.get("success", False), result.get("error"),
                           result.get("response_size", 0),
                           endpoint_path=f"{ep.get('method','')} {ep.get('path','')}")
    return result


async def execute_endpoint(integration: dict, endpoint: dict, parameters: dict = None) -> dict:
    """Execute a registered endpoint with the integration's auth. Returns structured result."""
    base_url = integration.get("base_url", "").rstrip("/")
    path = endpoint.get("path", "")

    # Substitute path parameters
    final_path = path
    query_params = {}
    for p in (endpoint.get("parameters") or []):
        pname = p.get("name", "")
        pval = (parameters or {}).get(pname, p.get("default"))
        if p.get("in") == "path":
            placeholder = f"{{{pname}}}"
            if placeholder in final_path:
                if pval is None and p.get("required"):
                    return {"success": False, "status": 0, "error": f"Missing required param: {pname}"}
                final_path = final_path.replace(placeholder, str(pval or ""))
        elif p.get("in") == "query" and pval is not None:
            query_params[pname] = str(pval)

    full_url = f"{base_url}{final_path}"
    headers = _build_auth_headers(integration)
    auth_params = _build_auth_params(integration)
    query_params.update(auth_params)

    result = await safe_api_request("GET", full_url, headers=headers, params=query_params or None)
    result["url"] = full_url
    result["endpoint_id"] = endpoint.get("id")
    result["integration_id"] = integration.get("id")
    return result


# ══════════════════════════════════════════════════════════════════════════
# Activity Logging & Stats
# ══════════════════════════════════════════════════════════════════════════

async def _log_api_request(instance_id, integration_id, endpoint_id, status, duration_ms, success, error, response_size, endpoint_path=""):
    try:
        db = _require_db()
        await db.api_request_logs.insert_one({
            "id": str(uuid.uuid4()),
            "instance_id": instance_id,
            "integration_id": integration_id,
            "endpoint_id": endpoint_id,
            "endpoint_path": endpoint_path,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "http_status": status,
            "duration_ms": duration_ms,
            "success": success,
            "error_category": str(error)[:100] if error else None,
            "response_size": response_size,
        })
    except Exception:
        pass


@router.get("/{integration_id}/activity")
async def get_activity(integration_id: str, request: Request, limit: int = 50):
    db = _require_db()
    instance_id = await _get_instance_access(request)
    cursor = db.api_request_logs.find(
        {"integration_id": integration_id, "instance_id": instance_id}, {"_id": 0}
    ).sort("timestamp", -1).limit(min(limit, 200))
    return {"logs": await cursor.to_list(min(limit, 200))}


@router.get("/{integration_id}/stats")
async def get_stats(integration_id: str, request: Request):
    db = _require_db()
    instance_id = await _get_instance_access(request)
    pipeline = [
        {"$match": {"integration_id": integration_id, "instance_id": instance_id}},
        {"$group": {
            "_id": None,
            "total_requests": {"$sum": 1},
            "successful": {"$sum": {"$cond": ["$success", 1, 0]}},
            "failed": {"$sum": {"$cond": ["$success", 0, 1]}},
            "avg_duration": {"$avg": "$duration_ms"},
            "total_bytes": {"$sum": "$response_size"},
        }}
    ]
    results = await db.api_request_logs.aggregate(pipeline).to_list(1)
    if results:
        s = results[0]
        s.pop("_id", None)
        s["avg_duration"] = round(s.get("avg_duration") or 0)
        return s
    return {"total_requests": 0, "successful": 0, "failed": 0, "avg_duration": 0, "total_bytes": 0}


# ══════════════════════════════════════════════════════════════════════════
# AI Orchestration helpers (called by server.py's unified pipeline)
# ══════════════════════════════════════════════════════════════════════════

async def get_enabled_endpoints_for_instance(instance_id: str) -> list[dict]:
    """All enabled, executable endpoints across all enabled integrations for an instance."""
    db = _require_db()
    intg_cursor = db.api_integrations.find({"instance_id": instance_id, "enabled": True}, {"_id": 0})
    integrations = {i["id"]: i for i in await intg_cursor.to_list(50)}
    if not integrations:
        return []

    ep_cursor = db.api_endpoints.find(
        {"instance_id": instance_id, "integration_id": {"$in": list(integrations.keys())},
         "enabled": True, "executable": True},
        {"_id": 0}
    )
    endpoints = await ep_cursor.to_list(500)
    for ep in endpoints:
        intg = integrations.get(ep.get("integration_id"), {})
        ep["_integration_name"] = intg.get("name", "")
        ep["_base_url"] = intg.get("base_url", "")
    return endpoints


async def execute_selected_endpoints(selections: list[dict], instance_id: str) -> list[dict]:
    """Execute a batch of endpoint selections. Each: {endpoint_id, parameters}.
    Returns list of {endpoint_id, endpoint, result, schema_context}."""
    db = _require_db()
    results = []

    for sel in selections[:MAX_API_CALLS_PER_MESSAGE]:
        ep_id = sel.get("endpoint_id", "")
        params = sel.get("parameters", {})

        ep = await db.api_endpoints.find_one(
            {"id": ep_id, "instance_id": instance_id, "enabled": True, "executable": True}, {"_id": 0}
        )
        if not ep:
            results.append({"endpoint_id": ep_id, "error": "Endpoint not found or disabled"})
            continue

        intg = await db.api_integrations.find_one(
            {"id": ep["integration_id"], "instance_id": instance_id, "enabled": True}
        )
        if not intg:
            results.append({"endpoint_id": ep_id, "error": "Integration not found or disabled"})
            continue

        result = await execute_endpoint(intg, ep, params)
        await _log_api_request(
            instance_id, intg["id"], ep_id,
            result.get("status", 0), result.get("duration_ms", 0),
            result.get("success", False), result.get("error"),
            result.get("response_size", 0),
            endpoint_path=f"{ep.get('method','')} {ep.get('path','')}"
        )
        schema_ctx = build_schema_context(ep, str(result.get("status", 200)))
        results.append({
            "endpoint_id": ep_id,
            "endpoint": ep,
            "result": result,
            "schema_context": schema_ctx,
        })

    return results
