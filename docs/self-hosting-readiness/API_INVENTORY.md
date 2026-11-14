# BitBot Pro — Complete API Inventory

> Generated from the FastAPI backend. **190+ operations** across v1 legacy + v2 multi-tenant routes.
> Last updated: November 2026 (includes V2 Architecture — all 5 phases).

## Summary

| Category | Endpoints | Auth Required | Version |
|---|---|---|---|
| Authentication & User Mgmt | 12 | Mixed | v1 |
| Bot Instance Management | 7 | Yes (Admin) | v1 |
| Bot Configuration | 7 | Yes | v1 |
| Knowledge Base | 17 | Yes | v1 |
| AI Chat & Streaming | 3 | Mixed | v1 |
| Embed/Widget | 3 | Mixed | v1 |
| API Integrations | 10 | Yes | v1 |
| API Intelligence / Diagnostics | 7 | Yes | v1 |
| API Keys (External) | 5 | Yes | v1 |
| Analytics & Usage | 10 | Yes | v1 |
| Discord | 22 | Yes | v1 |
| Telegram | 5 | Yes | v1 |
| Zendesk | 8 | Yes | v1 |
| Changelog | 4 | Mixed | v1 |
| Conversations | 4 | Yes | v1 |
| Onboarding | 4 | Yes | v1 |
| LLM Configuration | 4 | Yes (Admin) | v1 |
| Administration | 3 | Yes (Admin) | v1 |
| System | 2 | No | v1 |
| **V2 — Organisations** | **6** | **Yes** | **v2** |
| **V2 — Bots** | **6** | **Yes** | **v2** |
| **V2 — Connected Accounts** | **6** | **Yes** | **v2** |
| **V2 — Connections** | **6** | **Yes** | **v2** |
| **V2 — Suggestions** | **2** | **Yes** | **v2** |
| **V2 — Platform Admin** | **4** | **Yes (Admin)** | **v2** |
| **V2 — Webhook Router** | **—** | **N/A (internal)** | **v2** |

---

## 1. Authentication & User Management

### POST /api/auth/register
- **Purpose**: Register a new user account
- **Auth**: None
- **Request Body**: `{ email, username, password }`
- **Response**: `{ message, user_id }`
- **Errors**: 400 (duplicate email/username), 422 (validation)
- **Frontend**: `Register.js`

### POST /api/auth/login
- **Purpose**: Authenticate user, return JWT
- **Auth**: None
- **Request Body**: `{ email_or_username, password }`
- **Response**: `{ token, user: { id, email, username, role } }`
- **Errors**: 401 (invalid credentials), 403 (locked/unverified)
- **Frontend**: `Login.js`, `AuthContext.js`

### GET /api/auth/me
- **Purpose**: Get current authenticated user profile
- **Auth**: Bearer JWT
- **Response**: `{ id, email, username, role }`
- **Frontend**: `AuthContext.js`

### POST /api/auth/verify-email
- **Purpose**: Verify email with OTP code
- **Auth**: None
- **Request Body**: `{ email, code }`
- **Response**: `{ message }`
- **Frontend**: `VerifyEmail.js`

### POST /api/auth/resend-code
- **Purpose**: Resend email verification code
- **Auth**: None
- **Request Body**: `{ email }`
- **Response**: `{ message }`
- **Frontend**: `VerifyEmail.js`

### POST /api/auth/forgot-password
- **Purpose**: Send password reset email
- **Auth**: None
- **Request Body**: `{ email }`
- **Response**: `{ message }`
- **Frontend**: `ForgotPassword.js`

### POST /api/auth/reset-password
- **Purpose**: Reset password with token
- **Auth**: None
- **Request Body**: `{ token, new_password }`
- **Response**: `{ message }`
- **Frontend**: `ResetPassword.js`

### POST /api/auth/change-password
- **Purpose**: Change current user's password
- **Auth**: Bearer JWT
- **Request Body**: `{ current_password, new_password }`
- **Response**: `{ message }`
- **Frontend**: Settings pages

### GET /api/admin/users
- **Purpose**: List all users (admin only)
- **Auth**: Bearer JWT + Admin role
- **Response**: `[{ id, email, username, role, is_active, created_at }]`
- **Frontend**: `Users.js`

### DELETE /api/admin/users/{user_id}
- **Purpose**: Delete a user (admin only)
- **Auth**: Bearer JWT + Admin role
- **Frontend**: `Users.js`

### POST /api/admin/users/{user_id}/toggle-active
- **Purpose**: Enable/disable user account
- **Auth**: Bearer JWT + Admin role
- **Frontend**: `Users.js`

### POST /api/admin/users/{user_id}/change-role
- **Purpose**: Change user role
- **Auth**: Bearer JWT + Admin role
- **Request Body**: `{ role }`
- **Frontend**: `Users.js`

---

## 2. Bot Instance Management

### POST /api/admin/instances
- **Purpose**: Create new bot instance
- **Auth**: Bearer JWT + Admin
- **Request Body**: `{ name, description }`
- **Response**: `{ id, name, description, created_at }`
- **Frontend**: `Instances.js`, `InstanceSelect.js`

