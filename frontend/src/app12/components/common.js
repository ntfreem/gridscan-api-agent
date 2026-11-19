/** Small shared building blocks (accessible by default: labelled fields, live regions). */
import React, { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "../api/client";

export function Section({ title, description, actions, children, id }) {
  const hid = useId();
  return (
    <section aria-labelledby={hid} id={id} className="rounded-lg border border-white/10 bg-[#0B132B]/60 p-4 sm:p-5 mb-4">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h2 id={hid} className="text-base font-semibold text-white">{title}</h2>
          {description ? <p className="text-sm text-slate-400 mt-0.5">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Loading({ label = "Loading…" }) {
  return <p role="status" aria-live="polite" className="text-sm text-slate-400 py-2">{label}</p>;
}

export function ErrorBox({ error, children }) {
  const text = children || (typeof error === "string" ? error : errorMessage(error));
  if (!text) return null;
  return <p role="alert" className="text-sm text-red-300 bg-red-950/40 border border-red-900/60 rounded px-3 py-2 my-2">{text}</p>;
}

export function Notice({ children, tone = "info" }) {
  if (!children) return null;
  const cls = { info: "text-cyan-200 bg-cyan-950/30 border-cyan-900/60", ok: "text-emerald-200 bg-emerald-950/30 border-emerald-900/60",
    warn: "text-amber-200 bg-amber-950/30 border-amber-900/60", error: "text-red-200 bg-red-950/40 border-red-900/60" }[tone];
  return <p role="status" aria-live="polite" className={`text-sm border rounded px-3 py-2 my-2 ${cls}`}>{children}</p>;
}

export function Empty({ children }) {
  return <p className="text-sm text-slate-400 py-2">{children}</p>;
}

export function Badge({ children, tone = "neutral", title }) {
  const cls = { neutral: "bg-slate-800 text-slate-200", ok: "bg-emerald-900/60 text-emerald-200",
    warn: "bg-amber-900/60 text-amber-200", error: "bg-red-900/60 text-red-200", info: "bg-cyan-900/60 text-cyan-200" }[tone];
  return <span title={title} className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

export function StateBadge({ state }) {
  const tone = { active: "ok", enabled: "ok", connected: "ok", suspended: "warn", archived: "neutral", disabled: "neutral",
    revoked: "error", failed: "error", deleted: "error", uncertain: "warn", pending: "info" }[state] || "neutral";
  return <Badge tone={tone}>{state}</Badge>;
}

export function Field({ label, hint, children, id: given }) {
  const auto = useId();
  const id = given || auto;
  const child = React.Children.only(children);
  return (
    <div className="mb-3">
      <Label htmlFor={id} className="text-slate-200">{label}</Label>
      {React.cloneElement(child, { id, "aria-describedby": hint ? `${id}-hint` : undefined })}
      {hint ? <p id={`${id}-hint`} className="text-xs text-slate-400 mt-1">{hint}</p> : null}
    </div>
  );
}

export function TextField({ label, hint, value, onChange, type = "text", ...rest }) {
  return (
    <Field label={label} hint={hint}>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="mt-1" {...rest} />
    </Field>
  );
}

export function SelectField({ label, hint, value, onChange, options, ...rest }) {
  return (
    <Field label={label} hint={hint}>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-white/15 bg-[#050B14] px-3 py-2 text-sm text-white" {...rest}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Field>
  );
}

export function CheckField({ label, checked, onChange, hint, disabled }) {
  const id = useId();
  return (
    <div className="mb-3 flex items-start gap-2">
      <input id={id} type="checkbox" checked={Boolean(checked)} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} className="mt-1" aria-describedby={hint ? `${id}-hint` : undefined} />
      <div>
        <label htmlFor={id} className="text-sm text-slate-200">{label}</label>
        {hint ? <p id={`${id}-hint`} className="text-xs text-slate-400">{hint}</p> : null}
      </div>
    </div>
  );
}

/** Two-step button for destructive or irreversible actions. */
export function ConfirmButton({ children, confirmLabel = "Confirm", onConfirm, disabled, variant = "destructive", size = "sm" }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return <Button type="button" size={size} variant={variant === "destructive" ? "outline" : variant} disabled={disabled}
      onClick={() => setAsking(true)}>{children}</Button>;
  }
  return (
    <span className="inline-flex gap-1" role="group" aria-label={`Confirm: ${typeof children === "string" ? children : "action"}`}>
      <Button type="button" size={size} variant={variant} onClick={async () => { setAsking(false); await onConfirm(); }}>{confirmLabel}</Button>
      <Button type="button" size={size} variant="ghost" onClick={() => setAsking(false)}>Cancel</Button>
    </span>
  );
}

export function KeyValues({ rows }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-[minmax(10rem,auto)_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.filter(Boolean).map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-slate-400">{k}</dt>
          <dd className="text-slate-100 break-all">{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export function DataTable({ columns, rows, caption, empty = "Nothing here yet." }) {
  if (!rows || !rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="text-left text-slate-400 border-b border-white/10">
            {columns.map((c) => <th scope="col" key={c.key} className="py-2 pr-3 font-medium">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || r.key || i} className="border-b border-white/5 align-top">
              {columns.map((c) => <td key={c.key} className="py-2 pr-3 text-slate-100">{c.render ? c.render(r) : String(r[c.key] ?? "—")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Shows a secret exactly once (e.g. a new sidebar key); never stored. */
export function OneTimeSecret({ value, label, onDone }) {
  if (!value) return null;
  return (
    <div role="alert" className="border border-amber-700/60 bg-amber-950/30 rounded p-3 my-2">
      <p className="text-sm text-amber-200 mb-2">{label || "Copy this value now. It will not be shown again."}</p>
      <code className="block break-all text-xs text-white bg-black/40 rounded p-2" data-testid="one-time-secret">{value}</code>
      <div className="mt-2 flex gap-2">
        <Button type="button" size="sm" variant="outline"
          onClick={() => navigator.clipboard && navigator.clipboard.writeText(value)}>Copy</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>I have copied it</Button>
      </div>
    </div>
  );
}

export function SubmitRow({ busy, children = "Save", disabled }) {
  return <Button type="submit" size="sm" disabled={busy || disabled}>{busy ? "Working…" : children}</Button>;
}
