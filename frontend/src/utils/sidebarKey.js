/**
 * Zendesk sidebar key display (spec 008, R-P4.3). The backend stores only a hash:
 * the plaintext key is returned once, when it is created or regenerated, and
 * afterwards only a non-secret hint ("zsk_…abcd") with key_hidden=true.
 */
export function sidebarKeyView(data) {
  const d = data || {};
  if (d.key_hidden) return { revealed: null, hint: d.key_hint || null };
  const key = typeof d.sidebar_api_key === "string" ? d.sidebar_api_key : "";
  // Only a real key may be shown/copied (never a masked placeholder).
  if (/^zsk_[A-Za-z0-9_-]{20,}$/.test(key)) return { revealed: key, hint: d.key_hint || null };
  return { revealed: null, hint: d.key_hint || null };
}
