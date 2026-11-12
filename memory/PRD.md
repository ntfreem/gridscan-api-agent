# BitBot Pro PRD

## Original Problem Statement
Redesign the homepage to clearly sell main features (Knowledge, API data, Channels, Customization) using a Midnight Blue theme with sleek neon blue and cyan accents. Implement fade-in animations, an embedded live chat demo, and integrate a custom interlinking chat-bubble logo with animated drifting pupils on hover. Clean up repetitive graphical elements across auth pages.

PRODUCT REQUIREMENTS UPDATE: Add "API key usage stats", onboarding wizard, changelog, and scope out WhatsApp integration. Rename entire site from "BridgeBot" to "BitBot Pro".

## Product Overview
Multi-tenant bot SaaS platform (Discord, Web, Telegram, Zendesk) with a FastAPI backend and React frontend. Features KB system (GitHub/URL crawling), API diagnostics, admin dashboard, and polished marketing landing page.

## Architecture
- Frontend: React (CRA) with Tailwind-inspired inline styles, Shadcn/UI
- Backend: FastAPI (server.py >6.2k lines, needs future refactor)
- Database: MongoDB Atlas
- Integrations: OpenAI/Claude (Emergent LLM Key), Discord, Telegram, Zendesk, Emergent Object Storage

## Completed Features
- [x] Redesigned landing page with marketing copy, hero, neon cyan/blue theme
- [x] Embedded live chat demo on homepage hero
- [x] Scroll-based fade-in animations (IntersectionObserver)
- [x] Auth pages cleaned (Login, Register, ForgotPassword) — no repetitive gradient boxes
- [x] BridgeBotLogo component with animated drifting pupils on hover (PNG-based)
- [x] Logo replaced globally across all pages
- [x] Logo sizes increased to chunky/prominent (56px navbar, 52px admin, 48px footer)
- [x] Full site rename: BridgeBot → BitBot Pro (all 20+ files, 100+ occurrences)
- [x] **Onboarding Wizard (Setup Guide)** — Full-screen 5-step flow at /admin/setup-guide:
  - Step 1: Create First Bot (links to /admin/instances)
  - Step 2: Add Knowledge (links to /admin/knowledge)
  - Step 3: Customize Persona (links to /admin/settings)
  - Step 4: Test Bot (opens chat demo)
  - Step 5: Deploy to Channel (4 channel cards: Web Widget, Discord, Telegram, Zendesk)
  - Dynamic step completion from real DB data (no manual marking)
  - Always accessible via sidebar NavLink
  - Backend: GET /api/onboarding/step-status
  - Tested: 100% pass (8/8 backend, all frontend)

## P0 — Current Sprint
- [ ] WhatsApp channel integration (config page + webhook messaging)

## P1 — Upcoming
- [ ] API key usage stats dashboard widget
- [ ] Changelog page (public-facing)

## P2 — Future / Backlog
- [ ] Refactor server.py into modular route files (/routes, /models, /services)
- [ ] APP_MODE env splitting (worker vs api)
- [ ] Multi-server Discord feature

## Key DB Schema
- `telegram_config`: {instance_id, bot_token, listen_mode, is_active}
- `zendesk_config`: {instance_id, subdomain, admin_email, api_token, auto_reply, agent_assist, is_active}
- `changelog_entries`: {id, version, title, changes, date}

## Key API Endpoints
- GET/PUT /api/admin/telegram-config
- GET/PUT /api/admin/zendesk-config
- GET /api/analytics/daily-by-platform
- GET /api/admin/onboarding-status
- GET /api/onboarding/step-status (dynamic step completion)

## Credentials
- Admin: administrator / Admin@123

## Brand Notes
- Product name: "BitBot Pro" (with "Pro" in accent color)
- Logo: PNG at /assets/bridgebot-logo.png (file name kept for compatibility)
- Component name: BridgeBotLogo (internal code identifier)
- Production domain: bridgebot.tech
