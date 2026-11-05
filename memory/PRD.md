# BridgeBot — Product Requirements Document

## Overview
BridgeBot is a multi-tenant SaaS chatbot platform that connects AI-powered bots to Discord servers and web interfaces. Each bot instance operates with its own Knowledge Base, API integrations, conversation history, and LLM provider configuration.

## Core Architecture
- **Backend**: FastAPI (Python) — `/app/backend/server.py` (main), `api_integrations.py`, `api_integrations_routes.py`
- **Frontend**: React — `/app/frontend/src/`
- **Database**: MongoDB (local for preview)
- **LLM Providers**: Emergent Universal Key (default), Anthropic Direct, OpenAI Direct, Ollama
- **Messaging**: Discord.py, SSE streaming for web

## Implemented Features (All Verified Stable)

### Authentication & Multi-tenancy
- JWT-based admin auth with role-based access
- Multi-instance workspace system (bot instances)
- User assignment to instances
- API key management (bbk_ prefix)

### Knowledge Base
- File upload (PDF, TXT, DOCX, CSV), Web scraping, Manual entries
- Priority-based retrieval, Bulk delete
- Knowledge Gate Protocol (strict/relaxed/open)

### Chat System
- Web chat (streaming SSE + non-streaming)
- Discord integration (passive mode, scripted mode)
- External API endpoint (`/v1/chat`, `/v1/chat/stream`)
- Markdown rendering with copy-code buttons, Typing indicators
- Conversation history with session management

### Embed Widget
- Three modes: Popup, Inline, Fullpage
- Custom CSS URL support, Brand color customization

### API Integrations (Phases 1-4 Complete)
- Multi-API integration per bot instance
- CRUD management via `/api/integrations/*` endpoints
- OpenAPI/Swagger automatic endpoint discovery
- Endpoint-level enable/disable with category controls
- Response schema viewer, example responses, error documentation
- Connection testing, Endpoint testing with parameter input
- Encrypted credential storage (Fernet) — verified: secrets never exposed in API or logs
- Activity logging (endpoint_path, status, duration, success/fail)
- Stats aggregation (total, success, failed, avg duration)
- Admin UI: API Integrations page in sidebar

### Unified AI Intelligence
- `_try_api_query` returns (context, sources) tuple — NOT raw responses
- `build_system_prompt` accepts `api_context` + `api_sources` parameters
- All 4 chat entry points (/chat/send, /chat/stream, /v1/chat, Discord) use unified KB+API reasoning
- LLM receives both Knowledge Base and live API data simultaneously
- Schema-aware response interpretation, Error code documentation
- Endpoint permissions enforced: disabled endpoints blocked in AI pipeline (enabled=True filter)

### LLM Provider System (BYOK)
- **Emergent Universal Key**: Default, no user key needed
- **Anthropic Direct**: User provides own sk-ant key
- **OpenAI Direct**: User provides own sk- key
- **Ollama**: Self-hosted model server
- Per-instance provider configuration with model allowlists
- Streaming support for all 4 providers
- Connection testing, LLM usage analytics and cost tracking

### Analytics
- LLM cost tracking per model (with OpenAI pricing added)
- Token usage (input/output)
- API activity dashboard per integration
- Conversation analytics

## Validation Results (iteration_38)
- Backend: **100%** (15/15 pytest + 7/7 curl tests)
- Frontend: **100%** (all UI flows verified)
- Credential encryption: **PASS** (encrypted in DB, not exposed in API/logs)
- Endpoint permissions: **PASS** (enabled=True filter, instance isolation, auth required)
- OpenAI model validation: **PASS** (11 models, invalid rejected)
- API failure handling: **PASS** (404 gracefully handled, logged in activity)
- Multiple integrations: **PASS** (2+ per instance work)
- All chat endpoints: **PASS** (return strings, not tuples)

## Known Limitations
- OpenAI BYOK requires user's own API key (cannot be tested without one)
- OpenAPI discovery depends on API serving valid OpenAPI/Swagger JSON
- Discord bot token is shared across all instances

## Backlog (Prioritized)
### P2
- Refactor `server.py` into modular route files (`/routes`, `/models`, `/services`)
- APP_MODE env splitting (worker vs api)
- Multi-server Discord feature
