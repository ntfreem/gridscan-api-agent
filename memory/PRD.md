# BridgeBot — Product Requirements Document

## Overview
BridgeBot is a multi-tenant SaaS chatbot platform connecting AI bots to Discord and web interfaces. Each instance has its own Knowledge Base, API integrations, conversation history, and LLM provider configuration.

## Architecture
- **Backend**: FastAPI — `server.py` (main), `api_integrations.py`, `api_integrations_routes.py`
- **Frontend**: React — `/app/frontend/src/`
- **Database**: MongoDB
- **LLM Providers**: Emergent (default), Anthropic Direct, OpenAI Direct, Ollama
- **Messaging**: Discord.py, SSE streaming

## Implemented Features

### Auth & Multi-tenancy
- JWT admin auth, multi-instance workspaces, user assignment, API keys (bbk_ prefix)

### Knowledge Base
- File upload (PDF/TXT/DOCX/CSV), web scraping, manual entries, priority retrieval, bulk delete, Knowledge Gate Protocol

### Chat System
- Web chat (SSE streaming + non-streaming), Discord (passive/scripted mode), External API (`/v1/chat`, `/v1/chat/stream`)
- Markdown rendering, copy-code buttons, typing indicators, session management

### Embed Widget
- Popup, Inline, Fullpage modes. Custom CSS URL, brand color customization

### API Integrations (Phases 1-4)
- Multi-API per instance, CRUD, OpenAPI endpoint discovery, endpoint enable/disable
- Schema/example/error viewers, connection/endpoint testing, encrypted credentials (Fernet)
- Activity logging with endpoint_path, stats aggregation

### Unified AI Intelligence
- `_try_api_query` returns (context, sources) tuple
- `build_system_prompt` accepts api_context/api_sources
- All 4 chat entry points use unified KB+API reasoning
- Endpoint permissions enforced (enabled=True filter)

### LLM Provider System (BYOK)
- Emergent Universal Key, Anthropic Direct, OpenAI Direct, Ollama
- Per-instance config, model allowlists, streaming for all providers
- Duration tracking on all LLM calls

### API Key Usage Analytics (NEW)
- Dedicated analytics page at /admin/api-key-analytics
- Per-key tracking via contextvars (api_key_id on llm_usage + conversations)
- Overview: all keys with request count, success, avg latency
- Detail view per key: requests over time (bar chart), model breakdown, platform breakdown, error breakdown, cost by model, recent requests list
- Summary stats: total requests, success rate, input/output tokens, avg/min/max latency, estimated cost
- Time period filter (7/14/30/90 days)

### Analytics
- LLM cost tracking per model (Anthropic + OpenAI pricing tables)
- Token usage, API activity per integration, conversation analytics

## Key Database Collections
- `users`, `bot_instances` (with llm_config), `bot_config`, `knowledge_sources`
- `conversations` (now includes api_key_id), `api_integrations`, `api_endpoints`
- `api_request_logs` (now includes endpoint_path), `api_keys`
- `llm_usage` (now includes api_key_id + duration_ms)

## Backlog
- P2: Refactor server.py into modular route files
- P2: APP_MODE env splitting
- P2: Multi-server Discord
