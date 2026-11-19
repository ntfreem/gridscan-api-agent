/**
 * Test harness: a mocked Spec 012 API.
 * - Routes are matched against the exported manifest (contract/routes.json);
 *   a request to a route that is not in the manifest fails the test.
 * - Default responses are the REAL responses exported from the API test
 *   World (contract/samples.json); tests override individual routes.
 * Every request is recorded (method, path, headers, credentials, body).
 */
import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ROUTES from "../contract/routes.json";
import SAMPLES from "../contract/samples.json";
import { createClient } from "../api/client";
import App12, { OAuthResultPage } from "../App12";

export { SAMPLES };
export const IDS = SAMPLES._ids;

// Path converters of the API (api/common.py): generic routes only match these collection names.
const CHOICES = {
  type_: ["enterprises", "organisations", "bots", "instances"],
  scope_type: ["enterprises", "organisations", "bots"],
  owner_type: ["enterprises", "organisations"],
  op: ["start", "stop", "restart"],
};
const esc = (t) => t.replace(/[.*+?^$()|[\]\\]/g, "\\$&");

const COMPILED = ROUTES.map((r) => {
  const [method, tpl] = r.split(" ");
  const names = [];
  const src = tpl.split(/(\{[a-z_]+\})/).map((part) => {
    const m = /^\{([a-z_]+)\}$/.exec(part);
    if (!m) return esc(part);
    names.push(m[1]);
    let choices = CHOICES[m[1]];
    if (m[1] === "type_" && /\/policy$/.test(tpl)) choices = ["enterprises", "organisations"];
    return choices ? `(${choices.join("|")})` : "([^/]+)";
  }).join("");
  return { key: r, method, re: new RegExp(`^${src}$`), names };
});

