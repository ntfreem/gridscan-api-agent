# BitBot Pro — Product Requirements Document

## Product Overview
BitBot Pro is a multi-tenant AI bot SaaS platform that connects to Discord, Telegram, Zendesk, and Web channels. It provides AI-powered knowledge assistants with a customizable knowledge base, API integrations, and conversation management.

## Core Architecture
- **Frontend**: React SPA with neon electric blue theme
- **Backend**: FastAPI (Python) with 140+ v1 endpoints + 20+ v2 endpoints
- **Database**: MongoDB Atlas
- **Channels**: Web Chat, Discord, Telegram, Zendesk, External API (v1)
- **LLM**: Claude/OpenAI via Emergent Universal Key
- **Storage**: Emergent Object Storage
- **Email**: Emergent Managed Resend

## v2 Data Model

### Collections
```
organisations    → {id, name, owner_id, member_ids, member_roles}
bots             → {id, org_id, name, persona, instructions, settings, legacy_instance_id}
connected_accounts → {id, org_id, provider, name, status, credentials (encrypted), metadata}
connections      → {id, org_id, bot_id, account_id, provider, destination, response_mode, overrides, override_flags, priority}
v2_suggestions   → {connection_id, bot_id, instance_id, platform, user_message, ai_suggestion, status, metadata}
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
        ├── Discord → Server A / #billing (agent_assist, same account)
        ├── Telegram → Customer group (auto_reply)
        └── Zendesk → Billing ticket group (internal_note)
```

### v2 API Endpoints
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v2/orgs` | GET/POST | List/create organisations |
| `/api/v2/orgs/{org_id}` | GET/PUT | Get/update org |
| `/api/v2/orgs/{org_id}/members` | GET/POST/DELETE/PATCH | Member management |
| `/api/v2/orgs/{org_id}/bots` | GET/POST | List/create bots |
| `/api/v2/orgs/{org_id}/bots/{bot_id}` | GET/PUT/DELETE | Bot CRUD |
| `/api/v2/orgs/{org_id}/bots/{bot_id}/settings` | GET/PUT | Bot behaviour |
| `/api/v2/orgs/{org_id}/accounts` | GET/POST | List/create accounts |
| `/api/v2/orgs/{org_id}/accounts/{id}` | GET/PUT | Account CRUD |
| `/api/v2/orgs/{org_id}/accounts/{id}/disconnect` | POST | Disconnect (warns) |
| `/api/v2/orgs/{org_id}/accounts/{id}/reconnect` | POST | Reconnect |
| `/api/v2/orgs/{org_id}/bots/{bot_id}/connections` | GET/POST | List/create connections |
| `/api/v2/orgs/{org_id}/bots/{bot_id}/connections/{id}` | GET/PUT | Connection CRUD |
| `/api/v2/orgs/{org_id}/bots/{bot_id}/connections/{id}/toggle` | PATCH | Enable/disable |
| `/api/v2/orgs/{org_id}/bots/{bot_id}/connections/{id}/activity` | GET | Activity + suggestions |

### Auth Pattern
- JWT auth via `Authorization: Bearer {token}`
- `X-Org-ID` header for org scoping
- Superadmins have implicit access to all orgs
- Credentials never sent raw to frontend (masked with `mask_credential()`)

### Migration
- Script: `/app/backend/migrate_v2.py` (repeatable, non-destructive)
- Legacy `instance_id` preserved as `bot.legacy_instance_id` for backward compat
- v1 endpoints fully preserved and functional alongside v2

## Completed Features

### Phase 1 — v2 Data Model & Backend (Done — Nov 2026)
- [x] 4 new collections with proper indexes
- [x] 5 new route files: `v2_helpers.py`, `org_routes.py`, `bot_routes.py`, `account_routes.py`, `connection_routes.py`
- [x] Migration script with repeatable, non-destructive data mapping
- [x] Overlap detection, override inheritance, effective_settings resolution
- [x] Tested: 100% pass (21/21 backend tests, iteration_64.json)

### Phase 2 — Navigation & Layout Restructure (Done — Nov 2026)
- [x] New AdminLayout with Org selector, Bot selector, section groups
- [x] Routes: `/admin/org/overview`, `/admin/bots`, `/admin/accounts`, `/admin/bot/:id/integrations`
- [x] Tested: 100% pass (8/8 frontend tests, iteration_65.json)

### Phase 3 — Core Pages: Connected Accounts + Integrations (Done — Nov 2026)
- [x] Connected Accounts: list, add, edit, disconnect with provider badges
- [x] Integrations: connection cards, Add Connection wizard, detail tabs
- [x] Override inheritance UI (use bot defaults vs custom)
- [x] Tested: included in iteration_65.json

### Phase 4 — Provider Routing & Webhook Updates (Done — Nov 2026)
- [x] New `webhook_router.py` module for V2 multi-route resolution
- [x] Discord handler updated: V2 route resolution → multi-route processing (auto_reply + agent_assist)
- [x] Telegram handler updated: V2 resolution with V1 fallback
- [x] Zendesk handler updated: V2 resolution with ticket group/tag filtering
- [x] Per-account rate limiting via asyncio.Semaphore (MAX_CONCURRENT_PER_ACCOUNT=3)
- [x] V2 suggestion storage for agent_assist/internal_note connections
- [x] Connection activity endpoint enhanced (returns activity + suggestions)
- [x] Connection_id and v2_bot_id tracked in conversation metadata
- [x] 13 unit tests for webhook router (all pass)
- [x] Tested: 100% pass (23/23 backend + 10/10 frontend, iteration_66.json)

### Zendesk Sidebar App (Done — Nov 2026)
- [x] On-demand AI suggestion generation for any ticket
- [x] ZAF v2 sidebar app with Generate/Regenerate/Copy/Insert controls
- [x] Per-instance sidebar API key management

### Earlier Completed Work
- Zendesk OAuth migration, Analytics Dashboard, Admin role management
- User email invitations, Landing page fixes
- Self-hosting readiness documentation
- Full branding update (BridgeBot → BitBot Pro)

## Pending / Upcoming Tasks

### Phase 5 — Platform Admin & Polish (P0)
- Provider Apps management page
- Workspaces & Users page (multi-org admin)
- Documentation updates
- V2 suggestions UI (display agent_assist suggestions in frontend)

### Backlog
- P0: GitHub Export for self-hosting migration
- P1: WhatsApp integration (use integration_playbook_expert_v2)
- P2: Backend refactor (server.py modularization)
- P2: APP_MODE env splitting (worker vs api)
- P2: Legacy v1 endpoint cleanup (after V2 fully operational)

## Production URLs
- Production: `https://bitbotpro.io`
- Preview: `https://rag-search-dev.preview.emergentagent.com`
