"""
BridgeBot API Integrations Module
Handles: multi-API integrations, endpoint registry, credential encryption,
enhanced OpenAPI parsing, SSRF-safe execution, and CRUD endpoints.
"""

import os
import uuid
import hashlib
import ipaddress
import socket
import re
import asyncio
from datetime import datetime, timezone
from typing import Optional, List
from urllib.parse import urlparse

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

# ── Encryption ──────────────────────────────────────────────────────────

_fernet = None

def _get_fernet():
    global _fernet
    if _fernet is None:
        key = os.environ.get("ENCRYPTION_KEY", "")
        if not key:
            raise RuntimeError("ENCRYPTION_KEY env var not set")
        _fernet = Fernet(key.encode())
    return _fernet

def encrypt_value(plaintext: str) -> str:
    if not plaintext:
        return ""
    return _get_fernet().encrypt(plaintext.encode()).decode()

def decrypt_value(ciphertext: str) -> str:
    if not ciphertext:
        return ""
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except (InvalidToken, Exception):
        return ""

# ── SSRF Protection ─────────────────────────────────────────────────────

BLOCKED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.0.0.0/24"),
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("198.18.0.0/15"),
    ipaddress.ip_network("198.51.100.0/24"),
    ipaddress.ip_network("203.0.113.0/24"),
    ipaddress.ip_network("224.0.0.0/4"),
    ipaddress.ip_network("240.0.0.0/4"),
    ipaddress.ip_network("255.255.255.255/32"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("::ffff:127.0.0.0/104"),
    ipaddress.ip_network("::ffff:10.0.0.0/104"),
    ipaddress.ip_network("::ffff:172.16.0.0/108"),
    ipaddress.ip_network("::ffff:192.168.0.0/112"),
]

def _is_safe_url(url: str) -> tuple[bool, str]:
    """Validate URL is safe for outbound requests. Returns (is_safe, reason)."""
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Invalid URL"
    if parsed.scheme not in ("http", "https"):
        return False, f"Scheme '{parsed.scheme}' not allowed"
    hostname = parsed.hostname
    if not hostname:
        return False, "No hostname"
    # Resolve DNS
    try:
        addrs = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror:
        return False, f"DNS resolution failed for {hostname}"
    for family, _, _, _, sockaddr in addrs:
        ip = ipaddress.ip_address(sockaddr[0])
        for net in BLOCKED_NETWORKS:
            if ip in net:
                return False, f"Resolved to blocked address {ip}"
    return True, "OK"

MAX_RESPONSE_SIZE = 500_000  # 500KB
REQUEST_TIMEOUT = 20.0
MAX_API_CALLS_PER_MESSAGE = 5

async def safe_api_request(
    method: str, url: str, headers: dict = None, params: dict = None, timeout: float = REQUEST_TIMEOUT
) -> dict:
    """Execute an SSRF-safe outbound HTTP request. Returns structured result."""
    if method.upper() != "GET":
        return {"success": False, "status": 0, "error": "Only GET requests are allowed"}

    safe, reason = _is_safe_url(url)
    if not safe:
        return {"success": False, "status": 0, "error": f"URL blocked: {reason}"}

    start = datetime.now(timezone.utc)
    try:
        async with httpx.AsyncClient(
            timeout=timeout, follow_redirects=True, max_redirects=3
        ) as client:
            resp = await client.get(url, headers=headers or {}, params=params or {})

            # Check final redirect destination
            final_url = str(resp.url)
            safe2, reason2 = _is_safe_url(final_url)
            if not safe2:
                return {"success": False, "status": 0, "error": f"Redirect blocked: {reason2}"}

            content_len = len(resp.content)
            if content_len > MAX_RESPONSE_SIZE:
                return {"success": False, "status": resp.status_code,
                        "error": f"Response too large ({content_len} bytes, max {MAX_RESPONSE_SIZE})"}

            duration_ms = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)
            try:
                data = resp.json()
            except Exception:
                data = resp.text[:10000]

            return {
                "success": resp.status_code < 400,
                "status": resp.status_code,
                "data": data,
                "duration_ms": duration_ms,
                "response_size": content_len,
            }
    except httpx.TimeoutException:
        return {"success": False, "status": 0, "error": "Request timed out"}
    except Exception as e:
        return {"success": False, "status": 0, "error": str(e)[:300]}


