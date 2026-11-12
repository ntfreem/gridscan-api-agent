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
- [x] Auth pages cleaned (Login, Register, ForgotPassword)
- [x] BridgeBotLogo component with animated drifting pupils on hover (PNG-based)
- [x] Logo replaced globally, sizes increased to chunky/prominent
- [x] Full site rename: BridgeBot → BitBot Pro
- [x] Onboarding Wizard (Setup Guide) — 5-step full-screen flow at /admin/setup-guide
- [x] Progress Confetti — canvas-confetti celebration + banner when all 5 steps complete
- [x] Step Badges — Animated checkmark badges with pop/draw/slide animations on real-time step transitions (8s polling + focus)

## P0 — Current Sprint
- [ ] WhatsApp channel integration (config page + webhook messaging)

## P1 — Upcoming
- [ ] API key usage stats dashboard widget
- [ ] Changelog page (public-facing)

## P2 — Future / Backlog
- [ ] Refactor server.py into modular route files (/routes, /models, /services)
- [ ] APP_MODE env splitting (worker vs api)
- [ ] Multi-server Discord feature

## Key API Endpoints
- GET/PUT /api/admin/telegram-config
- GET/PUT /api/admin/zendesk-config
- GET /api/analytics/daily-by-platform
- GET /api/onboarding/step-status

## Credentials
- Admin: administrator / Admin@123

## Brand Notes
- Product name: "BitBot Pro" (with "Pro" in accent color)
- Logo: PNG at /assets/bridgebot-logo.png (file name kept for compatibility)
- Component name: BridgeBotLogo (internal code identifier)
