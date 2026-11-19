/**
 * Zendesk Bot Integration page (C10). Zendesk is a Bot Integration, never a
 * Bot Instance. BitBotPro never creates Zendesk tickets.
 *
 * Deletion (B4): the page shows requested / cleanup pending / cleanup failed /
 * deleted exactly as the API reports them. While a deletion is pending every
 * control that could re-enable or reconnect the integration is hidden (the API
 * refuses them too).
 */
import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ConfigPanel from "../components/ConfigPanel";
import { Breadcrumbs, PageTitle, Tabs } from "../components/Shell";
import { ConfirmButton, DataTable, ErrorBox, KeyValues, Loading, Notice, OneTimeSecret, Section, SelectField, StateBadge, TextField } from "../components/common";
import { useApi } from "../session";
import UsagePanel from "../components/Usage";
import { errorMessage } from "../api/client";
import { DELETION_STATES, deletionStateOf, fmtDate, useAction, useLoad } from "../util";

const REPLY_MODES = [["agent_assist", "Agent assist (private internal note)"], ["suggest_only", "Suggest only (nothing posted)"],
  ["auto_reply", "Automatic public reply"]];

export function DeletionBanner({ state, error }) {
  if (!state) return null;
  const s = DELETION_STATES[state];
  return (
    <div role="status" aria-live="polite" className={`rounded border p-3 mb-4 ${s.tone === "error" ? "border-red-800 bg-red-950/40" : s.tone === "ok" ? "border-emerald-800 bg-emerald-950/30" : "border-amber-800 bg-amber-950/30"}`}>
      <p className="font-semibold text-sm">{s.label}</p>
      <p className="text-sm text-slate-200">{s.text}</p>
      {error ? <p className="text-xs text-slate-400 mt-1">Last error: {error}</p> : null}
    </div>
  );
}

function Connection({ api, z, can, reload }) {
  const { busy, error, notice, run } = useAction();
  const [sub, setSub] = useState((z.connection && z.connection.subdomain) || "");
  const [cred, setCred] = useState("");
  return (
    <Section title="Connect Zendesk" description="Connect with OAuth (recommended) or with an API-token credential stored on the Organisation.">
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      <KeyValues rows={[
        ["Connection", <StateBadge key="c" state={(z.connection && z.connection.status) || "not_connected"} />],
        ["Subdomain", (z.connection && z.connection.subdomain) || "—"],
        ["Credential", z.credential_id || "—"],
        ["Checked", fmtDate(z.connection && z.connection.checked_at)],
      ]} />
      {can ? (
        <>
          <form className="flex flex-wrap gap-2 items-end mt-3" onSubmit={(e) => { e.preventDefault(); run(async () => {
            const r = await api.zendeskOAuthStart(z.id, sub);
            window.open(r.url, "_blank", "noopener,noreferrer");
          }, "Zendesk opened in a new tab. Approve access; you will return to BitBotPro."); }}>
            <TextField label="Zendesk subdomain" value={sub} onChange={setSub} required hint="For acme.zendesk.com enter acme." />
            <Button size="sm" type="submit" disabled={busy || !sub}>Connect with OAuth</Button>
          </form>
          <form className="flex flex-wrap gap-2 items-end mt-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.patchIntegration(z.id, { credential_id: cred.trim() }); await reload(); }, "Credential selected."); }}>
            <TextField label="Or use an API-token credential id" value={cred} onChange={setCred} />
            <Button size="sm" variant="outline" type="submit" disabled={busy || !cred.trim()}>Use credential</Button>
          </form>
          <div className="flex flex-wrap gap-2 mt-2">
            <Button size="sm" variant="outline" type="button" disabled={busy || !z.credential_id}
              onClick={() => run(() => api.integrationTest(z.id), (r) => `Zendesk responded (role: ${r.zendesk_role || "unknown"}).`)}>Test connection</Button>
            {z.credential_id ? <ConfirmButton confirmLabel="Remove credential" onConfirm={() => run(async () => { await api.patchIntegration(z.id, { clear_credential: true }); await reload(); }, "Credential removed.")}>Remove credential</ConfirmButton> : null}
          </div>
        </>
      ) : null}
    </Section>
  );
}

