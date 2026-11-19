/**
 * Platform superadmin pages (C3). Platform credentials (the Zendesk OAuth
 * client) and every Enterprise Discord application are managed only here.
 *
 * D-Q14 — ONE DISCORD APPLICATION PER ENTERPRISE. ONLY THE PLATFORM
 * SUPERADMIN CREATES, CONFIGURES AND CONTROLS THAT APPLICATION.
 * Secret inputs are write-only; the API returns fingerprints only.
 */
import React, { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Breadcrumbs, PageTitle, Tabs } from "../components/Shell";
import { ConfirmButton, DataTable, ErrorBox, KeyValues, Loading, Notice, Section, StateBadge, TextField } from "../components/common";
import { AuditList, WorkersPanel } from "./Ops";
import { useApi, useSession } from "../session";
import { fmtDate, useAction, useLoad } from "../util";

export function RequireSuperadmin({ children }) {
  const { user } = useSession();
  if (!user || !user.is_platform_superadmin) return <Navigate to="/app" replace />;
  return children;
}

function EnterprisesTab({ api }) {
  const list = useLoad(() => api.enterprises(), [api]);
  const [f, setF] = useState({ name: "", slug: "", plan: "free", owner_user_id: "" });
  const { busy, error, notice, run } = useAction();
  return (
    <Section title="Enterprises">
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      {list.loading ? <Loading /> : <ErrorBox error={list.error} />}
      <DataTable caption="All Enterprises" rows={(list.data && list.data.enterprises) || []} empty="No Enterprises." columns={[
        { key: "name", label: "Enterprise", render: (e) => <Link className="text-cyan-300 hover:underline" to={`/app/enterprises/${e.id}`}>{e.name}</Link> },
        { key: "slug", label: "Slug" },
        { key: "state", label: "State", render: (e) => <StateBadge state={(e.lifecycle && e.lifecycle.state) || "active"} /> },
        { key: "discord", label: "Discord application", render: (e) => <Link className="text-cyan-300 hover:underline" to={`/app/platform/enterprises/${e.id}/discord`}>Manage</Link> },
      ]} />
      <form className="max-w-md mt-4" onSubmit={(e) => { e.preventDefault(); run(async () => {
        const body = { name: f.name, slug: f.slug, plan: f.plan };
        if (f.owner_user_id.trim()) body.owner_user_id = f.owner_user_id.trim();
        await api.createEnterprise(body); setF({ name: "", slug: "", plan: "free", owner_user_id: "" }); await list.reload();
      }, "Enterprise created."); }}>
        <h3 className="text-sm font-semibold mb-2">Create an Enterprise</h3>
        <TextField label="Name" value={f.name} onChange={(v) => setF({ ...f, name: v })} required />
        <TextField label="Slug" value={f.slug} onChange={(v) => setF({ ...f, slug: v })} required hint="Lowercase letters, digits and hyphens." />
        <TextField label="Plan" value={f.plan} onChange={(v) => setF({ ...f, plan: v })} />
        <TextField label="Owner user id (optional)" value={f.owner_user_id} onChange={(v) => setF({ ...f, owner_user_id: v })} hint="Defaults to you." />
        <Button size="sm" type="submit" disabled={busy || !f.name || !f.slug}>Create Enterprise</Button>
      </form>
    </Section>
  );
}