### GET /api/admin/instances
- **Purpose**: List all bot instances
- **Auth**: Bearer JWT
- **Response**: `[{ id, name, description, created_at }]`
- **Frontend**: `InstanceSelect.js`, `AdminLayout.js`

### DELETE /api/admin/instances/{instance_id}
- **Purpose**: Delete a bot instance
- **Auth**: Bearer JWT + Admin
- **Frontend**: `Instances.js`

### POST /api/admin/instances/{instance_id}/assign-user
- **Purpose**: Assign user to instance
- **Auth**: Bearer JWT + Admin
- **Request Body**: `{ user_id }`
- **Frontend**: `Instances.js`

### DELETE /api/admin/instances/{instance_id}/unassign-user/{user_id}
- **Purpose**: Remove user from instance
- **Auth**: Bearer JWT + Admin
- **Frontend**: `Instances.js`

### GET /api/admin/instances/{instance_id}/llm-config
- **Purpose**: Get LLM provider config for instance
- **Auth**: Bearer JWT + Admin
- **Response**: `{ provider, model, temperature, api_key_masked }`
- **Frontend**: `LlmConfig.js`

### PUT /api/admin/instances/{instance_id}/llm-config
- **Purpose**: Update LLM config for instance
- **Auth**: Bearer JWT + Admin
- **Request Body**: `{ provider, model, temperature, api_key }`
- **Frontend**: `LlmConfig.js`

---

## 3. Bot Configuration

### GET /api/admin/bot-config
- **Purpose**: Get bot config for current instance
- **Auth**: Bearer JWT + X-Instance-ID header
- **Response**: `{ name, system_prompt, welcome_message, passive_mode, knowledge_gate, ... }`
- **Frontend**: `BotSettings.js`

### PUT /api/admin/bot-config
- **Purpose**: Update bot config
- **Auth**: Bearer JWT + X-Instance-ID
- **Request Body**: Full bot config object
- **Frontend**: `BotSettings.js`

### POST /api/admin/bot-logo
- **Purpose**: Upload bot logo image
- **Auth**: Bearer JWT + X-Instance-ID
- **Request**: Multipart file upload
- **Frontend**: `BotSettings.js`
- **File Upload**: Yes

### DELETE /api/admin/bot-logo
- **Purpose**: Remove bot logo
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `BotSettings.js`

### POST /api/admin/bot-logo/discord-sync
- **Purpose**: Sync bot logo to Discord
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `BotSettings.js`

### PUT /api/admin/embed-config
- **Purpose**: Update widget embed config (colors, positioning)
- **Auth**: Bearer JWT + X-Instance-ID
- **Request Body**: `{ primary_color, position, welcome_message, ... }`
- **Frontend**: `EmbedCode.js`

### POST /api/admin/api-test
- **Purpose**: Test API endpoint call
- **Auth**: Bearer JWT
- **Request Body**: `{ url, method, headers, body }`
- **Frontend**: `BotSettings.js`

---

## 4. Knowledge Base

### GET /api/knowledge/sources
- **Purpose**: List all knowledge sources for instance
- **Auth**: Bearer JWT + X-Instance-ID
- **Response**: `[{ id, type, title, content, enabled, priority, category, ... }]`
- **Frontend**: `KnowledgeBase.js`

### POST /api/knowledge/sources/faq
- **Purpose**: Add FAQ knowledge entry
- **Auth**: Bearer JWT + X-Instance-ID
- **Request Body**: `{ question, answer, category }`
- **Frontend**: `KnowledgeBase.js`

### POST /api/knowledge/sources/url
- **Purpose**: Ingest knowledge from URL
- **Auth**: Bearer JWT + X-Instance-ID
- **Request Body**: `{ url }`
- **Frontend**: `KnowledgeBase.js`

### POST /api/knowledge/sources/url/crawl
- **Purpose**: Crawl website and ingest multiple pages
- **Auth**: Bearer JWT + X-Instance-ID
- **Request Body**: `{ url, max_pages }`
- **Streaming**: Yes (SSE progress updates)
- **Frontend**: `KnowledgeBase.js`

### POST /api/knowledge/sources/url/rescrape
- **Purpose**: Re-scrape an existing URL source
- **Auth**: Bearer JWT + X-Instance-ID
- **Request Body**: `{ source_id }`
- **Frontend**: `KnowledgeBase.js`

### POST /api/knowledge/sources/upload
- **Purpose**: Upload document (PDF, TXT, DOCX, CSV, MD)
- **Auth**: Bearer JWT + X-Instance-ID
- **Request**: Multipart file upload
- **File Upload**: Yes
- **Frontend**: `KnowledgeBase.js`

### POST /api/knowledge/sources/github/scan
- **Purpose**: Scan GitHub repository for knowledge
- **Auth**: Bearer JWT + X-Instance-ID
- **Request Body**: `{ repo_url, branch, file_patterns }`
- **Frontend**: `KnowledgeBase.js`

