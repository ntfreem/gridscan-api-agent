/**
 * API base URL resolution and a guard against relative "/api" calls
 * (frontend at https://bitbotpro.io, API at https://api.bitbotpro.io).
 */
import fs from "fs";
import path from "path";
import { resolveApiOrigin, apiUrl, API_BASE } from "../apiBase";

test("prefers REACT_APP_API_BASE_URL, falls back to REACT_APP_BACKEND_URL, then same origin", () => {
  expect(resolveApiOrigin({ REACT_APP_API_BASE_URL: "https://api.bitbotpro.io/" })).toBe("https://api.bitbotpro.io");
  expect(resolveApiOrigin({ REACT_APP_BACKEND_URL: "https://legacy.example.org" })).toBe("https://legacy.example.org");
  expect(resolveApiOrigin({ REACT_APP_API_BASE_URL: "https://api.bitbotpro.io", REACT_APP_BACKEND_URL: "https://old" }))
    .toBe("https://api.bitbotpro.io");
  expect(resolveApiOrigin({})).toBe("");
  expect(resolveApiOrigin(undefined)).toBe("");
});

test("apiUrl joins paths onto API_BASE", () => {
  expect(apiUrl("/chat/send")).toBe(`${API_BASE}/chat/send`);
  expect(apiUrl("chat/send")).toBe(`${API_BASE}/chat/send`);
});

// ── Source guards ────────────────────────────────────────────────────────────
const SRC = path.resolve(__dirname, "../..");

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" || e.name === "testing" ? [] : sourceFiles(p);
    return /\.(js|jsx)$/.test(e.name) ? [p] : [];
  });
}

test("no source file sends requests to a relative /api path", () => {
  const allowed = new Set(["setupProxy.js", "LandingPage.js", "apiBase.js"]); // dev proxy, marketing copy, the resolver
  const offenders = [];
  for (const file of sourceFiles(SRC)) {
    if (allowed.has(path.basename(file))) continue;
    const text = fs.readFileSync(file, "utf8");
    text.split("\n").forEach((line, i) => {
      const joinedToBase = /API_ORIGIN|API_BASE/.test(line) || /consumeSSE\("\/api\//.test(line); // path appended to the API origin
      if (/(["'`])\/api(\/|\1)/.test(line) && !joinedToBase) offenders.push(`${path.relative(SRC, file)}:${i + 1}`);
      if (/process\.env\.REACT_APP_BACKEND_URL/.test(line)) offenders.push(`${path.relative(SRC, file)}:${i + 1} (use apiBase)`);
      // The frontend origin never serves the API (bitbotpro.io vs api.bitbotpro.io).
      if (/(window\.location\.origin|\borigin)\s*\}\/api\//.test(line) || /window\.location\.origin\s*\+\s*["'`]\/api/.test(line)) {
        if (!/API_ORIGIN \|\| window\.location\.origin/.test(line)) offenders.push(`${path.relative(SRC, file)}:${i + 1} (frontend origin + /api)`);
      }
    });
  }
  expect(offenders).toEqual([]);
});

test("chat pages use the token-based session helpers and no 'default' bot fallback", () => {
  for (const name of ["pages/ChatWidget.js", "pages/ChatPage.js"]) {
    const text = fs.readFileSync(path.join(SRC, name), "utf8");
    expect(text).not.toMatch(/\|\| "default"/);
    expect(text).not.toMatch(/(widget_session_|bf_chat_)/);
    expect(text).toMatch(/saveSession\(/);
    expect(text).toMatch(/restoreSession\(/);
    expect(text).toMatch(/normaliseBotId\(/);
    expect(text).not.toMatch(/chat\/history/); // history only through chatSession.fetchHistory
  }
});
