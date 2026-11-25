"""
OpenAPI spec loader and Anthropic tool definition builder.

Fetches the Gridscan OpenAPI spec and converts every endpoint
into an Anthropic-compatible tool definition so Claude can call them.
"""
import json
import re
import httpx
from typing import Any


def load_openapi_spec(url: str, timeout: int = 30) -> dict:
    """Fetch and return the OpenAPI JSON spec."""
    resp = httpx.get(url, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def _param_to_property(param: dict) -> dict:
    """Convert an OpenAPI parameter to a JSON Schema property."""
    schema = param.get("schema", {})
    prop: dict[str, Any] = {}

    # Type mapping
    ptype = schema.get("type", "string")
    prop["type"] = ptype

    # Description from param or schema
    desc_parts = []
    if param.get("description"):
        desc_parts.append(param["description"])
    if schema.get("enum"):
        desc_parts.append(f"Allowed values: {schema['enum']}")
    if schema.get("default") is not None:
        desc_parts.append(f"Default: {schema['default']}")
    if schema.get("minimum") is not None:
        desc_parts.append(f"Min: {schema['minimum']}")
    if schema.get("maximum") is not None:
        desc_parts.append(f"Max: {schema['maximum']}")
    if param.get("example") is not None:
        desc_parts.append(f"Example: {param['example']}")
    elif schema.get("example") is not None:
        desc_parts.append(f"Example: {schema['example']}")

    if desc_parts:
        prop["description"] = " | ".join(desc_parts)

    # Enum
    if schema.get("enum"):
        prop["enum"] = schema["enum"]

    return prop


def _make_tool_name(operation_id: str, method: str, path: str) -> str:
    """Create a clean tool name from the operation or path."""
    if operation_id:
        # Clean up operation IDs like "account_summary_api_accounts__stake_address__get"
        name = operation_id
        # Remove trailing _get/_post etc
        name = re.sub(r'_(?:get|post|put|patch|delete)$', '', name)
        # Remove 'api_' prefix
        name = re.sub(r'^api_', '', name)
        # Collapse double underscores
        name = re.sub(r'__+', '_', name)
        # Truncate to 64 chars (Anthropic limit)
        return name[:64]
    # Fallback: build from path
    name = path.replace('/api/', '').replace('/', '_').replace('{', '').replace('}', '')
    return f"{method}_{name}"[:64]


def build_tool_definitions(
    spec: dict,
    excluded_operations: list[str] | None = None,
    included_tags: list[str] | None = None,
) -> list[dict]:
    """
    Convert every endpoint in the OpenAPI spec into an Anthropic tool definition.

    Returns a list of dicts ready to pass to `anthropic.messages.create(tools=...)`.
    Also stores internal metadata (_path, _method, _params_map) for the API client.
    """
    excluded = set(excluded_operations or [])
    tools = []

    for path, path_item in spec.get("paths", {}).items():
        for method, operation in path_item.items():
            if method not in ("get", "post", "put", "patch", "delete"):
                continue

            op_id = operation.get("operationId", "")
            tags = operation.get("tags", [])

            # Filter by exclusion list
            tool_name = _make_tool_name(op_id, method, path)
            if tool_name in excluded or op_id in excluded:
                continue

            # Filter by included tags
            if included_tags is not None:
                if not any(t in included_tags for t in tags):
                    continue

            # Build description
            summary = operation.get("summary", "")
            desc = operation.get("description", "")
            tag_str = f"[{tags[0]}] " if tags else ""
            full_desc = f"{tag_str}{summary}"
            if desc and desc != summary:
                full_desc += f" — {desc[:200]}"

            # Build input schema from parameters
            properties = {}
            required = []
            params_map = {}  # name -> { in: "path"|"query", ... }

            for param in operation.get("parameters", []):
                pname = param["name"]
                ploc = param.get("in", "query")
                properties[pname] = _param_to_property(param)
                params_map[pname] = {"in": ploc, "schema": param.get("schema", {})}
                if param.get("required", False):
                    required.append(pname)

            # Request body (for POST endpoints)
            req_body = operation.get("requestBody", {})
            if req_body:
                content = req_body.get("content", {})
                json_schema = content.get("application/json", {}).get("schema", {})
                if json_schema:
                    # Flatten top-level body properties
                    for prop_name, prop_schema in json_schema.get("properties", {}).items():
                        properties[prop_name] = {
                            "type": prop_schema.get("type", "string"),
                            "description": prop_schema.get("description", f"Request body field: {prop_name}"),
                        }
                        params_map[prop_name] = {"in": "body", "schema": prop_schema}
                    for req_name in json_schema.get("required", []):
                        if req_name not in required:
                            required.append(req_name)

            tool = {
                "name": tool_name,
                "description": full_desc[:1024],  # Anthropic limit
                "input_schema": {
                    "type": "object",
                    "properties": properties,
                    "required": required,
                },
                # Internal metadata (not sent to Anthropic, used by api_client)
                "_path": path,
                "_method": method.upper(),
                "_params_map": params_map,
                "_operation_id": op_id,
                "_tags": tags,
            }
            tools.append(tool)

    return tools


def get_tools_summary(tools: list[dict]) -> str:
    """Return a human-readable summary of all tools for debugging."""
    lines = [f"Total tools: {len(tools)}\n"]
    # Group by tag
    by_tag: dict[str, list] = {}
    for t in tools:
        tag = t.get("_tags", ["Other"])[0] if t.get("_tags") else "Other"
        by_tag.setdefault(tag, []).append(t)
    for tag in sorted(by_tag):
        lines.append(f"\n{tag} ({len(by_tag[tag])} endpoints):")
        for t in by_tag[tag]:
            req = t["input_schema"].get("required", [])
            lines.append(f"  {t['name']:50} params: {', '.join(req) or '(none)'}")
    return "\n".join(lines)
