# BitBot Pro

Multi-tenant AI bot SaaS platform — connect Discord, Telegram, Zendesk, and Web channels to AI-powered knowledge assistants.

## Architecture

```
Frontend (React 19, ShadCN, TailwindCSS)   →   Backend (FastAPI, Python 3.11+)   →   MongoDB
     Port 3000                                        Port 8001
```

### V2 Multi-Tenant Data Model
```
Organisation
├── Members (user roles: owner, admin, member)
├── Connected Accounts (reusable provider identities)
│   ├── Discord Bot identity (encrypted credentials)
│   ├── Telegram Bot identity
│   └── Zendesk OAuth account
└── Bots (AI assistants)
    ├── Bot Settings (persona, KB, LLM config)
    └── Connections (routes to channel destinations)
        ├── Discord → Server / #channel (auto_reply | agent_assist)
        ├── Telegram → Group / Chat (auto_reply)
        └── Zendesk → Ticket group (internal_note | auto_reply)
```

## Quick Start (Self-Hosted)

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB 6+ (local or Atlas)
- Anthropic or OpenAI API key

### Backend
```bash
cd backend
cp .env.example .env    # Edit with your credentials
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001
```

### Frontend
```bash
cd frontend
cp .env.example .env    # Set REACT_APP_BACKEND_URL
yarn install
yarn start
```

### Reverse Proxy (Nginx example)
```nginx
location /api/ {
    proxy_pass http://localhost:8001;
}
location / {
    proxy_pass http://localhost:3000;
}
```

## Documentation

| Document | Description |
|---|---|
| [API Inventory](docs/self-hosting-readiness/API_INVENTORY.md) | 190+ endpoints with auth, schemas, and frontend mapping |
| [OpenAPI Spec](docs/self-hosting-readiness/openapi.json) | Machine-readable OpenAPI 3.1 specification |
| [Frontend-Backend Map](docs/self-hosting-readiness/FRONTEND_BACKEND_MAP.md) | Every frontend API call mapped to its backend endpoint |
| [Environment Variables](docs/self-hosting-readiness/ENVIRONMENT_VARIABLES.md) | All env vars with self-hosting notes |
| [Emergent Dependencies](docs/self-hosting-readiness/EMERGENT_DEPENDENCIES.md) | Platform-specific code with replacement strategies |
| [Channel Integrations](docs/self-hosting-readiness/CHANNEL_INTEGRATIONS.md) | Unified AI pipeline audit across all channels |
| [Migration Readiness](docs/self-hosting-readiness/MIGRATION_READINESS.md) | Overall readiness assessment and migration plan |

## Environment Variables

### Required
| Variable | Description |
|---|---|
| `MONGO_URL` | MongoDB connection string |
| `DB_NAME` | Database name |
| `JWT_SECRET` | JWT signing secret |
| `ENCRYPTION_KEY` | Fernet key for credential encryption |
| `CORS_ORIGINS` | Comma-separated frontend origins |

### LLM (at least one required)
| Variable | Description |
|---|---|
| `CLAUDE_API_KEY` | Anthropic API key |

### Optional Channels
| Variable | Description |
|---|---|
| `DISCORD_CLIENT_ID` | Discord Developer Portal |
| `DISCORD_CLIENT_SECRET` | Discord Developer Portal |
| `DISCORD_BOT_TOKEN` | Discord Bot token |
| `RESEND_API_KEY` | Email service for verification/reset |

## Tech Stack

- **Frontend**: React 19, React Router 7, ShadCN/Radix UI, Recharts, Tailwind CSS
- **Backend**: FastAPI, Motor (async MongoDB), Pydantic, discord.py, python-telegram-bot
- **Database**: MongoDB (Atlas or self-hosted)
- **LLM**: Claude (Anthropic), GPT (OpenAI) — configurable per-bot
- **Channels**: Discord, Telegram, Zendesk, Web Chat, External API

## License

Proprietary. All rights reserved.
