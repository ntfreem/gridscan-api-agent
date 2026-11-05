# BridgeBot — Product Requirements Document

## Overview
BridgeBot is a multi-tenant SaaS chatbot platform that connects AI-powered bots to Discord servers and web interfaces. Each bot instance operates with its own Knowledge Base, API integrations, conversation history, and LLM provider configuration.

## Core Architecture
- **Backend**: FastAPI (Python) — `/app/backend/server.py` (main), `api_integrations.py`, `api_integrations_routes.py`
- **Frontend**: React — `/app/frontend/src/`
- **Database**: MongoDB (local for preview)
- **LLM Providers**: Emergent Universal Key (default), Anthropic Direct, OpenAI Direct, Ollama
- **Messaging**: Discord.py, SSE streaming for web

## Implemented Features

### Authentication & Multi-tenancy
- JWT-based admin auth with role-based access
- Multi-instance workspace system (bot instances)
- User assignment to instances
- API key management (bbk_ prefix)

### Knowledge Base
- File upload (PDF, TXT, DOCX, CSV)
- Web scraping with chunking
- Manual text entries
- Priority-based retrieval
- Bulk delete
- Knowledge Gate Protocol (strict/relaxed/open)

### Chat System
- Web chat (streaming SSE + non-streaming)
- Discord integration (passive mode, scripted mode)
- External API endpoint (`/v1/chat`, `/v1/chat/stream`)
- Markdown rendering with copy-code buttons
- Typing indicators
- Conversation history with session management

### Embed Widget
- Three modes: Popup, Inline, Fullpage
- Custom CSS URL support
- Brand color customization
- Code generation

### API Integrations (NEW — Phase 1-4)
- Multi-API integration per bot instance
- CRUD management via `/api/integrations/*` endpoints
- OpenAPI/Swagger automatic endpoint discovery
- Endpoint-level enable/disable with category controls
- Response schema viewer and example responses
- Error documentation
- Connection testing
- Endpoint testing with parameter input
- Encrypted credential storage (Fernet)
- Activity logging and stats (requests, success/fail, response times)
- Admin UI: API Integrations page in sidebar

### Unified AI Intelligence
- `_try_api_query` returns (context, sources) tuple
- `build_system_prompt` accepts `api_context` + `api_sources`
- All chat endpoints (web, Discord, external API, streaming) use unified KB+API reasoning
- LLM receives both Knowledge Base and live API data simultaneously
- Schema-aware response interpretation
- Error code documentation in prompts

### LLM Provider System (BYOK)
- **Emergent Universal Key**: Default, no user key needed
- **Anthropic Direct**: User provides own sk-ant key
- **OpenAI Direct**: User provides own sk- key (NEW)
- **Ollama**: Self-hosted model server
- Per-instance provider configuration
- Model allowlists (Anthropic: haiku/sonnet/opus 4.5+, OpenAI: gpt-4o through gpt-5.6-terra, o3, o4-mini)
- Streaming support for all providers
- Connection testing
- LLM usage analytics and cost tracking

### Analytics
- LLM cost tracking per model
- Token usage (input/output)
- API activity dashboard per integration
- Conversation analytics

## Key Database Collections
- `users`: Admin accounts
- `bot_instances`: Workspace instances with `llm_config`
- `bot_config`: Per-instance bot settings (name, personality, knowledge gate, API query toggle)
- `knowledge_sources`: KB entries with chunking
- `conversations`: Chat history with session IDs
- `api_integrations`: Multi-API integration configs (encrypted credentials)
- `api_endpoints`: Discovered/manual endpoints per integration
- `api_activity_logs`: Per-request activity tracking
- `llm_usage`: Per-call LLM token and cost tracking
- `api_keys`: External API keys (bbk_ prefix)

## API Endpoints
- `POST /api/auth/login`, `/api/auth/register`
- `POST /api/chat/send`, `/api/chat/stream`
- `POST /api/v1/chat`, `/api/v1/chat/stream`
- `GET/POST/PUT/DELETE /api/integrations/*`
- `POST /api/integrations/{id}/discover`
- `POST /api/integrations/{id}/test-connection`
- `POST /api/integrations/test-endpoint`
- `GET /api/integrations/{id}/activity`
- `GET /api/integrations/{id}/stats`
- `GET/PUT /api/admin/instances/{id}/llm-config`
- `POST /api/admin/instances/{id}/llm-config/test`
- `GET/PUT /api/admin/bot-config`
- `GET/POST/DELETE /api/knowledge/*`
- `GET /api/analytics/*`

## Backlog (Prioritized)
### P2
- Refactor `server.py` into modular route files (`/routes`, `/models`, `/services`)
- APP_MODE env splitting (worker vs api)
- Multi-server Discord feature