### PUT /api/knowledge/sources/{source_id}
- **Purpose**: Update a knowledge source
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `KnowledgeBase.js`

### DELETE /api/knowledge/sources/{source_id}
- **Purpose**: Delete a knowledge source
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `KnowledgeBase.js`

### DELETE /api/knowledge/sources/group/{group_id}
- **Purpose**: Delete all sources in a group
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `KnowledgeBase.js`

### POST /api/knowledge/sources/bulk-delete
- **Purpose**: Bulk delete multiple sources
- **Auth**: Bearer JWT + X-Instance-ID
- **Request Body**: `{ source_ids: [] }`
- **Frontend**: `KnowledgeBase.js`

### PATCH /api/knowledge/sources/{source_id}/toggle
- **Purpose**: Enable/disable source
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `KnowledgeBase.js`

### PATCH /api/knowledge/sources/{source_id}/priority
- **Purpose**: Set source priority
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `KnowledgeBase.js`

### PATCH /api/knowledge/sources/{source_id}/category
- **Purpose**: Set source category
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `KnowledgeBase.js`

### GET /api/knowledge/sources/{source_id}/content
- **Purpose**: Get full content of a source
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `KnowledgeContentViewer.js`

### GET /api/knowledge/categories
- **Purpose**: List all categories in use
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `KnowledgeBase.js`

### GET /api/knowledge/export
- **Purpose**: Export knowledge base as JSON
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `KnowledgeBase.js`

### POST /api/knowledge/import
- **Purpose**: Import knowledge base from JSON
- **Auth**: Bearer JWT + X-Instance-ID
- **Request**: Multipart file upload
- **Frontend**: `KnowledgeBase.js`

### POST /api/knowledge/share
- **Purpose**: Share KB between instances
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `KnowledgeBase.js`

---

## 5. AI Chat & Streaming

### POST /api/chat
- **Purpose**: Send chat message, receive SSE stream response
- **Auth**: Bearer JWT or API Key (X-API-Key header)
- **Request Body**: `{ message, session_id, instance_id }`
- **Response**: Server-Sent Events stream
- **Streaming**: Yes (SSE)
- **Frontend**: `ChatPage.js`, `ChatWidget.js` (via `streamChat.js`)

### POST /api/v1/chat
- **Purpose**: External API chat endpoint (for API key users)
- **Auth**: X-API-Key header
- **Request Body**: `{ message, session_id }`
- **Response**: SSE stream
- **Streaming**: Yes (SSE)
- **Frontend**: External consumers via API keys

### POST /api/admin/instances/{instance_id}/llm-config/test
- **Purpose**: Test LLM provider configuration
- **Auth**: Bearer JWT + Admin
- **Request Body**: `{ provider, model, api_key }`
- **Response**: `{ success, message, response }`
- **Frontend**: `LlmConfig.js`

---

## 6. Embed / Widget

### GET /api/embed/config/{instance_id}
- **Purpose**: Get embed widget config (public)
- **Auth**: None (public endpoint for widget)
- **Response**: `{ name, welcome_message, primary_color, logo_url, ... }`
- **Frontend**: `ChatWidget.js`

### GET /api/embed.js
- **Purpose**: Serve the JavaScript embed snippet
- **Auth**: None (public)
- **Response**: JavaScript file
- **Frontend**: Embedded on third-party sites

### GET /api/chat/{instance_id}
- **Purpose**: Serve the embeddable chat HTML page
- **Auth**: None (public iframe)
- **Response**: HTML page
- **Frontend**: iframe embeds

---

## 7. API Integrations (prefix: /api/integrations)

### GET /api/integrations
- **Purpose**: List all API integrations for instance
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiIntegrations.js`

### GET /api/integrations/{integration_id}
- **Purpose**: Get single integration details
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiIntegrations.js`

### POST /api/integrations
- **Purpose**: Create new API integration
- **Auth**: Bearer JWT + X-Instance-ID
- **Request Body**: `{ name, base_url, auth_type, auth_value, description }`
- **Frontend**: `ApiIntegrations.js`

### PUT /api/integrations/{integration_id}
- **Purpose**: Update integration
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiIntegrations.js`

### DELETE /api/integrations/{integration_id}
- **Purpose**: Delete integration
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiIntegrations.js`

### POST /api/integrations/{integration_id}/test-connection
- **Purpose**: Test API connection
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiIntegrations.js`

### POST /api/integrations/{integration_id}/discover
- **Purpose**: Auto-discover API endpoints via OpenAPI
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiIntegrations.js`

### GET /api/integrations/{integration_id}/endpoints
- **Purpose**: List discovered endpoints
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiIntegrations.js`

### PUT /api/integrations/{integration_id}/endpoints/{endpoint_id}
- **Purpose**: Update endpoint config (enable/disable, params)
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiIntegrations.js`

### POST /api/integrations/test-endpoint
- **Purpose**: Execute a test call against an endpoint
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiIntegrations.js`

---

## 8. API Intelligence / Diagnostics (prefix: /api/integrations/{id}/diagnostics)

### GET /api/integrations/{id}/diagnostics/scan
- **Purpose**: Run passive diagnostic scan
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiIntegrations.js`

