# BitBot Pro — Product Requirements Document

## Product Overview
BitBot Pro is a multi-tenant AI bot SaaS platform that connects to Discord, Telegram, Zendesk, and Web channels. It provides AI-powered knowledge assistants with a customizable knowledge base, API integrations, and conversation management.

## Core Architecture
- **Frontend**: React SPA with neon electric blue theme
- **Backend**: FastAPI (Python) with 170 paths / 190+ operations (v1 legacy + v2 multi-tenant)
- **Database**: MongoDB Atlas (29 collections)
- **Channels**: Web Chat, Discord, Telegram, Zendesk, External API (v1)
- **LLM**: Claude/OpenAI via Emergent Universal Key
- **Storage**: Emergent Object Storage
- **Email**: Emergent Managed Resend

## v2 Data Model

### Collections
```
organisations      → {id, name, owner_id, member_ids, member_roles}
bots               → {id, org_id, name, persona, instructions, settings, legacy_instance_id}
connected_accounts → {id, org_id, provider, name, status, credentials (encrypted), metadata}
connections        → {id, org_id, bot_id, account_id, provider, destination, response_mode, overrides, priority}
v2_suggestions     → {_id, connection_id, bot_id, instance_id, platform, user_message, ai_suggestion, status}
```

### Hierarchy
```
Organisation
├── Members (users with org-level roles)
├── Connected Accounts (reusable provider identities)
│   ├── Discord Bot identity
│   ├── Telegram Bot identity
│   └── Zendesk OAuth account
└── Bots (AI assistants)
    ├── Bot Settings (persona, KB, LLM config)
    └── Connections (routes to destinations)
        ├── Discord → Server A / #general-help (auto_reply)
        ├── Discord → Server A / #billing (agent_assist → suggestions inbox)
        ├── Telegram → Customer group (auto_reply)
        └── Zendesk → Billing ticket group (internal_note)
```

