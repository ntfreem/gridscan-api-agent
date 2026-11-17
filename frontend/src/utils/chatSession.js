/**
 * Public chat session handling for the hardened backend (spec 008 Stage 4 / 9a).
 *
 * Backend contract:
 *  - The server issues every session: `session_id` ("web_" + 32 chars) and a
 *    `session_token` ("v1.<expiry>.<signature>") bound to that session AND bot.
 *  - /chat/send returns both; /chat/stream sends both in its first "session" event.
 *  - Continuing a conversation requires sending both back (JSON body fields).
 *    A session ID without a valid token silently starts a new session.
 *  - History: GET /chat/history/{session_id}?instance_id=<bot> with header
 *    X-Chat-Session-Token. Any failure is 404 (then start fresh).
 *  - A missing/unknown bot is 404; rate limit 429; daily bot ceiling 503;
 *    oversized message 413.
 *
 * Everything here is pure or takes its dependencies (storage, fetch) as
 * arguments, so it is unit-testable without rendering React.
 */
import { API_BASE } from "./apiBase";

export const SCOPE_WIDGET = "widget";
export const SCOPE_PAGE = "page";
export const MAX_MESSAGE_CHARS = 4000;

const SESSION_ID_RE = /^web_[A-Za-z0-9_-]{32}$/;
const SESSION_TOKEN_RE = /^v1\.\d{1,12}\.[A-Za-z0-9_-]{20,100}$/;
const BOT_ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/;

// Pre-hardening keys (stored a session ID without a token, or used "default").
const LEGACY_KEYS = {
  [SCOPE_WIDGET]: (bot) => [`widget_session_${bot}`, "widget_session_default"],
  [SCOPE_PAGE]: (bot) => [`bf_chat_${bot}`, "bf_chat_default"],
};

/** The bot ID from a URL parameter, or null. "default" is not a bot. */
export function normaliseBotId(raw) {
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id || id === "default" || !BOT_ID_RE.test(id)) return null;
  return id;
}

export function isValidSession(session) {
  return Boolean(
    session &&
      typeof session.sessionId === "string" &&
      typeof session.sessionToken === "string" &&
      SESSION_ID_RE.test(session.sessionId) &&
      SESSION_TOKEN_RE.test(session.sessionToken)
  );
}

export function storageKey(scope, botId) {
  return `bbp.chat.${scope}.v2.${botId}`;
}

// Storage can throw (private mode, sandboxed iframes, quota): never let it break chat.
function safeGet(storage, key) {
  try { return storage ? storage.getItem(key) : null; } catch { return null; }
}
function safeSet(storage, key, value) {
  try { if (storage) storage.setItem(key, value); return true; } catch { return false; }
}
function safeRemove(storage, key) {
  try { if (storage) storage.removeItem(key); } catch { /* ignore */ }
}

/** Remove pre-hardening entries (tokenless session IDs) for this bot. */
export function clearLegacySessions(storage, scope, botId) {
  const keys = LEGACY_KEYS[scope] ? LEGACY_KEYS[scope](botId) : [];
  keys.forEach((k) => safeRemove(storage, k));
}

/** The stored {sessionId, sessionToken} for this bot, or null (invalid entries are removed). */
export function loadSession(storage, scope, botId) {
  if (!botId) return null;
  const raw = safeGet(storage, storageKey(scope, botId));
  if (!raw) return null;
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }
  if (!isValidSession(parsed)) {
    safeRemove(storage, storageKey(scope, botId));
    return null;
  }
  return { sessionId: parsed.sessionId, sessionToken: parsed.sessionToken };
}

/** Persist the pair. Never stores a session ID without its matching token. */
export function saveSession(storage, scope, botId, sessionId, sessionToken) {
  const session = { sessionId, sessionToken };
  if (!botId || !isValidSession(session)) return false;
  return safeSet(storage, storageKey(scope, botId), JSON.stringify(session));
}

export function clearSession(storage, scope, botId) {
  if (botId) safeRemove(storage, storageKey(scope, botId));
}

/** Request body fields for /chat/send and /chat/stream (exact backend contract). */
export function chatRequestBody(message, botId, session) {
  const body = { message, instance_id: botId };
  if (isValidSession(session)) {
    body.session_id = session.sessionId;
    body.session_token = session.sessionToken;
  }
  return body;
}

/** Friendly UI text for an HTTP error status from the chat endpoints. */
export function friendlyChatError(status) {
  switch (status) {
    case 429:
      return "You're sending messages too quickly. Please wait a moment and try again.";
    case 503:
      return "This assistant is temporarily unavailable. Please try again later.";
    case 413:
      return `That message is too long. Please shorten it to ${MAX_MESSAGE_CHARS.toLocaleString("en-US")} characters or fewer.`;
    case 404:
      return "This chat is not available: the assistant could not be found.";
    case 400:
      return "Please enter a message.";
    default:
      return "Sorry, something went wrong. Please try again.";
  }
}

export const MISSING_BOT_MESSAGE =
  "This chat link is missing a valid assistant ID. Please use the link or embed code from your BitBotPro dashboard.";

/** Client-side pre-check mirroring the backend limits. Returns an error string or null. */
export function validateOutgoingMessage(text) {
  if (typeof text !== "string" || !text.trim()) return friendlyChatError(400);
  if (text.length > MAX_MESSAGE_CHARS) return friendlyChatError(413);
  return null;
}

/**
 * Fetch the history of a stored session.
 * Returns {status: "ok", messages} | {status: "not_found"} | {status: "error"}.
 */
export async function fetchHistory({ botId, session, fetchImpl, apiBase }) {
  if (!botId || !isValidSession(session)) return { status: "not_found" };
  const base = apiBase === undefined ? API_BASE : apiBase;
  const url = `${base}/chat/history/${encodeURIComponent(session.sessionId)}?instance_id=${encodeURIComponent(botId)}`;
  try {
    const resp = await (fetchImpl || fetch)(url, {
      method: "GET",
      headers: { "X-Chat-Session-Token": session.sessionToken },
      credentials: "omit",
    });
    if (resp.status === 404) return { status: "not_found" };
    if (!resp.ok) return { status: "error", httpStatus: resp.status };
    const data = await resp.json();
    return { status: "ok", messages: Array.isArray(data && data.messages) ? data.messages : [] };
  } catch {
    return { status: "error" };
  }
}

/**
 * Restore the stored session for a bot (used on mount, reload and bot switch).
 * - no stored session → {session: null, messages: []}
 * - history 404 → the stored session is cleared → {session: null, messages: []}
 * - transient error → keep the session, no messages
 */
export async function restoreSession({ storage, scope, botId, fetchImpl, apiBase }) {
  if (!botId) return { session: null, messages: [] };
  clearLegacySessions(storage, scope, botId);
  const session = loadSession(storage, scope, botId);
  if (!session) return { session: null, messages: [] };
  const result = await fetchHistory({ botId, session, fetchImpl, apiBase });
  if (result.status === "ok") return { session, messages: result.messages };
  if (result.status === "not_found") {
    clearSession(storage, scope, botId);
    return { session: null, messages: [] };
  }
  return { session, messages: [] };
}
