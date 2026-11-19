import SAMPLES from "../contract/samples.json";
import { DELETION_STATES, OAUTH_RESULTS, deletionStateOf, oauthResult, sourceLabel, isOwnSource, displayValue, availabilityText } from "../util";
import { parseInput, normalise } from "../components/ConfigPanel";
import { parseScope } from "../components/Credentials";
import { uploadProblem } from "../components/Knowledge";
import { apiExample } from "../pages/Instance";

test("every OAuth callback status the API can return has a specific explanation (C14)", () => {
  SAMPLES._oauth_statuses.forEach((s) => expect(OAUTH_RESULTS[s]).toBeDefined());
  expect(oauthResult("connected").tone).toBe("ok");
  expect(oauthResult("<script>").title).toBe("Something went wrong");
});

describe("Zendesk deletion states (B4)", () => {
  test("API states map to requested / cleanup pending / cleanup failed / deleted", () => {
    expect(deletionStateOf({ deletion: null })).toBeNull();
    expect(deletionStateOf(null, { state: "requested" })).toBe("requested");
    expect(deletionStateOf(null, { state: "cleanup" })).toBe("cleanup_pending");
    expect(deletionStateOf(null, { state: "finalising" })).toBe("cleanup_pending");
    expect(deletionStateOf(null, { state: "cleanup_failed" })).toBe("cleanup_failed");
    expect(deletionStateOf(null, { state: "cleanup_uncertain" })).toBe("cleanup_failed");
    expect(deletionStateOf({ deletion: { state: "cleanup_pending" } })).toBe("cleanup_pending");
    expect(deletionStateOf({ deletion: { state: "requested" } }, { deleted: true })).toBe("deleted");
    Object.values(DELETION_STATES).forEach((s) => expect(s.text.length).toBeGreaterThan(20));
  });
  test("'deleted' is only claimed from an explicit deleted:true response", () => {
    expect(deletionStateOf(null, { deleted: false, state: "requested" })).toBe("requested");
    expect(deletionStateOf(null, {})).toBeNull();
  });
});

test("configuration origin labels follow the resolver's source kinds", () => {
  expect(sourceLabel({ kind: "default" })).toBe("Platform default");
  expect(sourceLabel({ kind: "platform" })).toBe("Platform policy");
  expect(sourceLabel({ kind: "override", level: "organisation", object_id: "o1" }, "b1", { o1: "Sales" })).toBe("Inherited from Organisation Sales");
  expect(sourceLabel({ kind: "override", level: "bot", object_id: "b1" }, "b1")).toBe("Set here");
  expect(isOwnSource({ kind: "override", object_id: "b1" }, "b1")).toBe(true);
  expect(isOwnSource({ kind: "override", object_id: "o1" }, "b1")).toBe(false);
});

test("config normalisation handles object and integration views", () => {
  const obj = normalise(SAMPLES.config_bot.body, SAMPLES._ids.bot);
  expect(obj.overridable["knowledge.mode"]).toBe(true);
  expect(obj.own("knowledge.mode")).toBe(false);
  const integ = normalise({ ...SAMPLES.integration_config.body, overrides: { "knowledge.mode": "strict_knowledge_only" } }, "z");
  expect(integ.own("knowledge.mode")).toBe(true);
  expect(integ.overridable["knowledge.mode"]).toBe(true);
});

test("input parsing", () => {
  expect(parseInput("number", "0.6")).toBe(0.6);
  expect(() => parseInput("number", "x")).toThrow();
  expect(parseInput("list", "a, b,,c")).toEqual(["a", "b", "c"]);
  expect(() => parseInput("json", "{")).toThrow();
  expect(parseScope("organisation:o1, bot:b2")).toEqual([{ level: "organisation", id: "o1" }, { level: "bot", id: "b2" }]);
  expect(() => parseScope("enterprise:e1")).toThrow();
  expect(parseScope("")).toEqual([]);
});

test("upload checks (C11): size, type; scanned PDFs explained in the UI", () => {
  expect(uploadProblem({ name: "a.pdf", size: 3 * 1024 * 1024 })).toMatch(/2 MB/);
  expect(uploadProblem({ name: "a.exe", size: 10 })).toMatch(/Supported/);
  expect(uploadProblem({ name: "Policy.PDF", size: 10 })).toBe("");
  expect(uploadProblem(null)).toMatch(/Choose/);
});

test("display helpers", () => {
  expect(displayValue(true)).toBe("On");
  expect(displayValue([])).toBe("None");
  expect(displayValue(null)).toBe("—");
  expect(availabilityText({ available: false, unavailable_reason: "enterprise suspended" })).toBe("Unavailable: enterprise suspended");
  expect(availabilityText({ available: true })).toBe("");
});

test("W12 public API example uses the instance's public endpoints only", () => {
  const ex = apiExample(SAMPLES.embed_snippet.body);
  expect(ex).toContain(`https://api.bitbotpro.io/api/public/instances/${SAMPLES.embed_snippet.body.public_id}/sessions`);
  expect(ex).toContain("/chat ");
  expect(ex).not.toMatch(/Authorization|X-Instance-ID|api_key/i);
});