### GET /api/integrations/{id}/diagnostics/gap-report
- **Purpose**: Generate documentation gap report
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiIntegrations.js`

### POST /api/integrations/{id}/diagnostics/discovery
- **Purpose**: Test API discovery capability
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiIntegrations.js`

### POST /api/integrations/{id}/diagnostics/execution
- **Purpose**: Test endpoint execution
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiIntegrations.js`

### POST /api/integrations/{id}/diagnostics/unified
- **Purpose**: Run full diagnostic suite (discovery + execution)
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiIntegrations.js`

### GET /api/integrations/{id}/diagnostics/history
- **Purpose**: Get diagnostic run history
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiIntegrations.js`

### GET /api/diagnostics/instance-summary
- **Purpose**: Get diagnostic summary for all integrations
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: Dashboard

---

## 9. API Keys (External Access)

### POST /api/admin/api-keys
- **Purpose**: Create external API key
- **Auth**: Bearer JWT + X-Instance-ID
- **Request Body**: `{ name, rate_limit }`
- **Frontend**: `ApiKeyAnalytics.js`

### GET /api/admin/api-keys
- **Purpose**: List API keys
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiKeyAnalytics.js`

### DELETE /api/admin/api-keys/{key_id}
- **Purpose**: Revoke API key
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiKeyAnalytics.js`

### PATCH /api/admin/api-keys/{key_id}/toggle
- **Purpose**: Enable/disable API key
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiKeyAnalytics.js`

### GET /api/admin/api-key-analytics
- **Purpose**: Get usage analytics for all API keys
- **Auth**: Bearer JWT + X-Instance-ID
- **Query**: `?days=30`
- **Frontend**: `ApiKeyAnalytics.js`

---

## 10. Analytics & Usage Tracking

### GET /api/analytics/overview
- **Purpose**: Dashboard overview stats
- **Auth**: Bearer JWT + X-Instance-ID
- **Response**: `{ total_conversations, total_messages, avg_response_time, ... }`
- **Frontend**: `Dashboard.js`

### GET /api/analytics/daily
- **Purpose**: Daily message counts
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `Dashboard.js`

### GET /api/analytics/daily-by-platform
- **Purpose**: Daily counts broken down by platform
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `Dashboard.js`

### GET /api/analytics/llm-usage
- **Purpose**: LLM token usage stats
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `Dashboard.js`

### GET /api/analytics/llm-cost
- **Purpose**: Estimated LLM cost breakdown
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `Dashboard.js`

### GET /api/analytics/passive-skips
- **Purpose**: Count of passive-mode skipped responses
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `Dashboard.js`

### GET /api/admin/api-key-analytics/{key_id}
- **Purpose**: Analytics for specific API key
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiKeyAnalytics.js`

### GET /api/admin/integration-usage-analytics
- **Purpose**: Usage analytics across all integrations
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiKeyAnalytics.js`

### GET /api/admin/integration-usage-analytics/{integration_id}
- **Purpose**: Analytics for specific integration
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiKeyAnalytics.js`

### GET /api/integrations/{id}/stats
- **Purpose**: Stats for single integration
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ApiIntegrations.js`

---

## 11. Discord (22 endpoints)

### GET /api/discord/app-config
- **Purpose**: Get Discord app/bot config (admin-level)
- **Auth**: Bearer JWT + Admin
- **Frontend**: `DiscordAppSetup.js`

### PUT /api/discord/app-config
- **Purpose**: Update Discord app config
- **Auth**: Bearer JWT + Admin
- **Request Body**: `{ client_id, client_secret, bot_token }`
- **Frontend**: `DiscordAppSetup.js`

### GET /api/discord/app-config/connections
- **Purpose**: List all Discord guild connections
- **Auth**: Bearer JWT + Admin
- **Frontend**: `DiscordAppSetup.js`

### DELETE /api/discord/app-config
- **Purpose**: Clear Discord app config
- **Auth**: Bearer JWT + Admin
- **Frontend**: `DiscordAppSetup.js`

### POST /api/discord/purge-all-connections
- **Purpose**: Remove all guild connections
- **Auth**: Bearer JWT + Admin
- **Frontend**: `DiscordAppSetup.js`

### GET /api/discord/config
- **Purpose**: Get Discord config for instance
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `DiscordSettings.js`

### PUT /api/discord/config
- **Purpose**: Update instance Discord config
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `DiscordSettings.js`

### GET /api/discord/status
- **Purpose**: Get Discord bot status
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `DiscordSettings.js`

### GET /api/discord/oauth-url
- **Purpose**: Generate OAuth URL for bot invite
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `DiscordSettings.js`

### GET /api/discord/share-oauth-url
- **Purpose**: Generate shareable invite link
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `DiscordSettings.js`

### POST /api/discord/send-invite-email
- **Purpose**: Email Discord invite to server owner
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `DiscordSettings.js`

### GET /api/discord/callback
- **Purpose**: Discord OAuth callback handler
- **Auth**: None (OAuth redirect)
- **Response**: Redirect to frontend