function Settings({ api, z, can, reload }) {
  const st = z.settings || {};
  const [mode, setMode] = useState(st.reply_mode || "agent_assist");
  const [groups, setGroups] = useState((st.ticket_groups || []).join(", "));
  const [tags, setTags] = useState((st.ticket_tags || []).join(", "));
  const { busy, error, notice, run } = useAction();
  const split = (v) => v.split(",").map((x) => x.trim()).filter(Boolean);
  return (
    <Section title="Replies and routing" description="Without filters every ticket is handled; with filters, tickets that match none are ignored.">
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      <form className="max-w-md" onSubmit={(e) => { e.preventDefault(); run(async () => {
        await api.patchIntegration(z.id, { settings: { reply_mode: mode, ticket_groups: split(groups), ticket_tags: split(tags) } }); await reload(); }, "Saved."); }}>
        <SelectField label="Reply mode" value={mode} onChange={setMode} options={REPLY_MODES} disabled={!can} />
        <TextField label="Ticket groups (ids)" value={groups} onChange={setGroups} disabled={!can} />
        <TextField label="Ticket tags" value={tags} onChange={setTags} disabled={!can} />
        {can ? <Button size="sm" type="submit" disabled={busy}>Save</Button> : null}
      </form>
      {can ? (
        <div className="mt-3">
          {z.status === "enabled"
            ? <ConfirmButton confirmLabel="Disable" onConfirm={() => run(async () => { await api.patchIntegration(z.id, { status: "disabled" }); await reload(); }, "Disabled.")}>Disable integration</ConfirmButton>
            : <Button size="sm" type="button" onClick={() => run(async () => { await api.patchIntegration(z.id, { status: "enabled" }); await reload(); }, "Enabled.")}>Enable integration</Button>}
        </div>
      ) : null}
    </Section>
  );
}

function Webhook({ api, z, can, reload }) {
  const hook = useLoad(() => (can ? api.zendeskWebhook(z.id) : Promise.resolve(null)), [api, z.id, can]);
  const [secret, setSecret] = useState("");
  const [owner, setOwner] = useState("");
  const { busy, error, notice, run } = useAction();
  const h = hook.data || {};
  return (
    <Section title="Webhook" description="Zendesk sends ticket events here. Signatures are mandatory.">
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      {hook.loading ? <Loading /> : <ErrorBox error={hook.error} />}
      <KeyValues rows={[
        ["Signing secret", z.webhook && z.webhook.signing_secret_configured ? "Configured" : "Missing"],
        ["Provisioned in Zendesk", z.webhook && z.webhook.provisioned ? `Yes (${h.provisioned_webhook_id || ""})` : "No"],
        ["Rotated", fmtDate(z.webhook && z.webhook.rotated_at)],
      ]} />
      {can && h.url ? (
        <>
          <label htmlFor="hook-url" className="text-sm text-slate-300 block mt-3">Webhook URL (keep private)</label>
          <input id="hook-url" readOnly value={h.url} className="w-full font-mono text-xs bg-black/40 rounded p-2 text-white" />
          <div className="flex flex-wrap gap-2 mt-2">
            <Button size="sm" type="button" disabled={busy || !z.credential_id} onClick={() => run(async () => { await api.zendeskProvision(z.id); await reload(); await hook.reload(); }, "Webhook created in Zendesk.")}>Create webhook in Zendesk</Button>
            {z.webhook && z.webhook.provisioned ? <ConfirmButton confirmLabel="Remove" onConfirm={() => run(async () => { await api.zendeskDeprovision(z.id); await reload(); await hook.reload(); }, "Webhook removed from Zendesk.")}>Remove from Zendesk</ConfirmButton> : null}
            <ConfirmButton confirmLabel="Rotate" onConfirm={() => run(async () => { await api.zendeskRotateWebhook(z.id); await reload(); await hook.reload(); }, "Webhook URL rotated. Update Zendesk if you configured it manually.")}>Rotate URL</ConfirmButton>
          </div>
          <form className="flex flex-wrap gap-2 items-end mt-3" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.zendeskSigningSecret(z.id, secret); setSecret(""); await reload(); }, "Signing secret saved."); }}>
            <TextField label="Signing secret (from a manually created Zendesk webhook)" type="password" autoComplete="off" value={secret} onChange={setSecret} />
            <Button size="sm" variant="outline" type="submit" disabled={busy || !secret}>Save secret</Button>
          </form>
          <form className="flex flex-wrap gap-2 items-end mt-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.zendeskOwnerCredential(z.id, owner.trim()); await reload(); }, "Webhook owner credential recovered."); }}>
            <TextField label="Recover webhook owner (credential id for the same Zendesk account)" value={owner} onChange={setOwner} />
            <Button size="sm" variant="ghost" type="submit" disabled={busy || !owner.trim()}>Recover</Button>
          </form>
        </>
      ) : null}
    </Section>
  );
}