function PlatformCredentialsTab({ api }) {
  const list = useLoad(() => api.platformCredentials(), [api]);
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const { busy, error, notice, run } = useAction();
  const zd = ((list.data && list.data.credentials) || []).find((c) => c.kind === "zendesk_oauth_client");
  return (
    <Section title="Platform credentials" description="Platform-owned. Tenant users can never see or manage these.">
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      {list.loading ? <Loading /> : <ErrorBox error={list.error} />}
      <h3 className="text-sm font-semibold mb-1">Zendesk OAuth client</h3>
      {zd ? (
        <KeyValues rows={[["Status", <StateBadge key="s" state={zd.status} />], ["Client id", (zd.metadata && zd.metadata.client_id) || "—"],
          ["Fingerprint", <code key="f" className="text-xs">{zd.fingerprint}</code>], ["Rotated", fmtDate(zd.rotated_at)]]} />
      ) : <p className="text-sm text-slate-400">Not configured. Organisations can still connect Zendesk with API tokens.</p>}
      <form className="max-w-md mt-3" autoComplete="off" onSubmit={(e) => { e.preventDefault(); run(async () => {
        await api.putPlatformCredential("zendesk_oauth_client", { secret, metadata: { client_id: clientId } }); setSecret(""); await list.reload();
      }, "Zendesk OAuth client saved."); setSecret(""); }}>
        <TextField label="Client id (unique identifier)" value={clientId} onChange={setClientId} required />
        <TextField label="Client secret" type="password" autoComplete="new-password" value={secret} onChange={setSecret} required hint="Write-only." />
        <Button size="sm" type="submit" disabled={busy || !clientId || !secret}>{zd ? "Replace" : "Save"}</Button>
      </form>
      {zd && zd.status === "active" ? (
        <div className="mt-2"><ConfirmButton confirmLabel="Revoke" onConfirm={() => run(async () => { await api.revokePlatformCredential("zendesk_oauth_client"); await list.reload(); }, "Revoked.")}>Revoke client</ConfirmButton></div>
      ) : null}
    </Section>
  );
}

function UsersTab({ api }) {
  const [q, setQ] = useState("");
  const [pages, setPages] = useState([null]);           // cursor stack for previous/next
  const cursor = pages[pages.length - 1];
  const list = useLoad(() => api.platformUsers(q.trim().toLowerCase(), cursor || undefined, 25), [api, q, cursor]);
  const [target, setTarget] = useState(null);
  const [preview, setPreview] = useState(null);
  const [email, setEmail] = useState("");
  const { busy, error, notice, run } = useAction();
  const rows = (list.data && list.data.users) || [];
  return (
    <Section title="Users" description="Search by e-mail prefix. The last platform superadmin cannot lose the role or be deleted.">
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      <TextField label="Search users by e-mail" value={q} onChange={(v) => { setQ(v); setPages([null]); }} autoComplete="off" />
      {list.loading && !list.data ? <Loading /> : <ErrorBox error={list.error} />}
      <DataTable caption="Users" rows={rows} empty="No users match." columns={[
        { key: "email", label: "E-mail" }, { key: "name", label: "Name", render: (u) => u.name || "—" },
        { key: "status", label: "Status", render: (u) => <StateBadge state={u.status} /> },
        { key: "sa", label: "Superadmin", render: (u) => (u.is_platform_superadmin ? "Yes" : "No") },
        { key: "x", label: "", render: (u) => (
          <span className="flex flex-wrap gap-1">
            {u.is_platform_superadmin
              ? <ConfirmButton confirmLabel="Revoke superadmin" onConfirm={() => run(async () => { await api.setSuperadmin(u.id, false); await list.reload(); }, "Superadmin revoked.")}>Revoke superadmin</ConfirmButton>
              : <Button size="sm" variant="outline" type="button" onClick={() => run(async () => { await api.setSuperadmin(u.id, true); await list.reload(); }, "Superadmin granted.")}>Grant superadmin</Button>}
            <Button size="sm" variant="ghost" type="button" onClick={() => run(async () => { setTarget(u); setEmail(""); setPreview(await api.userDeletionPreview(u.id)); })}>Delete…</Button>
          </span>) },
      ]} />
      <div className="flex gap-2 mt-2">
        <Button size="sm" variant="outline" type="button" disabled={pages.length < 2} onClick={() => setPages(pages.slice(0, -1))}>Previous</Button>
        <Button size="sm" variant="outline" type="button" disabled={!(list.data && list.data.next)} onClick={() => setPages([...pages, list.data.next])}>Next</Button>
      </div>
      {preview && target ? (
        <form className="max-w-md mt-3" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.deleteUser(target.id, preview.preview_token, email); setPreview(null); setTarget(null); await list.reload(); }, "User deleted."); }}>
          <p className="text-sm text-slate-300 mb-2">Deleting {target.email} removes the account and its memberships ({Object.entries(preview.counts || {}).map(([k, v]) => `${k}: ${v}`).join(", ")}).</p>
          <TextField label="Type the user's e-mail address to confirm" value={email} onChange={setEmail} autoComplete="off" />
          <span className="flex gap-2">
            <Button size="sm" variant="destructive" type="submit" disabled={busy || email.trim().toLowerCase() !== target.email}>Delete user</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => { setPreview(null); setTarget(null); }}>Cancel</Button>
          </span>
        </form>
      ) : null}
    </Section>
  );
}

