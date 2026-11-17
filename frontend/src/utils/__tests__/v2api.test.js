/**
 * Spec 009 (R1.8): every org-scoped v2 call sends X-Org-ID equal to the org in
 * the URL. The API rejects a mismatched header, so pages that act on an org
 * other than the selected one (e.g. Team, Organisations) must still work.
 */
import fs from "fs";
import path from "path";

jest.mock("axios", () => {
  const ok = jest.fn(() => Promise.resolve({ data: {} }));
  return { get: ok, post: ok, put: ok, patch: ok, delete: ok, __calls: ok };
});

// eslint-disable-next-line import/first
import axios from "axios";
// eslint-disable-next-line import/first
import v2 from "../v2api";

beforeEach(() => {
  axios.__calls.mockClear();
  localStorage.clear();
  localStorage.setItem("bf_token", "test-token");
  localStorage.setItem("bf_org_id", "selected-org");
});

function lastCall() {
  const calls = axios.__calls.mock.calls;
  const args = calls[calls.length - 1];
  const config = args.find((a) => a && typeof a === "object" && a.headers);
  return { url: args[0], headers: config.headers };
}

test("org-scoped calls use the URL org for X-Org-ID, not the stored selection", () => {
  v2.listBots("other-org");
  expect(lastCall().url).toMatch(/\/v2\/orgs\/other-org\/bots$/);
  expect(lastCall().headers["X-Org-ID"]).toBe("other-org");

  v2.createBot("other-org", { name: "x" });
  expect(lastCall().headers["X-Org-ID"]).toBe("other-org");

  v2.updateOrg("other-org", { name: "x" });
  expect(lastCall().headers["X-Org-ID"]).toBe("other-org");

  v2.listSuggestions("other-org", "bot-1", { status: "pending" });
  expect(lastCall().headers["X-Org-ID"]).toBe("other-org");
});

test("non-org calls keep the stored selection and the bearer token", () => {
  v2.getMyWorkspaces();
  expect(lastCall().headers["X-Org-ID"]).toBe("selected-org");
  expect(lastCall().headers.Authorization).toBe("Bearer test-token");
});

test("source guard: every /v2/orgs/${orgId} call passes headers(orgId)", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "../v2api.js"), "utf8");
  const offenders = src
    .split("\n")
    .filter((l) => l.includes("/v2/orgs/${orgId}") && !l.includes("headers(orgId)"));
  expect(offenders).toEqual([]);
});
