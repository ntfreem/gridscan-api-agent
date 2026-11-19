/**
 * ConfigPanel (spec §12): effective value, origin ("Inherited from …" / "Set
 * here"), override, reset to inherited (null removes the sparse override),
 * policy lock with reason. Values are computed only by the API resolver; the
 * panel never merges configuration itself.
 */
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, ErrorBox, Notice, Section } from "./common";
import { displayValue, isOwnSource, sourceLabel, useAction } from "../util";

export const ENUMS = {
  "knowledge.mode": [["general", "General AI knowledge"], ["knowledge_preferred", "Knowledge preferred"],
    ["strict_knowledge_only", "Strict knowledge only"]],
  "ai.provider": [["anthropic", "Anthropic"], ["openai", "OpenAI"]],
};

export const HELP = {
  "knowledge.mode": "Strict knowledge only refuses (or uses the fallback) when approved evidence is missing, weak or contradictory. It never falls back to general AI knowledge. It reduces, but cannot eliminate, wrong answers.",
  "knowledge.min_evidence_score": "Minimum evidence score (0–1) before an answer is attempted in knowledge modes.",
  "knowledge.require_citations": "Answers must cite the approved documents they rely on.",
  "knowledge.human_handoff": "Offer a human handoff instead of an answer when evidence is insufficient.",
  "knowledge.approved_sources": "Knowledge sources this object may use (only sources the Enterprise approved).",
  "behaviour.tone_examples": "Approved example replies (from conversation review).",
};

function kindOf(key, value) {
  if (ENUMS[key]) return "enum";
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number") return "number";
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) return "list";
  if (value !== null && typeof value === "object") return "json";
  if (Array.isArray(value)) return "json";
  return typeof value === "string" && (value.length > 80 || /instructions|persona|message|fallback/.test(key)) ? "text" : "string";
}

export function parseInput(kind, raw) {
  if (kind === "bool") return Boolean(raw);
  if (kind === "number") {
    const n = Number(raw);
    if (raw === "" || Number.isNaN(n)) throw new Error("Enter a number.");
    return n;
  }
  if (kind === "list") return String(raw).split(",").map((s) => s.trim()).filter(Boolean);
  if (kind === "json") {
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error("Enter valid JSON.");
    }
  }
  return raw;
}

function toInput(kind, value) {
  if (kind === "list") return (value || []).join(", ");
  if (kind === "json") return JSON.stringify(value ?? null, null, 2);
  if (kind === "bool") return Boolean(value);
  return value ?? "";
}

/** Normalise the object-config and integration-config shapes. */
export function normalise(view, targetId) {
  const values = view.values || {};
  const sources = view.sources || {};
  const overridable = Array.isArray(view.overridable)
    ? Object.fromEntries(Object.keys(values).map((k) => [k, view.overridable.includes(k)]))
    : (view.overridable || {});
  const own = view.overrides
    ? (k) => Object.prototype.hasOwnProperty.call(view.overrides, k)
    : (k) => isOwnSource(sources[k], targetId);
  return { values, sources, overridable, own };
}

