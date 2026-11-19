/** LifecycleMenu (spec §7, §12) and PolicyPanel. */
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import ConfigPanel from "./ConfigPanel";
import DeleteDialog from "./DeleteDialog";
import { ErrorBox, Notice, Section, StateBadge } from "./common";
import { availabilityText, lifecycleState, useAction } from "../util";

export function LifecycleMenu({ api, type, node, permissions = {}, onChanged, onDeleted, pollMs }) {
  const { busy, error, notice, run } = useAction();
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const state = lifecycleState(node);
  const op = (name) => run(async () => {
    await api.lifecycle(type, node.id, name, reason);
    setReason("");
    if (onChanged) await onChanged();
  }, { suspend: "Suspended.", resume: "Resumed.", archive: "Archived.", unarchive: "Restored from archive." }[name]);
  const ops = [];
  if (permissions.suspend && state === "active") ops.push(["suspend", "Suspend"]);
  if (permissions.suspend && state === "suspended") ops.push(["resume", "Resume"]);
  if (permissions.archive && (state === "active" || state === "suspended")) ops.push(["archive", "Archive"]);
  if (permissions.archive && state === "archived") ops.push(["unarchive", "Unarchive"]);
  return (
    <Section title="Lifecycle" description="Suspending or archiving immediately disables everything below. Resuming a parent never resumes a child that was suspended on its own.">
      <p className="text-sm mb-2">State: <StateBadge state={state} />{node.lifecycle && node.lifecycle.reason ? <span className="text-slate-400"> — {node.lifecycle.reason}</span> : null}</p>
      {availabilityText(node) ? <Notice tone="warn">{availabilityText(node)}</Notice> : null}
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      {ops.length ? (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor={`lc-reason-${node.id}`} className="text-xs text-slate-400 block">Reason (recorded in the audit log)</label>
            <input id={`lc-reason-${node.id}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
              className="rounded-md border border-white/15 bg-[#050B14] px-2 py-1 text-sm text-white" />
          </div>
          {ops.map(([k, l]) => <Button key={k} size="sm" variant="outline" type="button" disabled={busy} onClick={() => op(k)}>{l}</Button>)}
        </div>
      ) : null}
      {permissions.delete ? (
        <div className="mt-4 border-t border-white/10 pt-3">
          <Button size="sm" variant="destructive" type="button" onClick={() => setDeleting(true)}>Delete permanently…</Button>
          <DeleteDialog api={api} type={type} id={node.id} name={node.name} open={deleting} onOpenChange={setDeleting}
            onDeleted={onDeleted} pollMs={pollMs} />
        </div>
      ) : null}
    </Section>
  );
}

export function PolicyPanel({ view, targetId, canEdit, onPatch }) {
  if (!view) return null;
  const keys = Object.keys(view.effective || {});
  const mapped = {
    values: view.effective || {}, sources: view.sources || {}, overrides: view.own || {},
    overridable: canEdit ? keys : [], conflicts: view.conflicts || [],
  };
  return (
    <>
      <ConfigPanel view={mapped} targetId={targetId} canEdit={canEdit} onPatch={onPatch} title="Policy" />
      <p className="text-xs text-slate-400 -mt-2 mb-4">Policies set here apply to everything below and can only be made stricter further down. The server rejects any change that would loosen a parent policy.</p>
    </>
  );
}
