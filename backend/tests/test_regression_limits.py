"""
Regression tests for API response size limits and diagnostics.
Covers: large OpenAPI docs, normal API size limits, parameter handling, doc import, execution diagnostics.
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


# ── Test safe_api_request size limits ────────────────────────────────────

def test_max_sizes_are_configured():
    """MAX_RESPONSE_SIZE and MAX_DOC_RESPONSE_SIZE are properly defined."""
    from api_integrations import MAX_RESPONSE_SIZE, MAX_DOC_RESPONSE_SIZE
    assert MAX_RESPONSE_SIZE == 500_000, "Normal API limit should be 500KB"
    assert MAX_DOC_RESPONSE_SIZE == 2_000_000, "Doc limit should be 2MB"
    assert MAX_DOC_RESPONSE_SIZE > MAX_RESPONSE_SIZE, "Doc limit must be larger than API limit"


def test_safe_api_request_accepts_max_size_param():
    """safe_api_request signature accepts max_size parameter."""
    import inspect
    from api_integrations import safe_api_request
    sig = inspect.signature(safe_api_request)
    assert "max_size" in sig.parameters, "safe_api_request must accept max_size parameter"
    assert sig.parameters["max_size"].default == 500_000, "Default max_size should be MAX_RESPONSE_SIZE"


def _make_mock_response(body_size, status=200, json_data=None):
    """Helper to create a mock httpx response with given body size."""
    resp = MagicMock()
    resp.content = b"x" * body_size
    resp.status_code = status
    resp.url = "https://example.com/test"
    resp.reason_phrase = "OK"
    resp.text = "x" * body_size
    resp.json.return_value = json_data or {}
    return resp


def _patch_httpx(mock_resp):
    """Patch httpx.AsyncClient to return mock_resp."""
    patcher = patch("api_integrations.httpx.AsyncClient")
    MockClient = patcher.start()
    instance = AsyncMock()
    instance.get.return_value = mock_resp
    instance.post.return_value = mock_resp
    instance.__aenter__ = AsyncMock(return_value=instance)
    instance.__aexit__ = AsyncMock(return_value=False)
    MockClient.return_value = instance
    return patcher


def test_large_response_rejected_at_default_limit():
    """A response > 500KB is rejected with the default limit."""
    from api_integrations import safe_api_request

    mock_resp = _make_mock_response(600_000)
    patcher = _patch_httpx(mock_resp)
    try:
        result = asyncio.get_event_loop().run_until_complete(
            safe_api_request("GET", "https://example.com/api/data")
        )
        assert result["success"] is False
        assert "too large" in result["error"]
        assert "600000" in result["error"]
        assert "500000" in result["error"]
    finally:
        patcher.stop()


def test_large_response_accepted_with_doc_limit():
    """A 600KB response passes when max_size is set to 2MB (doc limit)."""
    from api_integrations import safe_api_request, MAX_DOC_RESPONSE_SIZE

    mock_resp = _make_mock_response(600_000, json_data={"openapi": "3.1.0"})
    patcher = _patch_httpx(mock_resp)
    try:
        result = asyncio.get_event_loop().run_until_complete(
            safe_api_request("GET", "https://example.com/api/openapi.json",
                             max_size=MAX_DOC_RESPONSE_SIZE)
        )
        assert result["success"] is True, f"Should succeed: {result.get('error')}"
    finally:
        patcher.stop()


def test_response_exceeding_doc_limit_rejected():
    """A response > 2MB is rejected even with the doc limit."""
    from api_integrations import safe_api_request, MAX_DOC_RESPONSE_SIZE

    mock_resp = _make_mock_response(MAX_DOC_RESPONSE_SIZE + 1)
    patcher = _patch_httpx(mock_resp)
    try:
        result = asyncio.get_event_loop().run_until_complete(
            safe_api_request("GET", "https://example.com/api/openapi.json",
                             max_size=MAX_DOC_RESPONSE_SIZE)
        )
        assert result["success"] is False
        assert "too large" in result["error"]
    finally:
        patcher.stop()


def test_normal_size_response_accepted():
    """A response under 500KB passes with default limit."""
    from api_integrations import safe_api_request

    mock_resp = _make_mock_response(100_000, json_data={"data": "ok"})
    patcher = _patch_httpx(mock_resp)
    try:
        result = asyncio.get_event_loop().run_until_complete(
            safe_api_request("GET", "https://example.com/api/data")
        )
        assert result["success"] is True
    finally:
        patcher.stop()


# ── Test OpenAPI parsing with large specs ────────────────────────────────

def test_parse_large_openapi_spec():
    """parse_openapi_spec handles a large spec with many endpoints."""
    from api_integrations import parse_openapi_spec

    paths = {}
    for i in range(100):
        paths[f"/api/resource{i}"] = {
            "get": {
                "summary": f"Get resource {i}",
                "description": f"Fetch resource number {i}",
                "parameters": [
                    {"name": "id", "in": "query", "schema": {"type": "integer"},
                     "description": f"Resource {i} ID", "required": True},
                ],
                "responses": {
                    "200": {
                        "description": "Success",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "id": {"type": "integer", "description": "Unique ID"},
                                        "name": {"type": "string", "description": "Resource name"},
                                        "value": {"type": "number", "description": "Measured value",
                                                   "unit": "meters"},
                                    },
                                },
                                "example": {"id": 1, "name": "test", "value": 3.14},
                            }
                        }
                    },
                    "422": {
                        "description": "Validation Error",
                        "content": {"application/json": {"schema": {"type": "object"}}}
                    }
                }
            }
        }

    spec = {"openapi": "3.1.0", "info": {"title": "Test", "version": "1.0"}, "paths": paths}
    endpoints = parse_openapi_spec(spec)

    assert len(endpoints) == 100
    ep = endpoints[0]
    assert ep["response_schema"]["200"]["schema"]["properties"]["id"]["type"] == "integer"
    assert ep["response_schema"]["200"]["schema"]["properties"]["id"]["description"] == "Unique ID"
    assert ep["response_examples"]["200"]["id"] == 1
    assert ep["error_responses"]["422"]["description"] == "Validation Error"
    assert ep["parameters"][0]["description"].startswith("Resource")


# ── Test passive diagnostic accuracy ─────────────────────────────────────

def test_generic_schemas_not_counted_as_covered():
    """Schemas with only {type: object} and no properties must NOT count as covered."""
    from api_diagnostics import run_passive_scan

    endpoints = [
        {
            "id": "ep1", "method": "GET", "path": "/a",
            "response_schema": {"200": {"description": "OK", "schema": {"type": "object"}}},
            "parameters": [], "response_examples": {}, "error_responses": {},
            "summary": "Test", "enabled": True,
        },
        {
            "id": "ep2", "method": "GET", "path": "/b",
            "response_schema": {"200": {"description": "OK", "schema": {
                "type": "object",
                "properties": {"id": {"type": "integer", "description": "ID"}},
            }}},
            "parameters": [], "response_examples": {}, "error_responses": {},
            "summary": "Test2", "enabled": True,
        },
    ]

    result = run_passive_scan(endpoints, {"doc_source_type": "openapi"})
    schema_cov = result["metrics"]["response_schema_coverage"]
    assert schema_cov["covered"] == 1, "Only ep2 has real properties"
    assert schema_cov["total"] == 2
    assert schema_cov["generic_count"] == 1


def test_zero_fields_reported_correctly():
    """When no schemas define properties, field_description_coverage reports no_fields_defined."""
    from api_diagnostics import run_passive_scan

    endpoints = [{
        "id": "ep1", "method": "GET", "path": "/a",
        "response_schema": {"200": {"description": "OK", "schema": {"type": "object"}}},
        "parameters": [], "response_examples": {}, "error_responses": {},
        "summary": "Test", "enabled": True,
    }]

    result = run_passive_scan(endpoints, {"doc_source_type": "openapi"})
    field_cov = result["metrics"]["field_description_coverage"]
    assert field_cov["total"] == 0
    assert field_cov["no_fields_defined"] is True


def test_rich_schema_fields_counted():
    """Field descriptions are properly counted when properties exist."""
    from api_diagnostics import run_passive_scan

    endpoints = [{
        "id": "ep1", "method": "GET", "path": "/a",
        "response_schema": {"200": {"description": "OK", "schema": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "Unique identifier"},
                "name": {"type": "string", "description": ""},
                "value": {"type": "number", "description": "The measured value", "unit": "kg"},
            },
        }}},
        "parameters": [
            {"name": "id", "in": "query", "description": "Filter by ID"},
            {"name": "page", "in": "query", "description": ""},
        ],
        "response_examples": {"200": {"id": 1}},
        "error_responses": {"422": {"description": "Bad input"}},
        "summary": "Test", "enabled": True,
    }]

    result = run_passive_scan(endpoints, {"doc_source_type": "openapi"})
    field_cov = result["metrics"]["field_description_coverage"]
    assert field_cov["covered"] == 2  # id and value have descriptions
    assert field_cov["total"] == 3
    assert field_cov["fields_with_units"] == 1
    assert field_cov["no_fields_defined"] is False

    param_cov = result["metrics"]["parameter_documentation"]
    assert param_cov["covered"] == 1  # only "id" has a description
    assert param_cov["total"] == 2

    ex_cov = result["metrics"]["response_example_coverage"]
    assert ex_cov["covered"] == 1

    err_cov = result["metrics"]["error_documentation_coverage"]
    assert err_cov["covered"] == 1


# ── Test schema validation ───────────────────────────────────────────────

def test_validate_response_correct_type():
    """Schema validation passes when response matches schema."""
    from api_diagnostics import validate_response_against_schema

    ep = {
        "response_schema": {"200": {"description": "OK", "schema": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "ID"},
                "name": {"type": "string", "description": "Name"},
            },
        }}}
    }
    result = validate_response_against_schema({"id": 42, "name": "test"}, ep, "200")
    assert result["valid"] is True
    assert result["fields_found"] == 2


def test_validate_response_missing_required():
    """Schema validation fails when required field is missing."""
    from api_diagnostics import validate_response_against_schema

    ep = {
        "response_schema": {"200": {"description": "OK", "schema": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "required": True},
            },
        }}}
    }
    result = validate_response_against_schema({}, ep, "200")
    assert result["valid"] is False


def test_validate_response_array_type():
    """Schema validation works for array responses."""
    from api_diagnostics import validate_response_against_schema

    ep = {
        "response_schema": {"200": {"description": "OK", "schema": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer", "description": "ID"},
                },
            },
        }}}
    }
    result = validate_response_against_schema([{"id": 1}], ep, "200")
    assert result["valid"] is True


# ── Test doc source imports preserved ────────────────────────────────────

def test_openapi_doc_source_preserved():
    """parse_openapi_spec returns well-structured endpoints from OpenAPI spec."""
    from api_integrations import parse_openapi_spec

    spec = {
        "openapi": "3.1.0",
        "info": {"title": "Test", "version": "1.0"},
        "paths": {
            "/test": {"get": {"summary": "Test endpoint", "responses": {"200": {"description": "OK"}}}}
        }
    }
    endpoints = parse_openapi_spec(spec)
    assert len(endpoints) == 1
    assert endpoints[0]["method"] == "GET"
    assert endpoints[0]["path"] == "/test"
    assert endpoints[0]["summary"] == "Test endpoint"
    # doc_source is set during the import route, not in parse_openapi_spec
    # The importer sets it to "openapi" — verified by examining the route code
