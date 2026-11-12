"""
BitBot Pro API Intelligence Diagnostics Module
Passive documentation analysis, schema validation, and LLM context verification.
All functions are pure logic — no DB or framework dependencies.
"""

import json as _json
from datetime import datetime, timezone


# ══════════════════════════════════════════════════════════════════════════
# Passive Documentation Scan
# ══════════════════════════════════════════════════════════════════════════

def run_passive_scan(endpoints: list, integration: dict) -> dict:
    """Analyse stored endpoint documentation without API/LLM calls."""
    total = len(endpoints)
    enabled = [e for e in endpoints if e.get("enabled")]

    metrics = {
        "response_schema_coverage": _analyse_response_schemas(endpoints),
        "field_description_coverage": _analyse_field_descriptions(endpoints),
        "parameter_documentation": _analyse_parameters(endpoints),
        "endpoint_description_coverage": _analyse_endpoint_descriptions(endpoints),
        "response_example_coverage": _analyse_response_examples(endpoints),
        "error_documentation_coverage": _analyse_error_docs(endpoints),
    }

    weights = {
        "response_schema_coverage": 25,
        "field_description_coverage": 20,
        "parameter_documentation": 15,
        "endpoint_description_coverage": 15,
        "response_example_coverage": 15,
        "error_documentation_coverage": 10,
    }
    total_weight = sum(weights.values())
    weighted_sum = sum(
        metrics[k]["percentage"] * weights[k] / 100
        for k in weights if k in metrics
    )
    overall_score = round(weighted_sum / total_weight * 100, 1) if total_weight else 0

    return {
        "total_endpoints": total,
        "enabled_endpoints": len(enabled),
        "disabled_endpoints": total - len(enabled),
        "metrics": metrics,
        "overall_score": overall_score,
        "doc_sources": _analyse_doc_sources(endpoints),
        "doc_source_type": integration.get("doc_source_type", "unknown"),
    }


def _analyse_response_schemas(endpoints: list) -> dict:
    covered, generic, missing = [], [], []
    for ep in endpoints:
        entry = {"endpoint_id": ep["id"], "method": ep["method"], "path": ep["path"]}
        schemas = ep.get("response_schema") or {}
        if not schemas:
            missing.append({**entry, "reason": "No response schema"})
            continue

        # A schema counts as "covered" ONLY if it defines actual field properties.
        # A generic {type: "object"} or {type: "array", items: {type: "object"}}
        # with no properties is NOT useful documentation.
        has_properties = False
        for s in schemas.values():
            if not isinstance(s, dict):
                continue
            sc = s.get("schema", {})
            if sc.get("properties"):
                has_properties = True
                break
            items = sc.get("items", {}) if isinstance(sc.get("items"), dict) else {}
            if items.get("properties"):
                has_properties = True
                break

        if has_properties:
            covered.append({**entry, "status_codes": list(schemas.keys())})
        else:
            generic.append({**entry, "reason": "Schema is generic (no field definitions)"})

    total = len(endpoints)
    return {
        "covered": len(covered), "total": total,
        "percentage": round(len(covered) / total * 100, 1) if total else 0,
        "covered_endpoints": covered[:30],
        "missing_endpoints": (missing + generic)[:30],
        "generic_count": len(generic),
    }


def _analyse_field_descriptions(endpoints: list) -> dict:
    total_fields = 0
    described = 0
    undescribed = []
    units_count = 0

    for ep in endpoints:
        for _code, resp in (ep.get("response_schema") or {}).items():
            schema = resp.get("schema", {}) if isinstance(resp, dict) else {}
            props = schema.get("properties", {})
            if not props:
                items = schema.get("items", {})
                props = items.get("properties", {}) if isinstance(items, dict) else {}
            for fname, finfo in props.items():
                total_fields += 1
                if finfo.get("description"):
                    described += 1
                else:
                    undescribed.append({
                        "endpoint_id": ep["id"],
                        "path": f"{ep['method']} {ep['path']}",
                        "field": fname, "type": finfo.get("type", "unknown"),
                    })
                if finfo.get("unit"):
                    units_count += 1

    return {
        "covered": described, "total": total_fields,
        "percentage": round(described / total_fields * 100, 1) if total_fields else 0,
        "undescribed_fields": undescribed[:40],
        "fields_with_units": units_count,
        "no_fields_defined": total_fields == 0,
    }


