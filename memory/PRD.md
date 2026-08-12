# BridgeBot — Product Requirements Document

## Overview
Multi-tenant SaaS chatbot platform where admins create AI knowledge-base instances and assign them to users. Supports web chat, embeddable widget, and Discord bot integration.

## Core Architecture
- **Frontend**: React (CRA), Tailwind, Shadcn/UI components
- **Backend**: FastAPI (Python), single `server.py` (~2000 lines)
- **Database**: MongoDB Atlas — **`bridgebot_preview`** for the preview environment, **`bridgebot_prod`** for production (isolated databases in the same cluster as of 2026-05-26)
- **Auth**: Hybrid JWT (Bearer + HttpOnly Cookie), supports email or username login
- **LLM**: Claude via Emergent Universal Key
- **Email**: Resend API (LIVE — `bridgebot.tech` domain verified; free-tier daily quota limits apply)
- **Discord**: discord.py + Discord OAuth2 Application flow

## Design System
- Theme: "Tactical Futurism" — soft, rounded, blue palette
- Tokens defined in `/app/frontend/src/theme.js`

## Implemented Features

### Authentication (DONE)
- Email or Username login/registration
- Admin default username: `administrator`
- JWT tokens with 7-day expiry
- Password reset flow (email MOCKED via Resend)

### Multi-Tenant Instances (DONE)
- Admins create/manage bot instances
- Users assigned to instances

### Knowledge Base (DONE)
- FAQ entries, URL scraping, document upload
- **Priority system** (Normal/Medium/High) — High-priority sources checked first
- Priority can be set when adding and changed inline with up/down arrows
- Search sorts by priority then text relevance

### Chat (DONE)
- Web chat page + embeddable widget
- Session-based conversations
- Claude LLM with knowledge context + knowledge gate protocol

### Discord Bot (DONE)
- OAuth2 "Invite Bot" flow with one-click server invite
- Live config: listen mode, reply style, channel selection read from DB per message
- Bot name sync pushes server nickname (not just global username)

### Analytics (DONE)
- Dashboard overview, daily stats, LLM usage tracking

### UI Redesign (DONE)
- Soft, rounded, blue theme across all components

### Discord App Setup Page (DONE — 2026-05-25)
- New admin-only page at `/admin/discord-app-setup` with sidebar nav item
- Step-by-step Discord Developer Portal walkthrough (7 steps)
- Current Configuration display (masked credentials + last updated timestamp)
- Update Credentials form (moved from Discord Settings page)
- Danger Zone: Clear all credentials with confirmation dialog showing currently-connected instances + optional checkbox to also wipe instance ↔ guild mappings
- "How the mapping works" reference card + link to architecture docs
- Backend endpoints: `GET /api/discord/app-config/connections`, `DELETE /api/discord/app-config?clear_connections=bool`

### Architecture Docs Section (DONE — 2026-05-25)
- New "Architecture & Flow" section in `/docs` with monospace ASCII diagrams
- Includes: Message Flow end-to-end, Discord App ↔ Instance ↔ Server mapping, Data Stores, Three Key Architectural Decisions
- URL hash navigation (`/docs#architecture` opens straight to section)
- Linked from Discord App Setup page

### Passive Mode (DONE — 2026-05-25)
- New per-instance Discord setting: bot continuously monitors but only replies when it detects a real question it can confidently answer from the KB
- Implementation: single LLM call with `[SKIP]` sentinel — Claude returns `[SKIP]` for small-talk/non-questions, backend stays silent
- @mentions and DMs always get a reply (bypasses passive check) per UX recommendation
- UI toggle on `/admin/discord` page between Reply Style and Human Takeover
- Field: `discord_config.passive_mode` (boolean, default false)

