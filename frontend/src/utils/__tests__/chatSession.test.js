/**
 * Public chat session handling against the hardened backend (spec 008 Stage 4 / 9a).
 */
import {
  SCOPE_WIDGET, SCOPE_PAGE, normaliseBotId, isValidSession, storageKey, loadSession, saveSession,
  clearSession, clearLegacySessions, chatRequestBody, friendlyChatError, validateOutgoingMessage,
  fetchHistory, restoreSession, MAX_MESSAGE_CHARS,
} from "../chatSession";
import { memoryStorage, throwingStorage, SID, SID2, TOKEN, TOKEN2, jsonResponse } from "../testing/chatTestHelpers";

describe("bot IDs", () => {
  test("accepts real IDs and rejects missing/default/malformed ones", () => {
    expect(normaliseBotId("bot-a")).toBe("bot-a");
    expect(normaliseBotId("  2f4c9e1a-1111-4abc-9def-0123456789ab ")).toBe("2f4c9e1a-1111-4abc-9def-0123456789ab");
    [null, undefined, "", "   ", "default", "a/b", "x".repeat(129), "<script>", 42].forEach((v) =>
      expect(normaliseBotId(v)).toBeNull()
    );
  });
});

describe("session persistence", () => {
  test("stores the id and token together, scoped per bot and per surface", () => {
    const st = memoryStorage();
    expect(saveSession(st, SCOPE_WIDGET, "bot-a", SID, TOKEN)).toBe(true);
    expect(saveSession(st, SCOPE_WIDGET, "bot-b", SID2, TOKEN2)).toBe(true);
    expect(loadSession(st, SCOPE_WIDGET, "bot-a")).toEqual({ sessionId: SID, sessionToken: TOKEN });
    expect(loadSession(st, SCOPE_WIDGET, "bot-b")).toEqual({ sessionId: SID2, sessionToken: TOKEN2 });
    expect(loadSession(st, SCOPE_PAGE, "bot-a")).toBeNull();
    expect(st.keys()).toEqual([storageKey(SCOPE_WIDGET, "bot-a"), storageKey(SCOPE_WIDGET, "bot-b")]);
  });

  test("never stores a session id without its matching token", () => {
    const st = memoryStorage();
    [[SID, undefined], [SID, ""], [SID, null], [SID, "garbage"], ["not-a-web-id", TOKEN],
     ["discord_123456789012345678", TOKEN], [undefined, TOKEN]].forEach(([sid, tok]) =>
      expect(saveSession(st, SCOPE_PAGE, "bot-a", sid, tok)).toBe(false)
    );
    expect(saveSession(st, SCOPE_PAGE, null, SID, TOKEN)).toBe(false);
    expect(st.keys()).toEqual([]);
  });

  test("corrupt or tokenless stored entries are discarded", () => {
    const key = storageKey(SCOPE_PAGE, "bot-a");
    ["{not json", JSON.stringify({ sessionId: SID }), JSON.stringify({ sessionId: SID, sessionToken: "x" }), SID]
      .forEach((raw) => {
        const st = memoryStorage({ [key]: raw });
        expect(loadSession(st, SCOPE_PAGE, "bot-a")).toBeNull();
        expect(st.getItem(key)).toBeNull();
      });
  });

  test("legacy tokenless keys (incl. the old 'default' fallback) are removed", () => {
    const st = memoryStorage({ widget_session_botA: SID, widget_session_default: SID2, bf_chat_botA: SID, bf_chat_default: SID2 });
    clearLegacySessions(st, SCOPE_WIDGET, "botA");
    clearLegacySessions(st, SCOPE_PAGE, "botA");
    expect(st.keys()).toEqual([]);
  });

  test("clear removes only that bot", () => {
    const st = memoryStorage();
    saveSession(st, SCOPE_WIDGET, "bot-a", SID, TOKEN);
    saveSession(st, SCOPE_WIDGET, "bot-b", SID2, TOKEN2);
    clearSession(st, SCOPE_WIDGET, "bot-a");
    expect(loadSession(st, SCOPE_WIDGET, "bot-a")).toBeNull();
    expect(loadSession(st, SCOPE_WIDGET, "bot-b")).not.toBeNull();
  });

  test("blocked storage never throws", () => {
    const st = throwingStorage();
    expect(saveSession(st, SCOPE_WIDGET, "bot-a", SID, TOKEN)).toBe(false);
    expect(loadSession(st, SCOPE_WIDGET, "bot-a")).toBeNull();
    expect(() => clearSession(st, SCOPE_WIDGET, "bot-a")).not.toThrow();
    expect(() => clearLegacySessions(st, SCOPE_WIDGET, "bot-a")).not.toThrow();
  });
});

