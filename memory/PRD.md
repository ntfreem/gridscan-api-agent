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

## v2 Data Model (NEW — Phase 1 Complete)

### Collections
```
organisations    → {id, name, owner_id, member_ids, member_roles}
bots             → {id, org_id, name, persona, instructions, settings, legacy_instance_id}
connected_accounts → {id, org_id, provider, name, status, credentials (encrypted), metadata}
connections      → {id, org_id, bot_id, account_id, provider, destination, response_mode, overrides, override_flags, priority}
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
        ├── Discord → Server A / #general-help
        ├── Discord → Server A / #billing (same account)
        ├── Telegram → Customer group
        └── Zendesk → Billing ticket group
```

### v2 API Endpoints
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v2/orgs` | GET/POST | List/create organisations |
| `/api/v2/orgs/{org_id}` | GET/PUT | Get/update org |
| `/api/v2/orgs/{org_id}/members` | GET | List members with roles |
| `/api/v2/orgs/{org_id}/members` | POST | Add member |
| `/api/v2/orgs/{org_id}/members/{id}` | DELETE | Remove member |
| `/api/v2/orgs/{org_id}/members/{id}/role` | PATCH | Change role |
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
| `/api/v2/orgs/{org_id}/bots/{bot_id}/connections/{id}/activity` | GET | Recent activity |

### Auth Pattern
- JWT auth via `Authorization: Bearer {token}`
- `X-Org-ID` header for org scoping
- Bot/account/connection IDs in URL paths
- Org membership enforced on all v2 endpoints
- Superadmins have implicit access to all orgs
- Credentials never sent raw to frontend (masked with `mask_credential()`)

### Migration
- Script: `/app/backend/migrate_v2.py` (repeatable, non-destructive)
- Creates: 1 org, bots from instances, accounts from configs, connections linking them
- Legacy `instance_id` preserved as `bot.legacy_instance_id` for backward compat
- v1 endpoints fully preserved and functional alongside v2

## Completed Features

### Phase 1 — v2 Data Model & Backend (Done — Nov 2026)
- [x] 4 new collections with proper indexes
- [x] 5 new route files: `v2_helpers.py`, `org_routes.py`, `bot_routes.py`, `account_routes.py`, `connection_routes.py`
- [x] Migration script with repeatable, non-destructive data mapping
- [x] Org membership access control on all v2 endpoints
- [x] Credential masking (never expose raw secrets to frontend)
- [x] Overlap detection for conflicting connection routes
- [x] Override inheritance with explicit `override_flags` semantics
- [x] Connection effective_settings resolution (connection overrides > bot defaults)
- [x] Backward compatibility — all v1 endpoints still work
- [x] Tested: 100% pass rate (21/21 backend tests, iteration_64.json)
- [x] Security fix: password hash excluded from members endpoint

### Zendesk Sidebar App (Done — Nov 2026)
- [x] On-demand AI suggestion generation for any ticket
- [x] ZAF v2 sidebar app with Generate/Regenerate/Copy/Insert controls
- [x] Per-instance sidebar API key management
- [x] Admin UI card with 3-step setup guide and ZIP download

### Earlier Completed Work
- Zendesk OAuth migration, Analytics Dashboard, Admin role management
- User email invitations, Landing page fixes
- Self-hosting readiness documentation
- Full branding update (BridgeBot → BitBot Pro)

## Pending / Upcoming Tasks

### Phase 2 — Navigation & Layout Restructure
- New AdminLayout with Org selector, Bot selector, section groups
- Routes: `/admin/org/overview`, `/admin/bots`, `/admin/accounts`, `/admin/bot/:id/integrations`
- Shell pages wired to v2 backend APIs

### Phase 3 — Core Pages (Connected Accounts + Integrations)
- Connected Accounts: list, add, edit, disconnect with active-connection warnings
- Integrations: connection cards, Add Connection wizard, detail tabs
- Override inheritance UI (use bot defaults vs custom)

### Phase 4 — Provider Routing & Webhook Updates
- Multi-route webhook resolution for Discord, Telegram, Zendesk
- Overlap detection, idempotent handling, shared-account rate limiting

### Phase 5 — Platform Admin & Polish
- Provider Apps page, Workspaces & Users, documentation updates

### Backlog
- P0: GitHub Export for self-hosting migration
- P1: WhatsApp integration
- P2: Backend refactor (server.py modularization)
- P2: APP_MODE env splitting (worker vs api)
- P2: Multi-server Discord

## Production URLs
- Production: `https://bitbotpro.io`
- Preview: `https://rag-search-dev.preview.emergentagent.com`
