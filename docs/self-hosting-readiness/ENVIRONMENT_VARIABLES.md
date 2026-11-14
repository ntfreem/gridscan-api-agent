# BitBot Pro — Environment Variables & Infrastructure

## Backend Environment Variables (`/app/backend/.env`)

### Core Database
| Variable | Required | Description | Self-Hosting Notes |
|---|---|---|---|
| `MONGO_URL` | Yes | MongoDB connection string | Replace with your own MongoDB (Atlas or self-hosted) |
| `DB_NAME` | Yes | Database name | Any name; default uses Emergent naming |

### Authentication & Security
| Variable | Required | Description | Self-Hosting Notes |
|---|---|---|---|
| `JWT_SECRET` | Yes | Secret for JWT token signing | Generate a strong random string |
| `ENCRYPTION_KEY` | Yes | Fernet key for encrypting stored API keys and V2 connected account credentials | Generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `ADMIN_EMAIL` | Yes | Default admin account email | Set during first run; used for admin seeding |
| `ADMIN_PASSWORD` | Yes | Default admin account password | Set during first run; used for admin seeding |

### CORS
| Variable | Required | Description | Self-Hosting Notes |
|---|---|---|---|
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins | Set to your frontend URL(s) |

### LLM Providers
| Variable | Required | Description | Self-Hosting Notes |
|---|---|---|---|
| `CLAUDE_API_KEY` | Conditional | Anthropic Claude API key (Emergent Universal Key) | Replace with direct Anthropic key or keep for Universal Key |
| `OPENAI_API_KEY` | Conditional | OpenAI API key (Emergent Universal Key) | Replace with direct OpenAI key |
| `DEFAULT_LLM_PROVIDER` | No | Default provider: "emergent" or "openai_byok" | Change to "anthropic" or "openai" for direct keys |

### Emergent Services
| Variable | Required | Description | Self-Hosting Notes |
|---|---|---|---|
| `INTEGRATION_PROXY_URL` | No | Emergent LLM proxy URL | Remove; use direct SDK calls |
| `OBJECT_STORAGE_URL` | No | Emergent Object Storage base URL | Replace with S3/MinIO/local storage |
| `OBJECT_STORAGE_KEY` | No | Emergent Object Storage API key | Replace with your storage credentials |

### Discord
| Variable | Required | Description | Self-Hosting Notes |
|---|---|---|---|
| `DISCORD_CLIENT_ID` | Conditional | Discord app client ID | From Discord Developer Portal |
| `DISCORD_CLIENT_SECRET` | Conditional | Discord app client secret | From Discord Developer Portal |
| `DISCORD_BOT_TOKEN` | Conditional | Discord bot token | From Discord Developer Portal |

### Email (Verification & Password Reset)
| Variable | Required | Description | Self-Hosting Notes |
|---|---|---|---|
| `RESEND_API_KEY` | Conditional | Resend email service key | Replace with any SMTP/email provider |
| `EMAIL_FROM` | No | From address for emails | Default: `noreply@bridgebot.tech` |

### Webhook Configuration
| Variable | Required | Description | Self-Hosting Notes |
|---|---|---|---|
| `WEBHOOK_BASE_URL` | No | Base URL for generating webhook URLs | Set to your public backend URL |

### Zendesk OAuth
| Variable | Required | Description | Self-Hosting Notes |
|---|---|---|---|
| `ZENDESK_OAUTH_CLIENT_ID` | Conditional | OAuth client identifier from Zendesk Admin Center | Create an OAuth client in Zendesk; see `/docs/ZENDESK_OAUTH_SETUP.md` |
| `ZENDESK_OAUTH_CLIENT_SECRET` | Conditional | OAuth client secret (shown once at creation) | Store securely; never commit to VCS |

---

## Frontend Environment Variables (`/app/frontend/.env`)

| Variable | Required | Description | Self-Hosting Notes |
|---|---|---|---|
| `REACT_APP_BACKEND_URL` | Yes | Backend API base URL | Set to your backend URL |
| `WDS_SOCKET_PORT` | No | WebSocket dev server port | Development only |
| `ENABLE_HEALTH_CHECK` | No | Enable health check polling | Development only |

---

## External Service Dependencies

### MongoDB (Required)
- **Usage**: Primary data store for all collections
- **Collections**: users, bot_instances, bot_config, knowledge_sources, conversations, messages, api_integrations, api_endpoints, api_diagnostics_history, discord_config, telegram_config, zendesk_config, zendesk_events, zendesk_suggestions, zendesk_oauth_states, zendesk_oauth_client, embed_configs, api_keys, api_request_logs, llm_usage, onboarding, changelog, invitations, processed_discord_messages, **organisations** (V2), **bots** (V2), **connected_accounts** (V2), **connections** (V2), **v2_suggestions** (V2)
- **Self-hosting**: MongoDB Atlas (managed) or self-hosted MongoDB 6+
- **Vector search**: Uses MongoDB Atlas text search for knowledge retrieval (NOT Atlas Vector Search)

### LLM Providers (Required — at least one)
- **Claude (Anthropic)**: Primary LLM via `emergentintegrations` library
- **OpenAI**: Fallback and BYOK support via `openai` SDK
- **Self-hosting**: Direct API keys from Anthropic/OpenAI; remove Emergent proxy wrapper

### Object Storage (Required for file features)
- **Usage**: Bot logo uploads, document uploads
- **Current**: Emergent Object Storage (proprietary API)
- **Self-hosting**: Replace with AWS S3, MinIO, or local filesystem

### Email Service (Required for auth flows)
- **Usage**: Email verification, password reset
- **Current**: Resend API
- **Self-hosting**: Any SMTP provider (SendGrid, SES, Mailgun, self-hosted)

### Discord API (Optional)
- **Usage**: Discord bot integration
- **Self-hosting**: Requires Discord Developer Application credentials

### Telegram API (Optional)
- **Usage**: Telegram bot integration
- **Self-hosting**: Requires Telegram Bot Token from @BotFather

### Zendesk API (Optional)
- **Usage**: Zendesk ticket integration
- **Self-hosting**: Requires Zendesk subdomain, admin email, API token

---

## .env.example Files

### backend/.env.example
```
# Core
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/bitbotpro
DB_NAME=bitbotpro
JWT_SECRET=your-strong-random-secret-here
ENCRYPTION_KEY=your-fernet-key-here
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

# LLM Providers (at least one required)
CLAUDE_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Object Storage
OBJECT_STORAGE_URL=https://your-storage-url
OBJECT_STORAGE_KEY=your-storage-key

# Email (for verification & password reset)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com

# Discord (optional)
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=

# Webhooks
WEBHOOK_BASE_URL=https://your-backend-url.com/api
```

### frontend/.env.example
```
REACT_APP_BACKEND_URL=https://your-backend-url.com
```
