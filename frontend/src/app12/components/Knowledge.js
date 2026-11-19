/**
 * KnowledgePanel (C11): sources owned by an Enterprise or Organisation,
 * Enterprise approval (policy `knowledge.allowed_sources`), document upload,
 * processing status, versions, validity, ACLs, reprocess and deletion.
 * Retrieval, access filtering and evidence validation happen only in the API.
 */
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton, DataTable, ErrorBox, Loading, Notice, Section, StateBadge, TextField } from "./common";
import { fmtDate, useAction, useLoad } from "../util";

export const ACCEPT = ".txt,.md,.markdown,.html,.htm,.csv,.json,.docx,.pdf";
export const MAX_UPLOAD = 2 * 1024 * 1024;

export function uploadProblem(file) {
  if (!file) return "Choose a file.";
  if (file.size > MAX_UPLOAD) return "Files are limited to 2 MB.";
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ACCEPT.split(",").includes(`.${ext}`)) return "Supported: text, Markdown, HTML, CSV, JSON, DOCX and PDF (text-based).";
  return "";
}

function Documents({ api, source, canManage }) {
  const docs = useLoad(() => api.documents(source.id), [api, source.id]);
  const { busy, error, notice, run } = useAction();
  const [file, setFile] = useState(null);
  const [acl, setAcl] = useState({});
  const upload = (e) => {
    e.preventDefault();
    const problem = uploadProblem(file);
    if (problem) return run(() => Promise.reject(new Error(problem)));
    return run(async () => { await api.uploadDocument(source.id, file.name, file); setFile(null); e.target.reset(); await docs.reload(); },
      "Uploaded. Processing runs in the background; refresh to see the status.");
  };
  const rows = (docs.data && docs.data.documents) || [];
  return (
    <div className="mt-2 ml-2 border-l border-white/10 pl-3">
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      {docs.loading ? <Loading /> : <ErrorBox error={docs.error} />}
      <DataTable caption={`Documents in ${source.name}`} rows={rows} empty="No documents yet." columns={[
        { key: "name", label: "Document" },
        { key: "status", label: "Status", render: (d) => (
          <span>
            <StateBadge state={d.status} />
            {d.job && d.job.error ? <span className="block text-xs text-red-300">{d.job.error}</span> : null}
          </span>) },
        { key: "content_version", label: "Version" },
        { key: "chunk_count", label: "Chunks", render: (d) => d.chunk_count ?? "—" },
        { key: "acl", label: "Access", render: (d) => {
          const a = d.acl || {};
          const parts = [...(a.organisations || []).map((x) => `org:${x.slice(0, 6)}…`), ...(a.bots || []).map((x) => `bot:${x.slice(0, 6)}…`)];
          return parts.length ? parts.join(", ") : "Whole source";
        } },
        { key: "updated_at", label: "Updated", render: (d) => fmtDate(d.updated_at) },
        { key: "x", label: "", render: (d) => canManage ? (
          <span className="flex flex-wrap gap-1 items-center">
            <Button size="sm" variant="ghost" type="button" onClick={() => run(async () => { await api.reprocessDocument(d.id); await docs.reload(); }, "Reprocessing.")}>Reprocess</Button>
            <label className="sr-only" htmlFor={`acl-${d.id}`}>Restrict {d.name} to Organisation ids</label>
            <input id={`acl-${d.id}`} placeholder="org ids (comma)" value={acl[d.id] ?? ""} onChange={(e) => setAcl({ ...acl, [d.id]: e.target.value })}
              className="rounded border border-white/15 bg-[#050B14] px-2 py-1 text-xs text-white w-32" />
            <Button size="sm" variant="ghost" type="button" onClick={() => run(async () => {
              const organisations = (acl[d.id] || "").split(",").map((s) => s.trim()).filter(Boolean);
              await api.documentAcl(d.id, { organisations, bots: [] }); await docs.reload(); }, "Access updated.")}>Set access</Button>
            <ConfirmButton confirmLabel="Delete" onConfirm={() => run(async () => { await api.deleteDocument(d.id); await docs.reload(); }, "Document deleted.")}>Delete</ConfirmButton>
          </span>) : null },
      ]} />
      {canManage ? (
        <form onSubmit={upload} className="mt-2 flex flex-wrap gap-2 items-end">
          <div>
            <label htmlFor={`up-${source.id}`} className="text-xs text-slate-400 block">Upload a document (max 2 MB)</label>
            <input id={`up-${source.id}`} type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files[0] || null)} className="text-sm text-slate-200" />
          </div>
          <Button size="sm" type="submit" disabled={busy || !file}>Upload</Button>
          <p className="text-xs text-slate-400 w-full">Scanned or image-only PDFs contain no text and need OCR, which is not supported; upload a text-based PDF or another format.</p>
        </form>
      ) : null}
    </div>
  );
}

export default function KnowledgePanel({ api, type, ownerId, canManage, approved, canApprove, onApprove }) {
  const sources = useLoad(() => api.sources(type, ownerId), [api, type, ownerId]);
  const { busy, error, notice, run } = useAction();
  const [name, setName] = useState("");
  const [open, setOpen] = useState({});
  const approvedSet = new Set(approved || []);
  return (
    <Section title="Knowledge" description="Sources must be approved by the Enterprise before any bot can use them. Answers in knowledge modes cite only approved, accessible, currently valid documents.">
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      {sources.loading ? <Loading /> : <ErrorBox error={sources.error} />}
      <ul>
        {((sources.data && sources.data.sources) || []).map((s) => (
          <li key={s.id} className="py-2 border-b border-white/5">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <span>
                <strong className="text-white">{s.name}</strong> <StateBadge state={s.status} />{" "}
                {approved ? (approvedSet.has(s.id) ? <StateBadge state="approved" /> : <span className="text-xs text-amber-300">Not approved for use</span>) : null}
              </span>
              <span className="flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" type="button" aria-expanded={Boolean(open[s.id])}
                  onClick={() => setOpen({ ...open, [s.id]: !open[s.id] })}>{open[s.id] ? "Hide documents" : "Documents"}</Button>
                {canApprove ? (
                  <Button size="sm" variant="outline" type="button" disabled={busy} onClick={() => run(() => onApprove(s.id, !approvedSet.has(s.id)),
                    approvedSet.has(s.id) ? "Approval withdrawn." : "Source approved.")}>{approvedSet.has(s.id) ? "Withdraw approval" : "Approve"}</Button>
                ) : null}
                {canManage ? (
                  <>
                    <Button size="sm" variant="ghost" type="button" onClick={() => run(async () => {
                      await api.patchSource(s.id, { status: s.status === "active" ? "disabled" : "active" }); await sources.reload(); },
                    s.status === "active" ? "Source disabled." : "Source enabled.")}>{s.status === "active" ? "Disable" : "Enable"}</Button>
                    <ConfirmButton confirmLabel="Delete source" onConfirm={() => run(async () => { await api.deleteSource(s.id); await sources.reload(); }, "Source deleted.")}>Delete</ConfirmButton>
                  </>
                ) : null}
              </span>
            </div>
            {open[s.id] ? <Documents api={api} source={s} canManage={canManage} /> : null}
          </li>
        ))}
      </ul>
      {canManage ? (
        <form className="mt-3 max-w-sm" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.createSource(type, ownerId, { name }); setName(""); await sources.reload(); }, "Source created."); }}>
          <TextField label="New source name" value={name} onChange={setName} required maxLength={120} />
          <Button size="sm" type="submit" disabled={busy || !name.trim()}>Create source</Button>
        </form>
      ) : null}
    </Section>
  );
}
