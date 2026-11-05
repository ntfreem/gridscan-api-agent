# BridgeBot — Product Requirements Document

## Product Overview
Multi-tenant SaaS chatbot platform enabling AI-powered Discord and Web bots with Knowledge Base, multi-API integrations, and unified AI reasoning.

## Core Requirements
- Multi-tenant bot instance management with admin dashboard
- Knowledge Base ingestion (text, PDF, web scrape) with vector search
- Discord and Web chat interfaces with SSE streaming
- Unified AI reasoning: LLM receives KB context + live API data simultaneously
- Multi-API integration management with endpoint CRUD
- BYOK OpenAI support + Emergent Universal Key fallback

## Architecture
- **Backend**: FastAPI on port 8001, MongoDB
- **Frontend**: React SPA on port 3000
- **AI**: Emergent Universal Key (Claude/GPT), BYOK OpenAI
- **Integrations**: Discord.py, external REST APIs

## Key DB Collections
- `api_integrations`: integration configs with encrypted credentials
- `api_endpoints`: endpoint definitions with schemas, parameters, docs
- `api_diagnostics_history`: diagnostic run results with timestamps, pass/fail
- `llm_usage`: LLM token tracking per API key
- `api_request_logs`: external API call logs

## Implemented Features (Completed)

### Phase 1 — Core Platform
- Multi-tenant bot instances with admin/user roles
- Knowledge Base ingestion and vector search
- Discord bot integration with shared bot architecture
- Web chat widget with SSE streaming
- Bot configuration (personality, knowledge gate, tone examples)

### Phase 2 — API Integration System
- Multi-API integration CRUD with encrypted credentials
- Endpoint management with OpenAPI/Swagger auto-discovery
- Smart connection probing (tests doc URLs and endpoints, not just root)
- Unified AI orchestrator: LLM routes questions → selects endpoints → executes APIs → merges KB+API context
- API request logging and activity tracking

### Phase 3 — LLM Configuration
- BYOK OpenAI API keys with custom model selection
- API key analytics dashboard (token usage, costs, latency)
- Emergent Universal Key as default provider

### Phase 4 — API Intelligence Diagnostics (Nov 2026)
- **Passive Documentation Scan** (FREE): Response schema coverage, field description coverage, parameter documentation, endpoint descriptions, response examples, error documentation
- **AI Endpoint Discovery Test** (LLM tokens): Natural-language question → LLM selects endpoints
- **Endpoint Execution Test** (API call): Executes real endpoint, validates response against schema
- **Unified KB+API Reasoning Test** (LLM + API): Full pipeline trace with LLM context verification
- **Instance-Wide Summary**: KB sources, integrations, endpoints, doc coverage, LLM provider, last unified test
- **Diagnostic History**: Timestamped records of all diagnostic runs

### Phase 4.1 — Diagnostics Accuracy Fix (Nov 2026)
- Generic schemas (`{type: "object"}` without properties) correctly NOT counted as covered
- Contextual warnings for "no fields defined" in field description metrics

### Phase 4.2 — Response Size Limits & Connection Probing Fix (Nov 2026)
- **Root cause**: `safe_api_request` enforced a hard 500KB limit on ALL responses. The enriched GridScan OpenAPI spec is 578KB, which caused "Response too large" failures on test-connection (which probed the doc URL).
- **Fix**: Introduced `MAX_DOC_RESPONSE_SIZE` (2MB) for documentation downloads; `MAX_RESPONSE_SIZE` (500KB) preserved for ordinary API execution.
- **Connection probing**: Now prefers parameter-free endpoints (e.g., `/api/assets`) over parameterised ones (e.g., `/api/accounts/{stake_address}`). When parameterised endpoints must be used, extracts example/default values from the parameter schema instead of using "test" as a placeholder. Distinguishes expected 400/404 validation failures from actual connectivity failures.
- **Regression tests**: 14 new tests covering large OpenAPI docs, normal API size limits, schema validation, diagnostic accuracy, and doc import.

## Backlog
- P2: Refactor server.py into modular route files (/routes, /models, /services)
- P2: APP_MODE env splitting (worker vs api)
- P2: Multi-server Discord feature