export function PlatformPage() {
  const api = useApi();
  return (
    <RequireSuperadmin>
      <PageTitle kind="Platform" sub="Platform superadmin">Platform administration</PageTitle>
      <Tabs tabs={[
        ["ent", "Enterprises", () => <EnterprisesTab api={api} />],
        ["cred", "Platform credentials", () => <PlatformCredentialsTab api={api} />],
        ["ops", "Operations", () => <WorkersPanel api={api} />],
        ["audit", "Audit", () => <AuditList api={api} />],
        ["users", "Users", () => <UsersTab api={api} />],
      ]} />
    </RequireSuperadmin>
  );
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("The file could not be read."));
    r.readAsDataURL(file);
  });
}

export function DiscordAppPage() {
  const { id } = useParams();
  const api = useApi();
  const ent = useLoad(() => api.enterprise(id), [api, id]);
  const app = useLoad(() => api.discordApp(id), [api, id]);
  const [f, setF] = useState({ application_id: "", bot_token: "", client_secret: "", permissions: "", intents: "" });
  const [tok, setTok] = useState("");
  const [sec, setSec] = useState("");
  const [avatar, setAvatar] = useState(null);
  const { busy, error, notice, run } = useAction();
  const a = app.data || {};
  const save = (e) => {
    e.preventDefault();
    run(async () => {
      const body = { application_id: f.application_id || a.application_id };
      if (f.bot_token) body.bot_token = f.bot_token;
      if (f.client_secret) body.client_secret = f.client_secret;
      if (f.permissions !== "") body.permissions = Number(f.permissions);
      if (f.intents !== "") body.intents = Number(f.intents);
      await api.putDiscordApp(id, body);
      setF({ application_id: "", bot_token: "", client_secret: "", permissions: "", intents: "" });
      await app.reload();
    }, "Discord application saved.");
    setF((x) => ({ ...x, bot_token: "", client_secret: "" }));
  };
  return (
    <RequireSuperadmin>
      {ent.data ? <Breadcrumbs api={api} node={ent.data} kind="enterprise" /> : null}
      <PageTitle kind="Enterprise Discord application" sub="One Discord application per Enterprise, shared by all its Organisations. Only platform superadmins can change it.">
        {ent.data ? ent.data.name : "…"}
      </PageTitle>
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      {app.loading ? <Loading /> : <ErrorBox error={app.error} />}
      <Section title="Status">
        {a.configured ? (
          <KeyValues rows={[
            ["Application id", a.application_id], ["Bot user", `${a.bot_username || "—"} (${a.bot_user_id || "—"})`],
            ["Status", <StateBadge key="s" state={a.status} />], ["Token", <code key="t" className="text-xs">{a.token_fingerprint}</code>],
            ["Client secret", <code key="c" className="text-xs">{a.client_secret_fingerprint}</code>],
            ["Permissions / intents", `${a.permissions} / ${a.intents}`], ["OAuth redirect URI", a.redirect_uri], ["OAuth scopes", a.oauth_scopes],
            ["Gateway", `${(a.gateway && a.gateway.state) || "—"} (desired: ${a.gateway_desired})${a.gateway && a.gateway.last_error ? ` — ${a.gateway.last_error}` : ""}`],
          ]} />
        ) : <Notice tone="warn">Not configured. Organisations in this Enterprise cannot connect Discord instances until it is.</Notice>}
      </Section>
      <Tabs tabs={[
        ["setup", a.configured ? "Settings" : "Set up", () => (
          <Section title={a.configured ? "Application settings" : "Set up the Discord application"}
            description="Create the application in the Discord developer portal, add the redirect URI above, then enter its id and secrets here.">
            <form className="max-w-md" autoComplete="off" onSubmit={save}>
              <TextField label="Application id" value={f.application_id} onChange={(v) => setF({ ...f, application_id: v })} placeholder={a.application_id || ""} required={!a.configured} inputMode="numeric" />
              {!a.configured ? (
                <>
                  <TextField label="Bot token" type="password" autoComplete="new-password" value={f.bot_token} onChange={(v) => setF({ ...f, bot_token: v })} required hint="Write-only." />
                  <TextField label="Client secret" type="password" autoComplete="new-password" value={f.client_secret} onChange={(v) => setF({ ...f, client_secret: v })} required hint="Write-only." />
                </>
              ) : null}
              <TextField label="OAuth permissions (integer)" value={f.permissions} onChange={(v) => setF({ ...f, permissions: v })} placeholder={String(a.permissions ?? "")} inputMode="numeric" />
              <TextField label="Gateway intents (integer)" value={f.intents} onChange={(v) => setF({ ...f, intents: v })} placeholder={String(a.intents ?? "")} inputMode="numeric" />
              <Button size="sm" type="submit" disabled={busy}>Save</Button>
            </form>
          </Section>
        )],
        a.configured ? ["rotate", "Rotate secrets", () => (
          <Section title="Rotate secrets" description="The new token must belong to the same application.">
            <form className="flex flex-wrap gap-2 items-end" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.discordAppRotateToken(id, tok); setTok(""); await app.reload(); }, "Bot token rotated."); setTok(""); }}>
              <TextField label="New bot token" type="password" autoComplete="new-password" value={tok} onChange={setTok} />
              <Button size="sm" type="submit" disabled={busy || !tok}>Rotate token</Button>
            </form>
            <form className="flex flex-wrap gap-2 items-end" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.discordAppRotateSecret(id, sec); setSec(""); await app.reload(); }, "Client secret rotated."); setSec(""); }}>
              <TextField label="New client secret" type="password" autoComplete="new-password" value={sec} onChange={setSec} />
              <Button size="sm" type="submit" disabled={busy || !sec}>Rotate secret</Button>
            </form>
          </Section>
        )] : null,
        a.configured ? ["control", "Gateway & availability", () => (
          <Section title="Gateway and availability">
            <div className="flex flex-wrap gap-2">
              {a.status === "enabled"
                ? <ConfirmButton confirmLabel="Disable" onConfirm={() => run(async () => { await api.discordAppDisable(id); await app.reload(); }, "Disabled for all Organisations.")}>Disable application</ConfirmButton>
                : <Button size="sm" type="button" onClick={() => run(async () => { await api.discordAppEnable(id); await app.reload(); }, "Enabled.")}>Enable application</Button>}
              {["start", "stop", "restart"].map((op) => (
                <Button key={op} size="sm" variant="outline" type="button" disabled={busy} onClick={() => run(async () => { await api.discordAppGateway(id, op); await app.reload(); }, `Gateway ${op} requested.`)}>
                  {op[0].toUpperCase() + op.slice(1)} gateway</Button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">The gateway runs in the worker; its state updates after the worker acts on the request.</p>
          </Section>
        )] : null,
        a.configured ? ["avatar", "Avatar", () => (
          <Section title="Bot avatar" description="PNG, JPEG or GIF.">
            <form className="flex flex-wrap gap-2 items-end" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.discordAppAvatar(id, await readAsDataUrl(avatar)); }, "Avatar updated."); }}>
              <div>
                <label htmlFor="avatar" className="text-xs text-slate-400 block">Image</label>
                <input id="avatar" type="file" accept="image/png,image/jpeg,image/gif" onChange={(e) => setAvatar(e.target.files[0] || null)} />
              </div>
              <Button size="sm" type="submit" disabled={busy || !avatar}>Upload avatar</Button>
            </form>
          </Section>
        )] : null,
      ]} />
    </RequireSuperadmin>
  );
}