function Sidebar({ api, z, can, reload }) {
  const [key, setKey] = useState("");
  const { busy, error, notice, run } = useAction();
  return (
    <Section title="Zendesk sidebar app" description="Agents generate suggested replies inside Zendesk with a sidebar key (bbz_…).">
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      <p className="text-sm mb-2">{z.sidebar_key && z.sidebar_key.configured ? `Key configured (…${z.sidebar_key.hint}).` : "No sidebar key."}</p>
      <OneTimeSecret value={key} onDone={() => setKey("")} />
      {can ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" type="button" disabled={busy} onClick={() => run(async () => { const r = await api.zendeskSidebarKey(z.id); setKey(r.sidebar_key); await reload(); })}>
            {z.sidebar_key && z.sidebar_key.configured ? "Regenerate key" : "Create key"}</Button>
          {z.sidebar_key && z.sidebar_key.configured ? <ConfirmButton confirmLabel="Revoke" onConfirm={() => run(async () => { await api.zendeskRevokeSidebarKey(z.id); setKey(""); await reload(); }, "Key revoked.")}>Revoke key</ConfirmButton> : null}
          <a className="text-sm text-cyan-300 hover:underline self-center" href={api.zendeskSidebarZipUrl(z.id)}>Download sidebar app (.zip)</a>
        </div>
      ) : null}
    </Section>
  );
}

function Suggestions({ api, z, can }) {
  const list = useLoad(() => api.zendeskSuggestions(z.id), [api, z.id]);
  const { error, run } = useAction();
  return (
    <Section title="Suggestions inbox" description="Suggested replies (suggest-only mode and sidebar). Accepting records your review; agents post replies in Zendesk themselves.">
      <ErrorBox>{error}</ErrorBox>
      <ErrorBox error={list.error} />
      <DataTable caption="Suggestions" rows={(list.data && list.data.suggestions) || []} empty="No suggestions." columns={[
        { key: "ticket_id", label: "Ticket" },
        { key: "subject", label: "Subject", render: (s) => s.subject || "—" },
        { key: "text", label: "Suggestion", render: (s) => <span className="whitespace-pre-wrap">{s.text}</span> },
        { key: "citations", label: "Sources", render: (s) => ((s.citations || []).length ? s.citations.map((c) => c.document_name || c.document_id || c).join(", ") : "—") },
        { key: "status", label: "Status", render: (s) => <StateBadge state={s.status} /> },
        { key: "x", label: "", render: (s) => can && s.status === "pending" ? (
          <span className="flex gap-1">
            <Button size="sm" type="button" onClick={() => run(async () => { await api.zendeskDecideSuggestion(z.id, s.id, "accept"); await list.reload(); })}>Accept</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => run(async () => { await api.zendeskDecideSuggestion(z.id, s.id, "dismiss"); await list.reload(); })}>Dismiss</Button>
          </span>) : null },
      ]} />
    </Section>
  );
}

