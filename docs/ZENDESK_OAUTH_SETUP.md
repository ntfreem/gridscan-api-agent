# Zendesk OAuth Integration — Administrator Setup Guide

> **BitBot Pro** uses OAuth 2.0 (authorization-code flow with PKCE) to connect
> to Zendesk. This replaces the legacy email + API token method with a more
> secure, revocable, and scoped authorization.

---

## Prerequisites

| Requirement | Detail |
|---|---|
| **Zendesk plan** | Any plan that supports OAuth clients (Team and above) |
| **Admin access** | You need a Zendesk **Admin** role to create an OAuth client |
| **BitBot Pro** | Deployed and accessible via HTTPS |

---

## Step 1 — Determine Your Callback URL

The OAuth callback URL is where Zendesk redirects users after they authorize.
It **must** match exactly what you register in Zendesk.

| Environment | Callback URL |
|---|---|
| **Production** | `https://bitbotpro.io/api/zendesk/oauth/callback` |
| **Preview/Dev** | `https://rag-search-dev.preview.emergentagent.com/api/zendesk/oauth/callback` |

> You can retrieve this programmatically from the API:
> `GET /api/admin/zendesk/oauth/callback-url`

---

## Step 2 — Create the OAuth Client in Zendesk

1. Log in to Zendesk as an **Admin**.
2. Go to **Admin Center → Apps and integrations → APIs → OAuth clients**.
3. Click **Add OAuth client**.
4. Fill in the fields:

| Field | Value |
|---|---|
| **Client name** | `BitBot Pro` |
| **Client identifier** | `bitbotpro` (auto-generated, editable) |
| **Client kind** | **Confidential** (recommended — the app has a secure backend) |
| **Redirect URLs** | Paste the callback URL from Step 1. Add both production and preview if needed (one per line). |
| **Scopes (allowed)** | `tickets:read tickets:write users:read` |
| **Description** | (Optional) "BitBot Pro AI assistant integration" |

5. Click **Save**.
6. **Copy the Client Secret immediately** — it is shown only once.

---

## Step 3 — Set the Environment Variables

Two secrets must be added to BitBot Pro's backend environment:

| Variable | Value | Source |
|---|---|---|
| `ZENDESK_OAUTH_CLIENT_ID` | The **Identifier** from Step 2 (e.g. `bitbotpro`) | Zendesk OAuth client page |
| `ZENDESK_OAUTH_CLIENT_SECRET` | The **Secret** you copied in Step 2 | Shown once at creation |

### How to set them

Use BitBot Pro's **Secrets** management (the secure card in the chat interface)
to add these values. Never paste secrets directly into chat or `.env` files
committed to version control.

---

## Step 4 — Connect from the BitBot Pro Dashboard

1. Navigate to **Admin → Zendesk** in BitBot Pro.
2. Enter your Zendesk subdomain (e.g. `midnight-gd`).
3. Click **"Connect with Zendesk"**.
4. You'll be redirected to Zendesk to authorize.
5. After approving, you'll return to BitBot Pro with the connection confirmed.

---

## Scopes & Permissions

### OAuth Scopes Requested

| Scope | Purpose |
|---|---|
| `tickets:read` | Read ticket content for AI processing and agent-assist suggestions |
| `tickets:write` | Post AI-generated replies (only when Auto-Reply is enabled) |
| `users:read` | Verify the connected user's identity and role |

### Zendesk User-Role Requirements

The Zendesk user who authorizes the connection must have one of these roles:

| Role | Can Read Tickets | Can Post Replies | Notes |
|---|---|---|---|
| **Admin** | Yes | Yes | Full access. Recommended for setup. |
| **Agent** | Yes | Yes | Standard support agent. |
| **Light Agent** | Yes | Internal notes only | Cannot post public replies. |
| **End User** | Own tickets only | No | Not suitable for this integration. |

> The authorizing user's permissions apply to all API calls made by the
> integration. For full functionality (read all tickets + post public
> replies), an **Agent** or **Admin** role is required.

---

## Token Lifecycle

| Token | Default Expiry | Behavior |
|---|---|---|
| **Access token** | 8 hours | Refreshed automatically before expiry |
| **Refresh token** | 30 days | Rotated on each refresh (old token invalidated) |

- Token refresh is **automatic and transparent** — no user action needed.
- If the refresh token expires or is revoked, the dashboard shows an
  "Authorization Expired" warning with a **Reconnect** button.
- Disconnecting the integration revokes the OAuth token at Zendesk.

---

## Webhook Setup (for ticket processing)

After connecting via OAuth, you still need to set up a Zendesk webhook to
receive new-ticket events:

1. Go to **Admin Center → Objects and rules → Webhooks** → Create webhook
2. Set the **Endpoint URL** to the webhook URL shown on the BitBot Pro
   Zendesk settings page
3. Set **Request method** to POST, **Request format** to JSON
4. Create a **Trigger** in Zendesk:
   - Condition: "Ticket is Created"
   - Action: "Notify active webhook" → select your webhook
   - JSON body: `{"ticket_id": "{{ticket.id}}", "event_id": "ticket:{{ticket.id}}:created"}`

---

## Security Notes

- The client secret is stored server-side only — never exposed to the browser.
- PKCE (S256) is used for all authorization requests.
- The `state` parameter is validated to prevent CSRF attacks.
- OAuth states are single-use and expire after 10 minutes.
- Tokens are never logged or included in error responses.
- Auto-Reply is **disabled by default** — public posting requires explicit opt-in.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "OAuth Not Configured" in UI | Env vars not set | Complete Step 3 |
| "Scope rejected" during auth | OAuth client scope mismatch | Ensure `tickets:read tickets:write users:read` are in the client's allowed scopes |
| "Authorization Expired" warning | Refresh token expired or revoked | Click Reconnect |
| 403 on ticket operations | User role insufficient | Re-auth with an Admin or Agent account |
| Callback URL mismatch error | URL doesn't match registration | Verify the redirect URL in Step 2 matches exactly |

---

## Blocked on Administrator Action

The following items **require Zendesk Admin Center access** and cannot be
completed by the BitBot Pro application itself:

1. **Creating the OAuth client** (Step 2) — requires Admin role
2. **Setting environment variables** (Step 3) — requires access to BitBot Pro's deployment configuration
3. **Creating the webhook + trigger** (Webhook Setup) — requires Admin role

Until Steps 2 and 3 are completed, the "Connect with Zendesk" button will
be disabled and the UI will show an "OAuth Not Configured" notice.

---

*Last updated: Feb 2026*
