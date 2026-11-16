# BitBot Pro — Customer Workspace Architecture Proposal

## 1. Current State Audit

### 1.1 User Accounts (6 total)

| Email | User ID | Username | Current Role | Proposed Role |
|-------|---------|----------|-------------|---------------|
| `admin@bridgebot.tech` | `15fdc66c-52cb-4138-8c05-4335ee7bd516` | administrator | superadmin | **Workspace Owner** of `development` (demoted from superadmin) |
| `admin@bitbotpro.io` | **DOES NOT EXIST** | — | — | **Platform Superadmin** (must be created) |
| `test_promote_464322a4@example.com` | `60525026-0dee-467e-879e-c35dc27ef725` | test_promoteuser_e2041cd9 | **superadmin** ⚠️ | Demote to `user` (test artifact) |
| `test_promote_20e9c118@example.com` | `53aac246-1f11-45d4-8062-a113bbf25d48` | test_promoteuser_1ab839a8 | **superadmin** ⚠️ | Demote to `user` (test artifact) |
| `johndoe@example.com` | `30a8e85c-b1ee-4e1f-8f34-9851841c9242` | johndoe | user | Unchanged |
| `test_accept_ad995fb5@example.com` | `ed35a05a-e162-44c8-8e58-0f6cd5682709` | accept_user_ad995fb5 | user | Unchanged |
| `test_accept_ui_9c6e9175@example.com` | `6ece0cd7-295e-4d64-a82e-1d949b69de51` | ui_accept_9c6e9175 | user | Unchanged |

**Findings requiring decisions:**
- `admin@bitbotpro.io` must be created via secure invitation/signup. Agent will NOT invent a password.
- 2 test accounts have superadmin role (test artifacts from automated testing). Proposed: demote to `user`.
- `admin@bridgebot.tech` will lose superadmin and become Workspace Owner of `development` — still the most powerful *customer* role but not a platform admin.

### 1.2 Organisations (1 total)

| Org Name | Org ID | Owner | Members | Bots | Accounts |
|----------|--------|-------|---------|------|----------|
| Default Organisation | `cb91e73c-b74b-45a3-aecc-f7823ee07d2c` | `admin@bridgebot.tech` | 5 IDs (2 orphan refs to deleted users) | 2 | 9 |

- 2 member IDs (`a254e59d-...`, `424922dc-...`) reference users that no longer exist — orphan cleanup needed.
- 9 connected accounts (5 Discord, 2 Telegram, 1 Zendesk, 1 Telegram disconnected) — all test data.

### 1.3 Discord App Config

- `discord_app_config` collection: **Empty** — no platform-level Discord app is currently stored.
- `provider_apps` collection: **No Discord entry**.
- `.env` has `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_REDIRECT_URI` — these are the platform Discord app credentials read at startup.

**Implication**: Platform Discord app credentials currently live in `.env` only. Migration will formalize these as the platform-provided Discord application record.

### 1.4 Existing Data Inventory

| Collection | Count | Notes |
|-----------|-------|-------|
| organisations | 1 | Default Organisation |
| bots | 2 | API Tester (legacy), Sales Bot (V2-only) |
| connected_accounts | 9 | 5 Discord, 3 Telegram, 1 Zendesk |
| connections | varies | Bot-to-destination routes |
| conversations | varies | Chat history |
| knowledge_sources | varies | KB entries per bot |
| bot_templates | varies | Saved templates |
| users | 6 | See audit above |

---

## 2. Proposed Data Model

### 2.1 New Collection: `workspaces`