def _analyse_parameters(endpoints: list) -> dict:
    total_params = 0
    described = 0
    undocumented = []
    for ep in endpoints:
        for p in (ep.get("parameters") or []):
            total_params += 1
            if p.get("description"):
                described += 1
            else:
                undocumented.append({
                    "endpoint_id": ep["id"],
                    "path": f"{ep['method']} {ep['path']}",
                    "param": p.get("name", ""),
                    "in": p.get("in", ""),
                    "required": p.get("required", False),
                })
    return {
        "covered": described, "total": total_params,
        "percentage": round(described / total_params * 100, 1) if total_params else 0,
        "undocumented_params": undocumented[:40],
    }


def _analyse_endpoint_descriptions(endpoints: list) -> dict:
    covered, missing = [], []
    for ep in endpoints:
        entry = {"endpoint_id": ep["id"], "method": ep["method"], "path": ep["path"]}
        if ep.get("summary") or ep.get("description"):
            covered.append({**entry, "has_summary": bool(ep.get("summary")),
                            "has_description": bool(ep.get("description"))})
        else:
            missing.append({**entry, "reason": "No summary or description"})
    total = len(endpoints)
    return {
        "covered": len(covered), "total": total,
        "percentage": round(len(covered) / total * 100, 1) if total else 0,
        "missing_endpoints": missing[:30],
    }


def _analyse_response_examples(endpoints: list) -> dict:
    covered, missing = [], []
    for ep in endpoints:
        entry = {"endpoint_id": ep["id"], "method": ep["method"], "path": ep["path"]}
        if ep.get("response_examples"):
            covered.append({**entry, "status_codes": list(ep["response_examples"].keys())})
        else:
            missing.append(entry)
    total = len(endpoints)
    return {
        "covered": len(covered), "total": total,
        "percentage": round(len(covered) / total * 100, 1) if total else 0,
        "missing_endpoints": missing[:30],
    }


def _analyse_error_docs(endpoints: list) -> dict:
    covered, missing = [], []
    for ep in endpoints:
        entry = {"endpoint_id": ep["id"], "method": ep["method"], "path": ep["path"]}
        if ep.get("error_responses"):
            covered.append({**entry, "error_codes": list(ep["error_responses"].keys())})
        else:
            missing.append(entry)
    total = len(endpoints)
    return {
        "covered": len(covered), "total": total,
        "percentage": round(len(covered) / total * 100, 1) if total else 0,
        "missing_endpoints": missing[:30],
    }


def _analyse_doc_sources(endpoints: list) -> dict:
    sources = {}
    for ep in endpoints:
        src = ep.get("doc_source", "unknown")
        sources[src] = sources.get(src, 0) + 1
    return sources


# ══════════════════════════════════════════════════════════════════════════
# Response Schema Validation
# ══════════════════════════════════════════════════════════════════════════

def validate_response_against_schema(response_data, endpoint: dict, status_code: str = "200") -> dict:
    """Validate an actual API response against the stored schema."""
    schema_info = (endpoint.get("response_schema") or {}).get(status_code, {})
    schema = schema_info.get("schema", {}) if isinstance(schema_info, dict) else {}

    if not schema:
        return {"valid": None, "reason": "No schema defined for this status code",
                "field_results": [], "fields_found": 0, "fields_expected": 0}

    expected_type = schema.get("type", "object")
    results = []

    if expected_type == "array":
        if not isinstance(response_data, list):
            return {"valid": False, "field_results": [],
                    "reason": f"Expected array, got {type(response_data).__name__}",
                    "fields_found": 0, "fields_expected": 0}
        items_schema = schema.get("items", {})
        if response_data and items_schema.get("properties"):
            sample = response_data[0] if isinstance(response_data[0], dict) else {}
            results = _validate_fields(sample, items_schema["properties"])
    elif expected_type == "object":
        if not isinstance(response_data, dict):
            return {"valid": False, "field_results": [],
                    "reason": f"Expected object, got {type(response_data).__name__}",
                    "fields_found": 0, "fields_expected": 0}
        results = _validate_fields(response_data, schema.get("properties", {}))
    else:
        return {"valid": True, "reason": f"Primitive type '{expected_type}'",
                "field_results": [], "fields_found": 0, "fields_expected": 0}

    req_missing = any(r["status"] == "missing_required" for r in results)
    found = sum(1 for r in results if r["status"] in ("present", "type_match"))
    return {
        "valid": not req_missing,
        "reason": "Missing required fields" if req_missing else "Schema validated",
        "field_results": results,
        "fields_found": found,
        "fields_expected": len(results),
    }