# ── Enhanced OpenAPI Parser ──────────────────────────────────────────────

def _resolve_ref(ref_path: str, root: dict) -> dict:
    """Resolve a $ref like '#/components/schemas/Pool' into the actual schema dict."""
    if not ref_path or not ref_path.startswith("#/"):
        return {}
    parts = ref_path[2:].split("/")
    node = root
    for p in parts:
        if isinstance(node, dict):
            node = node.get(p, {})
        else:
            return {}
    return node if isinstance(node, dict) else {}


def _flatten_schema(schema: dict, root: dict, depth: int = 0, max_depth: int = 6) -> dict:
    """Recursively resolve a JSON schema into a flat description. Returns structured info."""
    if depth > max_depth:
        return {"type": "object", "description": "(nested object, depth limit reached)"}

    if "$ref" in schema:
        resolved = _resolve_ref(schema["$ref"], root)
        return _flatten_schema(resolved, root, depth + 1, max_depth)

    if "allOf" in schema:
        merged = {}
        for sub in schema["allOf"]:
            flat = _flatten_schema(sub, root, depth + 1, max_depth)
            if "properties" in flat:
                merged.setdefault("properties", {}).update(flat["properties"])
            merged.update({k: v for k, v in flat.items() if k != "properties"})
        merged["type"] = merged.get("type", "object")
        return merged

    if "oneOf" in schema or "anyOf" in schema:
        variants = schema.get("oneOf") or schema.get("anyOf") or []
        descs = []
        for v in variants[:4]:
            flat = _flatten_schema(v, root, depth + 1, max_depth)
            descs.append(flat.get("type", "unknown"))
        return {"type": f"oneOf({', '.join(descs)})", "description": schema.get("description", "")}

    result = {
        "type": schema.get("type", "object"),
        "description": schema.get("description", ""),
        "format": schema.get("format", ""),
    }

    if schema.get("enum"):
        result["enum"] = schema["enum"][:20]

    if "properties" in schema:
        props = {}
        for pname, pschema in schema["properties"].items():
            flat = _flatten_schema(pschema, root, depth + 1, max_depth)
            flat["required"] = pname in schema.get("required", [])
            props[pname] = flat
        result["properties"] = props

    if schema.get("type") == "array" and "items" in schema:
        result["items"] = _flatten_schema(schema["items"], root, depth + 1, max_depth)

    if "example" in schema:
        result["example"] = schema["example"]

    return result


