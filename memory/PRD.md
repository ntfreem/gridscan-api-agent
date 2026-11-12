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

## Visual Identity
- **Logo**: Two thick-stroked outlined speech bubbles that interlink — blue (left, tail bottom-left) goes OVER cyan at top; cyan (right, tail bottom-right) goes OVER blue at bottom. Subtle white oval robot eyes in center. SVG at `/app/frontend/src/components/BridgeBotLogo.js`
- **Palette**: Midnight Blue (#0B1020 bg), neon blue (#3B82F6 primary, #6BAAFF highlights), neon cyan (#3CDBD3 accents), with glow effects on interactive elements
- **Typography**: Outfit (headings), IBM Plex Sans (body), JetBrains Mono (mono)

## Implemented Features

### Phase 1–23 (Previously Completed)
Core platform, API integrations, LLM config, diagnostics, scraper improvements, conversations, knowledge gate, KB export/import, GitHub crawler, widget theming, embed.js, integration analytics, copy button fix, Telegram integration (rich replies, contextual buttons), Platform Stats Dashboard, Conversation Filters, Zendesk integration (auto-reply + agent-assist), Documentation, Onboarding Wizard, Changelog page, Docs search bar.

### Phase 24 — Homepage Redesign (Feb 2026)
- 11-section marketing landing page at `/`

### Phase 25–26 — Logo, Animations, Neon Treatment & Cleanup (Feb 2026)
- **Interlinking BridgeBotLogo SVG**: clipPath-based weave effect, neon glow prop, replaces all old Bot icons across 13+ files
- **Neon blue/cyan glow effects**: Primary buttons, card hovers, FAQ open state, section tags, hero background, CTA section, step icons
- **Updated palette**: brand.light=#6BAAFF, brand.cyan=#3CDBD3, added neonBlue/neonCyan/neonGlow shadow tokens in theme.js
- **Scroll fade-in animations**: IntersectionObserver-based FadeIn on all homepage sections
- **Live chat demo**: Embedded `/widget?mode=inline` iframe in hero section
- **Repetitive element cleanup**: Auth pages (Login, Register, ForgotPassword, ResetPassword, VerifyEmail) — removed gradient-box logos, robot-hero.png, redundant Documentation links
- **Testing**: 100% pass rate across iterations 54–57 (47/47 total tests)

## Backlog
- P1: WhatsApp Integration (MUST use integration_playbook_expert_v2)
- P2: Refactor server.py into modular route files (/routes, /models, /services)
- P2: APP_MODE env splitting (worker vs api)
- P2: Multi-server Discord feature