export function matchRoute(method, path) {
  // most specific first: fewer parameters wins (e.g. /enterprises/{id}/audit over /{type_}/{object_id}/config)
  const hits = COMPILED.filter((c) => c.method === method && c.re.test(path)).sort((a, b) => a.names.length - b.names.length);
  if (!hits.length) return null;
  const c = hits[0];
  const m = c.re.exec(path);
  return { key: c.key, params: Object.fromEntries(c.names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
}

const body = (name) => JSON.parse(JSON.stringify(SAMPLES[name].body));

/** Default handlers keyed by manifest route. */
export function defaultHandlers() {
  return {
    "GET /auth/session": () => ({ status: 200, body: body("session") }),
    "GET /enterprises": () => ({ status: 200, body: body("enterprises") }),
    "GET /enterprises/{enterprise_id}": () => ({ status: 200, body: body("enterprise") }),
    "GET /enterprises/{parent_id}/organisations": () => ({ status: 200, body: body("organisations") }),
    "GET /organisations/{object_id}": () => ({ status: 200, body: body("organisation") }),
    "GET /organisations/{parent_id}/bots": () => ({ status: 200, body: body("bots") }),
    "GET /bots/{object_id}": () => ({ status: 200, body: body("bot") }),
    "GET /bots/{bot_id}/instances": () => ({ status: 200, body: body("instances") }),
    "GET /bots/{bot_id}/integrations": () => ({ status: 200, body: body("integrations") }),
    "GET /instances/{instance_id}": ({ params }) => ({ status: 200, body: params.instance_id === IDS.instance_discord ? body("instance_discord")
      : params.instance_id === IDS.instance_telegram ? body("instance_telegram") : body("instance_web") }),
    "GET /{type_}/{object_id}/config": () => ({ status: 200, body: body("config_bot") }),
    "GET /{type_}/{object_id}/policy": () => ({ status: 200, body: body("policy_enterprise") }),
    "GET /{scope_type}/{scope_id}/members": () => ({ status: 200, body: body("members_enterprise") }),
    "GET /enterprises/{enterprise_id}/invitations": () => ({ status: 200, body: body("invitations") }),
    "GET /{owner_type}/{owner_id}/credentials": () => ({ status: 200, body: body("credentials_enterprise") }),
    "GET /{owner_type}/{owner_id}/knowledge/sources": () => ({ status: 200, body: body("knowledge_sources") }),
    "GET /knowledge/sources/{source_id}/documents": () => ({ status: 200, body: body("knowledge_documents") }),
    "GET /integrations/{integration_id}": () => ({ status: 200, body: body("integration") }),
    "GET /integrations/{integration_id}/config": () => ({ status: 200, body: body("integration_config") }),
    "GET /integrations/{integration_id}/zendesk/webhook": () => ({ status: 200, body: body("zendesk_webhook") }),
    "GET /integrations/{integration_id}/events": () => ({ status: 200, body: body("zendesk_events") }),
    "GET /integrations/{integration_id}/suggestions": () => ({ status: 200, body: body("zendesk_suggestions") }),
    "GET /integrations/{integration_id}/deliveries": () => ({ status: 200, body: body("zendesk_deliveries") }),
    "GET /instances/{instance_id}/channel/status": ({ params }) => ({ status: 200, body: params.instance_id === IDS.instance_discord ? body("discord_status") : body("telegram_status") }),
    "GET /enterprises/{enterprise_id}/discord": () => ({ status: 200, body: body("discord_enterprise") }),
    "GET /instances/{instance_id}/channel/discord/channels": () => ({ status: 200, body: body("discord_channels") }),
    "GET /instances/{instance_id}/channel/discord/share-links": () => ({ status: 200, body: body("discord_share_links") }),
    "GET /instances/{instance_id}/channel/discord/handoffs": () => ({ status: 200, body: body("discord_handoffs") }),
    "POST /instances/{instance_id}/channel/discord/install-url": () => ({ status: 200, body: body("discord_install_url") }),
    "POST /instances/{instance_id}/channel/discord/share-links": () => ({ status: 201, body: body("discord_share_create") }),
    "GET /instances/{instance_id}/embed-snippet": () => ({ status: 200, body: body("embed_snippet") }),
    "GET /instances/{instance_id}/conversations": () => ({ status: 200, body: body("conversations") }),
    "GET /instances/{instance_id}/deliveries": () => ({ status: 200, body: body("deliveries_tg") }),
    "GET /enterprises/{enterprise_id}/audit": () => ({ status: 200, body: body("audit_enterprise") }),
    "GET /platform/audit": () => ({ status: 200, body: body("platform_audit") }),
    "GET /platform/workers": () => ({ status: 200, body: body("platform_workers") }),
    "GET /platform/credentials": () => ({ status: 200, body: body("platform_credentials") }),
    "GET /platform/enterprises/{enterprise_id}/discord-application": () => ({ status: 200, body: body("discord_app_platform") }),
    "POST /{type_}/{object_id}/deletion-preview": () => ({ status: 200, body: body("deletion_preview") }),
    "POST /{type_}/{object_id}/delete": () => ({ status: 202, body: body("deletion_start") }),
    "GET /deletion-jobs/{job_id}": () => ({ status: 200, body: body("deletion_job") }),
    "POST /integrations/{integration_id}/sidebar-key": () => ({ status: 200, body: body("sidebar_key_create") }),
    "GET /{type_}/{object_id}/usage": () => ({ status: 200, body: body("usage_org") }),
    "GET /integrations/{integration_id}/usage": () => ({ status: 200, body: body("usage_integration") }),
    "GET /platform/users": () => ({ status: 200, body: body("platform_users") }),
    "GET /{scope_type}/{scope_id}/member-candidates": () => ({ status: 200, body: body("member_candidates") }),
  };
}

export class MockApi {
  constructor(overrides = {}) {
    this.handlers = { ...defaultHandlers(), ...overrides };
    this.requests = [];
    this.unknown = [];
    this.fetch = this.fetch.bind(this);
  }

  on(key, handler) {
    this.handlers[key] = typeof handler === "function" ? handler : () => handler;
    return this;
  }

  calls(key) {
    return this.requests.filter((r) => r.key === key);
  }

  async fetch(url, init = {}) {
    const u = new URL(url, "http://localhost");
    const path = u.pathname.replace(/^\/api/, "");
    const method = (init.method || "GET").toUpperCase();
    const m = matchRoute(method, path);
    let parsed = init.body;
    if (typeof parsed === "string") {
      try { parsed = JSON.parse(parsed); } catch (e) { /* raw */ }
    }
    const rec = { key: m && m.key, method, path, query: Object.fromEntries(u.searchParams), headers: init.headers || {},
      credentials: init.credentials, body: parsed, params: m && m.params };
    this.requests.push(rec);
    if (!m) {
      this.unknown.push(`${method} ${path}`);
      return response(404, { detail: "Not in the API contract" });
    }
    const h = this.handlers[m.key];
    if (!h) return response(404, { detail: `No mock for ${m.key}` });
    const out = await h(rec);
    return response(out.status ?? 200, out.body ?? null, out.headers);
  }
}

function response(status, data, headers = {}) {
  const h = { "content-type": "application/json", ...headers };
  return {
    status, ok: status >= 200 && status < 300,
    headers: { get: (k) => h[k.toLowerCase()] ?? null },
    json: async () => data, text: async () => JSON.stringify(data), blob: async () => data,
  };
}

export function renderApp(path, api = new MockApi()) {
  const client = createClient({ origin: "", fetchImpl: api.fetch, onUnauthorized: undefined });
  // SessionProvider wires onUnauthorized itself when no client is injected; tests that need
  // expiry handling use renderAppWithExpiry below.
  const utils = render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app/*" element={<App12 client={client} />} />
        <Route path="/oauth/:provider/result" element={<OAuthResultPage />} />
      </Routes>
    </MemoryRouter>,
  );
  return { ...utils, api };
}

export function renderAppWithExpiry(path, api = new MockApi()) {
  const prev = window.fetch;
  window.fetch = api.fetch;
  const utils = render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app/*" element={<App12 />} />
      </Routes>
    </MemoryRouter>,
  );
  return { ...utils, api, restore: () => { window.fetch = prev; } };
}

export function withPermissions(perms) {
  const cfg = body("config_bot");
  cfg.permissions = { ...Object.fromEntries(Object.keys(cfg.permissions).map((k) => [k, false])), read: true, ...perms };
  return () => ({ status: 200, body: cfg });
}

export const ALL_PERMISSIONS = Object.fromEntries(Object.keys(SAMPLES.config_bot.body.permissions).map((k) => [k, true]));