### POST /api/discord/disconnect
- **Purpose**: Disconnect from Discord guild
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `DiscordSettings.js`

### POST /api/discord/restart
- **Purpose**: Restart Discord bot
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `DiscordSettings.js`

### GET /api/discord/channels
- **Purpose**: List guild channels
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `DiscordSettings.js`

### GET /api/discord/handoff-status
- **Purpose**: Get human handoff status
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `DiscordSettings.js`

### POST /api/discord/handoff-resume
- **Purpose**: Resume AI responses after handoff
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `DiscordSettings.js`

### POST /api/discord/sync-name
- **Purpose**: Sync bot name to Discord
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `DiscordSettings.js`

### GET /api/discord/scripted-mode/scenarios
- **Purpose**: List scripted test scenarios
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `DiscordSettings.js`

### POST /api/discord/scripted-mode/scenarios
- **Purpose**: Create test scenario
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `DiscordSettings.js`

### POST /api/discord/scripted-mode/scenarios/{id}/run
- **Purpose**: Run single test scenario
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `DiscordSettings.js`

### POST /api/discord/scripted-mode/sandbox
- **Purpose**: Quick sandbox test
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `DiscordSettings.js`

---

## 12. Telegram (5 endpoints)

### GET /api/admin/telegram-config
- **Purpose**: Get Telegram config for instance
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `TelegramSettings.js`

### PUT /api/admin/telegram-config
- **Purpose**: Update Telegram config, set webhook
- **Auth**: Bearer JWT + X-Instance-ID
- **Request Body**: `{ bot_token, listen_mode }`
- **Frontend**: `TelegramSettings.js`

### DELETE /api/admin/telegram-config
- **Purpose**: Delete Telegram config, remove webhook
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `TelegramSettings.js`

### POST /api/admin/telegram-config/test
- **Purpose**: Test Telegram bot connection
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `TelegramSettings.js`

### POST /api/telegram/webhook/{instance_id}/{webhook_secret}
- **Purpose**: Telegram webhook receiver (incoming messages)
- **Auth**: URL-based secret
- **Webhook**: Yes (incoming from Telegram)

---

## 13. Zendesk (8 endpoints)

### GET /api/admin/zendesk-config
- **Purpose**: Get Zendesk config for instance
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ZendeskSettings.js`

### PUT /api/admin/zendesk-config
- **Purpose**: Update Zendesk config
- **Auth**: Bearer JWT + X-Instance-ID
- **Request Body**: `{ subdomain, admin_email, api_token, auto_reply, agent_assist }`
- **Frontend**: `ZendeskSettings.js`

### DELETE /api/admin/zendesk-config
- **Purpose**: Delete Zendesk config
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ZendeskSettings.js`

### POST /api/admin/zendesk-config/test
- **Purpose**: Test Zendesk connection
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ZendeskSettings.js`

### GET /api/admin/zendesk-config/webhook-url
- **Purpose**: Get webhook URL for Zendesk config
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ZendeskSettings.js`