### Passive Mode Session Bug Fix + Skip Analytics (DONE — 2026-05-26)
- **Bug fix**: `LlmChat` sessions cached per Discord user kept the OLD system prompt forever. When Passive Mode was toggled ON, returning users still chatted normally because their cached session never picked up the `[SKIP]` instruction. Fix: `call_claude` now refreshes `session.messages[0]` (the system role) on every call, so prompt changes take effect immediately.
- **Analytics**: new `passive_skips` MongoDB collection logs every skip (instance_id, channel_id, username, message preview, timestamp)
- New endpoint `GET /api/analytics/passive-skips` returns today / last 7 days / all-time counts + last 10 skipped messages
- Analytics page now shows a "Passive Mode Skips" card (only appears when count > 0) with the 3 totals and a recent-activity list

### "Train on this" Feature (DONE — 2026-05-26)
- Each row in the "Recent skipped messages" list has a small "+ Train" button
- Clicking opens a modal pre-filled with the skipped question, an Answer textarea, and Priority selector (Normal/Medium/High)
- Clicking "Add to Knowledge Base" calls `POST /api/knowledge/sources/faq` and instantly adds it to the active instance's KB
- Closes the loop: missed-question → FAQ entry without leaving the analytics page

### Scripted Mode (DONE — 2026-06-24)
- New per-instance Discord setting for incident/maintenance communications: bot ignores the KB and replies with configured messages instead
- Primary message → exact verbatim on first contact per user/channel
- Follow-ups → rephrased (AI / manual variants / hybrid) so it doesn't feel robotic
- Configurable: primary message, list of manual variants, fallback message, max attempts per user, counter-reset hours, rephrase mode
- Per-user per-channel counter stored in new `scripted_counters` MongoDB collection
- Respects Passive Mode: if both are on, bot still uses Claude to gate small-talk
- @mentions/DMs also get scripted replies (incident mode = silent override)
- UI: new "Scripted Mode" card on `/admin/discord` between Passive Mode and Human Takeover

### Share Invite Link (UPGRADED — 2026-06-24)
- New "Share invite link" block on the Discord Channel page (under the "Invite Bot to Server" button)
- Generates a Discord OAuth URL with `state=share:<instance_id>` so the callback knows it's a third-party invite
- **Copy** button — copies link to clipboard
- **Email** button — opens an inline form with recipient email/name/note fields; backend sends a fully-branded HTML email via Resend (no more mailto, no email client dependency)
- Backend endpoints:
  - `GET /api/discord/share-oauth-url` — generates the share OAuth URL
  - `POST /api/discord/send-invite-email` — sends Resend-powered HTML email with the invite link
- New public landing page at `/discord/invited?guild=...&bot=...` — renders a friendly "You're all set!" success message for the third-party user (no BridgeBot login required). They never see the admin panel.
- The host admin sees the newly invited guild auto-linked to their instance and can configure it as usual


### Global Response Defaults (REVERTED 2026-07-15)
- Originally moved Acknowledgment Replies and Fallback Message to Bot Settings as global per-instance settings
- **Reverted**: User found the AI router works better when these are directly in the Scripted Mode config on Discord Settings
- Ack replies and fallback are back in `discord_config.scripted_mode` where the AI router reads them directly
- The `reply-defaults` API endpoints on bot_instances remain but are no longer the primary source


### Smart URL Scraper + Knowledge Search (DONE 2026-07-15)
- **Bug**: URL scraper only stored 6,000 chars and couldn't extract content from JavaScript-rendered pages (Next.js, React SPAs). The Lace FAQ page (141 Q&As, 85K chars) returned only 25 chars.
- **Fix 1 — Next.js extraction**: Added `_extract_nextjs_content()` that detects and parses `__NEXT_DATA__` JSON embedded in Next.js pages, extracting structured Q&A from Sanity CMS portable text blocks.
- **Fix 2 — Content chunking**: Large scraped content is automatically split into ~8K chunks at section/Q&A boundaries via `_split_into_chunks()`. Each chunk becomes a separate searchable KB entry (e.g., "Lace FAQ (part 1/13)").
- **Fix 3 — Smart knowledge search**: `search_knowledge()` now uses MongoDB `$text` search for relevance-based retrieval. For large documents, `_extract_relevant_window()` scores content positions by query word frequency and extracts the most relevant ~2,500 char window.
- Storage limits increased from 6K to 50K per document (for non-chunked sources).
- Tests: 7/7 backend pytest covering chunked scraping, chat Q&A accuracy across staking, hardware wallets, Midnight, and swap topics.

