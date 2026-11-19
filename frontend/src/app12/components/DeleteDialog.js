/**
 * DeleteDialog (C13): preview (counts, external actions, backups note) →
 * typed confirmation of the exact name → deletion job with progress,
 * external-cleanup state, resume and operator resolution. The server enforces
 * authority, the preview token, the digest and last-owner/last-superadmin
 * protection; the dialog only shows what the server returns.
 */
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable, ErrorBox, Loading, Notice, StateBadge } from "./common";
import { errorMessage } from "../api/client";
import { fmtDate } from "../util";

export const JOB_TEXT = {
  pending: "Deletion queued.",
  running: "Deleting…",
  awaiting_external_cleanup: "Data removed. Waiting for external cleanup (Discord, Zendesk, credentials) to finish.",
  cleanup_failed: "Some external cleanup failed. Resume to retry, or resolve the action after checking it manually.",
  completed: "Deletion completed.",
  failed: "Deletion failed. Resume to retry.",
};

const TERMINAL = new Set(["completed"]);

export function JobView({ api, job: initial, pollMs = 2000 }) {
  const [job, setJob] = useState(initial);
  const [error, setError] = useState("");
  const [reasons, setReasons] = useState({});
  const timer = useRef(null);
  useEffect(() => setJob(initial), [initial]);
  useEffect(() => {
    if (!job || TERMINAL.has(job.status) || !pollMs) return undefined;
    timer.current = setTimeout(async () => {
      try {
        setJob(await api.deletionJob(job.id));
      } catch (e) {
        setError(errorMessage(e));
      }
    }, pollMs);
    return () => clearTimeout(timer.current);
  }, [api, job, pollMs]);
  if (!job) return null;
  const act = async (fn) => {
    setError("");
    try {
      setJob(await fn());
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const actions = job.external_actions || [];
  return (
    <div aria-live="polite">
      <p className="text-sm text-slate-200 mb-2"><StateBadge state={job.status} /> {JOB_TEXT[job.status] || job.status}</p>
      {job.error ? <ErrorBox>{String(job.error)}</ErrorBox> : null}
      <ErrorBox>{error}</ErrorBox>
      {actions.length ? (
        <DataTable caption="External cleanup actions" rows={actions} columns={[
          { key: "action", label: "Action" },
          { key: "state", label: "State", render: (a) => <StateBadge state={a.state} /> },
          { key: "attempts", label: "Attempts" },
          { key: "error_class", label: "Last error", render: (a) => a.error_class || "—" },
          { key: "resolve", label: "", render: (a) => (a.state === "failed" || a.state === "uncertain") ? (
            <span className="flex gap-1 items-center">
              <label className="sr-only" htmlFor={`r-${a.id}`}>Reason for resolving {a.action}</label>
              <input id={`r-${a.id}`} placeholder="Reason (checked manually)" value={reasons[a.id] || ""}
                onChange={(e) => setReasons({ ...reasons, [a.id]: e.target.value })}
                className="rounded border border-white/15 bg-[#050B14] px-2 py-1 text-xs text-white" />
              <Button size="sm" variant="outline" type="button" disabled={!(reasons[a.id] || "").trim()}
                onClick={() => act(() => api.resolveDeletionAction(job.id, a.id, reasons[a.id].trim()))}>Resolve</Button>
            </span>) : null },
        ]} />
      ) : null}
      {["failed", "cleanup_failed"].includes(job.status) ? (
        <Button size="sm" type="button" className="mt-2" onClick={() => act(() => api.resumeDeletionJob(job.id))}>Resume deletion</Button>
      ) : null}
      {job.completed_at ? <p className="text-xs text-slate-400 mt-2">Completed {fmtDate(job.completed_at)}</p> : null}
    </div>
  );
}

export default function DeleteDialog({ api, type, id, name, open, onOpenChange, onDeleted, pollMs }) {
  const [preview, setPreview] = useState(null);
  const [typed, setTyped] = useState("");
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPreview(null); setTyped(""); setJob(null); setError("");
    let alive = true;
    api.deletionPreview(type, id).then((p) => alive && setPreview(p)).catch((e) => alive && setError(errorMessage(e)));
    return () => { alive = false; };
  }, [api, type, id, open]);

  const confirm = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api.deleteObject(type, id, preview.preview_token, typed);
      setJob(r.data);
      if (onDeleted) onDeleted(r.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const counts = preview ? Object.entries(preview.counts || {}).filter(([, n]) => n > 0) : [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#050B14] text-white border-white/10 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permanently delete {name}</DialogTitle>
          <DialogDescription className="text-slate-400">
            This cannot be undone. Everything below this {type} is deleted first; nothing outside it is touched.
          </DialogDescription>
        </DialogHeader>
        <ErrorBox>{error}</ErrorBox>
        {job ? <JobView api={api} job={job} pollMs={pollMs} /> : !preview ? (error ? null : <Loading label="Preparing the deletion preview…" />) : (
          <form onSubmit={confirm}>
            <h3 className="text-sm font-semibold mb-1">What will be deleted</h3>
            <ul className="text-sm text-slate-200 grid grid-cols-2 gap-x-4 mb-3">
              {counts.map(([k, n]) => <li key={k}>{k.replace(/_/g, " ")}: <strong>{n}</strong></li>)}
            </ul>
            {(preview.external_actions || []).length ? (
              <>
                <h3 className="text-sm font-semibold mb-1">External cleanup</h3>
                <ul className="text-sm text-slate-300 list-disc ml-5 mb-3">
                  {preview.external_actions.map((a) => <li key={a.id}>{a.action.replace(/_/g, " ")}{a.mandatory ? " (required)" : ""}</li>)}
                </ul>
              </>
            ) : null}
            {preview.backups_note ? <Notice tone="info">{preview.backups_note}</Notice> : null}
            <p className="text-xs text-slate-400 mb-2">This preview expires {fmtDate(preview.expires_at)}.</p>
            <label htmlFor="confirm-name" className="text-sm">Type <strong>{preview.confirm_name}</strong> to confirm</label>
            <input id="confirm-name" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)}
              className="mt-1 block w-full rounded-md border border-white/15 bg-[#0B132B] px-3 py-2 text-sm text-white" />
            <div className="flex gap-2 mt-3">
              <Button type="submit" variant="destructive" disabled={busy || typed !== preview.confirm_name}>
                {busy ? "Deleting…" : "Delete permanently"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
