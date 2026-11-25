# BitBot Pro — Product Requirements Document

## Product Overview
Multi-tenant AI bot SaaS platform (BitBotPro) with a React frontend connected to a self-hosted Spec 012 API (`api.bitbotpro.io`). The frontend is built on a neon-blue glass-morphism design system.

## Architecture
- **Frontend**: React SPA with session-cookie auth, CSRF headers, Outfit/IBM Plex fonts
- **Backend API**: External at `https://api.bitbotpro.io` (managed by Claude Code)
- **Preview Proxy**: Local FastAPI reverse proxy at `/app/backend/server.py`
- **Gridscan Agent Module**: Standalone Python package at `/app/gridscan_agent/`

---

## Completed Work

### Phase 1 — Foundation (Complete)
- Restored theme.js, BridgeBotLogo, SessionContext, AdminLayout
- Login, ForgotPassword, ResetPassword pages
- Dashboard with stat cards and bot list
- Preview proxy for CORS bypass

### Phase 2 — Core Management (Complete)
- CredentialsPage, KnowledgePage, BotSettingsPage
- BotInstancesPage, BotKnowledgePage, BotIntegrationsPage
- InstancePage, AccountPage
- All using real Spec 012 API endpoints

### Phase 3 — Integrations & Monitoring (Complete, Deployed)
- MembersPage, PlatformPage, DiscordAppsPage, AnalyticsPage
- 21 pages compiled and deployed to production

### Phase 4 — Missing Feature Additions (Complete)
- PlatformPage: Organisations tab (create/delete with cascade preview)
- InstancePage: WebchatConfigPanel (Appearance/Content/Behavior tabs)
- KnowledgePage: DomainGroup expandable sections for URL sources
- ApiScraperPage: Standalone API testing tool
- AdminLayout: Developer section with API Scraper nav

### Phase 5 — Gridscan Agent Module (Complete, Dec 2026)
- **Standalone Python module** (`/app/gridscan_agent/`) — pip-installable, GitHub-exportable
- **89 Cardano API endpoints** auto-loaded from OpenAPI spec at `ada.api.gridscan.io`
- **Anthropic tool-calling**: Claude picks which endpoint(s) to call per message
- **Dual backend**: Emergent universal key (litellm proxy) OR raw Anthropic SDK
- **Conversation memory**: Remembers addresses, tx hashes, pool IDs, epochs across turns
- **Raw JSON passthrough**: Model returns actual API data, never makes up blockchain info
- **Multi-call chaining**: Can call multiple endpoints in one turn (e.g., block → txs → tx details)
- **Rate limiting**: Token-bucket rate limiter
- **Audit log**: Every API call logged with endpoint, status, timing
- **Test CLI**: Interactive terminal tester (`python -m gridscan_agent.test_cli`)
- **Test Web UI**: FastAPI server with dark-themed chat interface on port 8099
- **Tested**: 3-turn conversation verified live (block → transactions → network info)

---

## Remaining / Backlog

### P0
- KB Import/Export: Needs backend endpoints (not in Spec 012 contract yet)

### P1
- Deploy Gridscan Agent to production alongside main app
- Integrate agent module with BitBotPro bot message handlers
- Discord bot integration with tool-calling agent

### P2
- Codebase cleanup of unused legacy components
- Real-world testing with production test account on api.bitbotpro.io