### GET /api/admin/zendesk-tickets
- **Purpose**: Fetch recent Zendesk tickets
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ZendeskSettings.js`

### POST /api/zendesk/webhook/{instance_id}/{webhook_secret}
- **Purpose**: Zendesk webhook (incoming ticket events)
- **Auth**: URL-based secret + optional signature
- **Webhook**: Yes (incoming from Zendesk)

### GET /api/admin/zendesk-config/suggestions
- **Purpose**: Get AI suggestion history
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `ZendeskSettings.js`

### POST /api/admin/zendesk/oauth/start
- **Purpose**: Generate Zendesk OAuth authorization URL with PKCE and state
- **Auth**: Bearer JWT + X-Instance-ID
- **Body**: `{ "subdomain": "your-company" }`
- **Response**: `{ "redirect_url": "https://...", "subdomain": "your-company" }`
- **Frontend**: `ZendeskSettings.js` (Connect with Zendesk button)

### GET /api/zendesk/oauth/callback
- **Purpose**: OAuth callback — exchanges authorization code for tokens, validates state, stores connection
- **Auth**: None (uses state param for CSRF validation)
- **Query**: `?code=...&state=...` or `?error=...&error_description=...&state=...`
- **Response**: RedirectResponse to `/admin/zendesk?oauth=success` or `?oauth=error&message=...`
- **Frontend**: Browser redirect from Zendesk

### GET /api/admin/zendesk/oauth/callback-url
- **Purpose**: Return the OAuth callback URL for Zendesk admin setup
- **Auth**: Bearer JWT + X-Instance-ID
- **Response**: `{ "callback_url": "https://.../api/zendesk/oauth/callback" }`

### GET /api/zendesk/suggestion/{instance_id}/{ticket_id}
- **Purpose**: Public endpoint for Zendesk sidebar app to fetch AI suggestion
- **Auth**: None (public, scoped by instance_id + ticket_id)
- **Response**: `{ "suggestion": "...", "ticket_id": "..." }`

---

## 14. Conversations

### GET /api/conversations
- **Purpose**: List conversations for instance
- **Auth**: Bearer JWT + X-Instance-ID
- **Query**: `?limit=50&offset=0&search=`
- **Frontend**: `Conversations.js`

### GET /api/conversations/count
- **Purpose**: Get conversation count
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `Dashboard.js`

### DELETE /api/conversations/{session_id}
- **Purpose**: Delete a conversation
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `Conversations.js`

### PATCH /api/conversations/{session_id}/approve
- **Purpose**: Approve a response
- **Auth**: Bearer JWT + X-Instance-ID
- **Frontend**: `Conversations.js`

---

## 15. Changelog

### GET /api/changelog
- **Purpose**: List changelog entries (public)
- **Auth**: None
- **Frontend**: `ChangelogPage.js`

### POST /api/admin/changelog
- **Purpose**: Create changelog entry
- **Auth**: Bearer JWT + Admin
- **Frontend**: `ChangelogPage.js`

### PUT /api/admin/changelog/{id}
- **Purpose**: Update changelog entry
- **Auth**: Bearer JWT + Admin
- **Frontend**: `ChangelogPage.js`

### DELETE /api/admin/changelog/{id}
- **Purpose**: Delete changelog entry
- **Auth**: Bearer JWT + Admin
- **Frontend**: `ChangelogPage.js`

---

## 16. Onboarding

### GET /api/onboarding/status
- **Purpose**: Get onboarding completion status
- **Auth**: Bearer JWT
- **Frontend**: (Legacy, replaced by step-status)

### POST /api/onboarding/complete
- **Purpose**: Mark onboarding as complete
- **Auth**: Bearer JWT

### POST /api/onboarding/dismiss
- **Purpose**: Dismiss onboarding
- **Auth**: Bearer JWT

### GET /api/onboarding/step-status
- **Purpose**: Dynamic step completion based on real data
- **Auth**: Bearer JWT + X-Instance-ID
- **Response**: `{ create_instance, add_knowledge, customize_persona, test_bot, connect_channel }`
- **Frontend**: `SetupGuide.js`

---

## 17. System

### GET /api/
- **Purpose**: Health check / API info
- **Auth**: None
- **Response**: `{ message: "BitBot Pro API" }`

### GET /api/health
- **Purpose**: Health check with uptime
- **Auth**: None
- **Response**: `{ status, uptime }`


---

## 18. V2 — Organisations (prefix: `/api/v2/orgs`)

> V2 endpoints use `org_routes.py`. Auth is Bearer JWT. Org context is resolved from the URL path, not headers.

### GET /api/v2/orgs
- **Purpose**: List organisations the current user belongs to (with bot/member/account counts)
- **Auth**: Bearer JWT
- **Response**: `{ orgs: [{ id, name, description, bot_count, member_count, account_count }] }`
- **Frontend**: `AuthContext.js`, `AdminLayout.js` (org selector)

### POST /api/v2/orgs
- **Purpose**: Create a new organisation
- **Auth**: Bearer JWT
- **Request Body**: `{ name, description }`
- **Response**: `{ id, name, owner_id, created_at }`
- **Frontend**: `Organisations.js`

### GET /api/v2/orgs/{org_id}
- **Purpose**: Get single org details
- **Auth**: Bearer JWT (must be member)
- **Response**: `{ id, name, description, owner_id, member_count }`
- **Frontend**: `Organisations.js`

### PUT /api/v2/orgs/{org_id}
- **Purpose**: Update org name/description
- **Auth**: Bearer JWT (owner or admin)
- **Request Body**: `{ name, description }`
- **Frontend**: `Organisations.js`

### GET /api/v2/orgs/{org_id}/members
- **Purpose**: List org members with roles
- **Auth**: Bearer JWT (must be member)
- **Response**: `{ members: [{ user_id, email, username, role }] }`
- **Frontend**: `Organisations.js` (Team & Access tab)

### POST /api/v2/orgs/{org_id}/members
- **Purpose**: Add member to org
- **Auth**: Bearer JWT (owner or admin)
- **Request Body**: `{ user_id, role }`
- **Frontend**: `Organisations.js`

### DELETE /api/v2/orgs/{org_id}/members/{member_id}
- **Purpose**: Remove member from org
- **Auth**: Bearer JWT (owner or admin)
- **Frontend**: `Organisations.js`

### PATCH /api/v2/orgs/{org_id}/members/{member_id}/role
- **Purpose**: Update member role
- **Auth**: Bearer JWT (owner or admin)
- **Request Body**: `{ role }`
- **Frontend**: `Organisations.js`

### GET /api/v2/orgs/{org_id}/overview
- **Purpose**: Get org-scoped overview metrics (bots, connections, messages, KB size, suggestions)
- **Auth**: Bearer JWT (must be member)
- **Response**: `{ bots, connections, conversations, messages, knowledge, suggestions }`
- **Frontend**: `Dashboard.js`

---

## 19. V2 — Bots (prefix: `/api/v2/orgs/{org_id}/bots`)

> V2 endpoints use `bot_routes.py`. Bots are scoped to organisations.

### GET /api/v2/orgs/{org_id}/bots
- **Purpose**: List bots in organisation (with connection counts, KB size)
- **Auth**: Bearer JWT
- **Response**: `{ bots: [{ id, name, persona, connection_count, kb_size }] }`
- **Frontend**: `AdminLayout.js` (bot selector), `BotList.js`

### POST /api/v2/orgs/{org_id}/bots
- **Purpose**: Create a new bot (optionally linked to legacy instance)
- **Auth**: Bearer JWT
- **Request Body**: `{ name, persona, instructions, legacy_instance_id }`
- **Response**: `{ id, org_id, name, created_at }`
- **Frontend**: `BotList.js`

### GET /api/v2/orgs/{org_id}/bots/{bot_id}
- **Purpose**: Get single bot with enriched data
- **Auth**: Bearer JWT
- **Response**: `{ id, name, persona, connections, settings }`
- **Frontend**: `BotOverview.js`

### PUT /api/v2/orgs/{org_id}/bots/{bot_id}
- **Purpose**: Update bot name, persona, instructions
- **Auth**: Bearer JWT
- **Request Body**: `{ name, persona, instructions }`
- **Frontend**: `BotOverview.js`

### DELETE /api/v2/orgs/{org_id}/bots/{bot_id}
- **Purpose**: Delete bot (cascades to connections)
- **Auth**: Bearer JWT
- **Frontend**: `BotList.js`

### GET /api/v2/orgs/{org_id}/bots/{bot_id}/settings
- **Purpose**: Get bot behaviour settings (LLM config, response mode, knowledge gate)
- **Auth**: Bearer JWT
- **Response**: `{ llm_config, response_mode, knowledge_gate, custom_instructions }`
- **Frontend**: `BotSettings.js` (V2 Behaviour page)

### PUT /api/v2/orgs/{org_id}/bots/{bot_id}/settings
- **Purpose**: Update bot behaviour settings
- **Auth**: Bearer JWT
- **Request Body**: Full settings object
- **Frontend**: `BotSettings.js`

---

## 20. V2 — Connected Accounts (prefix: `/api/v2/orgs/{org_id}/accounts`)

> V2 endpoints use `account_routes.py`. Accounts are reusable provider identities (Discord bot, Telegram bot, Zendesk OAuth) shared across bots in an org.

### GET /api/v2/orgs/{org_id}/accounts
- **Purpose**: List all connected accounts for org (with connection counts)
- **Auth**: Bearer JWT
- **Response**: `{ accounts: [{ id, provider, name, status, connection_count, active_connection_count, credentials_display }] }`
- **Frontend**: `ConnectedAccounts.js`

### POST /api/v2/orgs/{org_id}/accounts
- **Purpose**: Create a new connected account
- **Auth**: Bearer JWT
- **Request Body**: `{ provider, name, credentials }` (credentials encrypted at rest)
- **Providers**: `discord`, `telegram`, `zendesk`
- **Frontend**: `ConnectedAccounts.js` (Discord guided setup, Telegram/Zendesk inline forms)

### GET /api/v2/orgs/{org_id}/accounts/{account_id}
- **Purpose**: Get single account details (with masked credentials)
- **Auth**: Bearer JWT
- **Response**: `{ id, provider, name, status, credentials_display, metadata }`
- **Frontend**: `ConnectedAccounts.js` (Settings panel)

### PUT /api/v2/orgs/{org_id}/accounts/{account_id}
- **Purpose**: Update account name and/or credentials
- **Auth**: Bearer JWT
- **Request Body**: `{ name, credentials }` (only non-empty credential fields are updated)
- **Frontend**: `ConnectedAccounts.js` (Discord Settings panel)

### POST /api/v2/orgs/{org_id}/accounts/{account_id}/disconnect
- **Purpose**: Soft-disconnect account (pauses all connections using it)
- **Auth**: Bearer JWT
- **Response**: `{ status, connections_paused, warning }`
- **Frontend**: `ConnectedAccounts.js`

### POST /api/v2/orgs/{org_id}/accounts/{account_id}/reconnect
- **Purpose**: Re-activate a disconnected account
- **Auth**: Bearer JWT
- **Frontend**: `ConnectedAccounts.js`

---

## 21. V2 — Connections (prefix: `/api/v2/orgs/{org_id}/bots/{bot_id}/connections`)

> V2 endpoints use `connection_routes.py`. Connections link a bot to a destination (e.g., Discord server, Telegram group) via a connected account.

### GET /api/v2/orgs/{org_id}/bots/{bot_id}/connections
- **Purpose**: List all connections for a bot (with account info)
- **Auth**: Bearer JWT
- **Response**: `{ connections: [{ id, account_id, provider, destination, response_mode, enabled, account_name, account_status }] }`
- **Frontend**: `IntegrationsPage.js`

### POST /api/v2/orgs/{org_id}/bots/{bot_id}/connections
- **Purpose**: Create a new connection route
- **Auth**: Bearer JWT
- **Request Body**: `{ account_id, provider, destination, response_mode, overrides, priority }`
- **Response Modes**: `auto_reply`, `agent_assist`, `internal_note`
- **Frontend**: `IntegrationsPage.js` (Add Connection wizard)

### GET /api/v2/orgs/{org_id}/bots/{bot_id}/connections/{conn_id}
- **Purpose**: Get connection details
- **Auth**: Bearer JWT
- **Response**: `{ id, provider, destination, response_mode, enabled, overrides, account }`
- **Frontend**: `IntegrationsPage.js`

### PUT /api/v2/orgs/{org_id}/bots/{bot_id}/connections/{conn_id}
- **Purpose**: Update connection settings
- **Auth**: Bearer JWT
- **Request Body**: `{ destination, response_mode, overrides, priority }`
- **Frontend**: `IntegrationsPage.js`

### PATCH /api/v2/orgs/{org_id}/bots/{bot_id}/connections/{conn_id}/toggle
- **Purpose**: Enable/disable a connection
- **Auth**: Bearer JWT
- **Response**: `{ enabled }`
- **Frontend**: `IntegrationsPage.js`

### GET /api/v2/orgs/{org_id}/bots/{bot_id}/connections/{conn_id}/activity
- **Purpose**: Get connection activity log and recent agent_assist suggestions
- **Auth**: Bearer JWT
- **Response**: `{ activity: [...], suggestions: [...] }`
- **Frontend**: `IntegrationsPage.js`

---

## 22. V2 — Suggestions (prefix: `/api/v2/orgs/{org_id}/bots/{bot_id}/suggestions`)

> Stored in `v2_suggestions` collection. Generated when a connection operates in `agent_assist` mode.

### GET /api/v2/orgs/{org_id}/bots/{bot_id}/suggestions
- **Purpose**: List AI suggestions for review (filterable by status, connection_id)
- **Auth**: Bearer JWT
- **Query**: `?status=pending&connection_id=xxx&limit=50&skip=0`
- **Response**: `{ suggestions: [{ id, connection_id, platform, user_message, ai_suggestion, status, created_at }] }`
- **Frontend**: `SuggestionsInbox.js`

### PATCH /api/v2/orgs/{org_id}/bots/{bot_id}/suggestions/{suggestion_id}
- **Purpose**: Accept or dismiss a suggestion
- **Auth**: Bearer JWT
- **Request Body**: `{ status: "accepted" | "dismissed" }`
- **Frontend**: `SuggestionsInbox.js`

---

## 23. V2 — Platform Admin (prefix: `/api/v2/platform`)

> V2 endpoints use `platform_routes.py`. Requires admin role. Cross-org visibility.

### GET /api/v2/platform/stats
- **Purpose**: Platform-wide statistics (org count, total bots, accounts, connections, messages)
- **Auth**: Bearer JWT + Admin
- **Response**: `{ orgs, bots, accounts, connections, active_connections, total_messages, total_conversations }`
- **Frontend**: `Dashboard.js` (Platform Admin section)

### GET /api/v2/platform/workspaces
- **Purpose**: List all organisations with stats (cross-org admin view)
- **Auth**: Bearer JWT + Admin
- **Response**: `{ workspaces: [{ id, name, owner, bot_count, account_count, member_count }] }`
- **Frontend**: `Organisations.js` (Platform Admin view)

### GET /api/v2/platform/workspaces/{org_id}/detail
- **Purpose**: Detailed org breakdown (members, bots, accounts for admin inspection)
- **Auth**: Bearer JWT + Admin
- **Response**: `{ org, members: [...], bots: [...], accounts: [...] }`
- **Frontend**: `Organisations.js` (expandable row detail)

### GET /api/v2/platform/provider-apps
- **Purpose**: Provider account/connection stats breakdown across all orgs
- **Auth**: Bearer JWT + Admin
- **Response**: `{ providers: { discord: { accounts, connections, active }, telegram: {...}, zendesk: {...} } }`
- **Frontend**: `ProviderApps.js`

---

## 24. V2 — Webhook Router (Internal Module)

> `webhook_router.py` is NOT exposed as API endpoints. It is an internal routing engine called by Discord `on_message`, Telegram webhook handler, and Zendesk webhook handler.

### Resolution Logic
```
Incoming message (provider + destination identifier)
  → webhook_router.resolve_v2(provider, destination_id)
  → Query connections collection: { provider, destination, enabled: true }
  → Match by account_id + destination (guild_id, chat_id, ticket_group_id)
  → Return { bot_id, connection_id, response_mode, overrides }
  → If no V2 match → fallback to V1 legacy routing
```

### Key Functions
- `resolve_v2_connection(provider, destination_id, account_id)` — Primary resolver
- `resolve_all_v2_connections(provider, destination_id)` — Returns all matching connections (multi-route)
- `log_v2_activity(connection_id, event_type, data)` — Activity tracking
- `create_v2_suggestion(connection_id, bot_id, ...)` — Agent-assist suggestion creation

### Test Coverage
- `tests/test_v2_webhook_router.py` — Comprehensive unit tests for resolution logic
