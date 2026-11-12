# BitBot Pro — OpenAPI Documentation Audit

## Specification Overview

| Metric | Value |
|---|---|
| OpenAPI Version | 3.1.0 |
| Total Paths | 132 |
| Total Operations | 154 |
| Total Schemas | 42 |
| Endpoints with Summaries | 154 / 154 (100%) |
| Endpoints with Response Schema | 154 / 154 (100%) |

The exported spec is at: `docs/self-hosting-readiness/openapi.json`

## Coverage Assessment

### Well-Documented Areas
- **Authentication routes**: Full request/response schemas via Pydantic models
- **API Integrations**: Typed models for IntegrationCreate, IntegrationUpdate, EndpointUpdate, etc.
- **Diagnostics**: Full request schemas (DiscoveryTestRequest, ExecutionTestRequest, UnifiedTestRequest)
- **Telegram & Zendesk**: Config models with field validation

### Areas Needing Improvement

#### 1. Missing Request Body Schemas (uses raw dict)
These endpoints accept JSON but rely on `request.json()` instead of Pydantic models:

| Endpoint | Issue |
|---|---|
| `PUT /api/admin/bot-config` | Accepts arbitrary dict, no typed schema |
| `PUT /api/admin/embed-config` | Accepts arbitrary dict |
| `PUT /api/discord/config` | Accepts arbitrary dict |
| `POST /api/admin/api-test` | Accepts raw JSON body |
| `POST /api/knowledge/sources/faq` | Partial schema |
| `POST /api/knowledge/sources/url` | Minimal schema |
| `POST /api/knowledge/sources/github/scan` | Accepts raw dict |

**Impact**: API consumers won't know expected fields. Self-hosting users need to inspect frontend code.
**Recommendation**: Add Pydantic request models without changing behavior.

#### 2. Generic Response Schemas
Many endpoints return `dict` or `JSONResponse` without typed response models:

| Pattern | Count | Examples |
|---|---|---|
| Returns raw MongoDB docs | ~20 | Knowledge sources, conversations, analytics |
| Returns `{"success": True}` | ~15 | Toggle, delete, bulk operations |
| Returns `{"message": "..."}` | ~10 | Auth operations |

**Impact**: Low risk for migration but poor documentation coverage.
**Recommendation**: Add response models progressively, starting with public-facing endpoints.

#### 3. Missing Parameter Descriptions
- `X-Instance-ID` header: Used by ~80% of endpoints but not documented in OpenAPI
- `X-API-Key` header: Used by `/api/v1/chat` but not in spec
- Query parameters on `/api/conversations` (`limit`, `offset`, `search`) lack descriptions

#### 4. Missing Error Response Definitions
Most endpoints only document `200` and `422` (validation). Common undocumented errors:
- `401 Unauthorized` (expired/missing JWT)
- `403 Forbidden` (wrong role)
- `404 Not Found` (missing resource)
- `409 Conflict` (duplicate)
- `429 Too Many Requests` (rate limit on API keys)

#### 5. Authentication Documentation
The OpenAPI spec lacks a `securitySchemes` definition. Add:
```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
```

## Recommendations (Safe, Non-Breaking)

1. **Add `securitySchemes`** to the FastAPI app initialization — documents auth without changing behavior
2. **Add `X-Instance-ID` as a Header parameter** in endpoint decorators where used
3. **Create Pydantic response models** for the top 10 most-used endpoints
4. **Add error response examples** to auth and CRUD endpoints
5. **Version the API** — add `/v2/` prefix planning for migration

## Files Modified
None. This is a read-only audit. The exported `openapi.json` reflects the current state.
