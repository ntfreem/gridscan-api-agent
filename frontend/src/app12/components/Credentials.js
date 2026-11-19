/** CredentialsPanel (C4–C6). Secrets are write-only: inputs are cleared after
 * submission and the API only ever returns fingerprints. Use and management
 * are separate permissions; the server enforces both. */
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton, DataTable, ErrorBox, Loading, Notice, Section, SelectField, StateBadge, TextField } from "./common";
import { PROVIDERS, fmtDate, useAction, useLoad } from "../util";

export const TESTABLE = new Set(["telegram_bot", "anthropic", "openai", "zendesk_api_token", "zendesk_oauth"]);

/** Sanitised result of a credential test (Phase 6A F4): never provider text. */
export function testMessage(r) {
  if (!r) return "No result.";
  if (r.ok) return r.bot_username ? `Works: Telegram bot @${r.bot_username}.` : "Works: the provider accepted this credential.";
  return { unauthorized: "Rejected: the provider did not accept this credential.", rate_limited: "The provider is rate-limiting requests; try again later.",
    unavailable: "The provider could not be reached; try again later." }[r.category] || "The provider did not accept this credential.";
}

export function parseScope(text) {
  return String(text || "").split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
    const [level, id] = s.split(":").map((x) => (x || "").trim());
    if (!["organisation", "bot"].includes(level) || !id) throw new Error("Use organisation:<id> or bot:<id>, separated by commas.");
    return { level, id };
  });
}

function RotateForm({ api, cred, onDone, run, busy }) {
  const [secret, setSecret] = useState("");
  return (
    <form className="flex gap-1 items-end" onSubmit={(e) => { e.preventDefault(); run(async () => {
      await api.patchCredential(cred.id, { secret }); setSecret(""); await onDone(); }, "Secret replaced."); }}>
      <label className="sr-only" htmlFor={`rot-${cred.id}`}>New secret for {cred.name}</label>
      <input id={`rot-${cred.id}`} type="password" autoComplete="new-password" placeholder="New secret" value={secret}
        onChange={(e) => setSecret(e.target.value)} className="rounded border border-white/15 bg-[#050B14] px-2 py-1 text-xs text-white w-36" />
      <Button size="sm" variant="outline" type="submit" disabled={busy || !secret}>Rotate</Button>
    </form>
  );
}

export default function CredentialsPanel({ api, type, ownerId, canManage }) {
  const list = useLoad(() => api.credentials(type, ownerId), [api, type, ownerId]);
  const { busy, error, notice, run } = useAction();
  const [provider, setProvider] = useState("anthropic");
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [sub, setSub] = useState("");
  const [email, setEmail] = useState("");
  const [scope, setScope] = useState("");
  const create = (e) => {
    e.preventDefault();
    run(async () => {
      const metadata = provider === "zendesk_api_token" ? { subdomain: sub, email } : {};
      await api.createCredential(type, ownerId, { provider, name, secret, metadata, usable_by: parseScope(scope) });
      setSecret(""); setName(""); setScope("");
      await list.reload();
    }, "Credential saved. The secret is encrypted and cannot be displayed again.");
    setSecret("");
  };
  return (
    <Section title="Credentials" description="Secrets are encrypted and never shown again. Children use credentials by reference; they never inherit raw secrets.">
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      {list.loading ? <Loading /> : <ErrorBox error={list.error} />}
      <DataTable caption="Credentials" rows={(list.data && list.data.credentials) || []} columns={[
        { key: "name", label: "Name" },
        { key: "provider", label: "Provider" },
        { key: "fingerprint", label: "Fingerprint", render: (c) => <code className="text-xs">{c.fingerprint}</code> },
        { key: "status", label: "Status", render: (c) => <StateBadge state={c.status} /> },
        { key: "usable_by", label: "Usable by", render: (c) => (c.usable_by || []).length ? c.usable_by.map((u) => `${u.level}:${u.id.slice(0, 8)}…`).join(", ") : "Whole owner scope" },
        { key: "rotated_at", label: "Rotated", render: (c) => fmtDate(c.rotated_at) },
        { key: "x", label: "", render: (c) => canManage && c.status === "active" ? (
          <span className="flex flex-wrap gap-1">
            <RotateForm api={api} cred={c} onDone={list.reload} run={run} busy={busy} />
            {TESTABLE.has(c.provider) ? (
              <Button size="sm" variant="ghost" type="button" onClick={() => run(() => api.testCredential(c.id), testMessage)}>Test</Button>
            ) : null}
            <ConfirmButton confirmLabel="Revoke" onConfirm={() => run(async () => { await api.revokeCredential(c.id); await list.reload(); }, "Credential revoked.")}>Revoke</ConfirmButton>
          </span>) : canManage ? (
          <ConfirmButton confirmLabel="Delete" onConfirm={() => run(async () => { await api.deleteCredential(c.id); await list.reload(); }, "Credential deleted.")}>Delete</ConfirmButton>
        ) : null },
      ]} empty="No credentials at this level." />
      {canManage ? (
        <form onSubmit={create} className="mt-4 max-w-md" autoComplete="off">
          <h3 className="text-sm font-semibold mb-2">Add a credential</h3>
          <SelectField label="Provider" value={provider} onChange={setProvider} options={PROVIDERS} />
          <TextField label="Name" value={name} onChange={setName} required maxLength={100} />
          <TextField label="Secret" type="password" autoComplete="new-password" value={secret} onChange={setSecret} required
            hint="Write-only. Stored encrypted; only a fingerprint is shown." />
          {provider === "zendesk_api_token" ? (
            <>
              <TextField label="Zendesk subdomain" value={sub} onChange={setSub} required hint="For acme.zendesk.com enter acme." />
              <TextField label="Agent email" type="email" value={email} onChange={setEmail} required />
            </>
          ) : null}
          {type === "enterprise" || type === "organisation" ? (
            <TextField label="Restrict use (optional)" value={scope} onChange={setScope}
              hint="Empty: usable anywhere below this owner. Otherwise organisation:<id> or bot:<id>, comma-separated." />
          ) : null}
          <Button size="sm" type="submit" disabled={busy || !name || !secret}>Save credential</Button>
        </form>
      ) : null}
    </Section>
  );
}
