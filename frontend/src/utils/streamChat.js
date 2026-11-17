import { API_BASE } from "./apiBase";
import { chatRequestBody, friendlyChatError } from "./chatSession";

/**
 * Send a chat message via SSE streaming (POST /api/chat/stream).
 * Returns an object with { abort } to cancel the stream.
 *
 * Backend contract (spec 008 Stage 4): the session is continued only when BOTH
 * `session_id` and `session_token` are sent as JSON body fields; the first SSE
 * event ("session") carries the session_id and session_token to keep (a new
 * pair whenever the server started a new session).
 *
 * @param {Object} opts
 * @param {string} opts.message - User message text
 * @param {string} opts.instanceId - Bot ID (required by the backend)
 * @param {{sessionId: string, sessionToken: string}|null} opts.session - Stored session (or null)
 * @param {string} [opts.endpoint] - Override URL (default: `${API_BASE}/chat/stream`)
 * @param {function} opts.onSession - (sessionId, sessionToken) when the session event arrives
 * @param {function} opts.onToken - Each text chunk
 * @param {function} opts.onDone - Full response when complete
 * @param {function} opts.onError - (friendlyMessage, {status}) on failure
 * @param {function} [opts.fetchImpl] - Injectable fetch (tests)
 */
export function streamChat({ message, instanceId, session, endpoint, onSession, onToken, onDone, onError, fetchImpl }) {
  const controller = new AbortController();
  const url = endpoint || `${API_BASE}/chat/stream`;
  const body = chatRequestBody(message, instanceId, session);

  (async () => {
    try {
      const resp = await (fetchImpl || fetch)(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
        credentials: "omit",
      });

      if (!resp.ok) {
        onError?.(friendlyChatError(resp.status), { status: resp.status });
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";

      const handleLine = (line) => {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
          return;
        }
        if (!line.startsWith("data: ")) return;
        let data;
        try {
          data = JSON.parse(line.slice(6));
        } catch {
          currentEvent = "";
          return; // Non-JSON data line, skip
        }
        if (currentEvent === "session") {
          onSession?.(data.session_id, data.session_token);
        } else if (currentEvent === "token") {
          onToken?.(data.token);
        } else if (currentEvent === "done") {
          onDone?.(data.full_response);
        } else if (currentEvent === "error") {
          onError?.(data.message || friendlyChatError(500), { status: 200 });
        }
        currentEvent = "";
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // keep an incomplete line; currentEvent survives chunk boundaries
        lines.forEach(handleLine);
      }
      if (buffer) handleLine(buffer);
    } catch (err) {
      if (err && err.name !== "AbortError") {
        onError?.(friendlyChatError(0), { status: 0 });
      }
    }
  })();

  return { abort: () => controller.abort() };
}
