"""
API Intelligence Diagnostics Routes
Mounts under /integrations/<id>/diagnostics and /diagnostics (instance-wide).
Active tests use the REAL production pipeline functions.
"""

import uuid
import json as _json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, List

from api_integrations import (
    build_endpoint_selection_context, build_schema_context,
    MAX_API_CALLS_PER_MESSAGE,
)
import api_diagnostics as diag

logger = logging.getLogger("bridgebot.diagnostics")

router = APIRouter(tags=["API Diagnostics"])

# ── Dependencies injected by init() from server.py ──────────────────────
_db = None
_get_instance_access = None
_call_claude = None
_search_knowledge = None
_build_system_prompt = None
_get_tone_examples = None
_api_route_prompt = ""
_get_enabled_endpoints = None
_execute_selected_endpoints = None
_execute_endpoint = None
_build_auth_headers = None
_build_auth_params = None


def init(database, instance_access_dep, *,
         call_claude_fn, search_knowledge_fn, build_system_prompt_fn,
         get_tone_examples_fn, api_route_prompt_str,
         get_enabled_endpoints_fn, execute_selected_endpoints_fn,
         execute_endpoint_fn, build_auth_headers_fn, build_auth_params_fn):
    global _db, _get_instance_access, _call_claude, _search_knowledge
    global _build_system_prompt, _get_tone_examples, _api_route_prompt
    global _get_enabled_endpoints, _execute_selected_endpoints
    global _execute_endpoint, _build_auth_headers, _build_auth_params
    _db = database
    _get_instance_access = instance_access_dep
    _call_claude = call_claude_fn
    _search_knowledge = search_knowledge_fn
    _build_system_prompt = build_system_prompt_fn
    _get_tone_examples = get_tone_examples_fn
    _api_route_prompt = api_route_prompt_str
    _get_enabled_endpoints = get_enabled_endpoints_fn
    _execute_selected_endpoints = execute_selected_endpoints_fn
    _execute_endpoint = execute_endpoint_fn
    _build_auth_headers = build_auth_headers_fn
    _build_auth_params = build_auth_params_fn


def _require_db():
    if _db is None:
        raise RuntimeError("api_diagnostics_routes not initialised")
    return _db


# ── Request Models ──────────────────────────────────────────────────────

class DiscoveryTestRequest(BaseModel):
    question: str
    expected_endpoint_id: Optional[str] = None

class ExecutionTestRequest(BaseModel):
    endpoint_id: str
    parameters: dict = {}

class UnifiedTestRequest(BaseModel):
    question: str


# ══════════════════════════════════════════════════════════════════════════
# 1. Passive Documentation Scan  (FREE — no API/LLM calls)
# ══════════════════════════════════════════════════════════════════════════

@router.get("/integrations/{integration_id}/diagnostics/scan")
async def passive_scan(integration_id: str, request: Request):
    db = _require_db()
    instance_id = await _get_instance_access(request)

    intg = await db.api_integrations.find_one(
        {"id": integration_id, "instance_id": instance_id},
        {"_id": 0, "auth_encrypted_value": 0},
    )
    if not intg:
        raise HTTPException(404, "Integration not found")

    endpoints = await db.api_endpoints.find(
        {"integration_id": integration_id, "instance_id": instance_id}, {"_id": 0}
    ).to_list(500)

    t0 = datetime.now(timezone.utc)
    result = diag.run_passive_scan(endpoints, intg)
    dur = int((datetime.now(timezone.utc) - t0).total_seconds() * 1000)

    record = {
        "id": str(uuid.uuid4()),
        "instance_id": instance_id,
        "integration_id": integration_id,
        "diagnostic_type": "passive_scan",
        "status": "pass" if result["overall_score"] >= 50 else ("warning" if result["overall_score"] >= 25 else "fail"),
        "duration_ms": dur,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "results": result,
        "endpoint_ids": [e["id"] for e in endpoints[:50]],
        "error_details": None,
    }
    await db.api_diagnostics_history.insert_one(record)

    return {**result, "diagnostic_id": record["id"], "status": record["status"],
            "duration_ms": dur, "timestamp": record["timestamp"]}


# ══════════════════════════════════════════════════════════════════════════
# 2. AI Endpoint Discovery Test  (ACTIVE — costs LLM tokens)
# ══════════════════════════════════════════════════════════════════════════

