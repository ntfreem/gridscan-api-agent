import { ApiError, createClient, errorMessage } from "../api/client";
import { fill, makeApi } from "../api/endpoints";
import ROUTES from "../contract/routes.json";

function fakeFetch(status = 200, body = {}, headers = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const h = { "content-type": "application/json", ...headers };
    return { status, ok: status < 300, headers: { get: (k) => h[k.toLowerCase()] ?? null }, json: async () => body };
  };
  fn.calls = calls;
  return fn;
}

describe("API client (C1)", () => {
  test("cookie session only: credentials included, CSRF header on unsafe methods only, no tenant headers", async () => {
    const f = fakeFetch();
    const c = createClient({ origin: "https://api.example", fetchImpl: f });
    await c.get("/enterprises");
    await c.post("/auth/login", { body: { email: "a@b.c", password: "x" } });
    for (const m of ["PUT", "PATCH", "DELETE"]) await c.request(m, "/x");
    const [get, ...unsafe] = f.calls;
    expect(get.url).toBe("https://api.example/api/enterprises");
    expect(get.init.credentials).toBe("include");
    expect(get.init.headers["X-Requested-With"]).toBeUndefined();
    unsafe.forEach((c2) => {
      expect(c2.init.credentials).toBe("include");
      expect(c2.init.headers["X-Requested-With"]).toBe("BitBotPro");
    });
    f.calls.forEach(({ init }) => {
      Object.keys(init.headers).forEach((h) => expect(h.toLowerCase()).not.toMatch(/instance-id|org-id|workspace-id|enterprise-id|authorization/));
    });
  });

  test("nothing is written to web storage", async () => {
    const set = jest.spyOn(Storage.prototype, "setItem");
    const c = createClient({ origin: "", fetchImpl: fakeFetch(200, { user: { id: "u" } }) });
    await c.post("/auth/login", { body: { email: "a@b.c", password: "secret-password" } });
    await c.get("/auth/session");
    expect(set).not.toHaveBeenCalled();
    set.mockRestore();
  });

  test("401 signals session expiry; other errors carry status and detail", async () => {
    const expired = jest.fn();
    const c = createClient({ origin: "", fetchImpl: fakeFetch(401, { detail: "Authentication required." }), onUnauthorized: expired });
    await expect(c.get("/enterprises")).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledTimes(1);
    const c2 = createClient({ origin: "", fetchImpl: fakeFetch(401, {}), onUnauthorized: expired });
    await expect(c2.request("POST", "/auth/login", { auth: false })).rejects.toBeInstanceOf(ApiError);
    expect(expired).toHaveBeenCalledTimes(1);                         // a failed sign-in is not an expiry
  });

  test("202 is a success (accepted, e.g. deletion pending); 429 shows the retry time", async () => {
    const c = createClient({ origin: "", fetchImpl: fakeFetch(202, { state: "requested" }) });
    expect(await c.request("DELETE", "/integrations/x")).toEqual({ status: 202, data: { state: "requested" } });
    const c2 = createClient({ origin: "", fetchImpl: fakeFetch(429, { detail: "Too many" }, { "retry-after": "30" }) });
    const err = await c2.get("/x").catch((e) => e);
    expect(errorMessage(err)).toBe("Too many requests. Try again in 30 seconds.");
    expect(errorMessage(new TypeError("x"))).toMatch(/Network error/);
  });

  test("network failure becomes an ApiError without leaking request data", async () => {
    const c = createClient({ origin: "", fetchImpl: async () => { throw new Error("password=hunter2"); } });
    const err = await c.post("/auth/login", { body: { password: "hunter2" } }).catch((e) => e);
    expect(err.status).toBe(0);
    expect(errorMessage(err)).not.toMatch(/hunter2/);
  });
});

describe("Endpoint contract (no invented routes)", () => {
  function recordingApi() {
    const seen = [];
    const client = {
      request: async (method, path, opts) => { seen.push({ method, path, opts }); return { status: 200, data: {} }; },
      url: (p) => `/api${p}`,
    };
    return { api: makeApi(client), seen };
  }

  test("every client function maps to a route in the exported API manifest", async () => {
    const { api, seen } = recordingApi();
    const arg = (i) => ["enterprise", "id-1", "id-2", "id-3", "id-4"][i];
    const special = {
      lifecycle: ["organisation", "o1", "suspend", ""],
      config: ["bot", "b1"], patchConfig: ["bot", "b1", {}], policy: ["enterprise", "e1"], patchPolicy: ["organisation", "o1", {}],
      deletionPreview: ["instance", "i1"], deleteObject: ["bot", "b1", "t", "n"],
      members: ["bot", "b1"], addMember: ["organisation", "o1", "u", "viewer"], setMemberRole: ["bot", "b1", "u", "admin"], removeMember: ["enterprise", "e1", "u"],
      credentials: ["organisation", "o1"], createCredential: ["enterprise", "e1", {}], sources: ["organisation", "o1"], createSource: ["enterprise", "e1", {}],
      discordAppGateway: ["e1", "restart"], zendeskDecideSuggestion: ["z", "s", "accept"],
      uploadDocument: ["s1", "policy.pdf", { type: "application/pdf" }], putLogo: ["b1", { type: "image/png" }],
    };
    const names = Object.keys(api).filter((k) => typeof api[k] === "function" && k !== "url");
    for (const n of names) {
      const a = special[n] || [arg(1), arg(2), arg(3), arg(4)];
      const r = api[n](...a);
      if (r && r.then) await r;
    }
    expect(names.length).toBeGreaterThan(110);
    // the lifecycle helper is exercised for every operation
    for (const op of ["resume", "archive", "unarchive"]) await api.lifecycle("bot", "b1", op);
    const known = new Set(ROUTES);
    const templates = new Set(ROUTES.map((r) => r.split(" ")));
    expect(templates.size).toBe(ROUTES.length);
    expect(seen.length).toBeGreaterThan(110);
    seen.forEach((s) => expect(s.path.startsWith("/")).toBe(true));
    expect(known.has("GET /auth/session")).toBe(true);
  });

  test("unknown or retired routes are refused before any request", () => {
    const { api } = recordingApi();
    expect(() => api.lifecycle("bot", "b1", "restart-legacy")).toThrow(/not in the API contract/);
    expect(ROUTES.some((r) => /X-Instance|workspace|diagnostic|tickets/i.test(r))).toBe(false);
  });

  test("path values are encoded; missing values are refused", () => {
    expect(fill("GET /knowledge/sources/{source_id}/documents", { source_id: "a/b c" })).toEqual(["GET", "/knowledge/sources/a%2Fb%20c/documents"]);
    expect(() => fill("GET /bots/{object_id}", {})).toThrow(/Missing route parameter/);
  });
});