def _validate_fields(data: dict, properties: dict) -> list:
    results = []
    for fname, finfo in properties.items():
        etype = finfo.get("type", "")
        req = finfo.get("required", False)
        if fname in data:
            actual = data[fname]
            ok = _check_type(actual, etype)
            results.append({
                "field": fname, "status": "type_match" if ok else "present",
                "expected_type": etype, "actual_type": type(actual).__name__,
                "has_description": bool(finfo.get("description")),
                "description": (finfo.get("description") or "")[:120],
            })
        else:
            results.append({
                "field": fname,
                "status": "missing_required" if req else "missing_optional",
                "expected_type": etype,
                "has_description": bool(finfo.get("description")),
            })
    return results


def _check_type(value, expected: str) -> bool:
    if not expected:
        return True
    _map = {"string": (str,), "integer": (int,), "number": (int, float),
            "boolean": (bool,), "array": (list,), "object": (dict,)}
    types = _map.get(expected)
    return isinstance(value, types) if types else True


# ══════════════════════════════════════════════════════════════════════════
# LLM Context Analysis
# ══════════════════════════════════════════════════════════════════════════

def analyse_assembled_context(system_prompt: str, kb_context: str = "",
                              api_context: str = "", api_sources: list = None) -> dict:
    """Inspect what the final LLM actually receives. Returns inclusion/missing details."""
    findings = {
        "kb_content_included": False,
        "api_response_included": False,
        "endpoint_info_included": False,
        "schema_info_included": False,
        "field_descriptions_included": False,
        "units_included": False,
        "error_definitions_included": False,
        "anti_fabrication_rule": False,
    }

    pl = system_prompt.lower()
    findings["kb_content_included"] = (
        ("knowledge base" in pl or "knowledge_base" in pl) and len(kb_context or "") > 10
    )
    findings["api_response_included"] = "api result" in pl or "response data" in pl
    findings["endpoint_info_included"] = "endpoint:" in pl or "api result:" in pl
    findings["schema_info_included"] = "schema info" in pl or "response fields" in pl
    findings["field_descriptions_included"] = ("\u2014" in system_prompt and "response fields" in pl)
    findings["units_included"] = "(unit:" in system_prompt
    findings["error_definitions_included"] = (
        "possible errors" in pl or "documented error" in pl
    )
    findings["anti_fabrication_rule"] = "never fabricate" in pl

    # Build a redacted preview (hide raw data blobs, keep structure)
    preview_lines = []
    for line in system_prompt.split("\n"):
        stripped = line.strip()
        if stripped.startswith(("{", "[")) and len(line) > 300:
            preview_lines.append(line[:120] + " ... [DATA REDACTED] ... " + line[-60:])
        elif len(line) > 500:
            preview_lines.append(line[:200] + " ... [TRUNCATED]")
        else:
            preview_lines.append(line)

    inc = sum(1 for v in findings.values() if v)
    tot = len(findings)
    return {
        "findings": findings,
        "included_count": inc,
        "total_checks": tot,
        "completeness_pct": round(inc / tot * 100, 1) if tot else 0,
        "context_preview": "\n".join(preview_lines)[:6000],
        "context_length_chars": len(system_prompt),
        "kb_context_length": len(kb_context or ""),
        "api_context_length": len(api_context or ""),
        "api_sources": api_sources or [],
    }