@router.post("/integrations/{integration_id}/diagnostics/discovery")
async def discovery_test(integration_id: str, body: DiscoveryTestRequest, request: Request):
    db = _require_db()
    instance_id = await _get_instance_access(request)
    t0 = datetime.now(timezone.utc)

    # Verify integration exists
    intg = await db.api_integrations.find_one(
        {"id": integration_id, "instance_id": instance_id}, {"_id": 0, "auth_encrypted_value": 0}
    )
    if not intg:
        raise HTTPException(404, "Integration not found")

    # Use the REAL pipeline: get all enabled endpoints for this instance
    endpoints = await _get_enabled_endpoints(instance_id)
    if not endpoints:
        raise HTTPException(400, "No enabled endpoints available for this instance")

    # Filter to show which are from this integration
    intg_endpoints = [e for e in endpoints if e.get("integration_id") == integration_id]

    endpoint_listing = build_endpoint_selection_context(endpoints)
    if not endpoint_listing.strip():
        raise HTTPException(400, "No executable endpoints available")

    # Use the REAL routing prompt — same as _try_api_query
    route_prompt = _api_route_prompt.format(
        endpoints=endpoint_listing[:12000],
        question=body.question,
        max_calls=MAX_API_CALLS_PER_MESSAGE,
    )

    route_json = None
    llm_raw = ""
    llm_error = None
    try:
        session_id = f"diag_discovery_{uuid.uuid4().hex[:8]}"
        llm_raw = await _call_claude(
            session_id, body.question, route_prompt,
            instance_id=instance_id, platform="diagnostics"
        )
        clean = llm_raw.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        clean = clean.replace("\u201c", '"').replace("\u201d", '"').replace("\u2018", "'").replace("\u2019", "'")
        js = clean.find("{")
        je = clean.rfind("}") + 1
        if js >= 0 and je > js:
            clean = clean[js:je]
        route_json = _json.loads(clean)
    except Exception as e:
        llm_error = str(e)[:300]

    dur = int((datetime.now(timezone.utc) - t0).total_seconds() * 1000)

    if route_json is None:
        result = {
            "test": "discovery",
            "status": "error",
            "question": body.question,
            "error": llm_error or "LLM returned unparseable response",
            "llm_raw_response": llm_raw[:1000],
            "candidate_endpoints_count": len(endpoints),
            "integration_endpoints_count": len(intg_endpoints),
        }
    else:
        evaluation = diag.evaluate_discovery_result(
            route_json, endpoints, body.expected_endpoint_id
        )
        status = "pass"
        if evaluation["action"] == "none":
            status = "warning"
        elif not evaluation["all_permissions_valid"]:
            status = "fail"
        elif evaluation["correctness"] is False:
            status = "fail"

        result = {
            "test": "discovery",
            "status": status,
            "question": body.question,
            "candidate_endpoints": [
                {"endpoint_id": e["id"], "method": e["method"], "path": e["path"],
                 "summary": e.get("summary", ""), "integration": e.get("_integration_name", ""),
                 "from_target_integration": e.get("integration_id") == integration_id}
                for e in endpoints[:30]
            ],
            "candidate_count": len(endpoints),
            **evaluation,
        }

    record = {
        "id": str(uuid.uuid4()),
        "instance_id": instance_id,
        "integration_id": integration_id,
        "diagnostic_type": "discovery_test",
        "status": result["status"],
        "duration_ms": dur,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "results": {k: v for k, v in result.items() if k != "candidate_endpoints"},
        "endpoint_ids": [s["endpoint_id"] for s in result.get("selected_endpoints", [])],
        "error_details": result.get("error"),
    }
    await db.api_diagnostics_history.insert_one(record)

    return {**result, "diagnostic_id": record["id"], "duration_ms": dur,
            "timestamp": record["timestamp"]}


# ══════════════════════════════════════════════════════════════════════════
# 3. Endpoint Execution + Schema Validation  (ACTIVE — costs API call)
# ══════════════════════════════════════════════════════════════════════════