def parse_openapi_spec(spec: dict) -> list[dict]:
    """Parse OpenAPI 3.x or Swagger 2.0 spec into structured endpoint records.
    Returns a list of endpoint dicts ready for the api_endpoints collection."""
    endpoints = []
    paths = spec.get("paths", {})
    is_swagger2 = spec.get("swagger", "").startswith("2")

    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        for method in ("get", "post", "put", "patch", "delete", "head", "options"):
            op = path_item.get(method)
            if not op or not isinstance(op, dict):
                continue

            endpoint = {
                "method": method.upper(),
                "path": path,
                "operation_id": op.get("operationId", ""),
                "summary": op.get("summary", ""),
                "description": op.get("description", ""),
                "category": (op.get("tags") or ["uncategorized"])[0] if op.get("tags") else "uncategorized",
                "enabled": method.lower() == "get",
                "executable": method.lower() == "get",
                "parameters": [],
                "response_schema": {},
                "response_examples": {},
                "error_responses": {},
            }

            # Parameters
            params = (path_item.get("parameters") or []) + (op.get("parameters") or [])
            for p in params:
                if not isinstance(p, dict):
                    continue
                if "$ref" in p:
                    p = _resolve_ref(p["$ref"], spec)
                endpoint["parameters"].append({
                    "name": p.get("name", ""),
                    "in": p.get("in", "query"),
                    "type": p.get("schema", {}).get("type", p.get("type", "string")) if isinstance(p.get("schema"), dict) else p.get("type", "string"),
                    "required": p.get("required", False),
                    "description": p.get("description", ""),
                    "default": p.get("schema", {}).get("default") if isinstance(p.get("schema"), dict) else p.get("default"),
                })

            # Response schemas
            responses = op.get("responses", {})
            for status_code, resp_obj in responses.items():
                if not isinstance(resp_obj, dict):
                    continue
                if "$ref" in resp_obj:
                    resp_obj = _resolve_ref(resp_obj["$ref"], spec)

                status_str = str(status_code)
                resp_desc = resp_obj.get("description", "")

                # Extract schema
                schema_raw = {}
                if is_swagger2:
                    schema_raw = resp_obj.get("schema", {})
                else:
                    content = resp_obj.get("content", {})
                    for ct in ("application/json", "application/hal+json", "text/json"):
                        if ct in content:
                            schema_raw = content[ct].get("schema", {})
                            # Check for examples
                            if "example" in content[ct]:
                                endpoint["response_examples"][status_str] = content[ct]["example"]
                            elif "examples" in content[ct]:
                                exs = content[ct]["examples"]
                                if isinstance(exs, dict):
                                    first_key = next(iter(exs), None)
                                    if first_key and isinstance(exs[first_key], dict):
                                        endpoint["response_examples"][status_str] = exs[first_key].get("value", exs[first_key])
                            break

                if schema_raw:
                    flat_schema = _flatten_schema(schema_raw, spec)
                else:
                    flat_schema = {}

                if status_str.startswith("2"):
                    endpoint["response_schema"][status_str] = {
                        "description": resp_desc,
                        "schema": flat_schema,
                    }
                else:
                    endpoint["error_responses"][status_str] = {
                        "description": resp_desc,
                        "schema": flat_schema,
                    }

                # Swagger 2.0 examples
                if is_swagger2 and "examples" in resp_obj:
                    for media_type, ex in resp_obj["examples"].items():
                        endpoint["response_examples"][status_str] = ex
                        break

            endpoints.append(endpoint)

    return endpoints


def parse_gridscan_reference(reference_data: list) -> list[dict]:
    """Parse GridScan's custom /api/reference format into structured endpoint records.
    reference_data is a list of endpoint documentation objects."""
    endpoints = []
    for item in reference_data:
        if not isinstance(item, dict):
            continue

        path = item.get("path") or item.get("endpoint", "")
        if not path:
            continue

        method = (item.get("method") or "GET").upper()

        endpoint = {
            "method": method,
            "path": path,
            "operation_id": item.get("operationId", ""),
            "summary": item.get("summary") or item.get("title", ""),
            "description": item.get("description", ""),
            "category": item.get("tag") or item.get("category", "uncategorized"),
            "enabled": method == "GET",
            "executable": method == "GET",
            "parameters": [],
            "response_schema": {},
            "response_examples": {},
            "error_responses": {},
        }

        # Parameters
        for p in (item.get("parameters") or item.get("params") or []):
            if isinstance(p, dict):
                endpoint["parameters"].append({
                    "name": p.get("name", ""),
                    "in": p.get("in", "path" if f"{{{p.get('name', '')}}}" in path else "query"),
                    "type": p.get("type", "string"),
                    "required": p.get("required", True),
                    "description": p.get("description", ""),
                    "default": p.get("default"),
                })

        # Response fields/schema
        resp_fields = item.get("response_fields") or item.get("fields") or item.get("response_schema")
        if resp_fields:
            if isinstance(resp_fields, list):
                props = {}
                for f in resp_fields:
                    if isinstance(f, dict):
                        props[f.get("name", f.get("field", ""))] = {
                            "type": f.get("type", "string"),
                            "description": f.get("description", ""),
                            "unit": f.get("unit", ""),
                        }
                endpoint["response_schema"]["200"] = {
                    "description": "Successful response",
                    "schema": {"type": "object", "properties": props},
                }
            elif isinstance(resp_fields, dict):
                endpoint["response_schema"]["200"] = {
                    "description": "Successful response",
                    "schema": _normalize_schema_dict(resp_fields),
                }

        # Examples
        example = item.get("example") or item.get("response_example")
        if example:
            endpoint["response_examples"]["200"] = example

        # Error codes
        for err in (item.get("errors") or item.get("error_codes") or []):
            if isinstance(err, dict):
                code = str(err.get("code") or err.get("status", ""))
                endpoint["error_responses"][code] = {
                    "description": err.get("description") or err.get("message", ""),
                }

        endpoints.append(endpoint)

    return endpoints


