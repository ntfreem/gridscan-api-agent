# BitBot Pro — Product Requirements Document

## Product Overview
BitBot Pro is a multi-tenant AI bot SaaS platform that connects to Discord, Telegram, Zendesk, and Web channels. It provides AI-powered knowledge assistants with a customizable knowledge base, API integrations, and conversation management.

## Core Architecture
- **Frontend**: React SPA with neon electric blue theme
- **Backend**: FastAPI (Python) with 135+ endpoints
- **Database**: MongoDB Atlas
- **Channels**: Web Chat, Discord, Telegram, Zendesk, External API (v1)
- **LLM**: Claude/OpenAI via Emergent Universal Key
- **Storage**: Emergent Object Storage

## Branding
- **Name**: BitBot Pro (renamed from BridgeBot)
- **Theme**: Neon electric blue palette
- **Logo**: Chunky logo across all pages (48px in header/footer)

## Authentication
- JWT-based auth with email/username + password
- Admin role: `administrator` / `Admin@123`
- Multi-tenant: instances with assigned users

## Completed Features

### UI/UX (Done)
- [x] Renamed entire platform from "BridgeBot" to "BitBot Pro"
- [x] Chunkier logo across all pages (Navbar, Footer, Auth, Admin Sidebar, Widgets)
- [x] Full-screen responsive Onboarding Setup Guide with confetti and step animations
- [x] Mobile hamburger menu in Admin Layout
- [x] Header logo matches footer exactly (size 48, no glow)
- [x] Original neon blue palette preserved
- [x] Landing page scroll-jump fix (iframe focus guard)

### Zendesk OAuth Migration (Done — Feb 2026)
- [x] Replaced API-token auth with OAuth 2.0 authorization-code flow + PKCE
- [x] Confidential client with server-side token exchange
- [x] Secure token storage in MongoDB (access: 8h, refresh: 30d)
- [x] Automatic token refresh with rotation
- [x] Bearer auth for all Zendesk API calls
- [x] Subdomain input with URL normalization (handles full URLs, plain subdomains)
- [x] "Connect with Zendesk" OAuth button
- [x] Connection status, reconnect, disconnect controls
- [x] Clear error messages for: denied consent, expired auth, permission failures, missing config
- [x] Auto-reply disabled by default
- [x] Admin setup guide: `/app/docs/ZENDESK_OAUTH_SETUP.md`
- [x] Updated self-hosting docs (CHANNEL_INTEGRATIONS.md, ENVIRONMENT_VARIABLES.md, API_INVENTORY.md)
- [x] New env vars: `ZENDESK_OAUTH_CLIENT_ID`, `ZENDESK_OAUTH_CLIENT_SECRET`
- [x] New collection: `zendesk_oauth_states` (TTL-indexed, auto-expires after 10 min)
- [x] Legacy API token connections still work (backward compatible)
- **BLOCKED**: Live connection requires Zendesk Admin to create OAuth client and set env vars

### Self-Hosting Readiness (Done)
- [x] Full codebase audit (135+ endpoints)
- [x] 7 Markdown documentation files in `/app/docs/self-hosting-readiness/`
- [x] OpenAPI JSON export
- [x] Environment variables catalog
- [x] Emergent dependencies identified
- [x] Migration readiness assessment

## Pending / Upcoming Tasks

### P0 — GitHub Export
- Export the application to GitHub for self-hosting migration
- Use Claude Code for the actual migration

### P1 — WhatsApp Integration
- Scope out and integrate WhatsApp channel
- Must use `integration_playbook_expert_v2`
- Create standalone `/app/backend/whatsapp_routes.py`

### P2 — Backend Refactor
- Break `/app/backend/server.py` (>6,300 lines) into modular files:
  - `/routes/` — endpoint handlers
  - `/models/` — Pydantic models
  - `/services/` — business logic
- APP_MODE env splitting (worker vs api)

### P2 — Multi-Server Discord
- Support multiple Discord servers per bot instance

## Key Technical Details

### New Zendesk OAuth Endpoints
| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/zendesk/oauth/start` | POST | JWT + Instance | Generate OAuth URL with PKCE |
| `/api/zendesk/oauth/callback` | GET | None (state param) | Handle Zendesk redirect, exchange code |
| `/api/admin/zendesk/oauth/callback-url` | GET | JWT + Instance | Return callback URL for admin setup |

### Environment Variables (Zendesk OAuth)
| Variable | Required | Description |
|---|---|---|
| `ZENDESK_OAUTH_CLIENT_ID` | For OAuth | From Zendesk Admin Center |
| `ZENDESK_OAUTH_CLIENT_SECRET` | For OAuth | Shown once at client creation |

### OAuth Scopes
- `tickets:read` — Read ticket content for AI processing
- `tickets:write` — Post AI-generated replies (auto-reply mode)
- `users:read` — Verify connected user identity

### Token Lifecycle
- Access token: 8 hours, auto-refreshed
- Refresh token: 30 days, rotated on each refresh
- Connection marked as "needs reauth" if refresh fails

### Production URLs
- Production: `https://bitbotpro.io`
- Preview: `https://rag-search-dev.preview.emergentagent.com`
- OAuth Callback: `{base_url}/api/zendesk/oauth/callback`