@router.post("/integrations/{integration_id}/diagnostics/execution")
async def execution_test(integration_id: str, body: ExecutionTestRequest, request: Request):
    db = _require_db()
    instance_id = await _get_instance_access(request)
    t0 = datetime.now(timezone.utc)

    intg = await db.api_integrations.find_one(
        {"id": integration_id, "instance_id": instance_id}
    )
    if not intg:
        raise HTTPException(404, "Integration not found")
    if not intg.get("enabled"):
        raise HTTPException(400, "Integration is disabled")

    ep = await db.api_endpoints.find_one(
        {"id": body.endpoint_id, "integration_id": integration_id,
         "instance_id": instance_id}, {"_id": 0}
    )
    if not ep:
        raise HTTPException(404, "Endpoint not found")

    # Use the REAL executor
    exec_result = await _execute_endpoint(intg, ep, body.parameters)
    dur = int((datetime.now(timezone.utc) - t0).total_seconds() * 1000)

    # Schema validation
    schema_validation = None
    if exec_result.get("success") and exec_result.get("data") is not None:
        status_str = str(exec_result.get("status", 200))
        schema_validation = diag.validate_response_against_schema(
            exec_result["data"], ep, status_str
        )

    # Build the schema context the LLM would see
    schema_ctx = build_schema_context(ep, str(exec_result.get("status", 200)))

    result = {
        "test": "execution",
        "status": "pass" if exec_result.get("success") else "fail",
        "endpoint": {
            "id": ep["id"], "method": ep["method"], "path": ep["path"],
            "summary": ep.get("summary", ""), "enabled": ep.get("enabled", False),
            "executable": ep.get("executable", False),
            "doc_source": ep.get("doc_source", "unknown"),
        },
        "http_status": exec_result.get("status", 0),
        "response_size": exec_result.get("response_size", 0),
        "api_duration_ms": exec_result.get("duration_ms", 0),
        "error": exec_result.get("error"),
        "schema_validation": schema_validation,
        "schema_context_preview": schema_ctx[:2000] if schema_ctx else None,
        "response_preview": _json.dumps(exec_result.get("data", ""), indent=2)[:2000]
            if exec_result.get("data") is not None else None,
    }

    # Adjust status based on schema validation
    if result["status"] == "pass" and schema_validation:
        if schema_validation["valid"] is False:
            result["status"] = "warning"

    record = {
        "id": str(uuid.uuid4()),
        "instance_id": instance_id,
        "integration_id": integration_id,
        "diagnostic_type": "execution_test",
        "status": result["status"],
        "duration_ms": dur,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "results": {k: v for k, v in result.items()
                    if k not in ("response_preview", "schema_context_preview")},
        "endpoint_ids": [ep["id"]],
        "error_details": result.get("error"),
    }
    await db.api_diagnostics_history.insert_one(record)

    return {**result, "diagnostic_id": record["id"], "duration_ms": dur,
            "timestamp": record["timestamp"]}


# ══════════════════════════════════════════════════════════════════════════
# 4. Unified KB+API Reasoning Test  (ACTIVE — costs LLM + API)
# ══════════════════════════════════════════════════════════════════════════

