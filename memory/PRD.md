# BridgeBot — Product Requirements Document

## Product Overview
Multi-tenant SaaS chatbot platform enabling AI-powered Discord, Web, and Telegram bots with Knowledge Base, multi-API integrations, and unified AI reasoning.

## Core Requirements
- Multi-tenant bot instance management with admin dashboard
- Knowledge Base ingestion (text, PDF, web scrape) with vector search
- Discord, Web, and Telegram chat interfaces with SSE streaming
- Unified AI reasoning: LLM receives KB context + live API data simultaneously
- Multi-API integration management with endpoint CRUD
- BYOK OpenAI support + Emergent Universal Key fallback

## Architecture
- **Backend**: FastAPI on port 8001, MongoDB
- **Frontend**: React SPA on port 3000
- **AI**: Emergent Universal Key (Claude/GPT), BYOK OpenAI
- **Integrations**: Discord.py, Telegram Bot API, external REST APIs

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
- Smart connection probing
- Unified AI orchestrator: LLM routes questions → selects endpoints → executes APIs → merges KB+API context
- API request logging and activity tracking

### Phase 3 — LLM Configuration
- BYOK OpenAI API keys with custom model selection
- API key analytics dashboard (token usage, costs, latency)
- Emergent Universal Key as default provider

### Phase 4 — API Intelligence Diagnostics
- Passive Documentation Scan, AI Discovery Test, Execution Test, Unified KB+API Reasoning Test
- Instance-Wide Summary, Diagnostic History, Documentation Gap Report

### Phase 5 — Critical Pipeline Fixes (Nov 2026)
- Bug 1-6: Fixed NO_KB bail-out, system prompt, endpoint truncation, curl recitation, API capability summary, Brotli encoding

### Phase 6 — Scraper Improvements & Content Viewer
- Sub-page crawler, content viewer, selective/bulk re-scrape, SSE progress, search quality boost

### Phase 7 — Conversations Bug Fix (Nov 2026)
- Fixed conversations UI not updating (instance_id resolution)

### Phase 8 — Conversations Enhancements & Knowledge Gate Slider
- Auto-refresh feed, conversation search, 0-100% graduated knowledge gate slider

### Phase 9 — Gate Presets, KB Export/Import/Share
- Gate presets, KB export/import, share KB across bot instances

### Phase 10 — GitHub Repository Crawler
- GitHub Crawler tab, scan/filter/import docs from repos, SSE progress

### Phase 11 — Smart File Filters, Widget Theming, Markdown Fix
- Extension toggle filters, widget theme URL params, markdown rendering fix

### Phase 12 — Embed.js Launcher Script & Theme Configurator
- Self-contained embed.js, theme configurator with 5 presets, 3 embed methods

### Phase 13 — Integration Usage Analytics
- Outbound integration analytics (Gridscan), per-integration breakdown, daily timeline

### Phase 14 — Custom Welcome Message & Auto-Expand Widget
- Configurable welcome message, default-open mode, embed.js data attributes

### Phase 15 — Bot Logo / Avatar Upload
- Emergent Object Storage, upload/remove/sync-to-Discord, widget logo display

### Phase 16 — Rich Markdown Formatting for API Responses
- Card-style markdown for blockchain data from Gridscan API

### Phase 17 — Copy Button UX Fix (Nov 2026)
- Minimal 12px clipboard icon outside message bubble, hover-only, code block copy icon-only

### Phase 18 — Telegram Bot Integration (Nov 2026)
- **Backend**: New `telegram_routes.py` module with:
  - `GET /api/admin/telegram-config` — Fetch per-instance config (token masked)
  - `PUT /api/admin/telegram-config` — Save/update token, listen mode, active status
  - `DELETE /api/admin/telegram-config` — Disconnect and remove webhook
  - `POST /api/admin/telegram-config/test` — Validate saved token with Telegram API
  - `POST /api/telegram/webhook/{instance_id}/{secret}` — Public webhook receiver
- **Token Validation**: `getMe` API call validates token before saving
- **Webhook Auto-Registration**: Webhook URL registered/unregistered automatically on connect/disconnect/toggle
- **Listen Modes**: Admin-configurable per instance:
  - `all` — Responds to every message in groups and DMs
  - `mention_or_command` — @mention, `/ask` command, reply-to-bot, or DMs
  - `dm_only` — Private conversations only
- **AI Pipeline**: Messages processed through full BridgeBot pipeline (KB search → API query → LLM response)
- **Conversations**: Saved with `platform: "telegram"`, visible in Conversations tab
- **Frontend**: `TelegramSettings.js` admin page with connection card, listen mode selector, active toggle
- **Navigation**: "Telegram" nav item with Send icon in sidebar
- **DB**: `telegram_config` collection with unique `instance_id` index

## Backlog
- P1: Zendesk integration (auto-reply + agent-assist sidebar, admin toggle)
- P2: Refactor server.py into modular route files (/routes, /models, /services)
- P2: APP_MODE env splitting (worker vs api)
- P2: Multi-server Discord feature
