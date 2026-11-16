# BridgeBot Pro — Emergent-Specific Dependencies

> Generated: November 2026

---

## Overview

BridgeBot Pro has **3 direct Emergent dependencies**. Two are essential (LLM + Object Storage), one is an optional URL reference. None require major architectural changes — they can be swapped with standard alternatives.

---

## 1. `emergentintegrations` Python Library (LLM Gateway)

**What it does:** Provides `LlmChat` class that routes LLM calls through Emergent's Universal Key proxy. Manages conversation history, model selection, and token counting.

**Where it is used:**
- `server.py` line 28: `from emergentintegrations.llm.chat import LlmChat, UserMessage`
- `server.py` lines 1172-1195: `_call_emergent()` function
- Called by the unified AI pipeline for the default "emergent" LLM provider

**Is it essential?** No — it's one of four LLM provider backends. The app already supports direct Anthropic, OpenAI, and Ollama calls that bypass this library entirely.

**Can it be configured externally?** Yes — per-bot LLM config allows selecting `anthropic`, `openai`, or `ollama` providers with BYOK (Bring Your Own Key).

**What Claude Code needs to do:**
1. Remove the `emergentintegrations` import
2. Replace `_call_emergent()` with a direct Anthropic SDK call (the default model is `claude-sonnet-4-6`)
3. Update `_resolve_llm_config()` to default to `"anthropic"` instead of `"emergent"`
4. Install `anthropic` SDK as a direct dependency
5. The existing `_call_anthropic()` function already handles direct Anthropic calls — make it the default

**Effort:** Low (~30 lines of code change)

---

## 2. Emergent Managed Object Storage

**What it does:** Provides file storage for bot logos and uploaded knowledge base documents (PDF, DOCX, etc.) via a REST API.

**Where it is used:**
- `server.py` lines 75-115: Storage initialization, `_put_object()`, `_get_object()`, `_delete_object()`
- Called by: bot logo upload/retrieval, knowledge base document upload

**API Contract:**
```
POST   {STORAGE_URL}/init            → {storage_key}
PUT    {STORAGE_URL}/objects/{path}   (upload file)
GET    {STORAGE_URL}/objects/{path}   (download file)
DELETE {STORAGE_URL}/objects/{path}   (delete file)
```

**Is it essential?** Yes — file storage is required for bot logos and document uploads.

**Can it be configured externally?** Partially — the base URL is configurable via `INTEGRATION_PROXY_URL` env var, but the API contract is Emergent-specific.

**What Claude Code needs to do:**
1. Replace the 4 storage functions (`_init_storage`, `_put_object`, `_get_object`, `_delete_object`) with S3-compatible equivalents
2. Add `boto3` dependency (or use MinIO client)
3. Add new env vars: `S3_BUCKET`, `S3_ENDPOINT_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
4. Keep the same function signatures so callers don't need changes

**Effort:** Medium (~50 lines of code change)

---

## 3. Emergent Universal Key (`CLAUDE_API_KEY`)

**What it does:** A single API key that provides access to multiple LLM providers (Claude, GPT, Gemini) through Emergent's billing proxy.

**Where it is used:**
- `server.py` line 78: `_EMERGENT_KEY = os.environ.get("CLAUDE_API_KEY") or os.environ.get("EMERGENT_LLM_KEY")`
- Used by `_call_emergent()` for LLM calls and `_init_storage()` for object storage init

**Is it essential?** No for LLM (BYOK alternatives exist). Yes for object storage (until replaced with S3).

**What Claude Code needs to do:**
1. Rename `CLAUDE_API_KEY` to `ANTHROPIC_API_KEY` in env
2. Use it directly with the `anthropic` SDK instead of routing through `emergentintegrations`
3. Remove `EMERGENT_LLM_KEY` references

**Effort:** Low (env rename + ~5 lines)

---

## 4. Hardcoded Emergent URLs in Frontend

**What it does:** Domain detection for environment banners (preview vs production).

**Where it is used:**
- `AdminLayout.js` line 264: `host.includes("preview.emergentagent.com")`

**Is it essential?** No — purely cosmetic, used to show "PREVIEW · SANDBOX" banner.

**What Claude Code needs to do:**
1. Remove or update the domain check to match the self-hosted domain
2. Or use an env var like `REACT_APP_ENV` instead of hostname detection

**Effort:** Trivial (~2 lines)

---

## 5. `bitbotpro.io` / `bridgebot.tech` Domain References

**Where:**
- `AdminLayout.js` line 261: Domain detection for env banner
- `LandingPage.js` line 904: Example embed code snippet
- `EmbedCode.js`: Example URLs in generated snippets

**Is it essential?** No — these are cosmetic/example text only.

**What Claude Code needs to do:** Search-and-replace domain references with the self-hosted domain.

**Effort:** Trivial

---

## Summary Table

| Dependency | Type | Essential | Replacement | Effort |
|-----------|------|-----------|-------------|--------|
| `emergentintegrations` library | Python package | No | Direct `anthropic` SDK | Low |
| Emergent Object Storage | REST API | Yes (until replaced) | AWS S3 / MinIO | Medium |
| Emergent Universal Key | API credential | No | Direct Anthropic key | Low |
| Emergent domain detection | Frontend URL check | No | Env var or remove | Trivial |
| `bitbotpro.io` references | Hardcoded strings | No | Search-and-replace | Trivial |

**Total estimated migration effort: ~100 lines of code changes across 2 files.**

---

## Dependencies That Are NOT Emergent-Specific

These work independently and require no changes for self-hosting:

| Dependency | Status |
|-----------|--------|
| MongoDB / Motor | Standard, no Emergent coupling |
| Discord.py bot | Standard Discord API |
| Telegram webhooks | Standard Telegram API |
| Zendesk OAuth + API | Standard Zendesk API |
| JWT auth (python-jose) | Standard JWT |
| bcrypt password hashing | Standard |
| FastAPI / Uvicorn | Standard |
| React frontend | Standard, uses `REACT_APP_BACKEND_URL` env var |
| Resend email | Standard third-party API |
| OpenAI / Anthropic SDKs | Already present for BYOK |
