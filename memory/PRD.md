# BridgeBot — Product Requirements Document

## Product Overview
Multi-tenant SaaS chatbot platform enabling AI-powered Discord, Web, Telegram, and Zendesk bots with Knowledge Base, multi-API integrations, and unified AI reasoning.

## Core Requirements
- Multi-tenant bot instance management with admin dashboard
- Knowledge Base ingestion (text, PDF, web scrape) with vector search
- Discord, Web, Telegram, and Zendesk chat interfaces
- Unified AI reasoning: LLM receives KB context + live API data simultaneously
- Multi-API integration management with endpoint CRUD
- BYOK OpenAI support + Emergent Universal Key fallback

## Architecture
- **Backend**: FastAPI on port 8001, MongoDB
- **Frontend**: React SPA on port 3000
- **AI**: Emergent Universal Key (Claude/GPT), BYOK OpenAI
- **Integrations**: Discord.py, Telegram Bot API, Zendesk REST API, external REST APIs

## Implemented Features

### Phase 1–16 (Previously Completed)
Core platform, API integrations, LLM config, diagnostics, pipeline fixes, scraper improvements, conversations, knowledge gate, KB export/import, GitHub crawler, file filters, widget theming, embed.js, integration analytics, welcome messages, bot logo upload, rich markdown formatting.

### Phase 17 — Copy Button UX Fix (Nov 2026)
- Minimal 12px clipboard icon outside message bubble, hover-only, code block copy icon-only

### Phase 18 — Telegram Bot Integration (Nov 2026)
- Backend `telegram_routes.py`: Config CRUD, token validation, webhook auto-registration
- Listen modes: `all`, `mention_or_command`, `dm_only` (admin-configurable per instance)
- AI pipeline: KB search + API query + LLM response, saved as platform="telegram"
- Frontend `TelegramSettings.js`: Token input, connect/disconnect, mode selector, active toggle

### Phase 19 — Platform Stats Dashboard (Nov 2026)
- Analytics upgrade with `platform_breakdown` (Web, Discord, Telegram, API, Zendesk)
- Daily trend endpoint: `GET /api/analytics/daily-by-platform`
- Dashboard: platform cards, grouped bar trend chart, Quick Actions

### Phase 20 — Telegram Rich Replies (Nov 2026)
- AI-driven contextual inline keyboard buttons (1-3 follow-up suggestions)
- Callback handler: button taps processed as new questions through full AI pipeline

### Phase 21 — Conversation Platform Filters (Nov 2026)
- Telegram, API, Zendesk filter buttons; PlatformBadge for all 5 platforms

### Phase 22 — Zendesk Integration (Nov 2026)
- Backend `zendesk_routes.py` with auto-reply and agent-assist modes
- Independent toggles, webhook listeners, event deduplication

### Phase 23 — Documentation, Onboarding & Changelog (Nov 2026)
- Updated docs, Onboarding Wizard, admin-editable Changelog, Docs search bar

### Phase 24 — Homepage Redesign (Feb 2026)
- 11-section marketing landing page at `/`
- Midnight Blue palette with restrained neon blue/cyan accents
- All CTAs linked to existing routes

### Phase 25 — Logo, Animations, Live Demo & Login Cleanup (Feb 2026)
- **New BridgeBotLogo SVG**: Two overlapping chat bubbles (blue gradient + cyan) with white robot eyes
  - Created `/app/frontend/src/components/BridgeBotLogo.js`
  - Replaced all lucide-react `Bot` icons across 13 files: LandingPage, Login, Register, AdminLayout, ChatPage, ChatWidget, Docs, DiscordInvited, InstanceSelect, ResetPassword, VerifyEmail, ForgotPassword, Instances
- **Scroll Fade-in Animations**: IntersectionObserver-based `FadeIn` wrapper on all homepage sections below hero
  - Uses cubic-bezier easing, 32px translateY reveal
  - Respects `prefers-reduced-motion` media query
- **Live Chat Demo**: Replaced static hero mockup with embedded `/widget?mode=inline` iframe
  - Visitors can test the bot directly on the homepage
  - Green "Live demo" indicator
- **Login Page Cleanup**: Removed robot-hero.png 50/50 split layout, now centered single-column form
- **Testing**: 100% pass rate (19/19 frontend tests — iteration 55)

## DB Collections
- `telegram_config`: {instance_id, bot_token, listen_mode, is_active}
- `zendesk_config`: {instance_id, subdomain, email, api_token, auto_reply, agent_assist, is_active}
- `changelog_entries`: {id, version, title, changes, date}

## Backlog
- P1: WhatsApp Integration (MUST use integration_playbook_expert_v2)
- P2: Refactor server.py into modular route files (/routes, /models, /services)
- P2: APP_MODE env splitting (worker vs api)
- P2: Multi-server Discord feature