def _normalize_schema_dict(d: dict) -> dict:
    """Convert a flat field dict into a pseudo-schema."""
    if "type" in d and "properties" in d:
        return d
    props = {}
    for k, v in d.items():
        if isinstance(v, dict):
            props[k] = {"type": v.get("type", "string"), "description": v.get("description", "")}
        elif isinstance(v, str):
            props[k] = {"type": "string", "description": v}
    return {"type": "object", "properties": props}


# ── Endpoint Selection Prompt ────────────────────────────────────────────

def build_endpoint_selection_context(endpoints: list[dict]) -> str:
    """Build a concise endpoint listing for the LLM to select from."""
    lines = []
    for ep in endpoints:
        if not ep.get("enabled") or not ep.get("executable"):
            continue
        params_desc = ""
        if ep.get("parameters"):
            param_strs = []
            for p in ep["parameters"]:
                req = " (required)" if p.get("required") else ""
                param_strs.append(f"{p['name']}: {p.get('type', 'string')}{req} — {p.get('description', '')}")
            params_desc = " | Params: " + "; ".join(param_strs)

        line = f"[{ep['id']}] {ep['method']} {ep['path']} — {ep.get('summary') or ep.get('description', '')}{params_desc}"
        lines.append(line)
    return "\n".join(lines)


def build_schema_context(endpoint: dict, status: str = "200") -> str:
    """Build a schema description string for the LLM to interpret an API response."""
    parts = []
    desc = endpoint.get("description") or endpoint.get("summary", "")
    if desc:
        parts.append(f"Endpoint: {endpoint['method']} {endpoint['path']} — {desc}")

    schema_info = (endpoint.get("response_schema") or {}).get(status, {})
    schema = schema_info.get("schema", {})
    if schema.get("properties"):
        parts.append("Response fields:")
        for fname, finfo in schema["properties"].items():
            ftype = finfo.get("type", "")
            fdesc = finfo.get("description", "")
            funit = finfo.get("unit", "")
            unit_str = f" (unit: {funit})" if funit else ""
            parts.append(f"  - {fname}: {ftype}{unit_str} — {fdesc}")
    elif schema.get("type") == "array" and schema.get("items", {}).get("properties"):
        parts.append("Response: array of objects with fields:")
        for fname, finfo in schema["items"]["properties"].items():
            ftype = finfo.get("type", "")
            fdesc = finfo.get("description", "")
            parts.append(f"  - {fname}: {ftype} — {fdesc}")

    # Error codes
    errors = endpoint.get("error_responses", {})
    if errors:
        parts.append("Possible errors:")
        for code, einfo in errors.items():
            parts.append(f"  - {code}: {einfo.get('description', '')}")

    # Example response
    examples = endpoint.get("response_examples", {})
    if examples.get(status):
        import json
        ex_str = json.dumps(examples[status], indent=2)[:2000]
        parts.append(f"Example response:\n{ex_str}")

    return "\n".join(parts)


# ── Pydantic Models ──────────────────────────────────────────────────────

class IntegrationCreate(BaseModel):
    name: str
    description: str = ""
    base_url: str
    auth_type: str = "none"  # none | api_key_header | bearer | api_key_query
    auth_header_name: str = ""
    auth_query_param: str = ""
    auth_value: str = ""
    doc_source_type: str = "openapi"  # openapi | swagger | custom_reference | manual
    doc_source_url: str = ""
    enabled: bool = True

class IntegrationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    base_url: Optional[str] = None
    auth_type: Optional[str] = None
    auth_header_name: Optional[str] = None
    auth_query_param: Optional[str] = None
    auth_value: Optional[str] = None
    doc_source_type: Optional[str] = None
    doc_source_url: Optional[str] = None
    enabled: Optional[bool] = None

class EndpointUpdate(BaseModel):
    enabled: Optional[bool] = None
    description: Optional[str] = None
    manual_notes: Optional[str] = None

class EndpointBulkUpdate(BaseModel):
    endpoint_ids: List[str] = []
    enabled: Optional[bool] = None
    category: Optional[str] = None

class EndpointTestRequest(BaseModel):
    integration_id: str
    endpoint_id: str
    parameters: dict = {}
