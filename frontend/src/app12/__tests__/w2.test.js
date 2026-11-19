/** W2 (approved Phase 6A): the API-hosted widget is the only widget. The admin
 * app never embeds or links the legacy React ChatWidget/ChatPage, and uses
 * only the API-provided embed and preview URLs. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return e.name === "__tests__" || e.name === "contract" ? [] : files(p);
  return /\.jsx?$/.test(e.name) ? [p] : [];
});

test("the admin app has no second widget implementation and no frontend widget links", () => {
  for (const f of files(ROOT)) {
    const text = fs.readFileSync(f, "utf8");
    expect([f, /ChatWidget|ChatPage|pages\/Chat/.test(text)]).toEqual([f, false]);
    expect([f, /["'`]\/(widget|chat)(\?|["'`])/.test(text)]).toEqual([f, false]);
  }
});

test("embed and preview URLs come from the API responses", () => {
  const inst = fs.readFileSync(path.join(ROOT, "pages", "Instance.js"), "utf8");
  expect(inst).toMatch(/snip\.data\.script/);
  expect(inst).toMatch(/snip\.data\.widget_url/);
  expect(inst).toMatch(/r\.preview_url/);
});
