/**
 * Streaming chat client against the hardened backend contract (spec 008 Stage 4 / 9a).
 */
import { TextEncoder, TextDecoder } from "util";
import { streamChat } from "../streamChat";
import { friendlyChatError } from "../chatSession";
import { API_BASE } from "../apiBase";
import { SID, TOKEN, SID2, TOKEN2 } from "../testing/chatTestHelpers";

global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

function sseResponse(chunks) {
  const enc = new TextEncoder();
  const queue = chunks.map((c) => enc.encode(c));
  return {
    ok: true,
    status: 200,
    body: { getReader: () => ({ read: async () => (queue.length ? { done: false, value: queue.shift() } : { done: true }) }) },
  };
}

function run(opts) {
  return new Promise((resolve) => {
    const events = { session: [], tokens: [], done: null, errors: [] };
    streamChat({
      message: "hello",
      instanceId: "bot-a",
      session: null,
      ...opts,
      onSession: (id, tok) => events.session.push([id, tok]),
      onToken: (t) => events.tokens.push(t),
      onDone: (full) => { events.done = full; resolve(events); },
      onError: (msg, info) => { events.errors.push([msg, info]); resolve(events); },
    });
  });
}

const SESSION_EVENT = (sid, tok) => `event: session\ndata: ${JSON.stringify({ session_id: sid, session_token: tok })}\n\n`;
const TOKEN_EVENT = (t) => `event: token\ndata: ${JSON.stringify({ token: t })}\n\n`;
const DONE_EVENT = (f) => `event: done\ndata: ${JSON.stringify({ full_response: f })}\n\n`;

test("posts to the configured API base with instance_id and no session for a new chat", async () => {
  const fetchImpl = jest.fn().mockResolvedValue(sseResponse([SESSION_EVENT(SID, TOKEN), DONE_EVENT("hi")]));
  await run({ fetchImpl });
  const [url, init] = fetchImpl.mock.calls[0];
  expect(url).toBe(`${API_BASE}/chat/stream`);
  expect(JSON.parse(init.body)).toEqual({ message: "hello", instance_id: "bot-a" });
  expect(init.headers).toEqual({ "Content-Type": "application/json" });
  expect(init.credentials).toBe("omit");
});

test("forwards session_id and session_token as JSON body fields on later messages", async () => {
  const fetchImpl = jest.fn().mockResolvedValue(sseResponse([SESSION_EVENT(SID, TOKEN), DONE_EVENT("ok")]));
  await run({ fetchImpl, session: { sessionId: SID, sessionToken: TOKEN } });
  expect(JSON.parse(fetchImpl.mock.calls[0][1].body))
    .toEqual({ message: "hello", instance_id: "bot-a", session_id: SID, session_token: TOKEN });
});

test("first event yields both the session id and token; tokens and done follow", async () => {
  const fetchImpl = jest.fn().mockResolvedValue(sseResponse([SESSION_EVENT(SID2, TOKEN2), TOKEN_EVENT("Hel"), TOKEN_EVENT("lo"), DONE_EVENT("Hello")]));
  const ev = await run({ fetchImpl, session: { sessionId: SID, sessionToken: TOKEN } });
  expect(ev.session).toEqual([[SID2, TOKEN2]]); // server started a new session → the new pair is reported
  expect(ev.tokens).toEqual(["Hel", "lo"]);
  expect(ev.done).toBe("Hello");
});

test("events split across network chunks are still parsed", async () => {
  const whole = SESSION_EVENT(SID, TOKEN) + TOKEN_EVENT("abc") + DONE_EVENT("abc");
  const chunks = [];
  for (let i = 0; i < whole.length; i += 7) chunks.push(whole.slice(i, i + 7));
  const ev = await run({ fetchImpl: jest.fn().mockResolvedValue(sseResponse(chunks)) });
  expect(ev.session).toEqual([[SID, TOKEN]]);
  expect(ev.tokens).toEqual(["abc"]);
  expect(ev.done).toBe("abc");
});

test.each([429, 503, 413, 404, 500])("HTTP %i becomes a friendly message with the status", async (status) => {
  const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status, text: async () => '{"detail":"internal"}' });
  const ev = await run({ fetchImpl });
  expect(ev.errors).toEqual([[friendlyChatError(status), { status }]]);
  expect(ev.session).toEqual([]);
});

test("network failure is reported without raw error details", async () => {
  const ev = await run({ fetchImpl: jest.fn().mockRejectedValue(new Error("ECONNREFUSED 10.0.0.1:8000")) });
  expect(ev.errors[0][0]).toBe(friendlyChatError(0));
  expect(ev.errors[0][0]).not.toMatch(/ECONNREFUSED|10\.0\.0\.1/);
});
