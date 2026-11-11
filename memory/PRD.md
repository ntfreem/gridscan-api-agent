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
- **Crawl Path Prefix Fix**: `_extract_subpage_urls` now uses parent directory as prefix (e.g. `/start-building/choose-your-tools/` → prefix `/start-building`), so sibling pages are correctly discovered. Previously used exact path which found 0 sub-pages for leaf URLs.
- **SSE Error Handling**: Frontend `consumeSSE` now checks `resp.ok` and surfaces HTTP errors instead of silently clearing the form.
- **Bulk Re-scrape**: "Refresh All URLs" button in KB sources header re-scrapes every URL source via SSE streaming with real-time progress bar showing current page, success/fail counts, and percent complete.
- **Crawl Progress Bar**: Sub-page crawling now uses SSE streaming with real-time progress bar instead of a simple spinner. Shows discovered sub-pages, current page being scraped, and success/fail counts.
- **Search Quality Boost**: `search_knowledge` limit bumped from 5 → 12 chunks per query. The 60K char context cap is the real constraint, giving broader recall without overflow.

### Phase 7 — Conversations Bug Fix (Nov 2026)
**Bug 7 — Conversations UI not updating (P0):**
Chat endpoints (`/chat/send`, `/chat/stream`) defaulted `instance_id` to `"default"` when not provided. The admin Conversations page queries by the real instance ID, so conversations from the Chat Demo page (which didn't pass `instance_id`) were invisible. Fixed: added `_resolve_chat_instance()` helper that resolves null/default to the first real instance from the DB. Also fixed Dashboard links ("Test Chat Demo", "start a chat demo") to include `?instance=<id>`. Migrated 4 existing "default" conversations to the real instance.

### Phase 8 — Conversations Enhancements & Knowledge Gate Slider (Nov 2026)
- **Auto-Refresh Feed**: Conversations page polls `GET /api/conversations/count` every 10 seconds. When new conversations arrive, a blue banner appears: "N new conversations — click to refresh". Clicking refreshes the list instantly.
- **Conversation Search**: Search bar above conversation list with backend regex search on `messages.content`. Case-insensitive, shows match count, has Clear button to reset.
- **Knowledge Gate Slider**: Replaced binary strict/flexible toggle with a 0-100% slider (step 5). Five graduated levels:
  - 0-20%: **Strict** — KB only, refuses all external questions
  - 21-40%: **Mostly Strict** — KB only, acknowledges gaps politely
  - 41-60%: **Balanced** — KB first, general knowledge with clear disclaimer
  - 61-80%: **Mostly Open** — KB preferred, general knowledge freely used
  - 81-100%: **Fully Open** — uses everything, KB is a trusted reference
  
  Gradient slider bar (red → amber → yellow → cyan → green), dynamic label and description, backward-compatible with legacy `knowledge_gate` string field.

### Phase 9 — Gate Presets, KB Export/Import/Share (Nov 2026)
- **Gate Presets**: Three quick-pick buttons above the slider — Conservative (10%), Balanced (50%), Open (85%). One click sets the slider and description. Active preset is highlighted with matching color border.
- **KB Export**: `GET /api/knowledge/export` returns portable JSON (strips instance_id). Frontend button triggers file download as `kb-export-YYYY-MM-DD.json`.
- **KB Import**: `POST /api/knowledge/import` accepts sources array + optional `overwrite` flag. Overwrite uses soft-delete (deactivates existing sources with `archived_at` timestamp). Merge mode skips duplicates by ID.
- **Share KB Across Bots**: `POST /api/knowledge/share` copies selected or all sources to another instance. Modal picker shows all available instances. Group IDs are regenerated for target instance to maintain chunked source grouping. Bulk action bar includes "Share Selected" button.

### Phase 10 — GitHub Repository Crawler (Nov 2026)
- **GitHub Crawler Tab**: New "GitHub Crawler" tab in Knowledge Base alongside FAQ, URL Scraper, and Upload Document.
- **Scan**: `POST /api/knowledge/sources/github/scan` uses GitHub's tree API to recursively list all files, then filters for documentation (`.md`, `.rst`, `.txt`, `README`, `CHANGELOG`, `CONTRIBUTING`, files in `docs/`, `wiki/`, etc.). Auto-detects default branch.
- **File Preview**: Scan results show scrollable list with checkboxes, file paths, auto-assigned category badges (Overview, Docs, Changelog, Examples, etc.), and file sizes. Select All / Deselect All toggle.
- **Import**: `POST /api/knowledge/sources/github/import-stream` uses SSE to stream progress. Downloads raw content, preserves code blocks in Markdown, chunks large files using `_split_into_chunks`. Sources stored with `type="github"` and metadata (`source_repo`, `source_branch`, `source_path`).
- **Private Repos**: Optional GitHub token field for accessing private repositories.

### Phase 11 — Smart File Filters, Widget Theming, Markdown Fix (Nov 2026)
- **Smart File Filters**: Extension toggle buttons (dynamically generated from scan results: `.md`, `.rst`, `.txt`, etc.) and max size dropdown (10KB, 50KB, 100KB, 500KB, No limit). "Clear Filters" button resets all. Select All only selects visible (filtered) files.
- **Widget Theme URL Parameters**: Embed URL accepts color params: `accent`, `accentLight`, `bg`, `surface`, `panel`, `text`, `textSecondary`, `border`, `userBubble`, `botBubble`, `inputBg`, `font`, `radius`. Applied via CSS custom properties. Example: `/widget?instance=...&accent=%237C3AED&bg=%230B0A1A`.
- **Markdown Rendering Fix**: MarkdownMessage component rewritten with `compact` mode for narrow widgets. Tables use `table-layout: fixed` with `word-break: break-word` on cells. Code blocks contained with `overflow-x: auto` and `pre-wrap`. Bubble CSS changed from `white-space: pre-wrap` to `overflow-wrap: anywhere` to prevent markdown conflicts.
- **Chat-Friendly System Prompt**: Added instructions to prefer vertical `**Field:** Value` key-value lists over tables for narrow chat. Truncate long hashes/addresses with inline code backticks.

### Phase 12 — Embed.js Launcher Script & Theme Configurator (Nov 2026)
- **Embed.js Script**: Self-contained `<script>` tag launcher. Reads `data-*` attributes from the script tag for instance, mode, position, and 13 theme color params. Injects a floating chat button (56px, bottom-right) with CSS pulse animation, expandable iframe panel (380x580px) with slide-up animation, and close/open toggle. Mobile responsive (full-screen at <480px).
- **Theme Configurator**: Redesigned Embed Code admin page with:
  - 5 built-in presets: Default Dark, Violet Cyber, Ocean Blue, Emerald, Rose
  - 8 color inputs: Accent, Accent Light, Background, Surface, Panel, Border, User Bubble, Bot Bubble
  - Live preview iframe that updates when theme changes
  - Code snippets auto-update with `data-*` theme attributes
  - 3 embed methods: Popup Widget, Inline Embed, Full Page
  - Direct URLs section with full theme query strings

## Backlog
- P0: ~~API Key Usage Analytics — Add integration usage stats~~ ✅ DONE (Nov 2026)
- P0: ~~API Key Analytics — Per-key integration breakdown with dates and call counts~~ ✅ DONE (Nov 2026)
- P1: Scope and integrate Telegram, WhatsApp, and Zendesk channels
- P2: Refactor server.py into modular route files (/routes, /models, /services)
- P2: APP_MODE env splitting (worker vs api)
- P2: Multi-server Discord feature

### Phase 13 — Integration Usage Analytics (Nov 2026)
- **New Backend Endpoint**: `GET /api/admin/integration-usage-analytics?days=N` aggregates data from `api_request_logs` collection. Returns per-integration breakdown (name, calls, success/fail, avg latency, data transferred, success rate), daily call timeline, top endpoints by call count, error breakdown, and recent request log.
- **Unified Usage Analytics Page**: Renamed "API Key Usage" page header to "Usage Analytics". Below existing API key analytics, added "External Integration Usage" collapsible section showing:
  - Summary stat cards (Total Calls, Successful, Failed)
  - Per-integration cards with name, call count, avg latency, data transferred, success rate badge, base URL
  - Integration Calls Over Time bar chart
  - Top Endpoints table with integration name, endpoint path, call count, avg latency
  - Integration Errors section
  - Recent Integration Calls log with timestamps, integration names, endpoints, HTTP status badges, latency


### Phase 14 — Custom Welcome Message & Auto-Expand Widget (Nov 2026)
- **Widget Behavior Config**: Added `welcome_message` (string) and `default_open` (boolean) to `embed_configs` collection. Backend `EmbedConfigUpdate` model accepts both fields. `GET /api/embed/config/{id}` returns them; `PUT /api/admin/embed-config` saves them.
- **embed.js Enhancements**: Added `data-welcome` and `data-open` attribute support. Script fetches config from `/api/embed/config/{id}` for server-saved values. When `data-open="true"` or config has `default_open`, popup auto-expands on page load.
- **ChatWidget.js**: Reads `welcome` URL param and displays it as the initial bot message (rendered with markdown). Falls back to embed config `welcome_message`. Old static "Hi! How can I help?" replaced with configurable greeting.
- **EmbedCode.js Admin UI**: New "Widget Behavior" card above Theme Configurator with Expand on Load toggle, Welcome Message textarea (markdown), and Save Configuration button.


### Phase 15 — Bot Logo / Avatar Upload (Nov 2026)
- **Object Storage**: Integrated Emergent Managed Object Storage for file uploads. Init on startup with `CLAUDE_API_KEY`.
- **Backend Endpoints**: `POST /api/admin/bot-logo` (upload, max 2MB, PNG/JPEG/WebP/GIF), `GET /api/bot-logo/{instance_id}` (public serve with caching), `DELETE /api/admin/bot-logo` (soft-delete), `POST /api/admin/bot-logo/discord-sync` (pushes logo as Discord bot avatar via Discord API).
- **Bot Settings UI**: New "Bot Avatar" section in Identity card. Shows avatar preview, Upload/Replace, Remove, and "Sync to Discord" buttons.
- **ChatWidget**: Logo replaces default Bot icon in header avatar, bot message avatars, typing indicator, and empty state. Falls back to Bot icon when no logo uploaded.
- **embed.js**: Trigger button probes `/api/bot-logo/{instance}` on load; shows logo if available, falls back to chat SVG.