@router.post("/integrations/{integration_id}/diagnostics/unified")
async def unified_test(integration_id: str, body: UnifiedTestRequest, request: Request):
    """Full pipeline: KB → discovery → endpoint selection → API execution →
    schema retrieval → LLM context assembly → final answer.
    Instruments the REAL pipeline functions to capture every intermediate step."""
    db = _require_db()
    instance_id = await _get_instance_access(request)
    t0 = datetime.now(timezone.utc)

    bot_config = await db.bot_config.find_one(
        {"instance_id": instance_id}, {"_id": 0}
    ) or {}

    trace = {
        "test": "unified",
        "question": body.question,
        "steps": {},
    }

    # ── Step 1: Knowledge Base Retrieval ─────────────────────────────────
    try:
        kb_context = await _search_knowledge(body.question, instance_id)
        kb_available = kb_context and kb_context != "__NO_KB__"
        trace["steps"]["kb_retrieval"] = {
            "status": "pass" if kb_available else ("no_kb" if kb_context == "__NO_KB__" else "empty"),
            "context_length": len(kb_context) if kb_context else 0,
            "preview": (kb_context[:500] + "...") if kb_context and len(kb_context) > 500 else kb_context,
        }
    except Exception as e:
        kb_context = ""
        kb_available = False
        trace["steps"]["kb_retrieval"] = {"status": "error", "error": str(e)[:200]}

    # ── Step 2: Endpoint Discovery ───────────────────────────────────────
    try:
        endpoints = await _get_enabled_endpoints(instance_id)
        endpoint_listing = build_endpoint_selection_context(endpoints)
        trace["steps"]["endpoint_discovery"] = {
            "status": "pass" if endpoints else "empty",
            "total_endpoints": len(endpoints),
            "from_target_integration": sum(
                1 for e in endpoints if e.get("integration_id") == integration_id
            ),
        }
    except Exception as e:
        endpoints = []
        endpoint_listing = ""
        trace["steps"]["endpoint_discovery"] = {"status": "error", "error": str(e)[:200]}

    # ── Step 3: LLM Endpoint Selection ───────────────────────────────────
    route_json = None
    if endpoints and endpoint_listing.strip():
        route_prompt = _api_route_prompt.format(
            endpoints=endpoint_listing[:12000],
            question=body.question,
            max_calls=MAX_API_CALLS_PER_MESSAGE,
        )
        try:
            session_id = f"diag_unified_{uuid.uuid4().hex[:8]}"
            route_raw = await _call_claude(
                session_id, body.question, route_prompt,
                instance_id=instance_id, platform="diagnostics"
            )
            clean = route_raw.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            clean = clean.replace("\u201c", '"').replace("\u201d", '"').replace("\u2018", "'").replace("\u2019", "'")
            js = clean.find("{")
            je = clean.rfind("}") + 1
            if js >= 0 and je > js:
                clean = clean[js:je]
            route_json = _json.loads(clean)
            trace["steps"]["llm_selection"] = {
                "status": "pass",
                "action": route_json.get("action", "none"),
                "reason": route_json.get("reason", ""),
                "calls": route_json.get("calls", []),
            }
        except Exception as e:
            trace["steps"]["llm_selection"] = {
                "status": "error", "error": str(e)[:200],
                "raw_response": route_raw[:500] if 'route_raw' in dir() else "",
            }
    else:
        trace["steps"]["llm_selection"] = {
            "status": "skipped", "reason": "No endpoints available",
        }

    # ── Step 4: Permission Validation ────────────────────────────────────
    calls = (route_json or {}).get("calls", []) if route_json and route_json.get("action") == "call_api" else []
    if calls:
        perm_results = []
        for c in calls:
            eid = c.get("endpoint_id", "")
            ep = next((e for e in endpoints if e["id"] == eid), None)
            perm_results.append({
                "endpoint_id": eid,
                "found": ep is not None,
                "enabled": ep.get("enabled", False) if ep else False,
                "executable": ep.get("executable", False) if ep else False,
                "permitted": (ep is not None and ep.get("enabled") and ep.get("executable")) if ep else False,
            })
        all_ok = all(p["permitted"] for p in perm_results)
        trace["steps"]["permission_validation"] = {
            "status": "pass" if all_ok else "fail",
            "endpoints": perm_results,
        }
    else:
        trace["steps"]["permission_validation"] = {
            "status": "skipped",
            "reason": "No API calls selected" if route_json else "No route decision",
        }

    # ── Step 5: API Execution ────────────────────────────────────────────
    api_context = ""
    api_sources = []
    api_results_detail = []
    if calls:
        try:
            results = await _execute_selected_endpoints(calls, instance_id)
            has_data = False
            api_context_parts = []

            for r in results:
                if r.get("error"):
                    api_context_parts.append(f"API ERROR: {r['error']}")
                    api_results_detail.append({
                        "endpoint_id": r.get("endpoint_id", ""),
                        "status": "error", "error": r["error"],
                    })
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
                    part += f"HTTP {result.get('status', 200)} \u2014 Response data:\n{data_str}"
                    api_context_parts.append(part)
                    api_sources.append(f"`{ep['method']} {ep['path']}`")

                    # Schema validation on the result
                    sv = diag.validate_response_against_schema(
                        result.get("data"), ep, str(result.get("status", 200))
                    )
                    api_results_detail.append({
                        "endpoint_id": ep.get("id", ""),
                        "method": ep.get("method", ""),
                        "path": ep.get("path", ""),
                        "status": "pass",
                        "http_status": result.get("status"),
                        "duration_ms": result.get("duration_ms", 0),
                        "schema_validation": sv,
                        "doc_source": ep.get("doc_source", "unknown"),
                    })
                else:
                    status_code = result.get("status", 0)
                    error = result.get("error", "Unknown")
                    err_schema = (ep.get("error_responses") or {}).get(str(status_code), {})
                    err_desc = err_schema.get("description", "")
                    part = f"--- API ERROR: {ep['method']} {ep['path']} \u2192 HTTP {status_code} ---\n"
                    if err_desc:
                        part += f"Documented error: {err_desc}\n"
                    part += f"Error: {error}"
                    api_context_parts.append(part)
                    api_sources.append(f"`{ep['method']} {ep['path']}` (error)")
                    api_results_detail.append({
                        "endpoint_id": ep.get("id", ""),
                        "method": ep.get("method", ""),
                        "path": ep.get("path", ""),
                        "status": "fail",
                        "http_status": status_code,
                        "error": error,
                    })

            if has_data or api_context_parts:
                api_context = "\n\n".join(api_context_parts)

            trace["steps"]["api_execution"] = {
                "status": "pass" if has_data else "fail",
                "endpoints_called": len(results),
                "successful": sum(1 for d in api_results_detail if d["status"] == "pass"),
                "details": api_results_detail,
            }
        except Exception as e:
            trace["steps"]["api_execution"] = {
                "status": "error", "error": str(e)[:200],
            }
    else:
        trace["steps"]["api_execution"] = {
            "status": "skipped", "reason": "No API calls to execute",
        }

    # ── Step 6: Response Schema Retrieval ────────────────────────────────
    trace["steps"]["schema_retrieval"] = {
        "status": "pass" if any(
            d.get("schema_validation", {}).get("fields_expected", 0) > 0
            for d in api_results_detail
        ) else ("skipped" if not api_results_detail else "warning"),
        "endpoints_with_schema": sum(
            1 for d in api_results_detail
            if d.get("schema_validation", {}).get("fields_expected", 0) > 0
        ),
    }

    # ── Step 7: Combined LLM Context Assembly ────────────────────────────
    try:
        knowledge_gate = bot_config.get("knowledge_gate", "strict")
        tone = await _get_tone_examples(instance_id, bot_config)
        system_prompt = _build_system_prompt(
            bot_config,
            knowledge_context=kb_context or "",
            tone_examples=tone,
            api_context=api_context,
            api_sources=api_sources,
            knowledge_gate=knowledge_gate,
        )
        context_analysis = diag.analyse_assembled_context(
            system_prompt, kb_context=kb_context or "",
            api_context=api_context, api_sources=api_sources,
        )
        trace["steps"]["context_assembly"] = {
            "status": "pass",
            **context_analysis,
        }
    except Exception as e:
        system_prompt = ""
        trace["steps"]["context_assembly"] = {
            "status": "error", "error": str(e)[:200],
        }

    # ── Step 8: Final Answer Generation ──────────────────────────────────
    final_answer = None
    try:
        if system_prompt:
            session_id = f"diag_answer_{uuid.uuid4().hex[:8]}"
            final_answer = await _call_claude(
                session_id, body.question, system_prompt,
                instance_id=instance_id, platform="diagnostics"
            )
            trace["steps"]["answer_generation"] = {
                "status": "pass",
                "answer_length": len(final_answer),
                "answer": final_answer[:3000],
            }
        else:
            trace["steps"]["answer_generation"] = {
                "status": "skipped", "reason": "No system prompt assembled",
            }
    except Exception as e:
        trace["steps"]["answer_generation"] = {
            "status": "error", "error": str(e)[:200],
        }

    # ── Overall status ───────────────────────────────────────────────────
    step_statuses = [s.get("status", "unknown") for s in trace["steps"].values()]
    if "error" in step_statuses:
        trace["status"] = "error"
    elif "fail" in step_statuses:
        trace["status"] = "fail"
    elif all(s in ("pass", "skipped") for s in step_statuses):
        trace["status"] = "pass"
    else:
        trace["status"] = "warning"

    dur = int((datetime.now(timezone.utc) - t0).total_seconds() * 1000)
    trace["duration_ms"] = dur
    trace["timestamp"] = datetime.now(timezone.utc).isoformat()

    # Persist (without large blobs)
    record = {
        "id": str(uuid.uuid4()),
        "instance_id": instance_id,
        "integration_id": integration_id,
        "diagnostic_type": "unified_test",
        "status": trace["status"],
        "duration_ms": dur,
        "timestamp": trace["timestamp"],
        "results": {
            "question": body.question,
            "step_statuses": {k: v.get("status", "unknown") for k, v in trace["steps"].items()},
        },
        "endpoint_ids": [d.get("endpoint_id", "") for d in api_results_detail],
        "error_details": next(
            (s.get("error") for s in trace["steps"].values() if s.get("error")),
            None
        ),
    }
    await db.api_diagnostics_history.insert_one(record)

    trace["diagnostic_id"] = record["id"]
    return trace


