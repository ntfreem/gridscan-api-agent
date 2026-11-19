/**
 * Spec 012 API client (Phase 5).
 *
 * - Authority comes only from the httpOnly session cookie (`credentials: "include"`).
 *   No token, id or role is ever kept in localStorage/sessionStorage, and no
 *   tenant header (X-Instance-ID, X-Org-ID, …) is ever sent.
 * - Every unsafe request carries the CSRF header the API requires
 *   (`X-Requested-With: BitBotPro`).
 * - A 401 on an authenticated call means the session expired or was revoked:
 *   `onUnauthorized` lets the app return to the sign-in page.
 */
import { API_ORIGIN } from "@/utils/apiBase";

export const CSRF_HEADER = "X-Requested-With";
export const CSRF_VALUE = "BitBotPro";
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export class ApiError extends Error {
  constructor(status, detail, body, retryAfter) {
    super(typeof detail === "string" ? detail : `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.body = body;
    this.retryAfter = retryAfter;
  }
}

/** Human-readable message for any error (never echoes request data). */
export function errorMessage(err) {
  if (!err) return "";
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return `Too many requests. Try again${err.retryAfter ? ` in ${err.retryAfter} seconds` : " later"}.`;
    }
    if (typeof err.detail === "string" && err.detail) return err.detail;
    if (Array.isArray(err.detail)) return "Some fields are invalid.";
    if (err.status === 403) return "You do not have permission to do this.";
    if (err.status === 404) return "Not found.";
    if (err.status >= 500) return "The server could not complete the request.";
    return `Request failed (${err.status}).`;
  }
  if (err instanceof TypeError || !err.message) return "Network error. Check your connection and try again.";
  return err.message;                                   // client-side validation messages
}

export function createClient({ origin = API_ORIGIN, fetchImpl, onUnauthorized } = {}) {
  const doFetch = fetchImpl || ((...a) => window.fetch(...a));
  const base = `${origin}/api`;

  async function request(method, path, { body, raw, contentType, query, auth = true } = {}) {
    const m = method.toUpperCase();
    let url = `${base}${path}`;
    if (query) {
      const q = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
      });
      const s = q.toString();
      if (s) url += `?${s}`;
    }
    const headers = { Accept: "application/json" };
    if (UNSAFE.has(m)) headers[CSRF_HEADER] = CSRF_VALUE;
    let payload;
    if (raw !== undefined) {
      payload = raw;
      headers["Content-Type"] = contentType || "application/octet-stream";
    } else if (body !== undefined) {
      payload = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
    }
    let res;
    try {
      res = await doFetch(url, { method: m, headers, body: payload, credentials: "include", cache: "no-store" });
    } catch (e) {
      throw new ApiError(0, "Network error. Check your connection and try again.", null);
    }
    const type = (res.headers && res.headers.get && res.headers.get("content-type")) || "";
    let data = null;
    if (type.includes("application/json")) {
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }
    } else if (res.status !== 204) {
      data = await (res.blob ? res.blob() : res.text());
    }
    if (!res.ok && res.status !== 202) {
      if (res.status === 401 && auth && onUnauthorized) onUnauthorized();
      const retry = res.headers && res.headers.get ? res.headers.get("retry-after") : null;
      throw new ApiError(res.status, data && typeof data === "object" ? data.detail : null, data,
        retry ? Number(retry) : undefined);
    }
    return { status: res.status, data };
  }

  const json = (method) => async (path, opts) => (await request(method, path, opts)).data;
  return {
    request,
    get: json("GET"),
    post: json("POST"),
    put: json("PUT"),
    patch: json("PATCH"),
    del: json("DELETE"),
    url: (path) => `${base}${path}`,
  };
}
