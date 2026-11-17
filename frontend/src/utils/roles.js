/**
 * Platform-role helpers for UI gating. The backend is authoritative: platform
 * Discord credentials and destructive operations are superadmin-only there
 * (spec 008, N8); the UI only hides controls a user cannot use.
 */
export function isSuperadmin(user) {
  return Boolean(user && (user.role === "superadmin" || user.platform_role === "superadmin"));
}
