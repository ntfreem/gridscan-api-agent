/**
 * Send a chat message via SSE streaming.
 * Returns an object with { abort } to cancel the stream.
 *
 * @param {Object} opts
 * @param {string} opts.message - User message text
 * @param {string|null} opts.sessionId - Existing session ID (or null for new)
 * @param {string|null} opts.instanceId - Bot instance ID
 * @param {string} opts.endpoint - API endpoint (default: /api/chat/stream)
 * @param {string|null} opts.apiKey - bbk_ API key for external API calls (optional)
 * @param {function} opts.onSession - Called with session_id when received
 * @param {function} opts.onToken - Called with each text chunk
 * @param {function} opts.onDone - Called with full_response when complete
 * @param {function} opts.onError - Called with error message string
 */
export function streamChat({ message, sessionId, instanceId, endpoint, apiKey, onSession, onToken, onDone, onError }) {
  const controller = new AbortController();
  const url = endpoint || "/api/chat/stream";

  const body = { message };
  if (sessionId) body.session_id = sessionId;
  if (instanceId) body.instance_id = instanceId;

  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  (async () => {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "Network error");
        onError?.(errText || `HTTP ${resp.status}`);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);
              if (currentEvent === "session") {
                onSession?.(data.session_id);
              } else if (currentEvent === "token") {
                onToken?.(data.token);
              } else if (currentEvent === "done") {
                onDone?.(data.full_response);
              } else if (currentEvent === "error") {
                onError?.(data.message || "Unknown error");
              }
            } catch {
              // Non-JSON data line, skip
            }
            currentEvent = "";
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        onError?.(err.message || "Connection failed");
      }
    }
  })();

  return { abort: () => controller.abort() };
}
