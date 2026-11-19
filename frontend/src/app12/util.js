/** Pure helpers for the Spec 012 admin app (tested in __tests__/util.test.js). */
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "./api/client";

export const LEVEL_LABEL = { enterprise: "Enterprise", organisation: "Organisation", bot: "Bot", bot_instance: "Instance",
  instance: "Instance", integration: "Integration", platform: "Platform", default: "Default" };
export const TYPE_TO_LEVEL = { enterprises: "enterprise", organisations: "organisation", bots: "bot", instances: "instance" };

/** Load data with loading/error state; `reload()` refetches. */
export function useLoad(fn, deps) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps);
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await load();
      if (alive.current) setState({ loading: false, error: null, data });
      return data;
    } catch (e) {
      if (alive.current) setState({ loading: false, error: e, data: null });
      return null;
    }
  }, [load]);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload, setData: (data) => setState((s) => ({ ...s, data })) };
}

/** Run an action, keeping busy/error/success state for the UI. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const run = useCallback(async (fn, success) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const out = await fn();
      if (success) setNotice(typeof success === "function" ? success(out) : success);
      return out;
    } catch (e) {
      setError(errorMessage(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, notice, run, setError, setNotice };
}

/** "Inherited from Organisation ‹name›" style origin label for a config source. */
export function sourceLabel(source, targetId, names = {}) {
  if (!source) return "Platform default";
  const { kind, level, object_id: id } = source;
  if (kind === "default") return "Platform default";
  if (kind === "platform") return "Platform policy";
  if (kind === "policy") return "Forced by policy";
  if (kind === "blocked") return "Blocked by policy";
  if (kind === "override" && id && id === targetId) return "Set here";
  const lvl = LEVEL_LABEL[level] || level || "parent";
  const name = id && names[id] ? ` ${names[id]}` : "";
  return `Inherited from ${lvl}${name}`;
}

export function isOwnSource(source, targetId) {
  return Boolean(source && source.kind === "override" && source.object_id === targetId);
}

export function lifecycleState(node) {
  return (node && node.lifecycle && node.lifecycle.state) || "active";
}

/** Why an object is not available, in words. */
export function availabilityText(node) {
  if (!node || node.available !== false) return "";
  const r = node.unavailable_reason || "";
  return r ? `Unavailable: ${r}` : "Unavailable because this object or one of its parents is not active.";
}

/** Zendesk deletion states as the UI must show them (B4). */
export const DELETION_STATES = {
  requested: { label: "Deletion requested", tone: "warn",
    text: "Deletion has been requested. A Zendesk request that had already started is finishing; nothing new will be sent." },
  cleanup_pending: { label: "Cleanup pending", tone: "warn",
    text: "BitBotPro is removing the Zendesk webhook and credentials. This can take a few minutes." },
  cleanup_failed: { label: "Cleanup failed", tone: "error",
    text: "Removing the Zendesk webhook failed. Retry the deletion; the integration stays disabled until cleanup succeeds." },
  deleted: { label: "Deleted", tone: "ok", text: "The integration and its Zendesk webhook have been removed." },
};

export function deletionStateOf(integration, deleteResponse) {
  if (deleteResponse && deleteResponse.deleted === true) return "deleted";
  const s = (deleteResponse && deleteResponse.state) || (integration && integration.deletion && integration.deletion.state);
  if (!s) return null;
  if (s === "cleanup" || s === "finalising") return "cleanup_pending";
  if (s === "cleanup_uncertain") return "cleanup_failed";
  return DELETION_STATES[s] ? s : "cleanup_pending";
}

/** OAuth callback statuses (C14) → title, text, tone. */
export const OAUTH_RESULTS = {
  connected: ["Connected", "The connection is complete.", "ok"],
  channel_selection_required: ["Choose channels", "This Discord server is shared. Choose the channels this instance should use (within 30 minutes).", "warn"],
  invalid_state: ["Link expired", "This link is invalid or has expired. Start the connection again from BitBotPro.", "error"],
  cancelled: ["Cancelled", "The authorisation was cancelled. Nothing was changed.", "warn"],
  invalid_request: ["Incomplete response", "The provider did not return the expected information. Start again.", "error"],
  oauth_failed: ["Authorisation failed", "The provider refused the authorisation. Start again.", "error"],
  not_authorised: ["Permission denied", "You are no longer allowed to connect this object.", "error"],
  not_server_manager: ["Permission denied", "You need the Manage Server permission on that Discord server.", "error"],
  wrong_server: ["Wrong server", "This invitation is for a different Discord server.", "error"],
  account_mismatch: ["Different account", "The Zendesk account does not match the one this integration uses.", "error"],
  bot_not_present: ["Bot not added", "The Discord bot was not added to the server. Start again and keep the bot permission selected.", "error"],
  application_changed: ["Application changed", "The Enterprise Discord application changed during the installation. Start again.", "error"],
  client_changed: ["Configuration changed", "The platform Zendesk client changed during the connection. Start again.", "error"],
  changed: ["Changed meanwhile", "The integration changed while you were connecting. Start again.", "error"],
  integration_deleting: ["Integration is being deleted", "This integration is being deleted and cannot be connected.", "error"],
  not_connectable: ["Not connectable", "This instance cannot be connected right now (it may be suspended or archived).", "error"],
  share_link_used: ["Link already used", "This invitation link has already been used.", "error"],
  share_link_inactive: ["Link no longer valid", "This invitation link was revoked or has expired.", "error"],
};

export function oauthResult(status) {
  const [title, text, tone] = OAUTH_RESULTS[status] || ["Something went wrong", "The connection could not be completed. Start again.", "error"];
  return { title, text, tone };
}

export const ROLES = ["owner", "admin", "editor", "viewer"];
export const PROVIDERS = [
  ["anthropic", "Anthropic API key"], ["openai", "OpenAI API key"], ["telegram_bot", "Telegram bot token"],
  ["zendesk_api_token", "Zendesk API token"],
];

export function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
}

export function displayValue(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "On" : "Off";
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") : "None";
  if (typeof v === "object") return Object.keys(v).length ? JSON.stringify(v) : "—";
  return String(v);
}