### Per-Instance Cost Dashboard (DONE 2026-02-XX)
- Captures real input/output tokens per LLM call:
  - **Anthropic SDK**: `resp.usage.input_tokens` / `output_tokens` (exact)
  - **Ollama**: `prompt_eval_count` / `eval_count` (exact)
  - **Emergent** path: heuristic estimate via `_estimate_tokens` (~4 chars/token) since the library doesn't expose usage
- New `LLM_PRICING` table covering Anthropic 4-series (Haiku $1/$5, Sonnet $3/$15, Opus $15/$75 per 1M tokens) + legacy 3.5 + Ollama=$0 + Sonnet-fallback for unknown.
- `_cost_for(model, in_tok, out_tok)` — handles provider-prefixed and bare model ids.

### KB Grouped Sources + Categories + Metadata (DONE 2026-08-12)
- **URL scrapes are now grouped** — chunked sources (e.g., 10-part Lace FAQ) appear as a single row with a "10 parts" badge instead of 10 individual rows
- **Categories** — each KB source/group can be tagged with a category (inline editor, autocomplete from existing categories, filter dropdown)
- **Rich metadata** — each row shows: type badge (URL/FAQ/Document), title, URL, scraped date, char count, parts count, category, priority with up/down controls
- **Group operations** — delete, toggle, category, priority all apply to the entire group at once
- New endpoints:
  - `DELETE /api/knowledge/sources/group/{group_id}` — delete all chunks in a group
  - `PATCH /api/knowledge/sources/group/{group_id}/category` — set category for group
  - `PATCH /api/knowledge/sources/group/{group_id}/toggle` — toggle active for group
  - `PATCH /api/knowledge/sources/group/{group_id}/priority` — set priority for group
  - `PATCH /api/knowledge/sources/{source_id}/category` — set category for single source
  - `GET /api/knowledge/categories` — list unique categories
- Validation: 404 for nonexistent groups/sources, priority constrained to 0-2
- Frontend: Complete KnowledgeBase.js rewrite with grouped display, inline category editor, filter
- Tests: 11/11 backend + full desktop E2E pass

- New endpoint `GET /api/analytics/llm-cost`: returns `{month_to_date: {cost_usd, input_tokens, output_tokens, calls, day_of_month, days_in_month}, by_model: [...], daily: [30 days], forecast_month_end_usd, last_30d_cost_usd}`.
- Forecast = `(mtd_cost / day_of_month) * days_in_month` (simple linear projection).
- UI: new Cost Dashboard card on Bot Settings page **directly below the LLM Provider card**:
  - 3 stat tiles: MTD cost / forecast / calls + token count
  - Custom SVG sparkline of 30 daily bars (no chart library dependency)
  - Per-model breakdown rows with provider badge, model name, calls, cost
  - Empty-state when zero calls this month
- Refactor: all `_call_*` helpers now return `(text, in_tok, out_tok)` tuple; `call_claude` dispatcher unpacks and forwards to `_log_llm_usage`.
- Tests: 12 new cost-helper unit tests in `test_llm_provider.py` (now 24 cases), new `test_llm_cost.py` (4 HTTP cases including seeded aggregation + legacy `$ifNull` fallback). 31/31 LLM tests + 51/51 scripted regression all green.

### Per-Instance LLM Provider (Emergent / Anthropic Direct / Ollama) (DONE 2026-02-XX)
- Ported v3.0.0's BYO-Anthropic-key feature **plus** kept Emergent and added Ollama as options.
- New per-instance `llm_config` on `bot_instances`: `{provider, model, anthropic_api_key, ollama_base_url}`.
- Three providers:
  - **emergent** (default): existing emergentintegrations + Universal Key path with the legacy Opus → Sonnet fallback. Behavior fully preserved for any instance without `llm_config`.
  - **anthropic**: direct Anthropic SDK with per-instance BYO API key. Model allowlist: `claude-haiku-4-5`, `claude-sonnet-4-5`, `claude-opus-4-5`.
  - **ollama**: HTTP POST to `{base_url}/api/chat` (default `OLLAMA_BASE_URL` env or `http://localhost:11434`). Any model installed on the Ollama server.
