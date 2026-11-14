# BitBot Pro — Channel Integrations Audit

## Unified AI Pipeline Analysis

### Core Function: `stream_chat_response()`
**Location**: `server.py:1615`

All channels ultimately call this function for AI responses. The pipeline:

```
User message
  → Search knowledge base (_search_knowledge)
  → Build system prompt (build_system_prompt)
  → Check for API integrations
  → Call LLM (_call_emergent or OpenAI BYOK)
  → Track usage (usage_tracking, llm_usage)
  → Return response
```

### Channel Entry Points

| Channel | Entry Point | Calls AI Via | Response Format |
|---|---|---|---|
| **Web Chat** | `POST /api/chat` | `stream_chat_response()` directly | SSE stream |
| **API (v1)** | `POST /api/v1/chat` | `stream_chat_response()` directly | SSE stream |
| **Discord** | Discord.py `on_message` event | `stream_chat_response()` directly (shared import) | Discord message |
| **Telegram** | `POST /api/telegram/webhook/{id}/{secret}` | `_handle_text()` → uses imported `_search_knowledge`, `_build_system_prompt`, `_call_emergent` | Telegram API sendMessage |
| **Zendesk** | `POST /api/zendesk/webhook/{id}/{secret}` | `_handle_ticket()` → uses imported `_search_knowledge`, `_build_system_prompt`, `_call_emergent` | Zendesk ticket comment API |

### Pipeline Consistency

**Shared Functions** (imported from server.py into channel modules):
- `_search_knowledge(query, instance_id)` — Same knowledge search for all channels
- `build_system_prompt(bot_config, ...)` — Same prompt builder for all channels
- `_call_emergent(session_id, message, system_prompt)` — Same LLM call for all channels

**Confirmed Consistent**:
- All channels use the same knowledge base search
- All channels respect the same bot_config (name, system_prompt, etc.)
- All channels use the same LLM provider configuration
- All channels track usage in the same `usage_tracking` collection

---

## Channel-Specific Details

### 1. Web Chat (Built-in)

**Architecture**: Frontend (`ChatPage.js`, `ChatWidget.js`) → SSE → `stream_chat_response()`

**Isolation**:
- Instance ID from `X-Instance-ID` header
- Session ID: `web_{timestamp}_{random}`
- Knowledge: scoped to instance
- Config: scoped to instance
- Conversations stored in `conversations` collection

**Unique Features**:
- SSE streaming responses
- Embeddable widget (`embed.js`)
- Customizable colors and branding
- Welcome message
- Logo upload

**Status**: Fully functional

---

### 2. Discord

**Architecture**: `discord.py` bot runs as a background task in the same process

**Key Files**:
- `server.py:1705-2036` — Shared Discord client, bot startup, message handling
- Discord config stored in `discord_config` collection

**Isolation**:
- Guild-to-instance mapping via `discord_config.guild_id`
- Session ID: `discord_{user_id}_{guild_id}`
- Knowledge: scoped to mapped instance
- Config: scoped to mapped instance

**Unique Features**:
- OAuth2 bot invite flow
- Channel-specific listen mode (all channels or specific)
- Human handoff (pause AI when human agent replies)
- Scripted mode testing
- Bot name/logo sync
- Multi-guild support (single bot, multiple instances)

**Discrepancies**:
- Discord bot runs in-process (not a separate worker) — could be fragile under load
- Discord uses `_shared_discord_client` singleton — single bot token for all instances
- Conversation history handled differently (Discord maintains thread context)

**Status**: Fully functional

---

### 3. Telegram

**Architecture**: Webhook-based. Telegram sends messages to `POST /api/telegram/webhook/{instance_id}/{secret}`

**Key Files**:
- `telegram_routes.py` — Standalone router module (464 lines)
- Config stored in `telegram_config` collection

**Isolation**:
- Instance ID embedded in webhook URL
- Session ID: `tg_{chat_id}_{instance_id}`
- Knowledge: scoped to instance
- Config: scoped to instance

**Unique Features**:
- Webhook auto-registration with Telegram API
- Listen modes: `all` (every message), `mention` (when bot is mentioned), `reply` (when replied to)
- Inline keyboard for feedback (thumbs up/down)
- Callback query handling
- Markdown formatting for responses

**Discrepancies**:
- Telegram calls `_call_emergent` directly instead of `stream_chat_response` — no streaming, gets full response at once
- This means Telegram doesn't benefit from any future streaming-specific logic added to `stream_chat_response`
- Token usage tracking format may differ slightly

**Status**: Fully functional

---

### 4. Zendesk

**Architecture**: Webhook-based. Zendesk sends ticket events to `POST /api/zendesk/webhook/{instance_id}/{secret}`

**Authentication**: OAuth 2.0 authorization-code flow with PKCE (preferred) or legacy API token.

**Key Files**:
- `zendesk_routes.py` — Standalone router module with OAuth flow, token management, webhook handler
- Config stored in `zendesk_config` collection
- OAuth pending states in `zendesk_oauth_states` collection (TTL-indexed, auto-expires)
- Events logged in `zendesk_events` collection
- AI suggestions stored in `zendesk_suggestions` collection
- Admin setup guide: `/app/docs/ZENDESK_OAUTH_SETUP.md`

**OAuth Flow**:
- `POST /api/admin/zendesk/oauth/start` → generates authorization URL with PKCE + state
- `GET /api/zendesk/oauth/callback` → handles redirect, exchanges code, stores tokens
- Automatic token refresh (access: 8h, refresh: 30d) with transparent rotation
- Bearer auth for all Zendesk API calls; falls back to Basic auth for legacy connections
- Token revocation on disconnect