function Events({ api, z }) {
  const [filter, setFilter] = useState("");
  const list = useLoad(() => api.zendeskEvents(z.id, filter), [api, z.id, filter]);
  const dl = useLoad(() => api.zendeskDeliveries(z.id), [api, z.id]);
  const [notes, setNotes] = useState({});
  const { error, notice, run } = useAction();
  return (
    <>
      <Section title="Ticket events" description="An uncertain generation is never retried automatically. Decide whether it is charged after checking the ticket in Zendesk.">
        <ErrorBox>{error}</ErrorBox>
        <Notice tone="ok">{notice}</Notice>
        <SelectField label="Show" value={filter} onChange={setFilter}
          options={[["", "All"], ["uncertain", "Uncertain"], ["failed", "Failed"], ["done", "Done"], ["processing", "Processing"]]} />
        <ErrorBox error={list.error} />
        <DataTable caption="Ticket events" rows={(list.data && list.data.events) || []} empty="No events." columns={[
          { key: "ticket_id", label: "Ticket" },
          { key: "status", label: "Status", render: (e) => <StateBadge state={e.status} /> },
          { key: "label", label: "Outcome", render: (e) => e.label || e.error || e.admin_issue || "—" },
          { key: "received_at", label: "Received", render: (e) => fmtDate(e.received_at) },
          { key: "x", label: "", render: (e) => e.status === "uncertain" && !e.resolution ? (
            <span className="flex flex-wrap gap-1 items-center">
              <label className="sr-only" htmlFor={`note-${e.id}`}>Note for ticket {e.ticket_id}</label>
              <input id={`note-${e.id}`} placeholder="What you checked" value={notes[e.id] || ""} onChange={(ev) => setNotes({ ...notes, [e.id]: ev.target.value })}
                className="rounded border border-white/15 bg-[#050B14] px-2 py-1 text-xs text-white" />
              {["charge", "waive"].map((d) => <Button key={d} size="sm" variant="outline" type="button" disabled={!(notes[e.id] || "").trim()}
                onClick={() => run(async () => { await api.zendeskResolveEvent(z.id, e.id, d, notes[e.id].trim()); await list.reload(); }, `Resolved (${d}).`)}>{d === "charge" ? "Charge" : "Waive"}</Button>)}
            </span>) : (e.resolution ? `Resolved: ${e.resolution.decision || ""}` : null) },
        ]} />
      </Section>
      <Section title="Deliveries" description="Comment and note deliveries to Zendesk. Unknown outcomes are reconciled from the ticket, never blindly resent.">
        <ErrorBox error={dl.error} />
        <DataTable caption="Zendesk deliveries" rows={(dl.data && dl.data.deliveries) || []} empty="No deliveries." columns={[
          { key: "id", label: "Delivery", render: (d) => <code className="text-xs">{String(d.id).slice(0, 12)}…</code> },
          { key: "status", label: "Status", render: (d) => <StateBadge state={d.status} /> },
          { key: "attempts", label: "Attempts" },
          { key: "last_error", label: "Last error", render: (d) => d.last_error || "—" },
          { key: "updated_at", label: "Updated", render: (d) => fmtDate(d.updated_at) },
        ]} />
      </Section>
    </>
  );
}