# ══════════════════════════════════════════════════════════════════════════
# Discovery Test Result Parser
# ══════════════════════════════════════════════════════════════════════════

def evaluate_discovery_result(route_json: dict, endpoints: list,
                              expected_endpoint_id: str = None) -> dict:
    """Evaluate an LLM endpoint-selection result."""
    action = route_json.get("action", "none")
    calls = route_json.get("calls", [])
    reason = route_json.get("reason", "")

    selected_eps = []
    for c in calls:
        eid = c.get("endpoint_id", "")
        params = c.get("parameters", {})
        ep = next((e for e in endpoints if e["id"] == eid), None)
        selected_eps.append({
            "endpoint_id": eid,
            "parameters": params,
            "found": ep is not None,
            "enabled": ep.get("enabled", False) if ep else False,
            "executable": ep.get("executable", False) if ep else False,
            "method": ep.get("method", "") if ep else "",
            "path": ep.get("path", "") if ep else "",
            "summary": ep.get("summary", "") if ep else "",
            "integration_name": ep.get("_integration_name", "") if ep else "",
        })

    # Permission validation
    all_permitted = all(s["found"] and s["enabled"] and s["executable"] for s in selected_eps)

    # Correctness — only evaluated if expected_endpoint_id is provided
    correctness = None
    if expected_endpoint_id and calls:
        correctness = any(c.get("endpoint_id") == expected_endpoint_id for c in calls)

    return {
        "action": action,
        "reason": reason,
        "selected_endpoints": selected_eps,
        "endpoints_selected_count": len(selected_eps),
        "all_permissions_valid": all_permitted,
        "correctness": correctness,
        "correctness_evaluated": expected_endpoint_id is not None,
    }



# ══════════════════════════════════════════════════════════════════════════
# Exportable Documentation Gap Report
# ══════════════════════════════════════════════════════════════════════════

