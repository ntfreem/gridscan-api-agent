/**
 * Single source of the backend location (spec 008, R-N7.1).
 *
 * Production: the frontend is served from https://bitbotpro.io and the API from
 * https://api.bitbotpro.io, so relative "/api" requests would hit the frontend
 * host. Set REACT_APP_API_BASE_URL=https://api.bitbotpro.io at build time.
 *
 * Resolution order: REACT_APP_API_BASE_URL, then the legacy REACT_APP_BACKEND_URL,
 * then "" (same origin; local development through setupProxy.js).
 */
export function resolveApiOrigin(env) {
  const source = env || {};
  const raw = source.REACT_APP_API_BASE_URL || source.REACT_APP_BACKEND_URL || "";
  return String(raw).trim().replace(/\/+$/, "");
}

export const API_ORIGIN = resolveApiOrigin(process.env);
export const API_BASE = `${API_ORIGIN}/api`;

/** Absolute (or same-origin) URL for an API path such as "/chat/send". */
export function apiUrl(path) {
  const p = String(path || "");
  return `${API_BASE}${p.startsWith("/") ? p : `/${p}`}`;
}