describe("request contract", () => {
  test("sends session_id and session_token only as a valid pair, plus instance_id", () => {
    expect(chatRequestBody("hi", "bot-a", null)).toEqual({ message: "hi", instance_id: "bot-a" });
    expect(chatRequestBody("hi", "bot-a", { sessionId: SID, sessionToken: TOKEN }))
      .toEqual({ message: "hi", instance_id: "bot-a", session_id: SID, session_token: TOKEN });
    expect(chatRequestBody("hi", "bot-a", { sessionId: SID })).toEqual({ message: "hi", instance_id: "bot-a" });
    expect(isValidSession({ sessionId: SID, sessionToken: TOKEN })).toBe(true);
  });

  test("client-side message validation mirrors the backend limits", () => {
    expect(validateOutgoingMessage("hello")).toBeNull();
    expect(validateOutgoingMessage("   ")).toBe(friendlyChatError(400));
    expect(validateOutgoingMessage("x".repeat(MAX_MESSAGE_CHARS))).toBeNull();
    expect(validateOutgoingMessage("x".repeat(MAX_MESSAGE_CHARS + 1))).toBe(friendlyChatError(413));
  });

  test("friendly error messages for backend statuses", () => {
    expect(friendlyChatError(429)).toMatch(/too quickly/);
    expect(friendlyChatError(503)).toMatch(/temporarily unavailable/);
    expect(friendlyChatError(413)).toMatch(/too long/);
    expect(friendlyChatError(404)).toMatch(/could not be found/);
    expect(friendlyChatError(500)).toMatch(/something went wrong/);
    [429, 503, 413, 404, 500].forEach((s) => expect(friendlyChatError(s)).not.toMatch(/\{|detail|Traceback/));
  });
});

describe("history authorization", () => {
  test("uses instance_id and the X-Chat-Session-Token header (never the URL)", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200, { session_id: SID, messages: [{ role: "user", content: "hi" }] }));
    const r = await fetchHistory({ botId: "bot a&b", session: { sessionId: SID, sessionToken: TOKEN }, fetchImpl, apiBase: "https://api.example.org/api" });
    expect(r).toEqual({ status: "ok", messages: [{ role: "user", content: "hi" }] });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://api.example.org/api/chat/history/${SID}?instance_id=bot%20a%26b`);
    expect(url).not.toContain(TOKEN);
    expect(init.headers).toEqual({ "X-Chat-Session-Token": TOKEN });
    expect(init.credentials).toBe("omit");
  });

  test("404 → not_found; other failures → error; no request without a valid session", async () => {
    const notFound = jest.fn().mockResolvedValue(jsonResponse(404, { detail: "Not found" }));
    expect(await fetchHistory({ botId: "b", session: { sessionId: SID, sessionToken: TOKEN }, fetchImpl: notFound, apiBase: "" }))
      .toEqual({ status: "not_found" });
    const boom = jest.fn().mockRejectedValue(new Error("offline"));
    expect((await fetchHistory({ botId: "b", session: { sessionId: SID, sessionToken: TOKEN }, fetchImpl: boom, apiBase: "" })).status)
      .toBe("error");
    const never = jest.fn();
    expect(await fetchHistory({ botId: "b", session: { sessionId: SID }, fetchImpl: never, apiBase: "" })).toEqual({ status: "not_found" });
    expect(never).not.toHaveBeenCalled();
  });

  test("restore: valid session → messages; 404 → stored session cleared; reload uses stored pair", async () => {
    const st = memoryStorage();
    saveSession(st, SCOPE_WIDGET, "bot-a", SID, TOKEN);
    const ok = jest.fn().mockResolvedValue(jsonResponse(200, { messages: [{ role: "assistant", content: "hello" }] }));
    const restored = await restoreSession({ storage: st, scope: SCOPE_WIDGET, botId: "bot-a", fetchImpl: ok, apiBase: "" });
    expect(restored).toEqual({ session: { sessionId: SID, sessionToken: TOKEN }, messages: [{ role: "assistant", content: "hello" }] });

    const gone = jest.fn().mockResolvedValue(jsonResponse(404, { detail: "Not found" }));
    const fresh = await restoreSession({ storage: st, scope: SCOPE_WIDGET, botId: "bot-a", fetchImpl: gone, apiBase: "" });
    expect(fresh).toEqual({ session: null, messages: [] });
    expect(loadSession(st, SCOPE_WIDGET, "bot-a")).toBeNull();
  });

  test("restore: transient error keeps the session; no bot → nothing", async () => {
    const st = memoryStorage();
    saveSession(st, SCOPE_PAGE, "bot-a", SID, TOKEN);
    const flaky = jest.fn().mockResolvedValue(jsonResponse(502, {}));
    const r = await restoreSession({ storage: st, scope: SCOPE_PAGE, botId: "bot-a", fetchImpl: flaky, apiBase: "" });
    expect(r.session).toEqual({ sessionId: SID, sessionToken: TOKEN });
    const none = jest.fn();
    expect(await restoreSession({ storage: st, scope: SCOPE_PAGE, botId: null, fetchImpl: none, apiBase: "" }))
      .toEqual({ session: null, messages: [] });
    expect(none).not.toHaveBeenCalled();
  });

  test("bot switching never reuses another bot's session", async () => {
    const st = memoryStorage();
    saveSession(st, SCOPE_PAGE, "bot-a", SID, TOKEN);
    const fetchImpl = jest.fn();
    const r = await restoreSession({ storage: st, scope: SCOPE_PAGE, botId: "bot-b", fetchImpl, apiBase: "" });
    expect(r).toEqual({ session: null, messages: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
