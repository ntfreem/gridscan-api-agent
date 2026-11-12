# BitBot Pro PRD

## Original Problem Statement
Redesign the homepage to clearly sell main features (Knowledge, API data, Channels, Customization) using a Midnight Blue theme with sleek neon blue and cyan accents. Implement fade-in animations, an embedded live chat demo, and integrate a custom interlinking chat-bubble logo with animated drifting pupils on hover. Clean up repetitive graphical elements across auth pages.

PRODUCT REQUIREMENTS UPDATE: Add "API key usage stats", onboarding wizard, changelog, and scope out WhatsApp integration. Rename entire site from "BridgeBot" to "BitBot Pro". Reduce neon by 60%, shift to more cyan.

## Product Overview
Multi-tenant bot SaaS platform (Discord, Web, Telegram, Zendesk) with a FastAPI backend and React frontend. Features KB system (GitHub/URL crawling), API diagnostics, admin dashboard, and polished marketing landing page.

## Architecture
- Frontend: React (CRA) with inline styles, Shadcn/UI
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
- [x] Progress Confetti + celebration banner when all 5 steps complete
- [x] Animated step badges with pop/draw/slide animations on real-time transitions
- [x] Mobile responsive: Setup Guide + AdminLayout hamburger sidebar
- [x] Cyan color shift — entire palette from electric blue to soft cyan (#22B8CF), 60% less neon glow
- [x] Logo text unified: "BitBot" in cyan, "Pro" in white everywhere (header + footer + auth + docs)

## P0 — Current Sprint
- [ ] WhatsApp channel integration (config page + webhook messaging)

## P1 — Upcoming
- [ ] API key usage stats dashboard widget
- [ ] Changelog page (public-facing)

## P2 — Future / Backlog
- [ ] Refactor server.py into modular route files (/routes, /models, /services)
- [ ] APP_MODE env splitting (worker vs api)
- [ ] Multi-server Discord feature

## Credentials
- Admin: administrator / Admin@123

## Brand Notes
- Product name: "BitBot Pro" — "BitBot" in cyan (#5CC8D8), "Pro" in white
- Logo: PNG at /assets/bridgebot-logo.png (file name kept for compatibility)
- Primary cyan: #22B8CF, Light cyan: #5CC8D8, Teal: #2B9EB8, Accent: #3CDBD3