def generate_gap_report(endpoints: list, integration: dict) -> str:
    """Generate a complete Markdown gap report with every missing item listed.
    Unlike the passive scan (truncated for UI), this iterates ALL endpoints."""
    lines = []
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    name = integration.get("name", "Unknown")
    base = integration.get("base_url", "")
    doc_type = integration.get("doc_source_type", "unknown")

    total = len(endpoints)
    enabled = sum(1 for e in endpoints if e.get("enabled"))

    # ── Header ───────────────────────────────────────────────────────────
    lines.append(f"# Documentation Gap Report — {name}")
    lines.append(f"")
    lines.append(f"Generated: {now}")
    lines.append(f"Base URL: `{base}`")
    lines.append(f"Documentation source: **{doc_type}**")
    lines.append(f"Endpoints: **{total}** total, **{enabled}** enabled")
    lines.append("")

    # Full scan for score
    scan = run_passive_scan(endpoints, integration)
    lines.append(f"**Overall documentation score: {scan['overall_score']}/100**")
    lines.append("")

    # ── Summary table ────────────────────────────────────────────────────
    lines.append("## Coverage Summary")
    lines.append("")
    lines.append("| Category | Covered | Total | Percentage | Status |")
    lines.append("|---|---|---|---|---|")
    labels = {
        "response_schema_coverage": "Response Schemas",
        "field_description_coverage": "Field Descriptions",
        "parameter_documentation": "Parameter Descriptions",
        "endpoint_description_coverage": "Endpoint Descriptions",
        "response_example_coverage": "Response Examples",
        "error_documentation_coverage": "Error Documentation",
    }
    for key, label in labels.items():
        m = scan["metrics"].get(key, {})
        cov, tot, pct = m.get("covered", 0), m.get("total", 0), m.get("percentage", 0)
        status = "PASS" if pct >= 75 else ("WARN" if pct >= 25 else "FAIL")
        lines.append(f"| {label} | {cov} | {tot} | {pct}% | {status} |")
    lines.append("")

    # ── Per-category detailed gaps ───────────────────────────────────────

    # 1) Response schemas
    schema_gaps = _full_schema_gaps(endpoints)
    if schema_gaps:
        lines.append("## Response Schema Gaps")
        lines.append("")
        lines.append("These endpoints lack detailed response field definitions.")
        lines.append("The OpenAPI `responses.content.schema.properties` should describe every field returned.")
        lines.append("")
        for g in schema_gaps:
            lines.append(f"- `{g['method']} {g['path']}` — {g['reason']}")
        lines.append("")

    # 2) Field descriptions
    field_gaps = _full_field_gaps(endpoints)
    if field_gaps["no_fields"]:
        lines.append("## Field Description Gaps")
        lines.append("")
        lines.append("No response fields are defined in any schema, so field descriptions cannot be evaluated.")
        lines.append("**Action**: Define `properties` in your response schemas first, then add `description` to each field.")
        lines.append("")
    elif field_gaps["undescribed"]:
        lines.append("## Field Description Gaps")
        lines.append("")
        lines.append(f"{len(field_gaps['undescribed'])} field(s) lack descriptions.")
        lines.append("Add a `description` to each property in your response schema.")
        lines.append("")
        by_ep = {}
        for f in field_gaps["undescribed"]:
            by_ep.setdefault(f["path"], []).append(f["field"])
        for ep_path, fields in by_ep.items():
            lines.append(f"- `{ep_path}`: {', '.join(f'`{f}`' for f in fields)}")
        lines.append("")
        if field_gaps["missing_units"]:
            lines.append(f"Additionally, {len(field_gaps['missing_units'])} field(s) could benefit from `unit` annotations (e.g., `\"unit\": \"lovelace\"`).")
            lines.append("")

    # 3) Parameter descriptions
    param_gaps = _full_param_gaps(endpoints)
    if param_gaps:
        lines.append("## Parameter Description Gaps")
        lines.append("")
        lines.append(f"{len(param_gaps)} parameter(s) lack descriptions.")
        lines.append("Add a `description` to each parameter in your OpenAPI spec.")
        lines.append("")
        by_ep = {}
        for p in param_gaps:
            by_ep.setdefault(p["path"], []).append(p)
        for ep_path, params in by_ep.items():
            param_list = ", ".join(
                f"`{p['param']}` ({'required' if p['required'] else 'optional'}, in {p['in']})"
                for p in params
            )
            lines.append(f"- `{ep_path}`: {param_list}")
        lines.append("")

    # 4) Endpoint descriptions
    desc_gaps = _full_desc_gaps(endpoints)
    if desc_gaps:
        lines.append("## Endpoint Description Gaps")
        lines.append("")
        lines.append(f"{len(desc_gaps)} endpoint(s) lack a summary or description.")
        lines.append("")
        for g in desc_gaps:
            lines.append(f"- `{g['method']} {g['path']}`")
        lines.append("")

    # 5) Response examples
    example_gaps = _full_example_gaps(endpoints)
    if example_gaps:
        lines.append("## Response Example Gaps")
        lines.append("")
        lines.append(f"{len(example_gaps)} endpoint(s) lack response examples.")
        lines.append("Add an `example` block to `responses.content.application/json` in your OpenAPI spec.")
        lines.append("")
        for g in example_gaps:
            lines.append(f"- `{g['method']} {g['path']}`")
        lines.append("")

    # 6) Error documentation
    error_gaps = _full_error_gaps(endpoints)
    if error_gaps:
        lines.append("## Error Documentation Gaps")
        lines.append("")
        lines.append(f"{len(error_gaps)} endpoint(s) lack error response documentation.")
        lines.append("Document expected error responses (400, 401, 404, 422, 500) in your OpenAPI spec.")
        lines.append("")
        for g in error_gaps:
            lines.append(f"- `{g['method']} {g['path']}`")
        lines.append("")

    # ── Recommendations ──────────────────────────────────────────────────
    lines.append("## Recommendations")
    lines.append("")
    recs = []
    sm = scan["metrics"]
    if sm["response_schema_coverage"]["percentage"] < 100:
        recs.append(
            "**Define response schemas**: Replace generic `{type: object}` with detailed `properties` "
            "blocks describing every field the endpoint returns, including type, description, and format."
        )
    if sm["field_description_coverage"].get("no_fields_defined"):
        recs.append(
            "**Add field definitions first**: Response schemas have no `properties` defined. "
            "Add fields before descriptions can be evaluated."
        )
    elif sm["field_description_coverage"]["percentage"] < 100:
        recs.append(
            "**Describe response fields**: Add `description` text to every property in your response schemas. "
            "Include `unit` where applicable (e.g., `\"unit\": \"lovelace\"`)."
        )
    if sm["parameter_documentation"]["percentage"] < 100:
        recs.append(
            "**Document parameters**: Add `description` to every path, query, and header parameter. "
            "Include `example` or `default` values to help API consumers."
        )
    if sm["response_example_coverage"]["percentage"] < 100:
        recs.append(
            "**Add response examples**: Provide `example` objects in your response schemas "
            "so API consumers can see expected response shapes."
        )
    if sm["error_documentation_coverage"]["percentage"] < 100:
        recs.append(
            "**Document error responses**: Describe common error codes (400, 401, 404, 422, 500) "
            "with descriptions and example error bodies."
        )
    for i, r in enumerate(recs, 1):
        lines.append(f"{i}. {r}")
    if not recs:
        lines.append("No gaps detected — documentation coverage is complete.")
    lines.append("")

    lines.append("---")
    lines.append(f"*Report generated by BitBot Pro API Intelligence Diagnostics*")

    return "\n".join(lines)