### v2 API Endpoints
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v2/orgs` | GET/POST | List/create organisations |
| `/api/v2/orgs/{org_id}` | GET/PUT | Get/update org |
| `/api/v2/orgs/{org_id}/members` | GET/POST/DELETE/PATCH | Member management |
| `/api/v2/orgs/{org_id}/overview` | GET | Org-scoped overview metrics |
| `/api/v2/orgs/{org_id}/bots` | GET/POST | List/create bots |
| `/api/v2/orgs/{org_id}/bots/{bot_id}` | GET/PUT/DELETE | Bot CRUD |
| `/api/v2/orgs/{org_id}/bots/{bot_id}/settings` | GET/PUT | Bot behaviour |
| `/api/v2/orgs/{org_id}/bots/{bot_id}/suggestions` | GET | List AI suggestions |
| `/api/v2/orgs/{org_id}/bots/{bot_id}/suggestions/{id}` | PATCH | Accept/dismiss suggestion |
| `/api/v2/orgs/{org_id}/accounts` | GET/POST | List/create accounts |
| `/api/v2/orgs/{org_id}/accounts/{id}` | GET/PUT | Account CRUD |
| `/api/v2/orgs/{org_id}/accounts/{id}/disconnect` | POST | Soft-disconnect |
| `/api/v2/orgs/{org_id}/accounts/{id}/reconnect` | POST | Re-activate |
| `/api/v2/orgs/{org_id}/bots/{bot_id}/connections` | GET/POST | List/create connections |
| `/api/v2/orgs/{org_id}/bots/{bot_id}/connections/{id}` | GET/PUT | Connection CRUD |
| `/api/v2/orgs/{org_id}/bots/{bot_id}/connections/{id}/toggle` | PATCH | Enable/disable |
| `/api/v2/orgs/{org_id}/bots/{bot_id}/connections/{id}/activity` | GET | Activity + suggestions |
| `/api/v2/platform/stats` | GET | Platform-wide statistics |
| `/api/v2/platform/workspaces` | GET | All orgs with stats |
| `/api/v2/platform/workspaces/{org_id}/detail` | GET | Org detail (members, bots, accounts) |
| `/api/v2/platform/provider-apps` | GET | Provider account/connection breakdown |

## Completed Features — V2 Architecture (All 5 Phases)

### Phase 1 — v2 Data Model & Backend (Done — Nov 2026)
- [x] 4 new collections with proper indexes
- [x] 5 new route files + migration script
- [x] Tested: 100% pass (iteration_64.json)

### Phase 2 — Navigation & Layout Restructure (Done — Nov 2026)
- [x] AdminLayout with Org/Bot selectors, section groups
- [x] Tested: 100% pass (iteration_65.json)

### Phase 3 — Core Pages: Connected Accounts + Integrations (Done — Nov 2026)
- [x] Connected Accounts: list, add, edit, disconnect
- [x] Integrations: connection cards, Add Connection wizard
- [x] Tested: included in iteration_65.json

### Phase 4 — Provider Routing & Webhook Updates (Done — Nov 2026)
- [x] `webhook_router.py` — V2 multi-route resolution engine
- [x] Discord/Telegram/Zendesk handlers updated with V2 routing + V1 fallback
- [x] Per-account rate limiting, V2 suggestion storage, connection_id tracking
- [x] Tested: 100% pass (iteration_66.json)

### Phase 5 — Platform Admin & Polish (Done — Nov 2026)
- [x] **Provider Apps page** (`/admin/platform/provider-apps`) — platform-wide provider stats
- [x] **Workspaces & Users page** (`/admin/platform/workspaces`) — cross-org admin dashboard with expandable detail
- [x] **Suggestions Inbox** (`/admin/bots/:botId/suggestions`) — agent review panel with accept/dismiss/copy
- [x] `platform_routes.py` — 4 new admin endpoints
- [x] Suggestions list + update endpoints in `connection_routes.py`
- [x] Tested: 100% pass (iteration_67.json)

### UI/UX Polish (Done — Nov 2026)
- [x] Discord guided setup panel in ConnectedAccounts.js (matches DiscordAppSetup.js design)
- [x] Zendesk guided setup & settings panel in ConnectedAccounts.js (matches ZendeskSettings.js design — Connection card, Integration Status, Response Mode toggles)
- [x] Telegram guided setup & settings panel in ConnectedAccounts.js (Connection card, masked token, Test button, Save/Reconnect/Disconnect)
- [x] Provider Cards grid — 3 cards (Discord, Telegram, Zendesk) always visible with Connected/Disconnected/Connect badges, one account per org per provider
- [x] Separate sidebar nav items for Discord, Telegram, Zendesk (replaces single "Connected Accounts" link), each at /admin/accounts/:provider
- [x] Discord two-column layout always visible: Current Config (2x2 credential badges + timestamp) + Setup Guide (matching old DiscordAppSetup.js)
- [x] Organisation management page with CRUD
- [x] Sidebar org/bot selectors, UserPopover, Platform Admin sections
- [x] API scraper merged into Knowledge Base tab
- [x] Integrations page redesign: 3 provider cards (Discord, Telegram, Zendesk) with one connection per bot per provider
- [x] Discord Bot detail: two-column layout with Connect card + invite link (left), Bot Status + Configuration + Listen Mode (right)
- [x] Discord Bot detail production features: Reply Style, Passive Mode toggle, Scripted Mode toggle, Human Takeover (staff role, cooldown, resume command, follow-up message, handoff channels), Setup Guide, Save Configuration, Start Bot — Tested: 100% pass (iteration_72.json)
- [x] Discord Bot detail production-matching layout: 50/50 grid, invite link always visible with fallback warning, production-accurate descriptions, section icons (Eye, Code, Users), Open Discord Developer Portal link, helper text under all fields, Save + Start side-by-side layout
- [x] Discord Bot detail full production parity: Bot Status card (live polling), Specific Channels fetch+select, live handoff status, Start Bot (restart), Resume Bot Now (handoff-resume), OAuth invite flow, Passive/Scripted Mode Active badges + tip, Save syncs V2+V1
- [x] Telegram detail view: production-matching with @BotFather info, token input + show/hide, connect flow, test/enable buttons, response mode badge
- [x] Zendesk detail view: full production parity — Connection (status, email, scopes, test/reconnect/disconnect), Integration Status badge, Response Mode (Auto-Reply + Agent Assist toggles), Webhook Setup (URL + copy + Zendesk Triggers link), Sidebar App (download, install steps, API key + regenerate), How it Works section

### Self-Hosting Readiness Docs (Done — Nov 2026)
- [x] Complete API Inventory (190+ endpoints, v1 + v2)
- [x] Frontend-Backend API Map (v1 api.js + v2 v2api.js)
- [x] Environment Variables doc with .env.example files
- [x] Emergent Dependencies with replacement strategies
- [x] Channel Integrations audit with V2 webhook router
- [x] Migration Readiness report
- [x] OpenAPI 3.1 spec export (openapi.json)
- [x] Updated README.md for GitHub export

### Earlier Completed Work
- Zendesk OAuth, ZAF sidebar app, Analytics, Admin roles
- User email invitations, Landing page, Self-hosting docs
- Full branding (BridgeBot → BitBot Pro)

## Pending / Upcoming Tasks

### Backlog
- P0: GitHub Export — push to GitHub and use Claude Code for self-hosting migration (DO NOT remove Emergent dependencies until user instructs)
- P1: WhatsApp integration (use integration_playbook_expert_v2)
- P2: Backend refactor — server.py modularization, extract v1 routes into separate modules
- P2: APP_MODE env splitting (worker vs api)
- P2: Legacy v1 endpoint cleanup (after V2 fully operational)

## Production URLs
- Production: `https://bitbotpro.io`
- Preview: `https://rag-search-dev.preview.emergentagent.com`