- Refactor: `call_claude` is now a dispatcher; extracted `_call_emergent`, `_call_anthropic`, `_call_ollama`. Added parallel `llm_history` cache for non-Emergent providers.
- New endpoints (admin only):
  - `GET /api/admin/instances/{id}/llm-config` — returns provider, model, masked key preview (`sk-ant-…{last4}`), defaults, allowed models
  - `PUT /api/admin/instances/{id}/llm-config` — saves config; empty `anthropic_api_key` preserves existing saved key; switching providers clears LLM session caches; validates provider and (for anthropic) model
  - `POST /api/admin/instances/{id}/llm-config/test` — one-shot "pong" health check; always returns 200 with `{success: bool, response/error}` so the UI can render a status chip without exceptions
- UI: new "LLM Provider" card on `BotSettings.js` with provider dropdown, conditional fields (free-text model for emergent/ollama, dropdown for anthropic, API key for anthropic, base URL for ollama), Save and Test Connection buttons, result chip.
- UX polish: "Select a workspace first" empty state on Bot Settings page when no instance is selected (was rendering inert forms before).
- Tests: `/app/backend/tests/test_llm_provider.py` (15/15 pass) + 51/51 scripted regression unchanged.

### Saved Scenarios — Regression Suite for Scripted Mode (DONE 2026-02-XX)
- Snapshot-test your Scripted Mode copy: save a sandbox conversation as a named scenario, run it later, system compares per-turn `(pool_name, intent)` against the golden baseline.
- First run auto-captures the golden; subsequent runs return pass / fail / captured_golden.
- Match strategy: `(pool_name, intent)` only — `bot_reply` text is non-deterministic when AI picks from a pool, so we don't compare it.
- New backend helpers: `_run_sandbox_simulation`, `_compare_against_golden`, `_run_scenario_doc`, `_load_scripted_cfg`.
- New endpoints: GET / POST `/discord/scripted-mode/scenarios`, DELETE `/scenarios/{id}`, POST `/scenarios/{id}/run`, POST `/scenarios/{id}/save-golden`, POST `/scenarios/run-all`.
- New collection: `scripted_scenarios` with `{id, instance_id, name, messages, golden_turns, last_run, created_at, updated_at}`.
- UI: Saved Scenarios collapsible card under the Reply Sandbox; per-row status badge (NOT RUN / GOLDEN CAPTURED / PASS / FAIL with count); name input + Save in the sandbox row; Run-all button; Re-bless button visible only on FAIL rows (promotes the latest run to be the new golden after intentional copy changes).
- Tests: `/app/backend/tests/test_scripted_scenarios.py` (18 new tests: 8 unit + 10 HTTP), plus regression sweep of `test_scripted_ai_router.py` (30) + `test_scripted_sandbox_http.py` (15) = **63/63 backend pass**. Frontend building blocks all verified.

### Active Counter Accuracy + Reply Sandbox (DONE 2026-02-XX)
- **Smarter Active Counters**: `GET /api/discord/scripted-counters/count` now filters by `last_at` within the cooldown window. Returns `{active_counters, total_counters, stale_counters, skips_last_24h, reset_hours}`. UI surfaces stale rows as "+ N idle (will auto-reset)" hint and enables Reset whenever total > 0.
- **Reply Sandbox** on `/admin/discord`:
  - New collapsible card on the Scripted Mode panel (`data-testid="sandbox-card"`)
  - Textarea accepts up to 25 user messages, one per line
  - "Run Sandbox" → calls `POST /api/discord/scripted-mode/sandbox` with the UNSAVED form values
  - Per-turn cards show: pool name badge (primary/update/variant/ack/fallback/silent), classified intent, user message, bot reply (or "Silent — {reason}"), `count_after`, and a collapsible "Pool considered" list
  - Sandbox does NOT touch the real `scripted_counters` collection (verified via `count_documents` invariant) — pure dry-run
  - ~2 small Claude calls per message; costs noted in the UI
