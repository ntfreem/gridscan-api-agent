# BridgeBot Pro — Frontend-to-Backend API Mapping

> Generated: November 2026

---

## Frontend Component → Backend API Map

### Authentication Pages

| Component | File | Backend Calls | Method |
|-----------|------|---------------|--------|
| `Login.js` | `pages/Login.js` | `/auth/login` | POST |
| `Register.js` | `pages/Register.js` | `/auth/register`, `/auth/resend-code` | POST |
| `VerifyEmail.js` | `pages/VerifyEmail.js` | `/auth/verify` | POST |
| `ForgotPassword.js` | `pages/ForgotPassword.js` | `/auth/forgot-password` | POST |
| `ResetPassword.js` | `pages/ResetPassword.js` | `/auth/reset-password` | POST |
| `InviteAccept.js` | `pages/InviteAccept.js` | `/invite/{token}` (GET), `/invite/{token}/accept` (POST) | GET/POST |
| `AuthContext.js` | `context/AuthContext.js` | `/auth/me`, `/auth/login`, `/auth/logout`, `/v2/workspaces`, `/v2/workspaces/{id}/orgs`, `/v2/orgs/{id}/bots` | Multiple |
| `Profile.js` | `pages/Profile.js` | `/auth/profile` (PATCH), `/auth/change-password` (POST) | PATCH/POST |

### Admin Pages

| Component | File | Backend Calls |
|-----------|------|---------------|
| `Dashboard.js` | `pages/Dashboard.js` | `/v2/orgs/{id}/overview`, `/analytics/overview` |
| `Users.js` | `pages/Users.js` | `/admin/users`, `/admin/users/invite`, `/admin/users/invitations`, `/v2/workspaces/{id}/members`, `/v2/workspaces/{id}/users`, `/v2/workspaces/{id}/org-membership`, `/v2/workspaces/{id}/user-orgs/{uid}` |
| `BotSettings.js` | `pages/BotSettings.js` | `/v2/orgs/{id}/bots/{id}/settings`, `/admin/bot-logo`, `/admin/api-keys`, `/admin/embed-config`, `/analytics/llm-cost` |
| `KnowledgeBase.js` | `pages/KnowledgeBase.js` | `/knowledge/sources`, `/knowledge/sources/upload`, `/knowledge/sources/url`, `/knowledge/sources/url/crawl-stream`, `/knowledge/sources/bulk-rescrape`, `/knowledge/sources/github/*`, `/knowledge/categories`, `/knowledge/export`, `/knowledge/import`, `/knowledge/share` |
| `Analytics.js` | `pages/Analytics.js` | `/analytics/overview`, `/analytics/daily`, `/analytics/daily-by-platform`, `/analytics/llm-usage`, `/analytics/llm-cost`, `/analytics/passive-skips`, `/analytics/zendesk`, `/knowledge/sources/faq` |
| `Conversations.js` | `pages/Conversations.js` | `/conversations`, `/conversations/count`, `/conversations/{id}`, `/conversations/{id}/approve` |
| `DiscordSettings.js` | `pages/DiscordSettings.js` | `/discord/*` (all Discord endpoints) |
| `DiscordAppSetup.js` | `pages/DiscordAppSetup.js` | `/discord/app-config`, `/v2/workspaces/{id}/discord-apps`, `/discord/purge-all-connections` |
| `TelegramSettings.js` | `pages/TelegramSettings.js` | `/admin/telegram-config`, `/admin/telegram-config/test` |
| `ZendeskSettings.js` | `pages/ZendeskSettings.js` | `/admin/zendesk-config`, `/admin/zendesk-config/test`, `/admin/zendesk-config/webhook-url`, `/admin/zendesk/oauth/*`, `/admin/zendesk/sidebar-key`, `/admin/zendesk/sidebar-app.zip`, `/admin/zendesk-tickets` |
| `IntegrationsPage.js` | `pages/IntegrationsPage.js` | Multiple Discord, Telegram, Zendesk status endpoints |
| `ApiIntegrations.js` | `pages/ApiIntegrations.js` | `/integrations/*` (all API integration endpoints) |
| `ApiDiagnostics.js` | `pages/ApiDiagnostics.js` | `/integrations/{id}/diagnostics/*` |
| `ConnectedAccounts.js` | `pages/ConnectedAccounts.js` | `/v2/orgs/{id}/accounts/*`, `/v2/orgs/{id}/bots/{id}/connections/*`, `/v2/orgs/{id}/bots/{id}/suggestions/*` |
| `EnterpriseWorkspaces.js` | `pages/EnterpriseWorkspaces.js` | `/v2/platform/stats`, `/v2/platform/workspaces` |
| `WorkspaceSettings.js` | `pages/WorkspaceSettings.js` | `/v2/workspaces/{id}`, `/v2/workspaces/{id}/billing` |
| `EmbedCode.js` | `pages/EmbedCode.js` | `/embed/config/{id}`, `/admin/embed-config` |
| `ChangelogPage.js` | `pages/ChangelogPage.js` | `/changelog`, `/admin/changelog` |
| `Docs.js` | `pages/Docs.js` | None (static documentation) |
| `OnboardingWizard.js` | `pages/OnboardingWizard.js` | `/onboarding/status`, `/onboarding/complete`, `/onboarding/dismiss` |

