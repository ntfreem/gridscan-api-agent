/**
 * Source-level regression guards for spec 008 Stage 9b frontend requirements.
 */
import fs from "fs";
import path from "path";

const SRC = path.resolve(__dirname, "../..");
const read = (p) => fs.readFileSync(path.join(SRC, p), "utf8");

test("platform Discord app setup is superadmin-only (route + page)", () => {
  expect(read("App.js")).toMatch(/path="discord-app-setup" element={<AdminOnlyRoute><DiscordAppSetup \/><\/AdminOnlyRoute>}/);
  const page = read("pages/DiscordAppSetup.js");
  expect(page).toMatch(/if \(!isSuperadmin\(user\)\)/);
  const settings = read("pages/DiscordSettings.js");
  expect(settings).toMatch(/if \(!canEdit\) return null;/);
});

test("password change keeps the user signed in with the fresh token", () => {
  const profile = read("pages/Profile.js");
  expect(profile).toMatch(/if \(data\.token\) updateToken\(data\.token\)/);
  expect(read("context/AuthContext.js")).toMatch(/const updateToken = useCallback/);
});

test("no page still enforces the old 6-character rule", () => {
  for (const f of fs.readdirSync(path.join(SRC, "pages"))) {
    const text = read(`pages/${f}`);
    expect([f, /length < 6|at least 6 characters|Minimum 6 characters/i.test(text)]).toEqual([f, false]);
  }
});

test("every password-setting form uses the shared policy and requirements", () => {
  for (const f of ["Register.js", "ResetPassword.js", "ForgotPassword.js", "Profile.js", "InviteAccept.js", "Users.js"]) {
    const text = read(`pages/${f}`);
    expect([f, text.includes("userPasswordError("), text.includes("<PasswordRequirements")]).toEqual([f, true, true]);
  }
});

test("embed snippets load embed.js from the API origin and the widget from this site", () => {
  const embed = read("pages/EmbedCode.js");
  expect(embed).toMatch(/const scriptSrc = `\$\{API_BASE\}\/embed\.js`;/);
  expect(embed).toMatch(/const origin = window\.location\.origin;/);
  expect(embed).toMatch(/\$\{origin\}\/widget\?instance=/);
});

test("sidebar keys are displayed only via sidebarKeyView", () => {
  const z = read("pages/ZendeskSettings.js");
  expect(z.match(/sidebarKeyView\(/g)).toHaveLength(2);
  expect(z).not.toMatch(/setSidebarKey\((sk|res)\.data\.sidebar_api_key/);
});

test("widget only loads https stylesheets", () => {
  expect(read("pages/ChatWidget.js")).toMatch(/cfg\.custom_css_url\.startsWith\("https:\/\/"\)/);
});

test("registration page follows the backend registration mode and fails closed", () => {
  const reg = read("pages/Register.js");
  expect(reg).toMatch(/\/auth\/registration-mode/);
  expect(reg).toMatch(/\.catch\(\(\) => setMode\("invite_only"\)\)/);
  expect(reg).toMatch(/mode !== "open" \?/);
  expect(reg).not.toMatch(/Account created! Check your email/);
});