# ══════════════════════════════════════════════════════════════════════════
# 5. Diagnostic History
# ══════════════════════════════════════════════════════════════════════════

@router.get("/integrations/{integration_id}/diagnostics/history")
async def get_diagnostic_history(integration_id: str, request: Request,
                                 limit: int = 20, diagnostic_type: str = None):
    db = _require_db()
    instance_id = await _get_instance_access(request)
    filt = {"integration_id": integration_id, "instance_id": instance_id}
    if diagnostic_type:
        filt["diagnostic_type"] = diagnostic_type
    cursor = db.api_diagnostics_history.find(
        filt, {"_id": 0}
    ).sort("timestamp", -1).limit(min(limit, 100))
    return {"history": await cursor.to_list(min(limit, 100))}


# ══════════════════════════════════════════════════════════════════════════
# 6. Instance-Wide Summary
# ══════════════════════════════════════════════════════════════════════════

@router.get("/diagnostics/instance-summary")
async def instance_summary(request: Request):
    db = _require_db()
    instance_id = await _get_instance_access(request)

    # KB sources
    kb_count = await db.knowledge_sources.count_documents(
        {"instance_id": instance_id, "is_active": True}
    )

    # Integrations
    integrations = await db.api_integrations.find(
        {"instance_id": instance_id},
        {"_id": 0, "auth_encrypted_value": 0}
    ).to_list(50)
    enabled_intgs = [i for i in integrations if i.get("enabled")]

    # Endpoints
    total_eps = await db.api_endpoints.count_documents({"instance_id": instance_id})
    enabled_eps = await db.api_endpoints.count_documents(
        {"instance_id": instance_id, "enabled": True}
    )

    # Doc coverage — run passive scan over ALL endpoints
    all_endpoints = await db.api_endpoints.find(
        {"instance_id": instance_id}, {"_id": 0}
    ).to_list(500)

    doc_coverage = 0
    if all_endpoints:
        has_desc = sum(1 for e in all_endpoints if e.get("summary") or e.get("description"))
        has_schema = sum(1 for e in all_endpoints if e.get("response_schema"))
        doc_coverage = round(
            (has_desc + has_schema) / (len(all_endpoints) * 2) * 100, 1
        )

    # LLM config
    bot_instance = await db.bot_instances.find_one(
        {"instance_id": instance_id}, {"_id": 0, "llm_config": 1}
    )
    llm_config = (bot_instance or {}).get("llm_config", {})
    llm_provider = llm_config.get("provider", "emergent")

    # Last unified test
    last_unified = await db.api_diagnostics_history.find_one(
        {"instance_id": instance_id, "diagnostic_type": "unified_test", "status": "pass"},
        {"_id": 0, "timestamp": 1, "integration_id": 1, "diagnostic_type": 1, "status": 1},
        sort=[("timestamp", -1)]
    )

    # Per-integration summary
    intg_summaries = []
    for intg in integrations:
        iid = intg["id"]
        ep_count = await db.api_endpoints.count_documents(
            {"integration_id": iid, "instance_id": instance_id}
        )
        en_count = await db.api_endpoints.count_documents(
            {"integration_id": iid, "instance_id": instance_id, "enabled": True}
        )
        last_diag = await db.api_diagnostics_history.find_one(
            {"integration_id": iid, "instance_id": instance_id},
            {"_id": 0, "timestamp": 1, "diagnostic_type": 1, "status": 1},
            sort=[("timestamp", -1)]
        )
        intg_summaries.append({
            "id": iid,
            "name": intg.get("name", ""),
            "enabled": intg.get("enabled", False),
            "endpoint_count": ep_count,
            "enabled_endpoint_count": en_count,
            "doc_source_type": intg.get("doc_source_type", ""),
            "last_diagnostic": last_diag,
        })

    return {
        "instance_id": instance_id,
        "knowledge_base": {
            "active_sources": kb_count,
        },
        "integrations": {
            "total": len(integrations),
            "enabled": len(enabled_intgs),
            "details": intg_summaries,
        },
        "endpoints": {
            "total": total_eps,
            "enabled": enabled_eps,
        },
        "documentation_coverage_pct": doc_coverage,
        "llm_provider": llm_provider,
        "last_unified_test": last_unified,
    }
