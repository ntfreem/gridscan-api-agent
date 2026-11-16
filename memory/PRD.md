# BitBot Pro — Product Requirements Document

## Product Overview
BitBot Pro is a multi-tenant AI bot SaaS platform that connects to Discord, Telegram, Zendesk, and Web channels. It provides AI-powered knowledge assistants with a customizable knowledge base, API integrations, and conversation management.

## Core Architecture
- **Frontend**: React SPA with neon electric blue theme
- **Backend**: FastAPI (Python) — fully V2 multi-tenant API
- **Database**: MongoDB Atlas (29+ collections)
- **Channels**: Web Chat, Discord, Telegram, Zendesk
- **LLM**: Claude/OpenAI via Emergent Universal Key
- **Storage**: Emergent Object Storage
- **Email**: Emergent Managed Resend

## Customer Workspace Architecture (NEW — Feb 2026)

### Hierarchy
```
Platform (BitBot Pro)
└── Customer Workspace (billing, Discord app choices, usage limits)
    ├── Workspace Members (owner, admin)
    ├── Workspace Discord Apps (customer-owned)
    └── Organisations (isolated tenants)
        ├── Org Members (admin, member)
        ├── Connected Accounts (provider identities)
        └── AI Bots
            ├── Bot Settings (persona, KB, LLM config)
            └── Connections (routes to destinations)
```

### Role Hierarchy
```
Platform Superadmin (internal, never assignable via customer flows)
  └── Workspace Owner (highest customer role)
        └── Workspace Admin (delegated workspace management)
              └── Organisation Admin (single-org scope)
                    └── Organisation Member (explicit permissions only)
```

### Account Assignments
- `admin@bitbotpro.io` — Platform Superadmin (role=superadmin, platform_role=superadmin)
- `admin@bridgebot.tech` — Workspace Owner of "development" (currently still superadmin, to be demoted after confirmation)

### New Collections
```
workspaces           → {id, name, slug, owner_id, billing: {plan, stripe_*, limits}, usage, created_at}
workspace_members    → {workspace_id, user_id, role: owner|admin, permissions: {manage_billing, manage_discord_apps}}
workspace_discord_apps → {id, workspace_id, name, source, client_id, client_secret, bot_token, allowed_org_ids}
platform_config      → {_id: "platform_discord_app", client_id, client_secret, bot_token, managed_by: "platform"}
```

### Modified Collections
```
organisations        → +workspace_id field (links org to workspace)
users                → +platform_role field (explicit platform-level access flag)
```

### Workspace API Endpoints
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v2/workspaces` | GET/POST | List/create workspaces |
| `/api/v2/workspaces/{ws_id}` | GET/PUT/DELETE | Workspace CRUD |
| `/api/v2/workspaces/{ws_id}/members` | GET/POST | List/add members |
| `/api/v2/workspaces/{ws_id}/members/{id}` | DELETE | Remove member |
| `/api/v2/workspaces/{ws_id}/members/{id}/role` | PATCH | Update role |
| `/api/v2/workspaces/{ws_id}/orgs` | GET | List orgs in workspace |
| `/api/v2/workspaces/{ws_id}/billing` | GET/PUT | Billing info/update |
| `/api/v2/workspaces/{ws_id}/discord-apps` | GET/POST | Custom Discord apps |
| `/api/v2/workspaces/{ws_id}/discord-apps/{id}` | PUT/DELETE | Discord app CRUD |
| `/api/v2/platform/discord-app` | GET/PUT | Platform Discord app (superadmin) |

## Implementation Status

### Stage 1: Backend Data Model + Migration — DONE (Feb 2026)
- [x] `workspaces` collection with indexes (id, slug unique)
- [x] `workspace_members` collection with indexes (workspace_id+user_id unique)
- [x] `workspace_discord_apps` collection with indexes
- [x] `platform_config` collection for platform Discord app
- [x] RBAC helpers: `_is_platform_superadmin()`, `require_workspace_member/admin/owner()`
- [x] Updated `require_org_member/admin()` with workspace inheritance
- [x] Workspace CRUD routes (list, create, get, update, delete)
- [x] Workspace member management (list, add, remove, role update)
- [x] Workspace billing endpoints (get, update)
- [x] Workspace Discord app CRUD (list, create, update, delete)
- [x] Platform Discord app endpoints (get, update — superadmin only)
- [x] Org creation with workspace_id scoping + limit enforcement
- [x] Org listing with X-Workspace-ID header filtering
- [x] Idempotent migration: created development workspace, assigned all orgs, created admin@bitbotpro.io, demoted test accounts, formalized platform Discord app
- [x] Tested: 100% pass — 21/21 backend (iteration_78.json)

### Stage 2: Frontend Workspace UI — NOT STARTED
- [ ] Workspace selector in sidebar (above org selector)
- [ ] Workspace Settings page (billing, Discord apps, member management)
- [ ] AuthContext updated with workspace state
- [ ] Org creation scoped to selected workspace

### Stage 3: Signup & Invitation Updates — NOT STARTED
- [ ] New signup creates workspace + default org
- [ ] Workspace invitation system
- [ ] Org invitation scoped to workspace

### Stage 4: Billing Integration — NOT STARTED
- [ ] Stripe customer/subscription linked to workspace
- [ ] Entitlement enforcement middleware
- [ ] Usage tracking + plan management UI

### Stage 5: Discord App Choices — NOT STARTED
- [ ] Org connection flow: choose platform vs custom Discord app
- [ ] OAuth state bound to workspace+org+app
- [ ] Shared app isolation (multi-org same app)

### Stage 6: Testing & Production Migration — NOT STARTED
- [ ] Two-workspace isolation test
- [ ] Role escalation prevention
- [ ] Billing limit enforcement
- [ ] Production migration with approval gate

## Previously Completed Features (V1→V2 Migration)

### V2 Architecture (All 5 Phases — Done Nov 2026)
- Phase 1: V2 Data Model & Backend
- Phase 2: Navigation & Layout Restructure
- Phase 3: Connected Accounts + Integrations
- Phase 4: Provider Routing & Webhook Updates
- Phase 5: Platform Admin & Polish

### Other Completed Work
- Discord guided setup, Zendesk OAuth, Telegram setup
- Bot Templates, Bot Cloning, Bot Deletion cascade
- V1→V2 Runtime Migration, Full V1 Endpoint Cleanup
- Admin User Management, Email Invitations
- Self-Hosting Readiness Docs, OpenAPI spec
- Discord Integration Isolation (platform vs custom)
- Landing page, Analytics, Branding (BridgeBot → BitBot Pro)

## Backlog
- P0: Stage 2-6 of Customer Workspace Architecture
- P1: GitHub Export (DO NOT start until instructed)
- P1: Demote admin@bridgebot.tech from superadmin after confirmation
- P2: WhatsApp integration (use integration_playbook_expert_v2)
- P2: APP_MODE env splitting (worker vs api)
- P2: Backend refactor — server.py modularization

## Production URLs
- Production: `https://bitbotpro.io`
- Preview: `https://rag-search-dev.preview.emergentagent.com`
