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
- **Backend**: New `zendesk_routes.py` module with:
  - `GET /api/admin/zendesk-config` — Fetch per-instance config (token masked)
  - `PUT /api/admin/zendesk-config` — Save/update credentials (validates against Zendesk API)
  - `DELETE /api/admin/zendesk-config` — Disconnect and clean up
  - `POST /api/admin/zendesk-config/test` — Test saved credentials
  - `GET /api/admin/zendesk-config/webhook-url` — Return webhook URL for Zendesk trigger setup
  - `GET /api/admin/zendesk-tickets` — Recent processed tickets
  - `POST /api/zendesk/webhook/{instance_id}/{secret}` — Public webhook for new ticket events
  - `GET /api/zendesk/suggestion/{instance_id}/{ticket_id}` — Public endpoint for ZAF sidebar app
- **Auth**: API token auth (`email/token:token`) — validated via `/users/me.json`
- **Auto-Reply Mode**: Posts public AI comment + internal audit note, tags `ai_processed` + `bridgebot`
- **Agent-Assist Mode**: Stores AI suggestion in `zendesk_suggestions` collection for sidebar retrieval
- **Both modes independently toggleable** by admin with visual toggle switches
- **Event Deduplication**: `zendesk_events` collection prevents duplicate processing
- **AI Pipeline**: Full BridgeBot pipeline (KB + APIs) + Zendesk-specific system prompt additions
- **Frontend**: `ZendeskSettings.js` admin page with:
  - Connection card (subdomain with `.zendesk.com` suffix, email, API token)
  - Auto-Reply toggle with warning about public responses
  - Agent-Assist toggle
  - Active/Paused status toggle
  - Webhook URL display with copy button
  - Link to Zendesk Triggers page
  - Recent Processed Tickets list with action badges
  - "How It Works" guide
- **Navigation**: "Zendesk" nav item with Headphones icon
- **Dashboard**: Zendesk added to platform cards, trend chart, and platform breakdown
- **Conversations**: Zendesk filter button added

## DB Collections (Zendesk)
- `zendesk_config`: {instance_id (unique), subdomain, email, api_token, webhook_secret, auto_reply_enabled, agent_assist_enabled, is_active}
- `zendesk_suggestions`: {instance_id, ticket_id (unique per instance), subject, suggestion, action_taken}
- `zendesk_events`: {instance_id, event_id (unique per instance), ticket_id, received_at}

## Backlog
- P2: Refactor server.py into modular route files (/routes, /models, /services)
- P2: APP_MODE env splitting (worker vs api)
- P2: Multi-server Discord feature
