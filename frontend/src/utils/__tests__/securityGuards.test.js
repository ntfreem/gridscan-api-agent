/**
 * Source-level regression guards for the Spec 012 frontend (Phase 6B).
 * Replaces the spec 008 Stage 9b guards, whose legacy pages were removed (spec §14).
 */
import fs from "fs";
import path from "path";

const SRC = path.resolve(__dirname, "../..");

function sourceFiles(dir = SRC) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["__tests__", "testing", "contract"].includes(entry.name)) continue;
      out.push(...sourceFiles(full));
    } else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\.js$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = sourceFiles();
const read = (f) => fs.readFileSync(f, "utf8");
const rel = (f) => path.relative(SRC, f);

test("the source tree was found", () => {
  expect(files.length).toBeGreaterThan(20);
});

test("no client-supplied tenant header is ever sent (spec §1.6)", () => {
  for (const f of files) {
    // a header name as a string literal (comments stating that none is sent are fine)
    expect([rel(f), /["'`]X-(Instance|Org|Workspace|Enterprise)-ID["'`]/i.test(read(f))]).toEqual([rel(f), false]);
  }
});

test("no session or token is kept in web storage", () => {
  for (const f of files) {
    if (rel(f).startsWith("components/ui/")) continue;            // shadcn primitives (sidebar state only)
    expect([rel(f), /(localStorage|sessionStorage)\.setItem\(/.test(read(f))]).toEqual([rel(f), false]);
  }
});

test("the removed legacy modules are not imported anywhere", () => {
  const removed = /from ["'](@\/|\.\.?\/)+(context\/AuthContext|utils\/api|utils\/v2api|utils\/chatSession|utils\/streamChat|components\/AdminLayout|pages\/(ChatWidget|ChatPage|Dashboard|Login|Register))["']/;
  for (const f of files) {
    expect([rel(f), removed.test(read(f))]).toEqual([rel(f), false]);
  }
});

test("no page enforces the old 6-character password rule", () => {
  for (const f of files) {
    expect([rel(f), /length < 6|at least 6 characters|Minimum 6 characters/i.test(read(f))]).toEqual([rel(f), false]);
  }
});

test("legacy paths only redirect; the React chat widget is retired (W2)", () => {
  const app = read(path.join(SRC, "App.js"));
  expect(app).toMatch(/path="\/admin\/\*" element={<Navigate to="\/app" replace \/>}/);
  expect(app).toMatch(/path="\/widget" element={<RetiredChatNotice \/>}/);
  expect(app).toMatch(/path="\/chat" element={<RetiredChatNotice \/>}/);
  expect(app).toMatch(/path="\/reset-password" element={<KeepHashRedirect to="\/app\/reset-password" \/>}/);
  expect(app).not.toMatch(/AuthProvider|AdminOnlyRoute|ProtectedRoute/);
});

test("public pages describe Spec 012, not the retired features", () => {
  for (const name of ["pages/Docs.js", "pages/LandingPage.js"]) {
    const text = read(path.join(SRC, name));
    expect([name, /workspace|Emergent Universal Key|bbk_|Developer Portal/i.test(text)]).toEqual([name, false]);
  }
});
