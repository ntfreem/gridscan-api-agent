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
- **Passive Documentation Scan** (FREE): Response schema coverage, field description coverage, parameter documentation, endpoint descriptions, response examples, error documentation. Calculated from stored data — no API/LLM calls.
- **AI Endpoint Discovery Test** (LLM tokens): Natural-language question → LLM selects endpoints using real routing prompt. Shows candidate endpoints, selected endpoints, permission validation, correctness evaluation.
- **Endpoint Execution Test** (API call): Executes real endpoint, validates response against stored schema. Shows field-level validation, doc source, schema context preview.
- **Unified KB+API Reasoning Test** (LLM + API): Full pipeline trace — KB retrieval → endpoint discovery → LLM selection → permission validation → API execution → schema retrieval → context assembly → answer generation. LLM context verification shows what was included/missing.
- **LLM Context Verification**: Inspects actual assembled LLM prompt for KB content, API responses, endpoint info, schema info, field descriptions, units, error definitions, anti-fabrication rules. Redacted preview available.
- **Instance-Wide Summary**: KB sources, integrations, endpoints, doc coverage, LLM provider, last unified test.
- **Diagnostic History**: Timestamped records of all diagnostic runs with status, duration, error details.
- **Doc Source Identification**: Shows whether endpoint docs come from OpenAPI, custom references, or manual config.
- **Frontend**: Diagnostics panel per integration with 5 collapsible sections + instance summary bar. Clear cost tags (FREE/LLM TOKENS/API CALL/LLM+API).

## Backlog
- P2: Refactor server.py into modular route files (/routes, /models, /services)
- P2: APP_MODE env splitting (worker vs api)
- P2: Multi-server Discord feature
