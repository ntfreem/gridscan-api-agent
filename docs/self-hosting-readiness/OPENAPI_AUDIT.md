# BridgeBot Pro — OpenAPI Documentation Audit

> Generated: November 2026

---

## Current State

| Metric | Value |
|--------|-------|
| **Total API Operations** | 226 |
| **Paths Documented in OpenAPI** | 185 |
| **Operations in OpenAPI spec** | 226 |
| **Pydantic Schemas Defined** | 65 |
| **Security Schemes Defined** | 0 |
| **Methods**: GET | 93 |
| **Methods**: POST | 77 |
| **Methods**: PUT | 19 |
| **Methods**: DELETE | 23 |
| **Methods**: PATCH | 14 |

---

## Issues Found

### 1. No Security Schemes Defined (HIGH)

**Problem:** The OpenAPI spec has zero `securitySchemes` definitions. While FastAPI auto-documents the endpoint paths and request bodies, there is no formal declaration of:
- Bearer JWT authentication
- API Key authentication (`X-API-Key` header)
- Webhook secret validation
- Sidebar key authentication

**Impact:** API consumers cannot understand auth requirements from the spec alone.

**Recommendation:** Add a `securitySchemes` component and apply `security` tags to protected endpoints. Example:
```python
from fastapi.security import HTTPBearer, APIKeyHeader
security_scheme = HTTPBearer()
api_key_scheme = APIKeyHeader(name="X-API-Key")
```

### 2. Generic "Successful Response" on All 200s (MEDIUM)

**Problem:** All 226 operations have `"description": "Successful Response"` for their 200 status code. No endpoint documents its actual success response schema.

**Impact:** Consumers cannot see response shapes without reading source code.

**Recommendation:** Add `response_model` to key endpoints (chat, auth, knowledge base) to auto-generate response schemas.

### 3. 34 POST/PUT/PATCH Endpoints Without Request Body Schema (MEDIUM)

**Problem:** 34 write operations (POST/PUT/PATCH) have no `requestBody` in the OpenAPI spec. These likely use `Request` directly instead of Pydantic models.

**Examples of endpoints missing request body schemas:**
- Many Discord endpoints that read from `request.json()`
- Zendesk webhook handlers
- Some admin configuration endpoints

**Recommendation:** Convert `request.json()` patterns to Pydantic models where feasible.

### 4. No Error Response Documentation (LOW)

**Problem:** No endpoint documents error responses (400, 401, 403, 404, 500).

**Recommendation:** Add `responses` parameter to critical endpoints with common error schemas.

### 5. Missing Parameter Descriptions (LOW)

**Problem:** Path parameters (like `{instance_id}`, `{org_id}`) lack descriptions.

**Recommendation:** Add `description` to `Path()` parameters.

---

## Schema Coverage

### Well-Documented Schemas (65 Pydantic models)

These request body schemas ARE properly defined and appear in the OpenAPI spec:

| Schema | Used By |
|--------|---------|
| `ChatMessage` | `/chat/send`, `/chat/stream` |
| `AcceptInviteBody` | `/invite/{token}/accept` |
| `AccountCreate/Update` | `/v2/orgs/{id}/accounts` |
| `BotCreate/Update` | `/v2/orgs/{id}/bots` |
| `BotSettingsUpdate` | `/v2/orgs/{id}/bots/{id}/settings` |
| `ConnectionCreate/Update` | `/v2/orgs/{id}/bots/{id}/connections` |
| `EmbedConfigUpdate` | `/admin/embed-config` |
| `DiscordAppConfigUpdate` | `/discord/app-config` |
| `DiscordConfigUpdate` | `/discord/config` |
| `ChangelogEntryCreate` | `/admin/changelog` |
| `InviteBody` | `/admin/users/invite` |
| `LoginBody/RegisterBody` | `/auth/login`, `/auth/register` |
| + 50 more... | Various endpoints |

### Missing Response Schemas

No endpoints have formal response models. All return untyped `dict` or `JSONResponse`.

---

## OpenAPI Spec Export

The generated OpenAPI specification has been exported to:
```
/app/docs/self-hosting-readiness/openapi.json
```

This file is version-controlled and can be used for:
- API client generation (TypeScript, Python, etc.)
- Documentation hosting (Swagger UI, Redoc)
- Contract testing
- Migration validation

---

## Recommendations Summary

| Priority | Issue | Effort |
|----------|-------|--------|
| HIGH | Add security schemes (Bearer JWT, API Key) | Low (~20 lines) |
| MEDIUM | Add response_model to key endpoints | Medium (gradual) |
| MEDIUM | Convert request.json() to Pydantic models | Medium (gradual) |
| LOW | Add error response documentation | Low (gradual) |
| LOW | Add parameter descriptions | Low (gradual) |

**Note:** These improvements should be made incrementally without changing application behavior. The existing 65 Pydantic request schemas provide good coverage for the most critical endpoints.
