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

**Bug 4 — LLM recites curl commands from KB instead of executing APIs (P0):**
`build_system_prompt` only checked the legacy `bot_config.api_query_enabled` flag to decide whether to tell the LLM it can call APIs. Newer instances use the `api_integrations` collection (checked via `has_api_integrations`), but this was never passed into the function. Result: the LLM was never told it could make API calls, so when KB contained API documentation with curl examples, it regurgitated them. Fixed: added `has_api_integrations` parameter to `build_system_prompt`, unified the gate (`api_query_enabled OR has_api_integrations`), added explicit anti-hallucination guardrails ("DO NOT recite curl commands or API docs"), updated all 4 call sites (streaming, non-streaming, v1 API, Discord). Also removed the harmful fallback text "help the user with documentation and curl commands instead."

**Bug 5 — API Capability Summary for meta-questions:**
When the LLM router returned "none" (no specific API call needed), `_try_api_query` returned `None`, losing all endpoint information. The LLM then answered meta-questions ("how many endpoints do you have?") from incomplete KB docs instead of the live system. Fixed: when router returns "none" but endpoints exist, returns a capability summary with accurate endpoint counts and categories.

**Bug 6 — Brotli-encoded pages stored as binary garbage (P0):**
The URL scraper sent `Accept-Encoding: gzip, deflate, br` but the `brotli` library was not installed. When CDNs (cardano.org) returned Brotli-compressed responses, httpx couldn't decode them → `resp.text` interpreted compressed bytes as UTF-8 → stored as binary garbage. Fixed: installed `brotli` and `zstandard` packages. Added content quality guard that rejects content with >5% null/replacement bytes.

### Phase 6 — Scraper Improvements & Content Viewer (current)
- **Sub-page Crawler**: New `/api/knowledge/sources/url/crawl` endpoint crawls same-domain sub-pages up to configurable depth (1-3 levels, max 50 pages). Frontend toggle + depth selector in URL scraper form.
- **Content Viewer**: New full-page `/admin/knowledge/view` route shows the exact stored content per KB source, with search, part navigation, character stats, and corruption detection. Documents character limits (8K chunks, 60K context window, top-5 search, 2.5K per-source cap).
- **View Links**: KB source titles are clickable → opens content viewer. Eye icon button added per row.
- **Selective Re-scrape**: Per-source refresh button (circular arrow) on each URL row. Deletes old chunks and re-scrapes fresh content with spinner feedback. Endpoint: `POST /knowledge/sources/url/rescrape`.
- **Bulk Re-scrape**: "Refresh All URLs" button in KB sources header re-scrapes every URL source via SSE streaming with real-time progress bar showing current page, success/fail counts, and percent complete.
- **Crawl Progress Bar**: Sub-page crawling now uses SSE streaming with real-time progress bar instead of a simple spinner. Shows discovered sub-pages, current page being scraped, and success/fail counts.
- **Search Quality Boost**: `search_knowledge` limit bumped from 5 → 12 chunks per query. The 60K char context cap is the real constraint, giving broader recall without overflow.

## Backlog
- P2: Refactor server.py into modular route files (/routes, /models, /services)
- P2: APP_MODE env splitting (worker vs api)
- P2: Multi-server Discord feature