- **Refactor**: extracted pure `_decide_scripted_reply` helper (no DB I/O). `build_scripted_response` now wraps it with idle-reset, counter persistence, and speculation-skip logging. All 20 v5 test cases pass unchanged.
- Tests: extended `test_scripted_ai_router.py` (+10 cases for the pure helper) + new `test_scripted_sandbox_http.py` (13 HTTP cases). 30/30 backend pytest, 13/13 HTTP, 8/8 frontend.

### Bugfix — Scripted Mode toggle reverting on click (DONE 2026-02-XX)
- User report: "When I create a new instance and try to enable script mode, it keeps disabling it."
- Root cause: React deps cycle in `DiscordSettings.js`. `loadStatus` useCallback had `scripted.enabled` in its deps (added in iteration 11 as a "don't poll when disabled" optimization). The main useEffect had `loadStatus` in its deps. So when the user toggled the switch, `loadStatus`'s identity changed → useEffect re-fired → `loadConfig()` re-ran → server state (still `false` for the unsaved toggle) overwrote the user's click.
- Fix: removed `scripted.enabled` from `loadStatus` deps. Counter endpoint is now polled unconditionally (cheap — returns 0/0 when off).
- Tests: testing_agent_v3_fork — toggle persistence across 11.5s+ (2 full poll cycles), save+reload persistence, OFF-stays-OFF regression, counters card still renders, all 22 backend tests still green.

### Scripted Mode v5 — Fixed Reply 1+2 Start, Then No-Repeat AI Router (DONE 2026-02-XX)
- Per user request: **Reply 1 and Reply 2 are always sent first, verbatim** (no AI, no LLM cost). The AI router only engages from msg3+ (or msg2 when Reply 2 is left blank).
- msg3+ AI router pool composition:
  - `intent=ack` → pick from **Acknowledgments** (acks cycle, allowed to repeat once exhausted)
  - `intent=question/update/other` → pick from **Variants** minus `used_replies`
  - no match → **Fallback** (once per conversation)
  - `intent=speculation` → silent, no count bump
- Reply 1 and Reply 2 are NOT in the msg3+ AI pool (only Variants/Acks/Fallback).
- Carries over from v4: `used_replies` no-repeat tracking, `max_attempts` cap (default 10), idle-reset wipes both `count` and `used_replies`, early cap check skips LLM calls.
- UI hint refresh on `DiscordSettings.js`: Reply 1 subtitle "always sent first" with "no AI involved here", Reply 2 subtitle "always sent second" with "AI router takes over" message; Ack block hint references "After Reply 1 and Reply 2 are sent".
- Tests: `/app/backend/tests/test_scripted_ai_router.py` fully rewritten for v5 (22/22 cases pass).

### Scripted Mode v4 — Unified AI Router Pool (DONE 2026-02-XX)
- AI/Hybrid mode: **every** user message now goes through the AI router from msg1 onwards. No more fixed Reply 1 → Reply 2 → variants sequence.
- Unified question pool = `[primary, update, *variants]`. AI picks the most suitable line per user message.
- **No-repeat guarantee**: `used_replies` is tracked on `scripted_counters` doc. The pool is filtered to exclude already-sent lines before each AI pick.
- **Acknowledgments stay separate** and cycle (allowed to repeat once the list is exhausted).
- **Fallback** fires only when AI can't match any remaining pool item, and only once per conversation (also tracked in `used_replies`).
- **Hard cap** at `max_attempts` (default raised from 2 → **10**) bot replies per user per cooldown window. Cap check now happens **before** any LLM call → zero LLM cost when capped.
- **Idle reset** clears both `count` AND `used_replies` after `reset_hours` of user inactivity (fresh conversation).
- **Manual mode unchanged**: msg1=primary, msg2=update, msg3+=silent, zero LLM cost.
- UI: relabeled "Primary Message" → "Reply 1 — Primary", "Update Message" → "Reply 2 — Update", "Max Attempts per User" → "Max Replies per User". Hints updated to describe unified pool + no-repeat behavior + idle-reset semantics.
- Tests: `/app/backend/tests/test_scripted_ai_router.py` rewritten (21/21 cases pass).