function Row({ k, value, source, own, editable, lockedReason, targetId, names, onSave, onReset, busy }) {
  const kind = kindOf(k, value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(toInput(kind, value));
  const [err, setErr] = useState("");
  const inputId = `cfg-${k.replace(/\W/g, "-")}`;
  const save = async () => {
    try {
      const v = parseInput(kind, draft);
      setErr("");
      const ok = await onSave(k, v);
      if (ok !== false) setEditing(false);
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <li className="py-3 border-b border-white/5">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="min-w-0">
          <span className="font-mono text-xs text-slate-300">{k}</span>{" "}
          <Badge tone={own ? "info" : "neutral"}>{sourceLabel(source, targetId, names)}</Badge>{" "}
          {lockedReason ? <Badge tone="warn" title={lockedReason}>Locked: {lockedReason}</Badge> : null}
        </div>
        {editable && !editing ? (
          <span className="flex gap-1">
            <Button size="sm" variant="outline" type="button" onClick={() => { setDraft(toInput(kind, value)); setEditing(true); }}
              aria-label={`Override ${k}`}>{own ? "Edit" : "Override"}</Button>
            {own ? <Button size="sm" variant="ghost" type="button" disabled={busy} onClick={() => onReset(k)}
              aria-label={`Reset ${k} to inherited`}>Reset to inherited</Button> : null}
          </span>
        ) : null}
      </div>
      {!editing ? <p className="text-sm text-slate-100 mt-1 break-words whitespace-pre-wrap">{displayValue(value)}</p> : (
        <div className="mt-2">
          <label htmlFor={inputId} className="sr-only">{k}</label>
          {kind === "bool" ? (
            <input id={inputId} type="checkbox" checked={Boolean(draft)} onChange={(e) => setDraft(e.target.checked)} />
          ) : kind === "enum" ? (
            <select id={inputId} value={draft} onChange={(e) => setDraft(e.target.value)}
              className="rounded-md border border-white/15 bg-[#050B14] px-2 py-1 text-sm text-white">
              {ENUMS[k].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ) : kind === "text" || kind === "json" ? (
            <textarea id={inputId} value={draft} onChange={(e) => setDraft(e.target.value)} rows={kind === "json" ? 5 : 3}
              className="w-full rounded-md border border-white/15 bg-[#050B14] px-2 py-1 text-sm text-white font-mono" />
          ) : (
            <input id={inputId} type={kind === "number" ? "number" : "text"} step="any" value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded-md border border-white/15 bg-[#050B14] px-2 py-1 text-sm text-white" />
          )}
          {kind === "list" ? <p className="text-xs text-slate-400">Comma-separated.</p> : null}
          {err ? <p role="alert" className="text-xs text-red-300">{err}</p> : null}
          <span className="flex gap-1 mt-2">
            <Button size="sm" type="button" disabled={busy} onClick={save}>Save</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>Cancel</Button>
          </span>
        </div>
      )}
      {HELP[k] ? <p className="text-xs text-slate-400 mt-1">{HELP[k]}</p> : null}
    </li>
  );
}

export default function ConfigPanel({ view, targetId, canEdit, onPatch, names, title = "Configuration" }) {
  const { busy, error, notice, run } = useAction();
  if (!view) return null;
  const { values, sources, overridable, own } = normalise(view, targetId);
  const groups = {};
  Object.keys(values).sort().forEach((k) => {
    const g = k.split(".")[0];
    (groups[g] = groups[g] || []).push(k);
  });
  const save = (k, v) => run(() => onPatch({ [k]: v }), `Saved ${k}.`).then((r) => r !== undefined);
  const reset = (k) => run(() => onPatch({ [k]: null }), `${k} now inherits from the parent.`);
  return (
    <Section title={title} description="Values flow down from parents. Override a value here or reset it to inherit again.">
      {view.available === false ? <Notice tone="warn">Unavailable: {view.unavailable_reason || "a parent is not active"}.</Notice> : null}
      {(view.runtime_blockers || []).map((b) => <Notice key={b} tone="warn">Not runnable: {b}.</Notice>)}
      {Object.entries(view.blocked || {}).map(([k, why]) => <Notice key={k} tone="warn">{k}: {why}.</Notice>)}
      {(view.conflicts || []).map((c, i) => (
        <Notice key={i} tone="warn">Policy conflict on {c.key || c.property}: {c.reason || c.message || "the inherited value is not allowed"}.</Notice>
      ))}
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      {Object.entries(groups).map(([g, keys]) => (
        <div key={g} className="mb-2">
          <h3 className="text-sm font-semibold text-cyan-300 uppercase tracking-wide mt-3">{g}</h3>
          <ul>
            {keys.map((k) => (
              <Row key={k} k={k} value={values[k]} source={sources[k]} own={own(k)} targetId={targetId} names={names}
                editable={Boolean(canEdit && overridable[k])} busy={busy}
                lockedReason={overridable[k] === false ? "set by a parent policy" : ""}
                onSave={save} onReset={reset} />
            ))}
          </ul>
        </div>
      ))}
    </Section>
  );
}
