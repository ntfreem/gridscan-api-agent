/**
 * Integration tests of the admin app against a mocked Spec 012 API (real
 * response shapes; only manifest routes are served).
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ALL_PERMISSIONS, IDS, MockApi, SAMPLES, renderApp, renderAppWithExpiry, withPermissions } from "../testing/harness";

const json = (o) => JSON.parse(JSON.stringify(o));
const noUnknownRoutes = (api) => expect(api.unknown).toEqual([]);

describe("C1 authentication", () => {
  test("signed-out users land on sign-in; sign-in uses the cookie session and CSRF header", async () => {
    const api = new MockApi();
    let signedIn = false;
    api.on("GET /auth/session", () => (signedIn ? { status: 200, body: SAMPLES.session.body } : { status: 401, body: { detail: "Authentication required." } }));
    api.on("POST /auth/login", () => { signedIn = true; return { status: 200, body: { user: SAMPLES.session.body.user } }; });
    renderApp("/app", api);
    await userEvent.type(await screen.findByLabelText("Email"), "owner@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "correct horse battery");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("link", { name: "Ent A" })).toBeInTheDocument();
    const [login] = api.calls("POST /auth/login");
    expect(login.headers["X-Requested-With"]).toBe("BitBotPro");
    expect(login.credentials).toBe("include");
    expect(window.localStorage.length + window.sessionStorage.length).toBe(0);
    noUnknownRoutes(api);
  });

  test("throttled sign-in shows the retry time", async () => {
    const api = new MockApi();
    api.on("GET /auth/session", { status: 401, body: {} });
    api.on("POST /auth/login", { status: 429, body: { detail: "Too many attempts." }, headers: { "retry-after": "120" } });
    renderApp("/app/login", api);
    await userEvent.type(await screen.findByLabelText("Email"), "a@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Too many requests. Try again in 120 seconds.")).toBeInTheDocument();
  });

  test("an expired session returns to sign-in with a notice", async () => {
    const api = new MockApi();
    let expired = false;
    api.on("GET /auth/session", () => (expired ? { status: 401, body: {} } : { status: 200, body: SAMPLES.session.body }));
    api.on("GET /enterprises", () => (expired ? { status: 401, body: { detail: "Authentication required." } } : { status: 200, body: SAMPLES.enterprises.body }));
    const r = renderAppWithExpiry("/app", api);
    expect(await screen.findByRole("link", { name: "Ent A" })).toBeInTheDocument();
    expired = true;
    await userEvent.click(screen.getByRole("link", { name: "Account" }));
    await userEvent.click(screen.getByRole("link", { name: "Enterprises" }));
    expect(await screen.findByText(/Your session has ended/)).toBeInTheDocument();
    r.restore();
  });

  test("reset password reads the token from the fragment and clears it", async () => {
    const api = new MockApi();
    api.on("GET /auth/session", { status: 401, body: {} });
    api.on("POST /auth/reset-password", { status: 200, body: { ok: true } });
    window.history.replaceState(null, "", "/app/reset-password#token=tok_abc123");
    renderApp("/app/reset-password", api);
    expect(window.location.hash).toBe("");
    await userEvent.type(await screen.findByLabelText("New password"), "a-long-new-password-1");
    await userEvent.type(screen.getByLabelText("Repeat new password"), "a-long-new-password-1");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    await screen.findByText(/Password changed/);
    expect(api.calls("POST /auth/reset-password")[0].body).toEqual({ token: "tok_abc123", new_password: "a-long-new-password-1" });
  });
});

describe("C2 navigation and breadcrumbs", () => {
  test("instance breadcrumbs come from server ancestry", async () => {
    const api = new MockApi();
    renderApp(`/app/instances/${IDS.instance_web}`, api);
    const nav = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(await within(nav).findByRole("link", { name: "Ent A" })).toHaveAttribute("href", `/app/enterprises/${IDS.enterprise}`);
    expect(within(nav).getByRole("link", { name: "Org A" })).toHaveAttribute("href", `/app/organisations/${IDS.organisation}`);
    expect(within(nav).getByRole("link", { name: "Bot A" })).toHaveAttribute("href", `/app/bots/${IDS.bot}`);
    expect(within(nav).getByText("Web A")).toHaveAttribute("aria-current", "page");
    noUnknownRoutes(api);
    api.requests.forEach((r) => Object.keys(r.headers).forEach((h) => expect(h).not.toMatch(/Instance-ID|Org-ID|Enterprise-ID/i)));
  });

  test("an ancestor the user cannot read is shown without a link", async () => {
    const api = new MockApi();
    api.on("GET /enterprises/{enterprise_id}", { status: 404, body: { detail: "Not found." } });
    api.on("GET /enterprises", { status: 200, body: { enterprises: [] } });
    renderApp(`/app/bots/${IDS.bot}`, api);
    const nav = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(await within(nav).findByText("enterprise (no access)")).toBeInTheDocument();
  });

  test("an Organisation-level member gets a limited Enterprise view listing only their Organisations", async () => {
    const api = new MockApi();
    api.on("GET /enterprises/{enterprise_id}", { status: 404, body: { detail: "Not found." } });
    renderApp(`/app/enterprises/${IDS.enterprise}`, api);
    expect(await screen.findByRole("heading", { name: "Ent A" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Org A" })).toHaveAttribute("href", `/app/organisations/${IDS.organisation}`);
    expect(screen.queryByRole("tab")).toBeNull();
  });
});

describe("C15 roles", () => {
  test("viewer: values visible, no edit, member, credential or lifecycle controls", async () => {
    const api = new MockApi();
    api.on("GET /{type_}/{object_id}/config", withPermissions({}));
    renderApp(`/app/organisations/${IDS.organisation}`, api);
    await screen.findByRole("heading", { name: "Org A" });
    expect(screen.queryByLabelText(/New bot name/)).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Defaults" }));
    expect(screen.queryByRole("button", { name: /^Override / })).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Members" }));
    await within(await screen.findByRole("table", { name: "Members" })).findByText("owner@example.test");
    expect(screen.queryByRole("button", { name: "Send invitation" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: /Role for/ })).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Credentials" }));
    await screen.findByText("Anthropic A");
    expect(screen.queryByRole("button", { name: "Save credential" })).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Lifecycle" }));
    expect(screen.queryByRole("button", { name: /Suspend|Archive|Delete permanently/ })).toBeNull();
  });

  test("admin: can create children and manage members", async () => {
    const api = new MockApi();
    api.on("GET /{type_}/{object_id}/config", withPermissions(ALL_PERMISSIONS));
    api.on("POST /organisations/{parent_id}/bots", { status: 201, body: SAMPLES.bot.body });
    renderApp(`/app/organisations/${IDS.organisation}`, api);
    await userEvent.type(await screen.findByLabelText("New bot name"), "Helpdesk");
    await userEvent.click(screen.getByRole("button", { name: "Create bot" }));
    await waitFor(() => expect(api.calls("POST /organisations/{parent_id}/bots")[0].body).toEqual({ name: "Helpdesk" }));
  });

  test("non-superadmins have no Platform navigation and are redirected away from it", async () => {
    const api = new MockApi();
    renderApp("/app/platform", api);
    expect(await screen.findByRole("heading", { name: "Enterprises" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Platform" })).toBeNull();
    expect(api.calls("GET /platform/credentials")).toHaveLength(0);
  });

  test("superadmin sees the Platform area and the Enterprise Discord application", async () => {
    const api = new MockApi();
    api.on("GET /auth/session", { status: 200, body: SAMPLES.session_root.body });
    renderApp(`/app/platform/enterprises/${IDS.enterprise}/discord`, api);
    expect(await screen.findByText("910000000000000001")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Platform" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Gateway & availability" }));
    await userEvent.click(screen.getByRole("button", { name: "Restart gateway" }));
    await waitFor(() => expect(api.calls("POST /platform/enterprises/{enterprise_id}/discord-application/gateway/{op}")[0].params.op).toBe("restart"));
    expect(document.body.textContent).not.toMatch(/sha256:[0-9a-f]{20,}/);       // fingerprints only, shortened by the API
  });
});

describe("C7 Discord instance (Organisation admin)", () => {
  const discordApi = () => {
    const api = new MockApi();
    api.on("GET /{type_}/{object_id}/config", withPermissions({ manage_channel: true, edit_config: true }));
    return api;
  };

  test("connect with the Enterprise application; no application controls are offered", async () => {
    const api = discordApi();
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    renderApp(`/app/instances/${IDS.instance_discord}`, api);
    await userEvent.click(await screen.findByRole("button", { name: "Reconnect / change server" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith(SAMPLES.discord_install_url.body.url, "_blank", "noopener,noreferrer"));
    const text = document.body.textContent;
    expect(text).not.toMatch(/bot token|client secret|Start gateway|Restart gateway|intents|avatar/i);
    expect(screen.queryByRole("link", { name: /Configure \(platform superadmin\)/ })).toBeNull();
    api.requests.forEach((r) => expect(r.path).not.toMatch(/^\/platform\//));
    open.mockRestore();
    noUnknownRoutes(api);
  });

  test("listen settings, channels, passive mode and DMs are saved through the instance route", async () => {
    const api = discordApi();
    api.on("PUT /instances/{instance_id}/channel/discord/settings", { status: 200, body: SAMPLES.instance_discord.body });
    renderApp(`/app/instances/${IDS.instance_discord}`, api);
    await userEvent.selectOptions(await screen.findByLabelText("Listen mode"), "specific_channels");
    await userEvent.click(await screen.findByLabelText("#help"));
    await userEvent.click(screen.getByLabelText("Passive mode"));
    await userEvent.click(screen.getByLabelText("Answer direct messages"));
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(api.calls("PUT /instances/{instance_id}/channel/discord/settings")).toHaveLength(1));
    const body = api.calls("PUT /instances/{instance_id}/channel/discord/settings")[0].body;
    expect(body).toMatchObject({ listen_mode: "specific_channels", channel_ids: ["222222222222222222"], passive_mode: true, dm_enabled: true });
  });

  test("share link for a server administrator; handoff pause", async () => {
    const api = discordApi();
    api.on("PUT /instances/{instance_id}/channel/discord/handoffs/{channel_id}", { status: 200, body: {} });
    renderApp(`/app/instances/${IDS.instance_discord}`, api);
    await userEvent.type(await screen.findByLabelText("Email it to (optional)"), "admin@server.example");
    await userEvent.click(screen.getByRole("button", { name: "Create invitation link" }));
    expect(await screen.findByText(SAMPLES.discord_share_create.body.url)).toBeInTheDocument();
    expect(api.calls("POST /instances/{instance_id}/channel/discord/share-links")[0].body).toEqual({ email: "admin@server.example" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Channel" }), "222222222222222221");
    await userEvent.click(screen.getByRole("button", { name: "Pause bot" }));
    await waitFor(() => expect(api.calls("PUT /instances/{instance_id}/channel/discord/handoffs/{channel_id}")[0].body).toEqual({ minutes: 30 }));
  });

  test("Enterprise application not configured", async () => {
    const api = discordApi();
    api.on("GET /enterprises/{enterprise_id}/discord", { status: 200, body: { configured: false, available: false } });
    renderApp(`/app/instances/${IDS.instance_discord}`, api);
    expect(await screen.findByText(/Enterprise Discord application is not configured yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add to Discord server|Reconnect/ })).toBeNull();
  });
});

describe("C8 Telegram and C9 Webchat", () => {
  test("Telegram connect, uncertain deliveries resolved with a note (never resent)", async () => {
    const api = new MockApi();
    api.on("GET /{type_}/{object_id}/config", withPermissions({ manage_channel: true }));
    api.on("GET /instances/{instance_id}/deliveries", { status: 200, body: { deliveries: [{ id: "d1", channel: "telegram", status: "uncertain", attempts: 1, parts: [{ index: 0, state: "uncertain" }], last_error: "timeout", created_at: "2026-11-18T10:00:00+00:00" }] } });
    api.on("POST /instances/{instance_id}/deliveries/{delivery_id}/resolve", { status: 200, body: {} });
    api.on("POST /instances/{instance_id}/channel/connect", { status: 200, body: {} });
    renderApp(`/app/instances/${IDS.instance_telegram}`, api);
    await userEvent.click(await screen.findByRole("button", { name: "Connect" }));
    await screen.findByText(/Webhook registered/);
    await userEvent.type(screen.getByLabelText("Review note"), "User confirmed receipt");
    await userEvent.click(screen.getByRole("button", { name: "Mark reviewed" }));
    await waitFor(() => expect(api.calls("POST /instances/{instance_id}/deliveries/{delivery_id}/resolve")[0].body).toEqual({ note: "User confirmed receipt" }));
    expect(screen.queryByRole("button", { name: /resend|retry/i })).toBeNull();
  });

  test("Webchat embed (API-hosted widget), origins and tone approval", async () => {
    const api = new MockApi();
    api.on("GET /{type_}/{object_id}/config", withPermissions({ manage_channel: true, edit_config: true }));
    api.on("GET /instances/{instance_id}/conversations", { status: 200, body: { conversations: [{ session_id: "sess_1234567890", messages: 2, updated_at: "2026-11-18T10:00:00+00:00" }] } });
    api.on("GET /instances/{instance_id}/conversations/{session_id}", { status: 200, body: { session_id: "sess_1234567890", messages: [
      { id: "m1", role: "user", text: "Refund window?" }, { id: "m2", role: "assistant", text: "14 days." }] } });
    api.on("POST /instances/{instance_id}/conversations/{session_id}/approve", { status: 200, body: { tone_examples: 1 } });
    api.on("PATCH /instances/{instance_id}", { status: 200, body: SAMPLES.instance_web.body });
    renderApp(`/app/instances/${IDS.instance_web}`, api);
    const code = await screen.findByLabelText("Paste this into your website");
    expect(code.value).toBe(SAMPLES.embed_snippet.body.script);
    expect(code.value).toMatch(/^<script src="https:\/\/api\.bitbotpro\.io\//);
    await userEvent.type(screen.getByLabelText("Allowed website origins"), "https://shop.example");
    await userEvent.click(screen.getByRole("button", { name: "Save origins" }));
    await waitFor(() => expect(api.calls("PATCH /instances/{instance_id}")[0].body).toEqual({ channel: { type: "webchat", allowed_origins: ["https://shop.example"] } }));
    await userEvent.click(screen.getByRole("button", { name: /sess_12345/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Approve tone" }));
    await waitFor(() => expect(api.calls("POST /instances/{instance_id}/conversations/{session_id}/approve")[0].body).toEqual({ message_id: "m2" }));
  });
});

describe("C10 Zendesk integration and B4 deletion states", () => {
  const zApi = (integration) => {
    const api = new MockApi();
    api.on("GET /{type_}/{object_id}/config", withPermissions({ manage_channel: true, edit_config: true }));
    if (integration) api.on("GET /integrations/{integration_id}", { status: 200, body: integration });
    return api;
  };

  test("deletion requested while a request is in flight: no completion claim, no re-enable controls", async () => {
    const api = zApi();
    let state = null;
    api.on("GET /integrations/{integration_id}", () => ({ status: 200, body: { ...json(SAMPLES.integration.body), deletion: state } }));
    api.on("DELETE /integrations/{integration_id}", () => { state = { state: "requested", attempts: 0, retryable: true }; return { status: 202, body: { state: "requested", deleted: false } }; });
    renderApp(`/app/integrations/${IDS.integration}`, api);
    await userEvent.click(await screen.findByRole("tab", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete integration…" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete integration" }));
    expect(await screen.findByText("Deletion requested")).toBeInTheDocument();
    expect(screen.queryByText("Deleted")).toBeNull();
    expect(screen.queryByRole("button", { name: /Enable integration|Connect with OAuth|Create webhook/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry deletion" })).toBeNull();
  });

  test("cleanup failed (502 with state) offers a retry; success shows deleted", async () => {
    const api = zApi();
    let calls = 0;
    api.on("GET /integrations/{integration_id}", () => ({ status: 200, body: { ...json(SAMPLES.integration.body), deletion: calls ? { state: "cleanup_failed", error: "forbidden", retryable: true } : null } }));
    api.on("DELETE /integrations/{integration_id}", () => { calls += 1; return calls === 1 ? { status: 502, body: { state: "cleanup_failed", error: "forbidden" } } : { status: 200, body: { deleted: true } }; });
    renderApp(`/app/integrations/${IDS.integration}`, api);
    await userEvent.click(await screen.findByRole("tab", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete integration…" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete integration" }));
    expect(await screen.findByText("Cleanup failed")).toBeInTheDocument();
    expect(screen.getByText("Cleanup failed").closest('[role="status"]')).toHaveTextContent("Last error: forbidden");
    await userEvent.click(screen.getByRole("button", { name: "Retry deletion" }));
    expect(await screen.findByRole("heading", { name: "Deleted" })).toBeInTheDocument();
    expect(screen.getByText(/integration and its Zendesk webhook have been removed/)).toBeInTheDocument();
    expect(api.calls("DELETE /integrations/{integration_id}")).toHaveLength(2);
  });

  test("cleanup pending is shown from the integration view on load", async () => {
    const api = zApi({ ...json(SAMPLES.integration.body), deletion: { state: "cleanup_pending", attempts: 1, retryable: true } });
    renderApp(`/app/integrations/${IDS.integration}`, api);
    expect(await screen.findByText("Cleanup pending")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Connection" })).toBeNull();
  });

  test("OAuth start, reply modes (no ticket creation), sidebar key shown once", async () => {
    const api = zApi();
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    api.on("POST /integrations/{integration_id}/zendesk/oauth/start", { status: 200, body: { url: "https://acme.zendesk.com/oauth/authorizations/new?x=1" } });
    api.on("PATCH /integrations/{integration_id}", { status: 200, body: SAMPLES.integration.body });
    renderApp(`/app/integrations/${IDS.integration}`, api);
    await userEvent.type(await screen.findByLabelText("Zendesk subdomain"), "acme");
    await userEvent.click(screen.getByRole("button", { name: "Connect with OAuth" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://acme.zendesk.com/oauth/authorizations/new?x=1", "_blank", "noopener,noreferrer"));
    await userEvent.click(screen.getByRole("tab", { name: "Replies" }));
    const modes = within(screen.getByLabelText("Reply mode")).getAllByRole("option").map((o) => o.value);
    expect(modes).toEqual(["agent_assist", "suggest_only", "auto_reply"]);
    expect(document.body.textContent).not.toMatch(/create ticket/i);
    await userEvent.click(screen.getByRole("tab", { name: "Sidebar" }));
    await userEvent.click(screen.getByRole("button", { name: "Create key" }));
    expect(await screen.findByTestId("one-time-secret")).toHaveTextContent(/^bbz_/);
    await userEvent.click(screen.getByRole("button", { name: "I have copied it" }));
    expect(screen.queryByTestId("one-time-secret")).toBeNull();
    open.mockRestore();
    noUnknownRoutes(api);
  });

  test("uncertain events are resolved as charge or waive with a note", async () => {
    const api = zApi();
    api.on("GET /integrations/{integration_id}/events", { status: 200, body: { events: [{ id: "ev1", ticket_id: 42, status: "uncertain", received_at: "2026-11-18T10:00:00+00:00" }] } });
    api.on("POST /integrations/{integration_id}/events/{event_id}/resolve", { status: 200, body: {} });
    renderApp(`/app/integrations/${IDS.integration}`, api);
    await userEvent.click(await screen.findByRole("tab", { name: "Events" }));
    await userEvent.type(await screen.findByLabelText("Note for ticket 42"), "Reply visible on ticket");
    await userEvent.click(screen.getByRole("button", { name: "Waive" }));
    await waitFor(() => expect(api.calls("POST /integrations/{integration_id}/events/{event_id}/resolve")[0].body).toEqual({ decision: "waive", note: "Reply visible on ticket" }));
  });
});

describe("C11 knowledge and C4 approval", () => {
  test("Enterprise approves a source through the allowed_sources policy; OCR limitation explained", async () => {
    const api = new MockApi();
    api.on("GET /{type_}/{object_id}/config", withPermissions({ edit_config: true, edit_policy: true }));
    api.on("PATCH /{type_}/{object_id}/policy", { status: 200, body: {} });
    renderApp(`/app/enterprises/${IDS.enterprise}`, api);
    await userEvent.click(await screen.findByRole("tab", { name: "Knowledge" }));
    expect(await screen.findByText("Not approved for use")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(api.calls("PATCH /{type_}/{object_id}/policy")[0].body).toEqual({ changes: { "knowledge.allowed_sources": [IDS.source] } }));
    await userEvent.click(screen.getByRole("button", { name: "Documents" }));
    expect(await screen.findByText(/need OCR, which is not supported/)).toBeInTheDocument();
  });

  test("oversized uploads are refused before sending", async () => {
    const api = new MockApi();
    api.on("GET /{type_}/{object_id}/config", withPermissions({ edit_config: true }));
    renderApp(`/app/organisations/${IDS.organisation}`, api);
    await userEvent.click(await screen.findByRole("tab", { name: "Knowledge" }));
    await userEvent.click(await screen.findByRole("button", { name: "Documents" }));
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.pdf", { type: "application/pdf" });
    await userEvent.upload(await screen.findByLabelText(/Upload a document/), big);
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(await screen.findByText("Files are limited to 2 MB.")).toBeInTheDocument();
    expect(api.calls("PUT /knowledge/sources/{source_id}/documents/{name}")).toHaveLength(0);
  });
});

describe("C14 OAuth result pages", () => {
  test.each([
    ["discord", "connected", "Discord: Connected"],
    ["discord", "not_server_manager", "Discord: Permission denied"],
    ["zendesk", "invalid_state", "Zendesk: Link expired"],
    ["zendesk", "account_mismatch", "Zendesk: Different account"],
  ])("%s %s", async (provider, status, title) => {
    renderApp(`/oauth/${provider}/result?status=${status}&instance_id=${IDS.instance_discord}&integration_id=${IDS.integration}`);
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
  });

  test("channel selection links back to the instance; unsafe ids are ignored", async () => {
    renderApp(`/oauth/discord/result?status=channel_selection_required&instance_id=${IDS.instance_discord}`);
    expect(await screen.findByRole("link", { name: "Choose channels" })).toHaveAttribute("href", `/app/instances/${IDS.instance_discord}`);
  });

  test("unknown provider or status never renders untrusted text", async () => {
    renderApp("/oauth/evil/result?status=%3Cimg%20src%3Dx%3E&instance_id=..%2F..%2Fx");
    expect(await screen.findByText("Unknown connection provider.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to BitBotPro" })).toHaveAttribute("href", "/app");
    expect(document.body.innerHTML).not.toMatch(/<img/);
  });
});

describe("C16 accessibility basics", () => {
  test("every form control on the main pages has an accessible name; tabs support arrow keys", async () => {
    const api = new MockApi();
    api.on("GET /{type_}/{object_id}/config", withPermissions(ALL_PERMISSIONS));
    renderApp(`/app/bots/${IDS.bot}`, api);
    await screen.findByRole("heading", { name: "Bot A" });
    const tabs = screen.getAllByRole("tab");
    for (const t of tabs) {
      await userEvent.click(t);
      await waitFor(() => expect(screen.queryByText("Loading…")).toBeNull());
      screen.queryAllByRole("textbox").concat(screen.queryAllByRole("combobox"), screen.queryAllByRole("checkbox"), screen.queryAllByRole("spinbutton"))
        .forEach((el) => expect(el).toHaveAccessibleName());
      screen.queryAllByRole("button").forEach((el) => expect(el).toHaveAccessibleName());
    }
    tabs[0].focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getAllByRole("tab")[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Skip to content")).toHaveAttribute("href", "#main");
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });
});
