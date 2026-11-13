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

## Step 3 — Enter OAuth Credentials in BitBot Pro

1. Navigate to **Admin → Zendesk** in BitBot Pro.
2. You'll see the **Redirect URL** displayed at the top — copy it and paste it into
   your Zendesk OAuth client's **Redirect URLs** field (from Step 2).
3. Enter your **Client ID** (the Identifier from Step 2) and **Client Secret** (the
   secret you copied) into the form.
4. Click **Save Credentials**.

> **Note**: Credentials are stored securely in the database, not in environment
> variables. The Client Secret is never exposed in the UI after saving.

---

## Step 4 — Connect from the BitBot Pro Dashboard

1. After saving credentials, enter your Zendesk **subdomain** — just the name part
   (e.g. `midnight-gd`). If you paste a full URL like `https://midnight-gd.zendesk.com`,
   BitBot Pro will automatically extract the subdomain.
2. Click **"Connect with Zendesk"**.
3. You'll be redirected to Zendesk to authorize.
4. After approving, you'll return to BitBot Pro with the connection confirmed.

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
| "OAuth Not Configured" in UI | Credentials not entered | Complete Step 3 — enter Client ID and Secret in BitBot Pro |
| "Scope rejected" during auth | OAuth client scope mismatch | Ensure `tickets:read tickets:write users:read` are in the client's allowed scopes |
| "Authorization Expired" warning | Refresh token expired or revoked | Click Reconnect |
| "redirect_uri mismatch" error | Callback URL not registered | Copy the Redirect URL shown in BitBot Pro and add it to your Zendesk OAuth client's Redirect URLs (match exactly, including https) |
| 403 on ticket operations | User role insufficient | Re-auth with an Admin or Agent account |

---

## Blocked on Administrator Action

The following items **require Zendesk Admin Center access** and cannot be
completed by the BitBot Pro application itself:

1. **Creating the OAuth client** (Step 2) — requires Zendesk Admin role
2. **Adding the Redirect URL** to the OAuth client (Step 2/3) — the exact URL is shown inside BitBot Pro, but you must paste it into Zendesk
3. **Creating the webhook + trigger** (Webhook Setup) — requires Zendesk Admin role

Until Steps 2 and 3 are completed, the "Connect with Zendesk" button will
be disabled and the UI will show an "OAuth Setup Required" notice.

---

*Last updated: Feb 2026*
