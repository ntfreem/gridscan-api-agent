/** Shared helpers for the chat tests (not a test file itself). */
export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    keys: () => Array.from(data.keys()),
    dump: () => Object.fromEntries(data),
  };
}

export function throwingStorage() {
  const boom = () => { throw new Error("SecurityError: storage blocked"); };
  return { getItem: boom, setItem: boom, removeItem: boom };
}

export const SID = "web_" + "A".repeat(32);
export const SID2 = "web_" + "B".repeat(32);
export const TOKEN = "v1.1893456000." + "s".repeat(43);
export const TOKEN2 = "v1.1893456000." + "t".repeat(43);

export function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}
