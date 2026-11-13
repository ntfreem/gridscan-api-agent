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
- [x] Connection status, reconnect, disconnect controls
- [x] Admin setup guide: `/app/docs/ZENDESK_OAUTH_SETUP.md`
- **BLOCKED**: Live connection requires Zendesk Admin to create OAuth client

### Admin Role Management (Done — Feb 2026)
- [x] `PATCH /api/admin/users/{user_id}/role` endpoint
- [x] Promote users to Admin or demote admins to User
- [x] Self-role-change prevention
- [x] UI buttons: ShieldCheck (promote) / ShieldOff (demote) per user
- [x] Current user shows "You" label (no action buttons)

### User Invitation System (Done — Feb 2026)
- [x] `POST /api/admin/users/invite` — send email invitation with role + optional instance
- [x] `GET /api/invite/{token}` — public validate endpoint
- [x] `POST /api/invite/{token}/accept` — create pre-verified user account
- [x] `GET /api/admin/users/invitations` — list all invitations
- [x] `DELETE /api/admin/users/invitations/{token}` — revoke pending invite
- [x] Email sent via Resend with branded HTML template
- [x] Invite accept page (`/invite/:token`) with username/password form
- [x] Pre-verified on accept (skips email verification)
- [x] Optional instance pre-assignment during invite
- [x] 7-day token expiry, single-use, duplicate prevention
- [x] Role selection (Team Member / Admin) in invite modal
- [x] Instance selection dropdown in invite modal

### Self-Hosting Readiness (Done)
- [x] Full codebase audit (135+ endpoints)
- [x] 7 Markdown documentation files in `/app/docs/self-hosting-readiness/`
- [x] OpenAPI JSON export

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

## Key API Endpoints (User Management)

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/users/invite` | POST | Admin | Send email invitation |
| `/api/admin/users/invitations` | GET | Admin | List all invitations |
| `/api/admin/users/invitations/{token}` | DELETE | Admin | Revoke invitation |
| `/api/invite/{token}` | GET | Public | Validate invite token |
| `/api/invite/{token}/accept` | POST | Public | Accept invite, create account |
| `/api/admin/users/{id}/role` | PATCH | Admin | Promote/demote user |

## Production URLs
- Production: `https://bitbotpro.io`
- Preview: `https://rag-search-dev.preview.emergentagent.com`
