# BridgeBot Pro — Channel Integration Analysis

> Generated: November 2026

---

## Unified AI Processing Pipeline

All messaging channels (Discord, Telegram, Zendesk, Web Chat, External API) ultimately route through the **same AI orchestration pipeline**. Here is how each channel processes messages:

---

## Architecture Diagram

```
                            ┌─────────────────────────────┐
                            │   Unified AI Pipeline        │
                            │                             │
     Web Chat ──────────────┤  1. Resolve instance_id     │
     External API ──────────┤  2. Load bot_config          │
     Discord ───────────────┤  3. Retrieve knowledge (RAG) │
     Telegram ──────────────┤  4. Check API integrations   │
     Zendesk ───────────────┤  5. Build system prompt      │
                            │  6. Call LLM provider        │
                            │  7. Log usage + conversation │
                            └─────────────────────────────┘
```

---

## Channel-Specific Processing

### Web Chat (`POST /chat/stream`, `POST /chat/send`)
- **Entry point**: `server.py:stream_chat_message()`, `send_chat_message()`
- **Instance resolution**: `_resolve_chat_instance()` — from body `instance_id` or header `X-Instance-ID`
- **Pipeline**: Calls `stream_chat_response(session_id, message, instance_id, platform="web")`
- **Response**: SSE streaming (token-by-token) or JSON (complete response)
- **Auth**: JWT or API Key (`bbk_*`)

### External API (`POST /chat/send`, `POST /chat/stream`)
- **Same endpoints as Web Chat** — differentiated only by auth method (API key vs JWT)
- **Pipeline**: Identical to Web Chat
- **Auth**: `X-API-Key: bbk_*` header
- **Platform tag**: "web" (same as web chat)

### Discord (`on_message` event handler)
- **Entry point**: `server.py:on_message()` → `_process_discord_v2_connection()`
- **Instance resolution**: `guild_instance_map[guild_id]` → V1 instance lookup, OR V2 `connections` collection lookup
- **Pipeline**: Calls `stream_chat_response(session_id, message, instance_id, platform="discord")`
- **Response**: Streamed to Discord channel via `discord.py` message editing (simulates typing)
- **Special behavior**:
  - Channel allowlisting (only responds in configured channels)
  - Passive mode (DM-only response, skip busy channels)
  - Scripted mode (regex-matched auto-responses, counter tracking)
  - Handoff mode (AI pauses when human agents are active)
  - Message deduplication via `processed_discord_messages` collection
  - Bot mention detection
  - Reply threading

### Telegram (`POST /telegram/webhook/{instance_id}/{secret}`)
- **Entry point**: `telegram_routes.py:telegram_webhook()` → `_process_telegram_message()` → `_process_telegram_v2_connection()`
- **Instance resolution**: From webhook URL path parameter `instance_id`, then lookup V2 `connections` collection
- **Pipeline**: Calls `stream_chat_response(session_id, message, instance_id, platform="telegram")`
- **Response**: Sent back via Telegram Bot API (`sendMessage` / `editMessageText` for streaming effect)
- **Special behavior**:
  - Bot token per-instance (stored in `telegram_config`)
  - Auto-registers webhook URL on configuration save

### Zendesk (`POST /zendesk/webhook/{instance_id}/{secret}`)
- **Entry point**: `zendesk_routes.py:zendesk_webhook()` → `_process_zendesk_ticket()` → `_process_zendesk_v2_connection()`
- **Instance resolution**: From webhook URL path parameter `instance_id`, then lookup V2 `connections` collection
- **Pipeline**: Calls `stream_chat_response(session_id, message, instance_id, platform="zendesk")`
- **Response**: Posted as ticket comment via Zendesk API
- **Special behavior**:
  - Processes ticket creation and ticket comment events
  - Only responds to end-user comments (not agent comments)
  - Tags processed tickets with `ai_processed` and `bitbotpro`
  - Auto-reply mode (immediate response) vs Agent Assist (sidebar suggestions only)
  - Sidebar app for real-time agent suggestions (`/zendesk/sidebar/generate`)
  - OAuth2 PKCE authentication flow

---

## Pipeline Verification: Bot Instance Isolation ✅

| Concern | Status | Implementation |
|---------|--------|----------------|
| Bot instance isolation | ✅ Enforced | Every channel resolves to a specific `instance_id`. All subsequent operations (KB retrieval, LLM config, API integrations) are scoped to that instance. |
| Knowledge Base scoping | ✅ Enforced | `knowledge_sources.find({"instance_id": instance_id})` — each bot has its own knowledge. |
| API Integration permissions | ✅ Enforced | `api_integrations.find({"instance_id": instance_id})` — integrations are per-bot. |
| LLM provider settings | ✅ Enforced | `bot_config.find_one({"instance_id": instance_id})` → `llm_config` field. Each bot can use different providers/models. |
| Conversation history | ✅ Enforced | `conversations.find({"instance_id": instance_id, "session_id": session_id})` — history is per-instance and per-session. |
| Usage tracking | ✅ Enforced | `llm_usage` collection tracks `instance_id`, `model`, `platform`, `tokens`, `cost`. |

---

## Discrepancies and Notes

### 1. Platform Tag Inconsistency (Minor)
- Web Chat and External API both use `platform="web"` — there's no way to distinguish API-key-originated traffic from browser-originated traffic in analytics.
- **Recommendation**: Consider adding `platform="api"` for API key requests.

### 2. Discord Has Additional Processing Logic
Discord has the most complex channel-specific logic:
- Passive mode, scripted mode, handoff mode are Discord-only features
- These don't exist for Telegram, Zendesk, or Web Chat
- This is by design (Discord community management needs are different)

### 3. Response Delivery Differs by Channel
| Channel | Response Method |
|---------|----------------|
| Web Chat | SSE stream (token-by-token) to browser |
| External API | JSON response or SSE stream |
| Discord | Edit Discord message in-place (simulates typing) |
| Telegram | `editMessageText` API call (simulates typing) |
| Zendesk | POST ticket comment (complete response) |

### 4. V1 → V2 Connection Routing
All channels first check V2 `connections` collection for active connections. If not found, they fall back to V1 `bot_instances` / `bot_config` lookup. This dual-path is a migration artifact but functions correctly.

### 5. No Channel-Specific LLM Override
All channels use the same LLM configuration from `bot_config.llm_config`. There is no way to use a different model for Discord vs Web Chat for the same bot. This is consistent behavior, not a discrepancy.

---

## Integration Health Summary

| Channel | Backend | Frontend | Webhook | OAuth | Status |
|---------|---------|----------|---------|-------|--------|
| Web Chat | ✅ | ✅ | N/A | N/A | Fully operational |
| External API | ✅ | N/A | N/A | N/A | Fully operational |
| Discord | ✅ | ✅ | N/A | ✅ | Fully operational |
| Telegram | ✅ | ✅ | ✅ | N/A | Fully operational |
| Zendesk | ✅ | ✅ | ✅ | ✅ | Operational (OAuth token may need re-auth) |
