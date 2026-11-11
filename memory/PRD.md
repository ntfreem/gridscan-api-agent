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

## Implemented Features

### Phase 1–16 (Previously Completed)
Core platform, API integrations, LLM config, diagnostics, pipeline fixes, scraper improvements, conversations, knowledge gate, KB export/import, GitHub crawler, file filters, widget theming, embed.js, integration analytics, welcome messages, bot logo upload, rich markdown formatting.

### Phase 17 — Copy Button UX Fix (Nov 2026)
- Minimal 12px clipboard icon outside message bubble, hover-only, code block copy icon-only

### Phase 18 — Telegram Bot Integration (Nov 2026)
- Backend `telegram_routes.py`: Config CRUD, token validation, webhook auto-registration
- Listen modes: `all`, `mention_or_command`, `dm_only` (admin-configurable per instance)
- AI pipeline: KB search + API query + LLM response, saved as platform="telegram"
- Frontend `TelegramSettings.js`: Token input, connect/disconnect, mode selector, active toggle

### Phase 19 — Platform Stats Dashboard (Nov 2026)
- **Analytics Upgrade**: `/api/analytics/overview` now returns `platform_breakdown` with Web, Discord, Telegram, API counts
- **Daily Trend Endpoint**: New `GET /api/analytics/daily-by-platform` returns 7-day array with per-platform message counts
- **Dashboard Redesign**: 
  - 4 platform breakdown cards (Web, Discord, Telegram, API) with distinct colors and icons
  - Grouped bar trend chart "Messages — Last 7 Days" with color-coded platform legend
  - Quick Actions row with "Connect Telegram" button
  - PlatformBadge supports all 4 platforms in conversation table

### Phase 20 — Telegram Rich Replies (Nov 2026)
- **AI-Driven Contextual Buttons**: System prompt instructs LLM to optionally append `[SUGGESTIONS: q1 | q2 | q3]` when contextually appropriate
- **Suggestion Parser**: `_parse_suggestions()` extracts up to 3 follow-up questions, strips the tag from the displayed response
- **Inline Keyboard**: Suggestions rendered as Telegram inline keyboard buttons (vertically stacked)
- **Callback Handler**: Button taps trigger `callback_query` → acknowledged + processed as new question through full AI pipeline
- **Smart Behavior**: LLM only includes suggestions when they add value (factual answers, data, concepts) — not for greetings or simple acknowledgements

## Backlog
- P1: Zendesk integration (auto-reply + agent-assist sidebar, admin toggle)
- P2: Refactor server.py into modular route files (/routes, /models, /services)
- P2: APP_MODE env splitting (worker vs api)
- P2: Multi-server Discord feature
