# BridgeBot Pro — Environment Variables & Infrastructure

> Generated: November 2026

---

## Required Environment Variables

### Backend (`/app/backend/.env`)

| Variable | Required | Description | Emergent-Specific | Self-Hosting Notes |
|----------|----------|-------------|--------------------|--------------------|
| `MONGO_URL` | **Yes** | MongoDB connection string | No | Standard MongoDB 6+ connection URI |
| `DB_NAME` | **Yes** | MongoDB database name | No | Default: `rag_search` |
| `JWT_SECRET` | **Yes** | JWT signing secret | No | Generate a strong random string (256-bit) |
| `ADMIN_EMAIL` | **Yes** | Initial admin user email | No | Seeded on first startup |
| `ADMIN_PASSWORD` | **Yes** | Initial admin user password | No | Seeded on first startup |
| `CORS_ORIGINS` | **Yes** | Allowed CORS origins (comma-separated) | No | Set to your frontend domain |
| `ENCRYPTION_KEY` | **Yes** | Fernet key for credential encryption | No | Generate via `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `CLAUDE_API_KEY` | **Yes**† | Emergent Universal Key / Anthropic key | **Yes** | Maps to Emergent LLM key. For self-hosting: replace with direct Anthropic API key |
| `DISCORD_CLIENT_ID` | Conditional | Discord OAuth2 Application ID | No | Required only if using Discord integration |
| `DISCORD_CLIENT_SECRET` | Conditional | Discord OAuth2 Application Secret | No | Required only if using Discord integration |
| `DISCORD_REDIRECT_URI` | Conditional | Discord OAuth2 callback URL | No | Must point to `{backend_url}/api/discord/callback` |
| `DISCORD_BOT_TOKEN` | Conditional | Discord bot token | No | Required only if using Discord bot |
| `RESEND_API_KEY` | Conditional | Resend.com email API key | No | Required for email invitations and password resets |
| `FROM_EMAIL` | Conditional | Sender email address for emails | No | Used with Resend |
| `INTEGRATION_PROXY_URL` | Optional | Emergent integration proxy URL | **Yes** | Used for object storage. For self-hosting: replace with S3/MinIO |
| `OLLAMA_BASE_URL` | Optional | Ollama LLM server URL | No | Default: `http://localhost:11434` |
| `ZENDESK_OAUTH_CLIENT_ID` | Conditional | Zendesk OAuth client ID | No | Required only if using Zendesk OAuth |
| `ZENDESK_OAUTH_CLIENT_SECRET` | Conditional | Zendesk OAuth client secret | No | Required only if using Zendesk OAuth |

† `CLAUDE_API_KEY` or `EMERGENT_LLM_KEY` — at least one is required for the default AI pipeline.

### Frontend (`/app/frontend/.env`)

| Variable | Required | Description | Emergent-Specific | Self-Hosting Notes |
|----------|----------|-------------|--------------------|--------------------|
| `REACT_APP_BACKEND_URL` | **Yes** | Full backend URL for API calls | No | Set to your deployment's public URL |
| `WDS_SOCKET_PORT` | Dev only | WebSocket port for dev server | No | Only for development hot-reload |
| `ENABLE_HEALTH_CHECK` | Optional | Enable health check endpoint | No | Set to `true` for monitoring |

---

## Infrastructure Dependencies

### 1. MongoDB (Required)
- **Version**: 6.0+
- **Collections**: 33 collections (see list below)
- **Indexes**: Text search indexes on `knowledge_sources.chunks`, compound indexes on `conversations`, `api_request_logs`
- **Vector Search**: Uses MongoDB Atlas Search with `$vectorSearch` aggregation for RAG retrieval. This requires either MongoDB Atlas or a compatible alternative (e.g., MongoDB 7.0+ with Atlas Vector Search)
- **Storage**: All application data stored in MongoDB. No separate SQL database.

**Collections:**
```
api_diagnostics_history   api_integrations       api_keys
api_request_logs          bot_config             bot_instances
bots                      changelog              connected_accounts
connections               conversations          discord_app_config
discord_config            embed_configs          invitations
knowledge_sources         llm_usage              onboarding
organisations             passive_skips          processed_discord_messages
scripted_counters         scripted_scenarios     scripted_skips
telegram_config           users                  workspace_discord_apps
workspace_members         workspaces             zendesk_config
zendesk_events            zendesk_oauth_states   zendesk_suggestions
```

### 2. Object Storage (Emergent Managed → Replace)
- **Current**: Uses Emergent Managed Object Storage via `INTEGRATION_PROXY_URL`
- **Used for**: Bot logo uploads, knowledge base document storage
- **API**: REST-based (`/objstore/api/v1/storage/objects/{path}`)
- **Self-hosting replacement**: MinIO, AWS S3, or any S3-compatible storage
- **Files affected**: `server.py` lines 75-115 (`_init_storage`, `_put_object`, `_get_object`, `_delete_object`)

### 3. LLM Providers
| Provider | Access Method | Required Key | Notes |
|----------|--------------|--------------|-------|
| Emergent (default) | `emergentintegrations` library | `CLAUDE_API_KEY` | Routes through Emergent Universal Key proxy |
| Anthropic (direct) | `anthropic` SDK | Per-bot BYOK | Direct Claude API access |
| OpenAI (direct) | `openai` SDK | Per-bot BYOK | GPT models |
| Ollama (local) | HTTP API | None (local) | Self-hosted models via `OLLAMA_BASE_URL` |

### 4. Email Service
- **Current**: Resend.com
- **Used for**: User invitations, password resets, Discord invite sharing
- **Self-hosting**: Any SMTP/email service (requires code change to swap provider)

### 5. Discord Bot Runtime
- **In-process**: The Discord bot runs as an async task within the FastAPI process
- **Library**: `discord.py`
- **Gateway**: Maintains persistent WebSocket connection to Discord
- **Self-hosting**: Works out-of-the-box with Discord credentials

### 6. No Background Job Queue
- No Celery, Redis, or external task queue
- Background tasks use FastAPI's `BackgroundTasks` and `asyncio.create_task`
- Long-running operations (web crawling, GitHub import) use SSE streaming
- No cron jobs configured

---

## .env.example (Backend)

```env
# === Required ===
MONGO_URL=mongodb://localhost:27017
DB_NAME=bridgebot
JWT_SECRET=change-me-to-a-random-256-bit-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
ENCRYPTION_KEY=generate-with-fernet

# === LLM Provider (at least one required) ===
CLAUDE_API_KEY=your-anthropic-api-key

# === Object Storage (replace for self-hosting) ===
# INTEGRATION_PROXY_URL=https://your-s3-compatible-endpoint

# === Discord (optional) ===
# DISCORD_CLIENT_ID=
# DISCORD_CLIENT_SECRET=
# DISCORD_REDIRECT_URI=https://yourdomain.com/api/discord/callback
# DISCORD_BOT_TOKEN=

# === Email (optional) ===
# RESEND_API_KEY=
# FROM_EMAIL=noreply@yourdomain.com

# === Zendesk (optional) ===
# ZENDESK_OAUTH_CLIENT_ID=
# ZENDESK_OAUTH_CLIENT_SECRET=

# === Ollama (optional, for local LLM) ===
# OLLAMA_BASE_URL=http://localhost:11434
```

## .env.example (Frontend)

```env
REACT_APP_BACKEND_URL=https://yourdomain.com
```