# ── Full-list helpers (no truncation, used only by gap report) ───────────

def _full_schema_gaps(endpoints: list) -> list:
    gaps = []
    for ep in endpoints:
        schemas = ep.get("response_schema") or {}
        if not schemas:
            gaps.append({"method": ep["method"], "path": ep["path"],
                         "reason": "No response schema defined"})
            continue
        has_properties = False
        for s in schemas.values():
            if not isinstance(s, dict):
                continue
            sc = s.get("schema", {})
            if sc.get("properties"):
                has_properties = True
                break
            items = sc.get("items", {}) if isinstance(sc.get("items"), dict) else {}
            if items.get("properties"):
                has_properties = True
                break
        if not has_properties:
            gaps.append({"method": ep["method"], "path": ep["path"],
                         "reason": "Schema is generic (no field definitions)"})
    return gaps


def _full_field_gaps(endpoints: list) -> dict:
    undescribed = []
    missing_units = []
    total_fields = 0
    for ep in endpoints:
        for _code, resp in (ep.get("response_schema") or {}).items():
            schema = resp.get("schema", {}) if isinstance(resp, dict) else {}
            props = schema.get("properties", {})
            if not props:
                items = schema.get("items", {})
                props = items.get("properties", {}) if isinstance(items, dict) else {}
            for fname, finfo in props.items():
                total_fields += 1
                if not finfo.get("description"):
                    undescribed.append({
                        "path": f"{ep['method']} {ep['path']}",
                        "field": fname, "type": finfo.get("type", "unknown"),
                    })
                if not finfo.get("unit") and finfo.get("type") in ("number", "integer"):
                    missing_units.append({
                        "path": f"{ep['method']} {ep['path']}", "field": fname,
                    })
    return {"undescribed": undescribed, "missing_units": missing_units,
            "no_fields": total_fields == 0}


def _full_param_gaps(endpoints: list) -> list:
    gaps = []
    for ep in endpoints:
        for p in (ep.get("parameters") or []):
            if not p.get("description"):
                gaps.append({
                    "path": f"{ep['method']} {ep['path']}",
                    "param": p.get("name", ""),
                    "in": p.get("in", ""),
                    "required": p.get("required", False),
                })
    return gaps


def _full_desc_gaps(endpoints: list) -> list:
    return [{"method": ep["method"], "path": ep["path"]}
            for ep in endpoints
            if not ep.get("summary") and not ep.get("description")]


def _full_example_gaps(endpoints: list) -> list:
    return [{"method": ep["method"], "path": ep["path"]}
            for ep in endpoints if not ep.get("response_examples")]


def _full_error_gaps(endpoints: list) -> list:
    return [{"method": ep["method"], "path": ep["path"]}
            for ep in endpoints if not ep.get("error_responses")]
