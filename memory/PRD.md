# BridgeBot — Product Requirements Document

## Product Overview
Multi-tenant SaaS chatbot platform enabling AI-powered Discord, Web, Telegram, and Zendesk bots with Knowledge Base, multi-API integrations, and unified AI reasoning.

## Core Requirements
- Multi-tenant bot instance management with admin dashboard
- Knowledge Base ingestion (text, PDF, web scrape) with vector search
- Discord, Web, Telegram, and Zendesk chat interfaces
- Unified AI reasoning: LLM receives KB context + live API data simultaneously
- Multi-API integration management with endpoint CRUD
- BYOK OpenAI support + Emergent Universal Key fallback

## Architecture
- **Backend**: FastAPI on port 8001, MongoDB
- **Frontend**: React SPA on port 3000
- **AI**: Emergent Universal Key (Claude/GPT), BYOK OpenAI
- **Integrations**: Discord.py, Telegram Bot API, Zendesk REST API, external REST APIs

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
- Analytics upgrade with `platform_breakdown` (Web, Discord, Telegram, API, Zendesk)
- Daily trend endpoint: `GET /api/analytics/daily-by-platform` (7-day per-platform message counts)
- Dashboard: platform cards, grouped bar trend chart, Quick Actions with "Connect Telegram"

### Phase 20 — Telegram Rich Replies (Nov 2026)
- AI-driven contextual inline keyboard buttons (1-3 follow-up suggestions)
- Suggestion parser: `_parse_suggestions()` extracts from `[SUGGESTIONS: ...]` tags
- Callback handler: button taps processed as new questions through full AI pipeline

### Phase 21 — Conversation Platform Filters (Nov 2026)
- Added Telegram, API, Zendesk filter buttons to Conversations page
- Updated PlatformBadge to support all 5 platforms with distinct colors

### Phase 22 — Zendesk Integration (Nov 2026)
- **Backend**: New `zendesk_routes.py` module with config CRUD, webhook, auto-reply, agent-assist
- **Auth**: API token auth (`email/token:token`) — validated via `/users/me.json`
- **Auto-Reply Mode**: Posts public AI comment + internal audit note
- **Agent-Assist Mode**: Stores AI suggestion for sidebar retrieval
- **Frontend**: `ZendeskSettings.js` admin page with toggles, webhook URL, processed tickets

### Phase 23 — Documentation, Onboarding & Changelog (Nov 2026)
- Updated site documentation to reflect all new channels and architecture
- Built Onboarding Wizard for guided first-time admin setup
- Admin-editable Changelog page
- Search bar on Docs page

### Phase 24 — Homepage Redesign (Feb 2026)
- **New marketing landing page** at root `/` route replacing the previous redirect to `/admin`
- **File**: `/app/frontend/src/pages/LandingPage.js`
- **11 sections**: Navbar, Hero, Channels, Knowledge Base, Live API Data, Zendesk, Widget Customization, Dashboard & Analytics, How It Works, FAQ, Final CTA, Footer
- **Color palette**: Midnight Blue (#0B1020 bg, #131D30 surfaces, #2A3850 borders, #EDF3FF primary text, #A7B7D0 secondary, #3B82F6 action blue, #83ADFF electric highlights, #63E2EE cyan accents)
- **Typography**: Outfit (headings), IBM Plex Sans (body), JetBrains Mono (mono)
- **Interactive elements**: FAQ accordion, Zendesk mode toggle, Widget color picker
- **CTAs**: All linked to existing routes (/register, /login, /chat, /docs)
- **Responsive**: Mobile hamburger nav, grid layouts adapt at breakpoints
- **Accessibility**: Reduced-motion support, keyboard-navigable, semantic HTML
- **Testing**: 100% pass rate (25/25 tests) — all sections, CTAs, interactivity, and existing routes verified

## DB Collections (Zendesk)
- `zendesk_config`: {instance_id (unique), subdomain, email, api_token, webhook_secret, auto_reply_enabled, agent_assist_enabled, is_active}
- `zendesk_suggestions`: {instance_id, ticket_id (unique per instance), subject, suggestion, action_taken}
- `zendesk_events`: {instance_id, event_id (unique per instance), ticket_id, received_at}

## Backlog
- P1: WhatsApp Integration (MUST use integration_playbook_expert_v2)
- P2: Refactor server.py into modular route files (/routes, /models, /services)
- P2: APP_MODE env splitting (worker vs api)
- P2: Multi-server Discord feature
