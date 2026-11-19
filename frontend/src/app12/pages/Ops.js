/** C12 operations review: audit, uncertain deliveries (resolved with a note,
 * never resent from the UI), worker and deletion-job health. */
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { JobView } from "../components/DeleteDialog";
import { DataTable, ErrorBox, KeyValues, Loading, Notice, Section, SelectField, StateBadge, TextField } from "../components/common";
import { fmtDate, useAction, useLoad } from "../util";

export function AuditList({ api, enterpriseId }) {
  const list = useLoad(() => (enterpriseId ? api.enterpriseAudit(enterpriseId) : api.platformAudit()), [api, enterpriseId]);
  return (
    <Section title="Audit log" description="Most recent first. Secrets are never recorded.">
      {list.loading ? <Loading /> : <ErrorBox error={list.error} />}
      <DataTable caption="Audit events" rows={(list.data && list.data.events) || []} empty="No audit events." columns={[
        { key: "at", label: "When", render: (e) => fmtDate(e.at) },
        { key: "action", label: "Action", render: (e) => <code className="text-xs">{e.action}</code> },
        { key: "actor_id", label: "Actor", render: (e) => `${String(e.actor_id || "system").slice(0, 8)}${e.actor_superadmin ? " (superadmin)" : ""}` },
        { key: "target", label: "Target", render: (e) => `${e.target_level || ""} ${String(e.target_id || "").slice(0, 8)}` },
        { key: "details", label: "Details", render: (e) => <span className="text-xs text-slate-400 break-all">{e.details ? JSON.stringify(e.details) : ""}</span> },
      ]} />
    </Section>
  );
}

export function DeliveriesPanel({ api, instanceId, canResolve }) {
  const [status, setStatus] = useState("");
  const list = useLoad(() => api.deliveries(instanceId, status), [api, instanceId, status]);
  const [notes, setNotes] = useState({});
  const { error, notice, run } = useAction();
  return (
    <Section title="Deliveries" description="An uncertain delivery may or may not have reached the user. It is never resent automatically; check the chat and record what you found.">
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      <SelectField label="Show" value={status} onChange={setStatus}
        options={[["", "All"], ["uncertain", "Uncertain"], ["failed_before_send", "Failed before sending"], ["pending", "Pending"], ["sent", "Sent"]]} />
      <ErrorBox error={list.error} />
      <DataTable caption="Deliveries" rows={(list.data && list.data.deliveries) || []} empty="No deliveries." columns={[
        { key: "created_at", label: "Created", render: (d) => fmtDate(d.created_at) },
        { key: "status", label: "Status", render: (d) => <StateBadge state={d.status} /> },
        { key: "parts", label: "Parts", render: (d) => (d.parts || []).map((p) => p.state).join(", ") || "—" },
        { key: "last_error", label: "Last error", render: (d) => d.last_error || "—" },
        { key: "x", label: "", render: (d) => canResolve && d.status === "uncertain" ? (
          <span className="flex gap-1 items-center">
            <label className="sr-only" htmlFor={`dn-${d.id}`}>Review note</label>
            <input id={`dn-${d.id}`} placeholder="What you checked" value={notes[d.id] || ""} onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })}
              className="rounded border border-white/15 bg-[#050B14] px-2 py-1 text-xs text-white" />
            <Button size="sm" variant="outline" type="button" disabled={!(notes[d.id] || "").trim()}
              onClick={() => run(async () => { await api.resolveDelivery(instanceId, d.id, { note: notes[d.id].trim() }); await list.reload(); }, "Marked as reviewed.")}>Mark reviewed</Button>
          </span>) : null },
      ]} />
    </Section>
  );
}

export function WorkersPanel({ api }) {
  const w = useLoad(() => api.platformWorkers(), [api]);
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState(null);
  const { error, run } = useAction();
  if (w.loading) return <Loading />;
  if (w.error) return <ErrorBox error={w.error} />;
  const d = w.data;
  return (
    <>
      <Section title="Workers" actions={<Button size="sm" variant="outline" type="button" onClick={w.reload}>Refresh</Button>}>
        <DataTable caption="Workers" rows={d.workers} empty="No worker has reported in. Background jobs (deliveries, deletion cleanup, Discord gateways, knowledge processing) are not running." columns={[
          { key: "id", label: "Worker" }, { key: "at", label: "Last heartbeat", render: (x) => fmtDate(x.at) },
          { key: "state", label: "State", render: (x) => <StateBadge state={x.state || "active"} /> },
        ]} />
      </Section>
      <Section title="Deletion jobs">
        <KeyValues rows={Object.entries(d.deletion_jobs || {}).map(([k, v]) => [k.replace(/_/g, " "), v])} />
        <ErrorBox>{error}</ErrorBox>
        <form className="flex flex-wrap gap-2 items-end mt-3" onSubmit={(e) => { e.preventDefault(); run(async () => setJob(await api.deletionJob(jobId.trim()))); }}>
          <TextField label="Open a deletion job by id" value={jobId} onChange={setJobId} />
          <Button size="sm" type="submit" disabled={!jobId.trim()}>Open</Button>
        </form>
        {job ? <JobView api={api} job={job} /> : null}
      </Section>
      <Section title="Outbound deliveries (all channels)">
        <KeyValues rows={Object.entries(d.deliveries || {}).map(([k, v]) => [k.replace(/_/g, " "), v])} />
        {(d.deliveries && d.deliveries.uncertain) ? <Notice tone="warn">There are uncertain deliveries. Review them on the affected instance pages; they are never resent automatically.</Notice> : null}
      </Section>
    </>
  );
}