### Chat / Embed

| Component | File | Backend Calls | Special |
|-----------|------|---------------|---------|
| `ChatPage.js` | `pages/ChatPage.js` | `/chat/stream`, `/chat/history/{session_id}` | **SSE streaming** |
| `ChatWidget.js` | `pages/ChatWidget.js` | `/bot-info/{id}`, `/embed/config/{id}`, `/chat/stream` | **SSE streaming** |
| `streamChat.js` | `utils/streamChat.js` | `/chat/stream` | **SSE fetch** |

---

## API Communication Patterns

### 1. REST Calls (Axios)
- **Library**: `axios` via `utils/api.js` custom instance
- **Base URL**: `/api` (proxied to backend)
- **Auth**: Axios interceptor auto-injects `Authorization: Bearer <token>` and `X-Instance-ID` from localStorage
- **Headers**: Custom `X-Instance-ID`, `X-Workspace-ID`, `X-Org-ID` headers for multi-tenant scoping

### 2. SSE Streaming (fetch)
- **Library**: Native `fetch` API in `utils/streamChat.js`
- **Endpoints**: `/chat/stream`, `/knowledge/sources/url/crawl-stream`, `/knowledge/sources/bulk-rescrape`, `/knowledge/sources/github/import-stream`
- **Auth**: Token passed in request body or query params
- **Response format**: `data: {json}\n\n` event stream

### 3. File Uploads
- **Library**: `axios` with `multipart/form-data`
- **Endpoints**: `/admin/bot-logo` (image), `/knowledge/sources/upload` (documents)
- **Auth**: Bearer JWT

### 4. No WebSocket usage
- The frontend does NOT use WebSockets directly
- Discord bot uses WebSocket internally (server-side only via `discord.py`)

### 5. No Direct Database Access
- Frontend never accesses MongoDB directly
- All data flows through the FastAPI backend

---

## Hardcoded URLs in Frontend

| File | URL/Pattern | Type | Self-Hosting Action |
|------|-------------|------|---------------------|
| `AdminLayout.js:261` | `bitbotpro.io`, `bridgebot.tech` | Domain detection | Replace with self-hosted domain |
| `AdminLayout.js:264` | `preview.emergentagent.com` | Env detection | Replace with env var check |
| `BotSettings.js:471` | `localhost:11434` | Ollama default URL | Keep (Ollama is local by design) |
| `LandingPage.js:904` | `bitbotpro.app/embed.js` | Example snippet | Replace with actual domain |
| `ChatWidget.js:85-111` | `data-bitbotpro-css` attribute | CSS marker | Cosmetic, rename optionally |

---

## V2 API Utility (`v2api.js`)

The file `utils/v2api.js` provides helper functions for V2 workspace/org/bot scoped API calls:
- Uses the same `api` axios instance
- Adds `X-Workspace-ID` and `X-Org-ID` headers automatically
- Called by: `ConnectedAccounts.js`, `Organisations.js`, `BotList.js`, `BotSettings.js`

---

## Frontend Environment Variables

| Variable | Usage | Files |
|----------|-------|-------|
| `REACT_APP_BACKEND_URL` | Backend API base URL | `utils/api.js` (via CRA env injection) |
| `WDS_SOCKET_PORT` | Dev hot-reload | CRA build config |
| `ENABLE_HEALTH_CHECK` | Enable /healthz | Build config |

**No other external service URLs are accessed directly from the frontend.** All third-party communication (Discord, Telegram, Zendesk, LLMs) goes through the backend.
