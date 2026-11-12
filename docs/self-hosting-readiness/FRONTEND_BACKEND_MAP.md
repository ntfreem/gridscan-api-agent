# BitBot Pro — Frontend-to-Backend API Mapping

## API Client Configuration

### REST Client (`/src/utils/api.js`)
- Base URL: `/api` (relative, proxied via ingress)
- Auth: Axios interceptor adds `Authorization: Bearer <token>` from localStorage
- Instance: Axios interceptor adds `X-Instance-ID` header from AuthContext
- Error handling: 401 → auto-logout and redirect to `/login`

### SSE Streaming (`/src/utils/streamChat.js`)
- Uses native `fetch()` with `ReadableStream` reader
- URL: `${REACT_APP_BACKEND_URL}/api/chat`
- Auth: Bearer token in Authorization header
- Instance: X-Instance-ID header
- Supports abort via `AbortController`

### Direct Fetch
- `KnowledgeBase.js` line 501: Uses `fetch()` for file download (knowledge export)
- `ChatWidget.js`: Uses `streamChat()` for SSE

---

## Page-by-Page API Mapping

### AuthContext.js
| Call | Endpoint | Purpose |
|---|---|---|
| `axios.get` | `/api/auth/me` | Check auth state on load |
| `api.get` | `/api/admin/instances` | Load user's instances |

### Login.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.post` | `/api/auth/login` | Authenticate |

### Register.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.post` | `/api/auth/register` | Create account |

### VerifyEmail.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.post` | `/api/auth/verify-email` | Submit OTP |
| `api.post` | `/api/auth/resend-code` | Resend verification |

### ForgotPassword.js / ResetPassword.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.post` | `/api/auth/forgot-password` | Request reset email |
| `api.post` | `/api/auth/reset-password` | Submit new password |

### Dashboard.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.get` | `/api/analytics/overview` | Stats cards |
| `api.get` | `/api/analytics/daily` | Chart data |
| `api.get` | `/api/analytics/daily-by-platform` | Platform breakdown |
| `api.get` | `/api/analytics/llm-usage` | Token usage |
| `api.get` | `/api/analytics/llm-cost` | Cost estimates |
| `api.get` | `/api/analytics/passive-skips` | Skip counts |
| `api.get` | `/api/conversations?limit=6` | Recent conversations |
| `api.get` | `/api/conversations/count` | Total count |

### KnowledgeBase.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.get` | `/api/knowledge/sources` | List all sources |
| `api.get` | `/api/knowledge/categories` | Category list |
| `api.post` | `/api/knowledge/sources/faq` | Add FAQ |
| `api.post` | `/api/knowledge/sources/url` | Add URL |
| `api.post` | `/api/knowledge/sources/url/crawl` | Crawl site |
| `api.post` | `/api/knowledge/sources/url/rescrape` | Re-scrape |
| `api.post` | `/api/knowledge/sources/upload` | Upload document |
| `api.post` | `/api/knowledge/sources/github/scan` | GitHub scan |
| `api.put` | `/api/knowledge/sources/{id}` | Edit source |
| `api.delete` | `/api/knowledge/sources/{id}` | Delete source |
| `api.delete` | `/api/knowledge/sources/group/{id}` | Delete group |
| `api.post` | `/api/knowledge/sources/bulk-delete` | Bulk delete |
| `api.patch` | `/api/knowledge/sources/{id}/toggle` | Enable/disable |
| `api.patch` | `/api/knowledge/sources/{id}/priority` | Set priority |
| `api.patch` | `/api/knowledge/sources/{id}/category` | Set category |
| `api.get` | `/api/knowledge/export` | Export KB |
| `api.post` | `/api/knowledge/import` | Import KB |
| `api.post` | `/api/knowledge/share` | Share KB |
| `fetch` | `/api/knowledge/sources/{id}/content` | View content |

### BotSettings.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.get` | `/api/admin/bot-config` | Load config |
| `api.put` | `/api/admin/bot-config` | Save config |
| `api.post` | `/api/admin/bot-logo` | Upload logo |
| `api.delete` | `/api/admin/bot-logo` | Remove logo |
| `api.post` | `/api/admin/bot-logo/discord-sync` | Sync to Discord |

### ChatPage.js
| Call | Endpoint | Purpose |
|---|---|---|
| `streamChat()` | `/api/chat` | SSE streaming chat |

### ChatWidget.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.get` | `/api/embed/config/{id}` | Widget config |
| `streamChat()` | `/api/chat` | SSE streaming chat |

### EmbedCode.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.put` | `/api/admin/embed-config` | Save embed settings |

### ApiIntegrations.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.get` | `/api/integrations` | List integrations |
| `api.post` | `/api/integrations` | Create integration |
| `api.put` | `/api/integrations/{id}` | Update |
| `api.delete` | `/api/integrations/{id}` | Delete |
| `api.post` | `/api/integrations/{id}/test-connection` | Test |
| `api.post` | `/api/integrations/{id}/discover` | Auto-discover |
| `api.get` | `/api/integrations/{id}/endpoints` | List endpoints |
| `api.put` | `/api/integrations/{id}/endpoints/{eid}` | Update endpoint |
| `api.post` | `/api/integrations/test-endpoint` | Test endpoint |
| `api.get` | `/api/integrations/{id}/diagnostics/scan` | Diagnostic scan |
| `api.get` | `/api/integrations/{id}/diagnostics/gap-report` | Gap report |
| `api.post` | `/api/integrations/{id}/diagnostics/discovery` | Discovery test |
| `api.post` | `/api/integrations/{id}/diagnostics/execution` | Execution test |
| `api.post` | `/api/integrations/{id}/diagnostics/unified` | Full diagnostic |
| `api.get` | `/api/integrations/{id}/diagnostics/history` | History |
| `api.get` | `/api/diagnostics/instance-summary` | Summary |
| `api.get` | `/api/integrations/{id}/stats` | Stats |
| `api.get` | `/api/integrations/{id}/activity` | Activity log |

