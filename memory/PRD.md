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

### Phase 1–23 (Previously Completed)
Core platform, API integrations, LLM config, diagnostics, scraper improvements, conversations, knowledge gate, KB export/import, GitHub crawler, widget theming, embed.js, integration analytics, copy button fix, Telegram integration (rich replies, contextual buttons), Platform Stats Dashboard, Conversation Filters, Zendesk integration (auto-reply + agent-assist), Documentation, Onboarding Wizard, Changelog page, Docs search bar.

### Phase 24 — Homepage Redesign (Feb 2026)
- 11-section marketing landing page at `/` (Hero, Channels, Knowledge, Live API, Zendesk, Widget, Dashboard, How It Works, FAQ, CTA, Footer)
- Midnight Blue palette with restrained neon blue/cyan accents
- All CTAs linked to existing routes (/register, /login, /chat, /docs)

### Phase 25 — Logo, Animations, Live Demo & Cleanup (Feb 2026)
- **New BridgeBotLogo SVG** (`/app/frontend/src/components/BridgeBotLogo.js`):
  - ViewBox `0 0 64 56` — two overlapping chat bubbles (blue gradient + solid cyan) with white eyes and dark pupils
  - Designed for legibility from 16px to 64px+
  - Replaced across 13+ files: LandingPage, Login, Register, AdminLayout, ChatPage, ChatWidget, Docs, DiscordInvited, InstanceSelect, ResetPassword, VerifyEmail, ForgotPassword, Instances
- **Removed gradient-box wrappers** from all branding positions — logo SVG now renders directly without wrapping div+gradient+shadow
- **Removed repetitive elements**:
  - Login: removed robot-hero.png 50/50 split layout → centered form, removed Documentation link
  - Register, ForgotPassword, ResetPassword, VerifyEmail: replaced heavy gradient-box logos with minimal SVG+text links to home
  - Docs header: simplified from gradient-box to direct SVG link
  - ChatPage header + message avatars: removed gradient boxes
  - AdminLayout sidebar: removed gradient box wrapper
- **Scroll fade-in animations**: IntersectionObserver-based `FadeIn` wrapper on all homepage sections below hero, cubic-bezier easing, prefers-reduced-motion support
- **Live chat demo**: Replaced static hero mockup with embedded `/widget?mode=inline` iframe for interactive demo
- **Testing**: 100% pass rate across iterations 55 + 56 (33/33 total tests)

## DB Collections
- `telegram_config`: {instance_id, bot_token, listen_mode, is_active}
- `zendesk_config`: {instance_id, subdomain, email, api_token, auto_reply, agent_assist, is_active}
- `changelog_entries`: {id, version, title, changes, date}

## Backlog
- P1: WhatsApp Integration (MUST use integration_playbook_expert_v2)
- P2: Refactor server.py into modular route files (/routes, /models, /services)
- P2: APP_MODE env splitting (worker vs api)
- P2: Multi-server Discord feature
