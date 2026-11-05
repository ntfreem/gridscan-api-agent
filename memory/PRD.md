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
- Smart connection probing (prefers param-free endpoints, uses example values, 2MB doc limit)
- Unified AI orchestrator: LLM routes questions → selects endpoints → executes APIs → merges KB+API context
- API request logging and activity tracking

### Phase 3 — LLM Configuration
- BYOK OpenAI API keys with custom model selection
- API key analytics dashboard (token usage, costs, latency)
- Emergent Universal Key as default provider

### Phase 4 — API Intelligence Diagnostics
- Passive Documentation Scan, AI Discovery Test, Execution Test, Unified KB+API Reasoning Test
- Instance-Wide Summary, Diagnostic History, Documentation Gap Report (exportable Markdown)

### Phase 5 — Critical Pipeline Fixes (Nov 2026)
**Bug 1 — __NO_KB__ bail-out blocked ALL API calls:**
All 4 chat paths (streaming, non-streaming, v1 API, Discord) returned a hard-coded "no KB" message and exited before reaching `_try_api_query`. Fixed: only bail when no KB AND no enabled API integrations exist.

**Bug 2 — build_system_prompt refused questions when no KB + API data:**
`__NO_KB__` forced the LLM to refuse ALL questions even when API context was provided. Fixed: when no KB but API data is present, the system prompt instructs the LLM to use the API data.

**Bug 3 — Endpoint listing truncation hid 60+ endpoints from LLM:**
With enriched documentation, the endpoint listing grew to 33,745 chars but was truncated at 12,000. All `txs`, `pools`, `scripts` and later-alphabet endpoints were invisible. Fixed: compact listing format (33K → 10K chars) drops optional parameter details and descriptions, keeping only path params and required query params. Raised limit to 30K.

## Backlog
- P2: Refactor server.py into modular route files (/routes, /models, /services)
- P2: APP_MODE env splitting (worker vs api)
- P2: Multi-server Discord feature