### ApiKeyAnalytics.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.post` | `/api/admin/api-keys` | Create key |
| `api.get` | `/api/admin/api-keys` | List keys |
| `api.delete` | `/api/admin/api-keys/{id}` | Revoke key |
| `api.patch` | `/api/admin/api-keys/{id}/toggle` | Toggle key |
| `api.get` | `/api/admin/api-key-analytics` | All key analytics |
| `api.get` | `/api/admin/api-key-analytics/{id}` | Key-specific analytics |
| `api.get` | `/api/admin/integration-usage-analytics` | Integration analytics |
| `api.get` | `/api/admin/integration-usage-analytics/{id}` | Per-integration |

### DiscordSettings.js / DiscordAppSetup.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.get` | `/api/discord/app-config` | App setup |
| `api.put` | `/api/discord/app-config` | Save app config |
| `api.get` | `/api/discord/app-config/connections` | Connections |
| `api.delete` | `/api/discord/app-config` | Clear config |
| `api.post` | `/api/discord/purge-all-connections` | Purge |
| `api.get` | `/api/discord/config` | Instance config |
| `api.put` | `/api/discord/config` | Save instance config |
| `api.get` | `/api/discord/status` | Bot status |
| `api.get` | `/api/discord/oauth-url` | Get invite URL |
| `api.get` | `/api/discord/share-oauth-url` | Shareable URL |
| `api.post` | `/api/discord/send-invite-email` | Email invite |
| `api.post` | `/api/discord/disconnect` | Disconnect |
| `api.post` | `/api/discord/restart` | Restart |
| `api.get` | `/api/discord/channels` | Channel list |
| `api.get` | `/api/discord/handoff-status` | Handoff status |
| `api.post` | `/api/discord/handoff-resume` | Resume AI |
| `api.post` | `/api/discord/sync-name` | Sync name |
| `api.get` | `/api/discord/scripted-mode/scenarios` | Test scenarios |
| `api.post` | `/api/discord/scripted-mode/scenarios` | Create scenario |
| `api.post` | `/api/discord/scripted-mode/scenarios/{id}/run` | Run scenario |
| `api.post` | `/api/discord/scripted-mode/sandbox` | Sandbox test |

### TelegramSettings.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.get` | `/api/admin/telegram-config` | Load config |
| `api.put` | `/api/admin/telegram-config` | Save config |
| `api.delete` | `/api/admin/telegram-config` | Delete config |
| `api.post` | `/api/admin/telegram-config/test` | Test connection |

### ZendeskSettings.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.get` | `/api/admin/zendesk-config` | Load config |
| `api.put` | `/api/admin/zendesk-config` | Save config |
| `api.delete` | `/api/admin/zendesk-config` | Delete config |
| `api.post` | `/api/admin/zendesk-config/test` | Test connection |
| `api.get` | `/api/admin/zendesk-config/webhook-url` | Get webhook URL |
| `api.get` | `/api/admin/zendesk-tickets` | Recent tickets |

### LlmConfig.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.get` | `/api/admin/instances/{id}/llm-config` | Load LLM config |
| `api.put` | `/api/admin/instances/{id}/llm-config` | Save LLM config |
| `api.post` | `/api/admin/instances/{id}/llm-config/test` | Test provider |

### Instances.js / InstanceSelect.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.get` | `/api/admin/instances` | List instances |
| `api.post` | `/api/admin/instances` | Create instance |
| `api.delete` | `/api/admin/instances/{id}` | Delete instance |
| `api.post` | `/api/admin/instances/{id}/assign-user` | Assign user |
| `api.delete` | `/api/admin/instances/{id}/unassign-user/{uid}` | Unassign |

### Users.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.get` | `/api/admin/users` | List users |
| `api.delete` | `/api/admin/users/{id}` | Delete user |

### Conversations.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.get` | `/api/conversations` | List with pagination |
| `api.delete` | `/api/conversations/{id}` | Delete conversation |
| `api.patch` | `/api/conversations/{id}/approve` | Approve response |

### ChangelogPage.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.get` | `/api/changelog` | List entries |
| `api.post` | `/api/admin/changelog` | Create entry |
| `api.put` | `/api/admin/changelog/{id}` | Update entry |
| `api.delete` | `/api/admin/changelog/{id}` | Delete entry |

### SetupGuide.js
| Call | Endpoint | Purpose |
|---|---|---|
| `api.get` | `/api/onboarding/step-status` | Step completion |

---

## Hardcoded URLs and Emergent-Specific References

| File | Reference | Notes |
|---|---|---|
| `frontend/.env` | `REACT_APP_BACKEND_URL` | Set to Emergent preview URL; must change for self-hosting |
| `utils/api.js` | `baseURL: /api` | Relative — works anywhere |
| `utils/streamChat.js` | `${process.env.REACT_APP_BACKEND_URL}/api/chat` | Uses env var — configurable |
| `AdminLayout.js` line 49 | `host === "bridgebot.tech"` | Production domain check for environment banner |
| `ChatWidget.js` | `data-bitbotpro-css` attribute | Cosmetic, not a dependency |

## Coupling Assessment

**Low coupling**: The frontend communicates exclusively through REST API and SSE. All URLs use environment variables or relative paths. No direct database access, no server-side rendering, no shared code between frontend and backend.

**Migration-safe**: Changing `REACT_APP_BACKEND_URL` to point at a self-hosted backend is sufficient. No code changes needed in the frontend.
