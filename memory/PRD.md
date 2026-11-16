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

## Customer Workspace Architecture (Feb 2026)

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
- `admin@bitbotpro.io` — Platform Superadmin
- `admin@bridgebot.tech` — Workspace Owner of "development" (still superadmin, to be demoted after confirmation)

### New Collections
```
workspaces           → {id, name, slug, owner_id, billing, usage, created_at}
workspace_members    → {workspace_id, user_id, role, permissions}
workspace_discord_apps → {id, workspace_id, name, source, client_id, client_secret, bot_token, allowed_org_ids}
platform_config      → {_id: "platform_discord_app", client_id, client_secret, bot_token, managed_by}
```

### Modified Collections
```
organisations        → +workspace_id field
users                → +platform_role field
```

## Implementation Status

### Stage 1: Backend Data Model + Migration — DONE ✅
- [x] `workspaces`, `workspace_members`, `workspace_discord_apps`, `platform_config` collections
- [x] RBAC: `_is_platform_superadmin()`, `require_workspace_member/admin/owner()`
- [x] Updated `require_org_member/admin()` with workspace inheritance
- [x] 16 new workspace API endpoints (CRUD, members, billing, Discord apps)
- [x] Platform Discord app endpoints (superadmin-only)
- [x] Idempotent migration: development workspace, admin@bitbotpro.io, demoted test accounts
- [x] Tested: 21/21 backend passed (iteration_78.json)

### Stage 2: Frontend Workspace UI — DONE ✅
- [x] AuthContext: workspace state (workspaces, selectedWorkspace, selectWorkspace, refreshWorkspaces)
- [x] AuthContext: workspace-scoped org listing via X-Workspace-ID header
- [x] AuthContext: fetchWorkspacesAndOrgs on login with localStorage persistence
- [x] Sidebar: Workspace selector above org selector (data-testid="workspace-switcher")
- [x] Sidebar: Workspace Settings nav section (General, Members, Billing, Discord Apps)
- [x] WorkspaceSettings page: General tab (name edit, ID, slug, created date)
- [x] WorkspaceSettings page: Members tab (list, role badges, owner protection, remove button)
- [x] WorkspaceSettings page: Billing tab (plan, limits, usage tracker)
- [x] WorkspaceSettings page: Discord Apps tab (platform app, custom apps)
- [x] v2api.js: 18+ workspace methods added
- [x] Mobile responsive workspace UI
- [x] Tested: 16/16 backend + all UI passed (iteration_79.json)

### Stage 2.5: Signup Workspace Flow — DONE ✅
- [x] Backend: email verification auto-creates workspace + default org for new users
- [x] Idempotent: skips if user already has a workspace membership
- [x] Default plan: "free" with starter limits (3 orgs, 3 bots, 1000 msgs)
- [x] Never auto-adds new customers to "development" workspace

### Stage 2.7: Admin UI Enhancements — DONE ✅ (Nov 2026)
- [x] EditUserModal: Cross-workspace role management (admin/member toggle per workspace)
- [x] EditUserModal: Org assignment toggle — expand workspace to see org list, add/remove user from orgs
- [x] InviteModal: Workspace selection dropdown + workspace role (admin/member) pre-assignment
- [x] InviteModal: Backend stores workspace_id + workspace_role on invitation record
- [x] New Workspace button: "+" button in sidebar next to workspace selector (superadmin only)
- [x] NewWorkspaceModal: Name input, slug auto-generation, creator becomes owner
- [x] Backend APIs: getUserOrgMemberships, updateOrgMembership, invite with workspace
- [x] Tested: 13/13 backend + all UI passed (iteration_80.json)

### Stage 2.8: Invite Auto-Join & Workspace Deletion — DONE ✅ (Nov 2026)
- [x] Invite accept flow auto-joins user to pre-assigned workspace with correct role
- [x] GET /invite/{token} now returns workspace_name and workspace_role
- [x] Invite accept page shows workspace name + role badge when workspace is assigned
- [x] If no workspace on invite, auto-creates a new workspace for the user (existing)
- [x] Workspace Settings General tab: Danger Zone with type-to-confirm deletion
- [x] Cascade protection: refuses to delete workspace with existing organisations
- [x] After deletion, switches to remaining workspace and redirects to /admin
- [x] Tested: 5/5 backend + all UI passed (iteration_81.json)

### Stage 2.9: Enterprise Superadmin View — DONE ✅ (Nov 2026)
- [x] Restructured superadmin sidebar: removed Workspace Settings, Analytics, API Key Usage
- [x] New "Enterprise" section: Workspaces, Team & Access, Discord App Setup
- [x] Enterprise Workspaces page: full CRUD, member management, role editing, plan display
- [x] Non-superadmin sidebar preserved: Workspace Settings still shows for workspace owners
- [x] Workspace cards: expandable with members (role badges, edit, remove), orgs, plan (5 orgs, unlimited bots)
- [x] Create workspace inline form + Delete with type-to-confirm and cascade protection
- [x] Tested: 13/13 backend + all UI passed (iteration_82.json)

### Stage 2.10: Admin Sidebar for Workspace Admins — DONE ✅ (Nov 2026)
- [x] Workspace admins see "Admin" section: Organisations, Discord App Setup, Team & Access, Analytics, API Key Usage
- [x] Removed Workspace Settings section for non-superadmins
- [x] Created `require_admin_or_ws_admin` backend dependency — allows workspace admins to access admin endpoints
- [x] Workspace-scoped data: `/api/admin/users` returns only users in the admin's workspaces
- [x] Workspace admin role editing scoped to their workspaces; platform role changes blocked
- [x] Workspace admins can invite, delete (workspace-scoped), and manage team members
- [x] Superadmin sidebar unchanged (Enterprise section)
- [x] Tested: 11/11 backend + all UI passed (iteration_83.json)

### Stage 3: Signup & Invitation System — DONE ✅
- [x] Workspace invitation system (email + role + token) — backend + UI done
- [x] Invite accept auto-joins workspace with pre-configured role
- [x] Invite details show workspace name and role on accept page
- [ ] Workspace/org switching UX improvements (optional polish)

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

## Previously Completed Features

### V2 Architecture (All 5 Phases)
- Phase 1-5: Complete V2 multi-tenant API, navigation, integrations, routing, admin

### Other Completed Work
- Discord guided setup, Zendesk OAuth, Telegram setup
- Bot Templates, Bot Cloning, Bot Deletion cascade
- V1→V2 Runtime Migration, Full V1 Endpoint Cleanup
- Discord Integration Isolation (platform vs custom)
- Landing page, Analytics, Branding

## Backlog
- P0: Stages 4-6 of Customer Workspace Architecture (Billing, Discord App Choices, Testing/Migration)
- P1: Demote admin@bridgebot.tech from superadmin after confirmation
- P1: GitHub Export (DO NOT start until instructed)
- P2: WhatsApp integration
- P2: APP_MODE env splitting
- P2: Backend refactor — server.py modularization
- P3: Users.js component splitting (file at 752 lines)
- P3: Workspace/org switching UX polish

## Key URLs
- Production: `https://bitbotpro.io`
- Preview: `https://rag-search-dev.preview.emergentagent.com`
