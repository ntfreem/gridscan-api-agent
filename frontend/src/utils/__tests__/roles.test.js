import { isSuperadmin } from "../roles";
import { sidebarKeyView } from "../sidebarKey";

test("superadmin detection", () => {
  expect(isSuperadmin({ role: "superadmin" })).toBe(true);
  expect(isSuperadmin({ role: "user", platform_role: "superadmin" })).toBe(true);
  [null, undefined, {}, { role: "user" }, { role: "admin" }, { role: "owner" }].forEach((u) => expect(isSuperadmin(u)).toBe(false));
});

describe("Zendesk sidebar key display", () => {
  const KEY = "zsk_" + "A".repeat(43);
  test("plaintext only right after creation/regeneration", () => {
    expect(sidebarKeyView({ sidebar_api_key: KEY, key_hidden: false, key_hint: "zsk_…AAAA" }))
      .toEqual({ revealed: KEY, hint: "zsk_…AAAA" });
  });
  test("existing keys are never shown or copyable (masked placeholder ignored)", () => {
    const masked = "zsk_…AAAA (hidden; regenerate to get a new key)";
    expect(sidebarKeyView({ sidebar_api_key: masked, key_hidden: true, key_hint: "zsk_…AAAA" }))
      .toEqual({ revealed: null, hint: "zsk_…AAAA" });
    expect(sidebarKeyView({ sidebar_api_key: masked })).toEqual({ revealed: null, hint: null });
    expect(sidebarKeyView(null)).toEqual({ revealed: null, hint: null });
  });
});