```json
{
  "id": "uuid",
  "name": "development",
  "slug": "development",
  "owner_id": "user-uuid (Workspace Owner)",
  "billing": {
    "plan": "pro",
    "stripe_customer_id": null,
    "stripe_subscription_id": null,
    "limits": {
      "max_organisations": 10,
      "max_bots_per_org": 5,
      "max_discord_connections": 20,
      "max_monthly_ai_messages": 10000,
      "max_custom_discord_apps": 3
    }
  },
  "usage": {
    "current_period_start": "ISO datetime",
    "ai_messages_used": 0
  },
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

### 2.2 New Collection: `workspace_members`

Separate from org members. Maps users to workspace-level roles.

```json
{
  "workspace_id": "uuid",
  "user_id": "uuid",
  "role": "owner | admin",
  "permissions": {
    "manage_billing": true,
    "manage_discord_apps": true
  },
  "invited_by": "uuid",
  "joined_at": "ISO datetime"
}
```

**Note**: Workspace Owners are ALSO stored here with `role: "owner"`. The `owner_id` on the workspace doc is the canonical owner reference; this collection tracks all workspace-level members.

### 2.3 New Collection: `workspace_discord_apps`

Customer-owned Discord applications stored per workspace.

```json
{
  "id": "uuid",
  "workspace_id": "uuid",
  "name": "My Custom Discord Bot",
  "source": "custom",
  "client_id": "encrypted",
  "client_secret": "encrypted",
  "bot_token": "encrypted",
  "redirect_uri": "https://...",
  "allowed_org_ids": ["org-uuid-1", "org-uuid-2"],
  "created_by": "user-uuid",
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

**Platform-provided Discord app** is NOT stored here — it lives in a separate `platform_discord_app` document (see §2.7).

### 2.4 Modified Collection: `organisations` (additive changes only)

```diff
{
  "id": "uuid",
  "name": "Default Organisation",
+ "workspace_id": "uuid",           ← NEW: links org to workspace
  "owner_id": "user-uuid",
  "member_ids": ["..."],
  "member_roles": {"user-id": "admin|member"},
  "created_at": "...",
  "updated_at": "..."
}
```

No fields removed. Only `workspace_id` added.

### 2.5 Modified Collection: `users` (additive changes only)

```diff
{
  "id": "uuid",
  "email": "...",
  "username": "...",
  "role": "superadmin | user",      ← SIMPLIFIED: only "superadmin" or "user" at platform level
+ "platform_role": "superadmin",    ← NEW: explicit platform role (null for non-platform users)
  "first_name": "...",
  "last_name": "...",
  "hashed_password": "...",
  ...
}
```

**Key change**: The legacy `role` field stays for backward compat. `platform_role` is the authoritative field for platform-level access. Only `admin@bitbotpro.io` gets `platform_role: "superadmin"`.

### 2.6 Modified Collection: `connected_accounts` (additive changes only)

```diff
{
  "id": "uuid",
  "org_id": "uuid",
  "provider": "discord | telegram | zendesk",
+ "discord_app_id": "uuid | 'platform'",  ← NEW: which Discord app this account uses
  "credentials": { ... },
  "metadata": { "source": "platform|custom" },
  ...
}
```

### 2.7 New Document: `platform_discord_app` (singleton)

Formalizes the platform-provided Discord application (currently in .env).

```json
{
  "_id": "platform_discord_app",
  "client_id": "from DISCORD_CLIENT_ID env",
  "client_secret": "encrypted",
  "bot_token": "encrypted",
  "redirect_uri": "...",
  "managed_by": "platform",
  "updated_at": "ISO datetime",
  "updated_by": "user-uuid (superadmin)"
}
```

Only Platform Superadmins can modify this.

### 2.8 New Collection: `audit_log` (optional, for cross-workspace admin actions)

```json
{
  "id": "uuid",
  "actor_id": "user-uuid",
  "action": "workspace.create | workspace.member.add | platform.discord_app.update | ...",
  "target_type": "workspace | org | user | discord_app",
  "target_id": "uuid",
  "details": {},
  "timestamp": "ISO datetime"
}
```

---

## 3. Permission Matrix

### 3.1 Role Hierarchy

```
Platform Superadmin (internal, never assignable via customer flows)
  └── Workspace Owner (highest customer role)
        └── Workspace Admin (delegated workspace management)
              └── Organisation Admin (single-org scope)
                    └── Organisation Member (explicit permissions only)
```

### 3.2 Permission Table

| Action | Platform Superadmin | Workspace Owner | Workspace Admin | Org Admin | Org Member |
|--------|:------------------:|:---------------:|:---------------:|:---------:|:----------:|
| **Platform** |
| Manage platform Discord app | ✅ | ❌ | ❌ | ❌ | ❌ |
| Access all workspaces | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create platform superadmin | ✅ | ❌ | ❌ | ❌ | ❌ |
| Platform admin dashboard | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Workspace** |
| Create workspace | ✅ | ✅ (via signup) | ❌ | ❌ | ❌ |
| Delete workspace | ✅ | ✅ (own) | ❌ | ❌ | ❌ |
| Transfer ownership | ✅ | ✅ (own) | ❌ | ❌ | ❌ |
| Manage billing | ✅ | ✅ | ⚡ (if permitted) | ❌ | ❌ |
| Manage workspace members | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage custom Discord apps | ✅ | ✅ | ⚡ (if permitted) | ❌ | ❌ |
| Create organisation | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Organisation** |
| Manage org members | ✅ | ✅ | ✅ | ✅ | ❌ |
| Manage bots | ✅ | ✅ | ✅ | ✅ | ❌ |
| Manage knowledge base | ✅ | ✅ | ✅ | ✅ | ❌ |
| Manage connections | ✅ | ✅ | ✅ | ✅ | ❌ |
| Connect Discord servers | ✅ | ✅ | ✅ | ✅ | ❌ |
| View org data | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Security** |
| Grant platform_superadmin | ✅ | ❌ | ❌ | ❌ | ❌ |
| Grant workspace_owner | ✅ | ✅ (transfer) | ❌ | ❌ | ❌ |
| Grant workspace_admin | ✅ | ✅ | ❌ | ❌ | ❌ |
| Grant org_admin | ✅ | ✅ | ✅ | ❌ | ❌ |
| Remove workspace owner | ❌* | ❌* | ❌ | ❌ | ❌ |

*Only via ownership transfer — at least one owner must always exist.

⚡ = Only when `permissions.manage_billing` or `permissions.manage_discord_apps` is `true` on their workspace_members record.

### 3.3 Multi-Membership

- Users can belong to **multiple workspaces** with different roles.
- Users can belong to **multiple organisations** (even across workspaces) with different org-level roles.
- Workspace Owner/Admin gets **implicit access** to all orgs within their workspace.
- Org-level membership is still tracked via `organisations.member_ids` and `member_roles`.

---

## 4. Signup & Invitation Flows

### 4.1 Independent Customer Signup

1. New user registers → account created with `role: "user"`, `platform_role: null`
2. A new workspace is automatically created → user becomes its Owner
3. A default organisation is created within the workspace
4. User is added as org owner/admin of the default org
5. **Never** auto-added to the `development` workspace

### 4.2 Workspace Invitation

1. Workspace Owner/Admin invites a user by email with a specific role
2. Invitation record stores: `{workspace_id, email, role, invited_by, token, expires_at}`
3. When accepted: user joins ONLY the specified workspace with the assigned role
4. Does NOT create a new workspace
5. If the invited user doesn't have an account, they register first, then the invitation auto-applies

### 4.3 Organisation Invitation

1. Org Admin (or higher) invites a user to a specific org
2. If the user is already in the workspace → they get added to the org with the specified org-level role
3. If the user is NOT in the workspace → they get added to both the workspace (as basic member) and the org

---

## 5. Discord Application Architecture

### 5.1 Two Sources

| Source | Storage | Managed By | Visible To |
|--------|---------|------------|-----------|
| Platform-provided | `platform_discord_app` (singleton) | Platform Superadmin only | All workspaces (as an option) |
| Customer-owned | `workspace_discord_apps` collection | Workspace Owner/Admin | Only their workspace's orgs |

### 5.2 Connection Flow

1. Org Admin goes to connect Discord
2. Sees available Discord apps: platform-provided + workspace-owned apps (filtered by `allowed_org_ids`)
3. Selects an app → initiates OAuth flow
4. OAuth state bound to `{workspace_id, org_id, discord_app_id}` — prevents cross-org hijacking
5. On success → `connected_accounts` record created with `discord_app_id` reference
6. Org Admin NEVER sees the actual client_secret or bot_token — only the app name and connection status

### 5.3 Shared Application Isolation

- Multiple orgs can use the same Discord application
- Each org gets its own `connected_accounts` record with its own server authorizations
- Disconnecting one org's connection does NOT affect other orgs using the same Discord app
- Platform shutdown (revoking the bot token) is a separate superadmin action with explicit warning

---

## 6. Billing Architecture

### 6.1 Workspace-Level Billing

- Subscriptions attach to `workspaces.billing`
- Stripe customer ID and subscription ID stored per workspace
- Plan limits defined in `workspaces.billing.limits`
- Usage tracked per org, aggregated at workspace level

### 6.2 Entitlement Enforcement (Backend)

- Before creating an org: check `max_organisations` limit
- Before creating a bot: check `max_bots_per_org` limit
- Before creating a Discord connection: check `max_discord_connections` limit
- Before each AI message: check `max_monthly_ai_messages` limit
- Concurrent request limiting via workspace-level semaphore

### 6.3 Migration: Existing Subscriptions

- Currently: no active Stripe subscriptions found in the codebase (billing is planned but not live)
- Migration: `development` workspace gets a default "unlimited" internal plan
- No billing changes needed for existing data

---

## 7. Migration Plan

### 7.1 Pre-Migration Inventory (Read-Only)

Before any writes, the migration script will:
1. Count all users, orgs, bots, accounts, connections, conversations, knowledge sources
2. Identify the 2 orphan member references in Default Organisation
3. Verify `admin@bridgebot.tech` exists (confirmed: ID `15fdc66c-...`)
4. Report that `admin@bitbotpro.io` does NOT exist
5. List the 2 test accounts with superadmin role
6. Output a JSON inventory for manual verification

### 7.2 Migration Steps (Idempotent & Reversible)

**Step 1: Create `development` workspace**
```
workspace = {
  id: new UUID,
  name: "development",
  slug: "development",
  owner_id: "15fdc66c-..." (admin@bridgebot.tech),
  billing: { plan: "internal", limits: { unlimited } },
  created_at: now
}
```
- Idempotent: skip if workspace with slug "development" already exists

**Step 2: Create workspace_members record for owner**
```
{ workspace_id, user_id: "15fdc66c-...", role: "owner", joined_at: now }
```
- Idempotent: skip if record exists

**Step 3: Add `workspace_id` to Default Organisation**
```
organisations.update_one(
  {id: "cb91e73c-..."},
  {$set: {workspace_id: development_workspace_id}}
)
```
- Idempotent: safe to re-run

**Step 4: Clean orphan member references**
```
Remove IDs "a254e59d-..." and "424922dc-..." from Default Organisation member_ids
(these reference non-existent users)
```

**Step 5: Demote test superadmin accounts**
```
Update test_promote_464322a4@example.com: role → "user"
Update test_promote_20e9c118@example.com: role → "user"
```
- Only after user approval (presented in this document)

**Step 6: Demote admin@bridgebot.tech from superadmin**
```
Update admin@bridgebot.tech: role → "user", platform_role → null
```
- This account becomes Workspace Owner (via workspace_members), not Platform Superadmin
- Only after admin@bitbotpro.io is created and confirmed as Platform Superadmin

**Step 7: Formalize platform Discord app (if env vars present)**
```
Insert into platform_discord_app:
  { _id: "platform_discord_app", client_id: from env, ... }
```
- Only if DISCORD_CLIENT_ID env var is non-empty
- Credentials stay in .env for runtime, this document is the formal record

**Step 8: Create admin@bitbotpro.io account**
- **NOT done automatically** — requires secure invitation flow
- Agent will provide the invitation URL for the user to set their own password

### 7.3 Rollback Procedure

Every migration step is additive:
- `workspace_id` on orgs can be `$unset`
- `workspaces` collection can be dropped
- `workspace_members` collection can be dropped
- User role changes can be reverted from the pre-migration inventory JSON
- No data is deleted (orphan cleanup is optional)

### 7.4 Validation Checks

After migration:
1. ✅ Default Organisation has `workspace_id` matching `development`
2. ✅ `admin@bridgebot.tech` is workspace_members.owner for `development`
3. ✅ All bots, connections, accounts, conversations, KB entries unchanged
4. ✅ No duplicate workspace or membership records
5. ✅ Existing org member_ids/member_roles preserved
6. ✅ Discord routing still works (no credential changes)

---

## 8. Implementation Stages

### Stage 1: Backend Data Model (Collections + Helpers)
- Create `workspaces` collection with indexes
- Create `workspace_members` collection with indexes
- Create `workspace_discord_apps` collection
- Add `require_workspace_member`, `require_workspace_admin`, `require_workspace_owner` helpers to `v2_helpers.py`
- Add `require_platform_superadmin` helper
- Run migration script (Steps 1-4, 7 — NOT Steps 5-6 until admin@bitbotpro.io exists)

### Stage 2: Workspace API Routes
- `POST/GET/PUT/DELETE /api/v2/workspaces` — CRUD
- `GET/POST/DELETE /api/v2/workspaces/{ws_id}/members` — member management
- `GET /api/v2/workspaces/{ws_id}/orgs` — list orgs in workspace
- `PUT /api/v2/workspaces/{ws_id}/billing` — billing settings
- `POST/GET/PUT/DELETE /api/v2/workspaces/{ws_id}/discord-apps` — custom Discord apps
- `GET /api/v2/platform/discord-app` — platform Discord app (superadmin)
- `PUT /api/v2/platform/discord-app` — update platform Discord app (superadmin)
- Modify org creation to require `workspace_id`
- Add workspace_id validation to existing org/bot/account routes

### Stage 3: Signup & Invitation Updates
- New signup flow creates workspace + default org
- Workspace invitation system
- Org invitation scoped to workspace
- Workspace/org switching in auth context

### Stage 4: Frontend — Workspace UI
- Workspace selector in sidebar
- Workspace Settings page (billing, Discord apps, members)
- Updated AuthContext with workspace state
- Org creation scoped to workspace
- Workspace/org switching UX

### Stage 5: Billing Integration
- Stripe customer/subscription linked to workspace
- Entitlement checks in backend middleware
- Usage tracking per org, aggregated to workspace
- Plan management UI

### Stage 6: Testing & Production Migration
- Two-workspace isolation test
- Role escalation prevention test
- Discord shared-app disconnection test
- Billing limit enforcement test
- Production migration with approval gate

---

## 9. Decisions Requiring User Input

1. **admin@bitbotpro.io does not exist** — How should it be created?
   - Option A: Agent generates a secure invitation link; user sets password via the invite flow
   - Option B: User creates the account through the normal signup flow, agent then assigns platform_superadmin

2. **Test superadmin accounts** — Confirm demoting these to `user`:
   - `test_promote_464322a4@example.com` (currently superadmin)
   - `test_promote_20e9c118@example.com` (currently superadmin)

3. **admin@bridgebot.tech demotion timing** — Should we:
   - Option A: Demote immediately during migration (before admin@bitbotpro.io exists) — temporarily no platform superadmin
   - Option B: Demote only after admin@bitbotpro.io is created and confirmed — recommended

4. **Orphan member IDs** in Default Organisation — Confirm removing 2 references to deleted users.