### Scripted Mode v3 — AI Conversation Router (DONE 2026-02-XX)
- Replaces the "silent after msg2" behavior. Msg3+ now uses AI as a router (never a generator) to pick from admin-defined message pools
- New `acknowledgment_replies` field in `ScriptedModeConfig` — short replies for "thanks/ok/got it"
  - Auto-seeded with 4 defaults: "You're welcome!", "Anytime — happy to help!", "No problem!", "Glad I could help."
- New helpers in `server.py`:
  - `_classify_user_intent()` extended with `ack` label (was: question/update/speculation/other)
  - `_ai_pick_variant(user_text, options, ...)` — returns 1-based int index or 0. Robust regex parser handles "option 2", "Pick: 1", "-1", "5.", garbage → 0. **Never** returns text.
- Flow at msg3+:
  - Manual rephrase mode → fully silent (cost-zero contract, no LLM calls)
  - AI / Hybrid rephrase mode → classify intent →
    - `ack` → pick from `acknowledgment_replies` (first ack as safe default if AI returns 0)
    - `question`/`update`/`other` → pick from `variants`
    - `speculation` → silent (don't waste a fallback)
    - No match → `fallback_message` (else silent)
- UI: new "Acknowledgment Replies" section on Discord Settings page, gated on rephrase_mode in {ai, hybrid}, with editable rows and 4 pre-filled defaults
- Tests: `/app/backend/tests/test_scripted_ai_router.py` (31/31 runnable pass — covers parser robustness, intent routing, manual-mode silence, ack pool selection, default seeding)

### Reset Scripted Counters (DONE 2026-02-XX)
- New `POST /api/discord/scripted-counters/reset` endpoint wipes per-user `scripted_counters` for the current instance (admin only, scoped via `get_instance_access`)
- New `GET /api/discord/scripted-counters/count` returns `{active_counters, skips_last_24h}` so the UI can show how many users are mid-sequence
- New UI card inside the Scripted Mode block: live counter badge + "Reset Counters" button (auto-disabled when count=0). Polls every 5s, but only while Scripted Mode is enabled
- Does NOT touch `scripted_skips` analytics history — only the per-user counter table
- Tests: `/app/backend/tests/test_scripted_counters.py` (11/11 pass) covering auth gating, per-instance scoping, idempotency, analytics preservation

### Discord App Setup — DB Single Source of Truth (DONE 2026-02-XX)
- Fixed bug where "Clear All Discord App Settings" left the Current Configuration card showing green "All credentials configured" with stale masked values
- Root cause: `get_discord_credentials()` was OR-ing each DB field with the corresponding `.env` value (DISCORD_CLIENT_ID/SECRET/REDIRECT_URI/BOT_TOKEN) — so clearing the DB silently re-populated from env
- Fix: removed `.env` fallback; `db.discord_app_config` is now the single source of truth
- Also fixed browser autofilling the admin email into the Client ID field (added `autoComplete="off"` / `autoComplete="new-password"` per field)
- Tests: `/app/backend/tests/test_discord_app_config.py` covers clear → get → put → re-clear lifecycle (8/8 pass)

## Backlog

### P1 — Multi-Server per Instance (PARKED — revisit later)
- Allow one bot instance to be connected to multiple Discord servers, all sharing that instance's KB
- Schema: new `discord_guilds` collection `{instance_id, guild_id, guild_name, connected_at}` (move guild mapping out of `discord_config`)
- Bot routing: lookup `guild_id → instance_id` via new collection
- UI: "Connected Servers" list per instance with "Add Another Server" (OAuth invite) and "Disconnect" actions
- Decision pending: single shared Discord settings across servers vs per-server overrides

### P2 — Refactor server.py
- Split ~3400-line server.py into modular route files

### P2 — Real-time Streaming
- SSE or WebSocket for streaming chat responses

### P2 — Vector DB
- Pinecone/Weaviate integration for semantic RAG search

## Constraints
- **No rate limiting** (user explicitly requested this)
- Branding must stay "BridgeBot"