**Required Environment Variables** (for OAuth):
- `ZENDESK_OAUTH_CLIENT_ID` — from Zendesk Admin Center OAuth client
- `ZENDESK_OAUTH_CLIENT_SECRET` — shown once at client creation

**OAuth Scopes**: `tickets:read tickets:write users:read`

**Callback URL**: `{APP_BASE_URL}/api/zendesk/oauth/callback`

**Isolation**:
- Instance ID embedded in webhook URL
- OAuth state validated per-instance (single-use, 10-min TTL)
- Session ID: `zd_{ticket_id}_{instance_id}`
- Knowledge: scoped to instance
- Config: scoped to instance

**Unique Features**:
- Two modes: Auto-reply (posts AI response as ticket comment) and Agent Assist (saves suggestion without posting)
- Ticket tagging (`ai_processed`, `bitbotpro`)
- Internal note vs. public reply option
- Signature verification for webhook security
- Deduplication via processed ticket tracking
- Connection status, reconnect, and disconnect controls in the admin UI
- Auto-reply disabled by default; requires explicit opt-in

**Discrepancies**:
- Same as Telegram — calls `_call_emergent` directly, no streaming
- Additional system prompt instructions specific to Zendesk (ticket context, formatting)
- Zendesk has its own usage tracking in `zendesk_events` alongside the shared tracking

**Status**: Fully functional (OAuth flow requires admin setup of OAuth client in Zendesk)

---

### 5. External API (v1)

**Architecture**: External developers use API keys to access chat

**Entry Point**: `POST /api/v1/chat` with `X-API-Key` header

**Isolation**:
- API key maps to instance_id
- Session ID provided by caller
- Rate limiting per API key
- Usage tracked per key in `api_key_usage`

**Unique Features**:
- API key authentication (not JWT)
- Rate limiting
- Usage analytics per key

**Status**: Fully functional

---

## Compliance Matrix

| Feature | Web | Discord | Telegram | Zendesk | API v1 |
|---|---|---|---|---|---|
| Instance isolation | Yes | Yes | Yes | Yes | Yes |
| Knowledge base | Yes | Yes | Yes | Yes | Yes |
| System prompt | Yes | Yes | Yes | Yes | Yes |
| API integrations | Yes | Yes | Yes | Yes | Yes |
| LLM provider config | Yes | Yes | Yes | Yes | Yes |
| Conversation history | Yes | Yes | Yes | Yes | Yes |
| Usage tracking | Yes | Yes | Yes | Yes | Yes |
| Streaming | Yes (SSE) | No | No | No | Yes (SSE) |
| Passive mode | Yes | Yes | Yes | N/A | N/A |

## Key Findings

1. **Pipeline is consistent**: All channels use the same knowledge search, prompt builder, and LLM caller
2. **Telegram and Zendesk have a minor divergence**: They call `_call_emergent` directly instead of `stream_chat_response`, missing streaming logic. This is intentional — webhooks can't stream
3. **Discord runs in-process**: The bot is a background task, not a separate service. For self-hosting, consider splitting into a worker process
4. **No channel breaks instance isolation**: Every channel correctly scopes to its configured instance_id

---

## V2 Multi-Route Webhook Resolution (Added Nov 2026)

### Overview
The V2 architecture adds a **webhook router** (`webhook_router.py`) that intercepts all incoming channel messages before they reach the legacy V1 handlers. This enables:
- **Multi-route**: One Discord server can be mapped to multiple bots (via different connections)
- **Per-connection response modes**: `auto_reply`, `agent_assist`, `internal_note`
- **Organisation-scoped accounts**: Provider credentials (bot tokens, OAuth tokens) are stored in `connected_accounts` and shared across bots

### Resolution Flow
```
Incoming message (e.g., Discord guild_id or Telegram chat_id)
  → webhook_router.resolve_v2(provider, destination_id)
  → Query: connections WHERE provider=X AND destination=destination_id AND enabled=true
  → For each matched connection:
      → Load bot settings (persona, KB, LLM config)
      → Execute response_mode logic
  → If agent_assist: create v2_suggestion instead of replying
  → If no V2 match: fallback to V1 legacy routing
```

### V2 Channel Entry Points (Updated)

| Channel | V2 Entry Point | V1 Fallback | Notes |
|---|---|---|---|
| Discord | `webhook_router.resolve_v2("discord", guild_id)` | `discord_config.guild_id` lookup | V2 checked first on every `on_message` |
| Telegram | `webhook_router.resolve_v2("telegram", chat_id)` | `telegram_config.instance_id` | V2 checked first in webhook handler |
| Zendesk | `webhook_router.resolve_v2("zendesk", ticket_group_id)` | `zendesk_config.instance_id` | V2 checked first in webhook handler |
| Web Chat | Direct `stream_chat_response()` | N/A | Not routed through V2 (uses instance_id directly) |
| API v1 | Direct `stream_chat_response()` | N/A | Not routed through V2 (uses API key → instance_id) |

### V2 Collections for Channel Routing
- `connected_accounts` — Provider credentials (encrypted), status, org_id
- `connections` — Bot ↔ destination mapping, response_mode, priority
- `v2_suggestions` — Agent-assist suggestions (pending/accepted/dismissed)

### Self-Hosting Impact
No additional infrastructure needed. The webhook router is a pure Python module with no external dependencies beyond MongoDB.