export function IntegrationPage() {
  const { id } = useParams();
  const api = useApi();
  const nav = useNavigate();
  const z = useLoad(() => api.integration(id), [api, id]);
  const cfg = useLoad(() => api.integrationConfig(id).catch(() => null), [api, id]);
  const perm = useLoad(async () => (z.data ? (await api.config("bot", z.data.bot_id)).permissions : {}), [api, z.data && z.data.bot_id]);
  const [deleteResult, setDeleteResult] = useState(null);
  const [delError, setDelError] = useState("");
  const [delBusy, setDelBusy] = useState(false);

  if (deleteResult && deleteResult.deleted === true) {
    return (
      <>
        <PageTitle kind="Zendesk integration">Deleted</PageTitle>
        <DeletionBanner state="deleted" />
        <Button type="button" onClick={() => nav(-1)}>Back</Button>
      </>
    );
  }
  if (z.loading && !z.data) return <Loading />;
  if (z.error) {
    return z.error.status === 404 && deleteResult ? <DeletionBanner state="deleted" /> : <ErrorBox error={z.error} />;
  }
  const doc = z.data;
  const perms = perm.data || {};
  const can = Boolean(perms.manage_channel);
  const dstate = deletionStateOf(doc, deleteResult);
  const reload = async () => { await z.reload(); await cfg.reload(); };
  const requestDelete = async () => {
    setDelBusy(true);
    setDelError("");
    try {
      const r = await api.deleteIntegration(id);
      setDeleteResult(r.data);
      if (!(r.data && r.data.deleted)) await z.reload();
    } catch (e) {
      // 502 carries the state (cleanup failed); show it rather than a generic error
      if (e.body && e.body.state) {
        setDeleteResult(e.body);
        await z.reload();
      } else setDelError(errorMessage(e));
    } finally {
      setDelBusy(false);
    }
  };
  const deleting = Boolean(dstate);
  return (
    <>
      <Breadcrumbs api={api} node={{ ...doc, organisation_id: doc.organisation_id, bot_id: doc.bot_id }} kind="integration" />
      <PageTitle kind="Zendesk integration (Bot Integration)">{doc.name}</PageTitle>
      <DeletionBanner state={dstate} error={(doc.deletion && doc.deletion.error) || (deleteResult && deleteResult.error)} />
      {deleting ? (
        <Section title="Deletion">
          <ErrorBox>{delError}</ErrorBox>
          <p className="text-sm text-slate-300 mb-2">While deletion is pending the integration cannot be re-enabled or reconnected.</p>
          {can && dstate !== "requested" ? <Button size="sm" variant="destructive" type="button" disabled={delBusy} onClick={requestDelete}>{delBusy ? "Retrying…" : "Retry deletion"}</Button> : null}
          {dstate === "requested" ? <Button size="sm" variant="outline" type="button" onClick={reload}>Refresh status</Button> : null}
        </Section>
      ) : (
        <Tabs tabs={[
          ["connect", "Connection", () => <Connection api={api} z={doc} can={can} reload={reload} />],
          ["settings", "Replies", () => <Settings api={api} z={doc} can={can} reload={reload} />],
          ["webhook", "Webhook", () => <Webhook api={api} z={doc} can={can} reload={reload} />],
          ["sidebar", "Sidebar", () => <Sidebar api={api} z={doc} can={can} reload={reload} />],
          ["suggestions", "Suggestions", () => <Suggestions api={api} z={doc} can={can} />],
          ["events", "Events", () => (can ? <Events api={api} z={doc} /> : <Notice>Only administrators can review ticket events.</Notice>)],
          ["usage", "Usage", () => (
            <>
              <UsagePanel api={api} type="integration" id={id} integration />
              <Notice tone="info">Zendesk analytics dashboards are not available yet (deferred). Usage above and the Events tab show what is recorded.</Notice>
            </>
          )],
          ["config", "Overrides", () => (cfg.data ? (
            <ConfigPanel view={cfg.data} targetId={id} canEdit={perms.edit_config} title="Integration overrides"
              onPatch={async (c) => { await api.patchIntegrationConfig(id, c); await cfg.reload(); }} />) : <ErrorBox error={cfg.error} />)],
          ["delete", "Delete", () => (
            <Section title="Delete integration" description="Disables the integration at once, waits for any Zendesk request already in flight, removes the webhook BitBotPro created, then deletes the integration. Ticket data in Zendesk is not changed.">
              <ErrorBox>{delError}</ErrorBox>
              {can ? <ConfirmButton confirmLabel="Delete integration" onConfirm={requestDelete}>Delete integration…</ConfirmButton> : <Notice>You do not have permission to delete this integration.</Notice>}
            </Section>
          )],
        ]} />
      )}
    </>
  );
}
