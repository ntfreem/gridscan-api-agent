# BitBot Pro — Emergent-Specific Dependencies

## Summary

| Dependency | Impact | Essential | Replaceable | Effort |
|---|---|---|---|---|
| `emergentintegrations` Python library | High | Yes (for LLM) | Yes | Medium |
| Emergent Object Storage | Medium | Yes (for uploads) | Yes | Medium |
| Emergent Universal LLM Key | High | No (if BYOK) | Yes | Low |
| Emergent Preview URL routing | Low | No | N/A | N/A |
| Emergent Deployment Pipeline | Low | No | N/A | N/A |

---

## 1. `emergentintegrations` Python Library

### What It Does
Provides a unified LLM interface (`LlmChat`) that routes to Claude, GPT, or Gemini through a single API key (Emergent Universal Key). Also provides `EmergentObjectStorage` for file uploads.

### Where Used
```
server.py:28  — from emergentintegrations.llm.chat import LlmChat, ChatMessage
server.py:29  — from emergentintegrations.llm.chat import LlmModelType (model enum)
server.py:30  — from emergentintegrations.storage import EmergentObjectStorage
```

### How It Works
- `LlmChat` wraps Anthropic/OpenAI SDKs behind a unified interface
- Takes an Emergent API key that proxies to the actual provider
- `EmergentObjectStorage` wraps a proprietary object storage API

### Replacement Strategy
**LLM**: Replace `LlmChat` calls with direct Anthropic/OpenAI SDK calls:
```python
# Current (Emergent)
from emergentintegrations.llm.chat import LlmChat, ChatMessage
chat = LlmChat(api_key=EMERGENT_KEY, model=LlmModelType.CLAUDE_SONNET_4_6)
response = await chat.send_message_async(messages)

# Replacement (Direct Anthropic)
import anthropic
client = anthropic.AsyncAnthropic(api_key=CLAUDE_API_KEY)
response = await client.messages.create(model="claude-sonnet-4-6", messages=messages)
```

**Object Storage**: Replace `EmergentObjectStorage` with S3-compatible storage:
```python
# Current (Emergent)
from emergentintegrations.storage import EmergentObjectStorage
storage = EmergentObjectStorage(api_key=key)
url = await storage.upload(file_bytes, path)

# Replacement (S3/MinIO)
import boto3
s3 = boto3.client('s3', ...)
s3.upload_fileobj(file, bucket, key)
```

### Essential?
Yes — the app cannot function without LLM calls. But the library is a thin wrapper; replacing it is straightforward.

---

## 2. Emergent Object Storage

### What It Does
Stores uploaded files (bot logos, documents) via Emergent's proprietary storage API.

### Where Used
```
server.py:67-80  — _upload_to_storage(), _get_storage_url(), _delete_from_storage()
server.py:3464   — Bot logo upload
server.py:4680   — Document upload for knowledge base
```

### API Contract
```
POST   {STORAGE_URL}/objects/{path}    — Upload file
GET    {STORAGE_URL}/objects/{path}    — Download file  
DELETE {STORAGE_URL}/objects/{path}    — Delete file
Headers: X-Storage-Key: {key}
```

### Replacement
Replace with any S3-compatible service. The storage functions are isolated in 3 helper functions at the top of `server.py` — only these need changing.

### Essential?
Yes for file upload features. No for core chat functionality.

---

## 3. Emergent Universal LLM Key

### What It Does
A single API key that works across Claude, GPT, and Gemini models via the `emergentintegrations` library.

### Where Used
```
backend/.env: CLAUDE_API_KEY (this IS the Emergent Universal Key)
server.py:1123  — _call_emergent() uses this key
server.py:1615  — stream_chat_response() routes through it
```

### Replacement
Replace with direct provider API keys:
- Anthropic: `ANTHROPIC_API_KEY`
- OpenAI: `OPENAI_API_KEY`

The app already supports OpenAI BYOK (Bring Your Own Key) per-instance. Extending this to Anthropic is the migration path.

### Essential?
No — if you have direct API keys, you can bypass the Universal Key entirely.

---

## 4. Emergent Preview URL Routing

### What It Does
The Emergent platform routes `/api/*` requests to port 8001 (backend) and all other requests to port 3000 (frontend) via Kubernetes ingress.

### Where Used
- `frontend/.env`: `REACT_APP_BACKEND_URL=https://xxx.preview.emergentagent.com`
- `utils/api.js`: `baseURL: /api` (relative path)

### Replacement
Standard reverse proxy (Nginx, Caddy, or cloud load balancer):
```nginx
location /api/ {
    proxy_pass http://backend:8001;
}
location / {
    proxy_pass http://frontend:3000;
}
```

### Essential?
No — this is infrastructure routing, not application code.

---

## 5. Emergent Deployment Pipeline

### What It Does
Builds and deploys the app via Emergent's internal CI/CD.

### Where Used
- `.emergent/emergent.yml` — deployment config
- `.emergent/markers/` — internal state

### Replacement
Standard Docker + CI/CD:
- Dockerfile for backend (Python + FastAPI)
- Dockerfile for frontend (Node + React build)
- docker-compose.yml for local development
- GitHub Actions / GitLab CI for deployment

### Essential?
No — the app runs as standard Python + Node processes.

---

## Migration Priority

1. **High Priority**: Replace `emergentintegrations.llm.chat` with direct Anthropic/OpenAI SDK
2. **High Priority**: Replace `EmergentObjectStorage` with S3-compatible storage
3. **Medium Priority**: Create Dockerfiles and docker-compose.yml
4. **Low Priority**: Set up CI/CD pipeline
5. **Not Needed**: Frontend requires no changes beyond `REACT_APP_BACKEND_URL`

---

## V2 Architecture — No Additional Emergent Dependencies

The V2 multi-tenant architecture (organisations, bots, connected accounts, connections, webhook router, platform admin, suggestions inbox) was built entirely with standard Python + MongoDB and does not introduce any new Emergent-specific dependencies. All V2 route files (`org_routes.py`, `bot_routes.py`, `account_routes.py`, `connection_routes.py`, `platform_routes.py`, `webhook_router.py`) use only FastAPI, Motor (MongoDB), and the Python standard library.
