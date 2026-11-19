/** C14: landing page after a Discord or Zendesk OAuth callback. The API
 * redirects here with only a status code and non-secret ids; the code, state
 * and tokens never reach the frontend. */
import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { oauthResult } from "../util";

const PROVIDERS = { discord: "Discord", zendesk: "Zendesk" };
const ID = /^[A-Za-z0-9-]{1,64}$/;

export function OAuthResultPage() {
  const { provider } = useParams();
  const [q] = useSearchParams();
  const status = q.get("status") || "";
  const name = PROVIDERS[provider];
  const r = oauthResult(status);
  const instanceId = ID.test(q.get("instance_id") || "") ? q.get("instance_id") : null;
  const integrationId = ID.test(q.get("integration_id") || "") ? q.get("integration_id") : null;
  const back = provider === "discord" && instanceId ? `/app/instances/${instanceId}`
    : provider === "zendesk" && integrationId ? `/app/integrations/${integrationId}` : "/app";
  const cls = r.tone === "ok" ? "border-emerald-800 bg-emerald-950/30" : r.tone === "warn" ? "border-amber-800 bg-amber-950/30" : "border-red-800 bg-red-950/40";
  return (
    <div className="app12 min-h-screen bg-[#030712] text-slate-100 flex items-center justify-center px-4">
      <main id="main" className={`w-full max-w-md rounded-lg border p-6 ${cls}`}>
        <p className="text-xs uppercase tracking-wide text-slate-400">{name || "Connection"}</p>
        <h1 className="text-xl font-semibold text-white mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>{name ? `${name}: ${r.title}` : r.title}</h1>
        <p role={r.tone === "error" ? "alert" : "status"} className="text-sm text-slate-200 mb-4">{name ? r.text : "Unknown connection provider."}</p>
        {provider === "discord" && status === "channel_selection_required" && instanceId ? (
          <Link className="text-cyan-300 hover:underline text-sm" to={`/app/instances/${instanceId}`}>Choose channels</Link>
        ) : (
          <Link className="text-cyan-300 hover:underline text-sm" to={back}>{status === "connected" ? "Continue" : "Back to BitBotPro"}</Link>
        )}
        <p className="text-xs text-slate-400 mt-4">A server administrator who used an invitation link can close this page.</p>
      </main>
    </div>
  );
}
