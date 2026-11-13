# BitBot Pro — Product Requirements Document

## Product Overview
BitBot Pro is a multi-tenant AI bot SaaS platform that connects to Discord, Telegram, Zendesk, and Web channels. It provides AI-powered knowledge assistants with a customizable knowledge base, API integrations, and conversation management.

## Core Architecture
- **Frontend**: React SPA with neon electric blue theme
- **Backend**: FastAPI (Python) with 140+ endpoints
- **Database**: MongoDB Atlas
- **Channels**: Web Chat, Discord, Telegram, Zendesk, External API (v1)
- **LLM**: Claude/OpenAI via Emergent Universal Key
- **Storage**: Emergent Object Storage
- **Email**: Emergent Managed Resend

## Branding
- **Name**: BitBot Pro (renamed from BridgeBot)
- **Theme**: Neon electric blue palette
- **Logo**: Chunky logo across all pages (48px in header/footer)

## Authentication
- JWT-based auth with email/username + password
- Admin role: `administrator` / `Admin@123`
- Multi-tenant: instances with assigned users
- User invitation system with email sign-up links

## Completed Features

### Zendesk Sidebar App — Agent Assist (Done — Nov 2026)
- [x] `POST /api/zendesk/sidebar/generate` — On-demand AI suggestion for any ticket
  - Auth via per-instance `X-Sidebar-Key` header (not JWT)
  - Fetches full ticket conversation from Zendesk via OAuth
  - Runs existing knowledge base search + AI pipeline (Claude)
  - Returns suggestion with `low_confidence` flag when no matching KB content
  - Stores suggestion in `zendesk_suggestions` collection (for analytics)
  - Treats ticket content as untrusted input (not instructions)
  - Does NOT post comments, change ticket status, or send replies
- [x] `GET /api/admin/zendesk/sidebar-key` — Get/auto-generate sidebar API key
- [x] `POST /api/admin/zendesk/sidebar-key/regenerate` — Rotate sidebar key (old key invalidated)
- [x] `GET /api/admin/zendesk/sidebar-app.zip` — Dynamic ZIP download (ZAF v2 app)
- [x] ZAF v2 sidebar app with: Generate, Regenerate, Copy, Insert into Reply controls
- [x] Ticket switch detection (invalidates stale suggestions via `ticket.id.changed`)
- [x] Dark theme matching BitBot Pro aesthetic
- [x] Installation parameters: `bitbot_url` (pre-filled) + `sidebar_api_key` (secure)
- [x] Admin UI card in ZendeskSettings page with 3-step setup guide
- [x] Tested: 100% pass rate (21/21 tests, iteration_63.json)

### Zendesk UX Improvements (Done — Nov 2026)
- [x] Callback URL prominently displayed with copy button for easy Zendesk setup
- [x] Subdomain field auto-normalizes URLs on blur (strips https://, .zendesk.com)
- [x] Updated ZENDESK_OAUTH_SETUP.md with in-app credential management instructions

### Zendesk Analytics Dashboard (Done — Nov 2026)
- [x] `GET /api/analytics/zendesk` endpoint with ticket processing stats
- [x] Stat cards, charts, action breakdown, recent tickets table
- [x] Connection status indicator and empty states
- [x] Tested: 100% pass rate (iteration_62.json)

### Zendesk OAuth Migration (Done — Feb 2026)
- [x] OAuth 2.0 authorization-code flow + PKCE
- [x] Secure token storage in MongoDB (access: 8h, refresh: 30d)
- [x] Automatic token refresh with rotation
- [x] In-app OAuth credential management (Client ID + Secret via UI)

### Admin Role Management (Done — Feb 2026)
- [x] Promote/demote users with self-role-change prevention

### User Invitation System (Done — Feb 2026)
- [x] Email invitations with Resend, role + instance assignment, 7-day expiry

### Self-Hosting Readiness (Done)
- [x] Full codebase audit (135+ endpoints)
- [x] 7 Markdown documentation files in `/app/docs/self-hosting-readiness/`

## Key API Endpoints

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/zendesk/sidebar/generate` | POST | X-Sidebar-Key | On-demand AI ticket suggestion |
| `/api/admin/zendesk/sidebar-key` | GET | JWT+Instance | Get sidebar API key |
| `/api/admin/zendesk/sidebar-key/regenerate` | POST | JWT+Instance | Rotate sidebar key |
| `/api/admin/zendesk/sidebar-app.zip` | GET | JWT+Instance | Download ZAF app ZIP |
| `/api/analytics/zendesk` | GET | JWT+Instance | Zendesk ticket stats |
| `/api/admin/zendesk/oauth/callback-url` | GET | JWT+Instance | Get OAuth callback URL |
| `/api/admin/users/invite` | POST | Admin | Send email invitation |
| `/api/admin/users/{id}/role` | PATCH | Admin | Promote/demote user |

## Pending / Upcoming Tasks

### P0 — GitHub Export
- Export the application to GitHub for self-hosting migration

### P1 — WhatsApp Integration
- Scope out and integrate WhatsApp channel
- Create standalone `/app/backend/whatsapp_routes.py`

### P2 — Backend Refactor
- Break `/app/backend/server.py` (>6,500 lines) into modular files
- APP_MODE env splitting (worker vs api)

### P2 — Multi-Server Discord
- Support multiple Discord servers per bot instance

## Production URLs
- Production: `https://bitbotpro.io`
- Preview: `https://rag-search-dev.preview.emergentagent.com`
