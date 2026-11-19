/** C2–C6: Enterprises list, Enterprise, Organisation and Bot pages. The URL is
 * the selection state; permissions come from the API's effective view. */
import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ConfigPanel from "../components/ConfigPanel";
import CredentialsPanel from "../components/Credentials";
import KnowledgePanel from "../components/Knowledge";
import MembersPanel from "../components/Members";
import UsagePanel from "../components/Usage";
import { LifecycleMenu, PolicyPanel } from "../components/Lifecycle";
import { AuditList } from "./Ops";
import { Breadcrumbs, PageTitle, Tabs } from "../components/Shell";
import { DataTable, ErrorBox, Loading, Notice, Section, SelectField, StateBadge, TextField } from "../components/common";
import { useApi, useSession } from "../session";
import { availabilityText, displayValue, lifecycleState, useAction, useLoad } from "../util";

const GETTER = { enterprise: "enterprise", organisation: "organisation", bot: "bot", instance: "instance" };

/** Load an object and its effective view (which carries the caller's permissions). */
export function useNode(api, kind, id) {
  return useLoad(async () => {
    const node = await api[GETTER[kind]](id);
    const cfg = await api.config(kind, id).catch(() => null);
    return { node, cfg, perms: (cfg && cfg.permissions) || {} };
  }, [api, kind, id]);
}

function ChildList({ rows, base, empty, columns = [] }) {
  return (
    <DataTable caption="Children" rows={rows} empty={empty} columns={[
      { key: "name", label: "Name", render: (r) => <Link className="text-cyan-300 hover:underline" to={`/app/${base}/${r.id}`}>{r.name}</Link> },
      { key: "state", label: "State", render: (r) => <StateBadge state={lifecycleState(r)} /> },
      ...columns,
      { key: "available", label: "Available", render: (r) => (r.available === false ? <span title={availabilityText(r)}>No</span> : "Yes") },
    ]} />
  );
}

function CreateChild({ label, onCreate }) {
  const [name, setName] = useState("");
  const { busy, error, run } = useAction();
  return (
    <form className="max-w-sm mt-3" onSubmit={(e) => { e.preventDefault(); run(async () => { await onCreate({ name }); setName(""); }); }}>
      <ErrorBox>{error}</ErrorBox>
      <TextField label={`New ${label} name`} value={name} onChange={setName} required maxLength={100} />
      <Button size="sm" type="submit" disabled={busy || !name.trim()}>Create {label}</Button>
    </form>
  );
}

function Rename({ node, can, onSave }) {
  const [name, setName] = useState(node.name);
  const { busy, error, notice, run } = useAction();
  if (!can) return null;
  return (
    <Section title="Name">
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      <form className="max-w-sm" onSubmit={(e) => { e.preventDefault(); run(() => onSave({ name }), "Saved."); }}>
        <TextField label="Name" value={name} onChange={setName} required maxLength={100} />
        <Button size="sm" type="submit" disabled={busy || name === node.name}>Save</Button>
      </form>
    </Section>
  );
}

function Gate({ state, children }) {
  if (state.loading && !state.data) return <Loading />;
  if (state.error) return <ErrorBox error={state.error} />;
  return children(state.data);
}

export function EnterprisesPage() {
  const api = useApi();
  const { user } = useSession();
  const list = useLoad(() => api.enterprises(), [api]);
  return (
    <>
      <PageTitle sub="Choose an Enterprise to manage.">Enterprises</PageTitle>
      <Gate state={list}>{(d) => (
        <DataTable caption="Enterprises" rows={d.enterprises} empty={user && user.is_platform_superadmin
          ? "No Enterprises yet. Create one under Platform." : "You are not a member of any Enterprise yet. Ask an administrator for an invitation."}
        columns={[
          { key: "name", label: "Enterprise", render: (e) => <Link className="text-cyan-300 hover:underline" to={`/app/enterprises/${e.id}`}>{e.name}</Link> },
          { key: "slug", label: "Slug" },
          { key: "role", label: "Your role", render: (e) => e.role || (user && user.is_platform_superadmin ? "superadmin" : "—") },
          { key: "state", label: "State", render: (e) => <StateBadge state={(e.lifecycle && e.lifecycle.state) || "active"} /> },
        ]} />
      )}</Gate>
    </>
  );
}

/** Members with a role only inside an Enterprise (e.g. an Organisation admin) may not
 * read the Enterprise itself; the API lets them list their own Organisations in it. */
function LimitedEnterprise({ api, id }) {
  const orgs = useLoad(() => api.organisations(id), [api, id]);
  const list = useLoad(() => api.enterprises(), [api]);
  const ent = ((list.data && list.data.enterprises) || []).find((e) => e.id === id);
  if (orgs.loading && !orgs.data) return <Loading />;
  if (orgs.error) return <ErrorBox error={orgs.error} />;
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-slate-400 mb-4"><Link to="/app" className="hover:text-white">Enterprises</Link></nav>
      <PageTitle kind="Enterprise" sub="You have access to the Organisations below.">{ent ? ent.name : "Enterprise"}</PageTitle>
      <Section title="Your Organisations">
        <ChildList rows={orgs.data.organisations || []} base="organisations" empty="No Organisations." />
      </Section>
    </>
  );
}

export function EnterprisePage() {
  const { id } = useParams();
  const api = useApi();
  const nav = useNavigate();
  const { user } = useSession();
  const st = useNode(api, "enterprise", id);
  const orgs = useLoad(() => api.organisations(id), [api, id]);
  const pol = useLoad(() => api.policy("enterprise", id), [api, id]);
  const disc = useLoad(() => api.discordAvailability(id).catch(() => null), [api, id]);
  if (st.error && st.error.status === 404) return <LimitedEnterprise api={api} id={id} />;   // after every hook
  return (
    <Gate state={st}>{({ node, cfg, perms }) => {
      const allowed = (pol.data && pol.data.effective && pol.data.effective["knowledge.allowed_sources"]) || [];
      const approve = async (sid, on) => {
        const next = on ? [...new Set([...allowed, sid])] : allowed.filter((x) => x !== sid);
        await api.patchPolicy("enterprise", id, { "knowledge.allowed_sources": next });
        await pol.reload();
      };
      return (
        <>
          <Breadcrumbs api={api} node={node} kind="enterprise" />
          <PageTitle kind="Enterprise" sub={availabilityText(node)}>{node.name}</PageTitle>
          <Tabs tabs={[
            ["orgs", "Organisations", () => (
              <Section title="Organisations">
                <ErrorBox error={orgs.error} />
                <ChildList rows={(orgs.data && orgs.data.organisations) || []} base="organisations" empty="No Organisations yet." />
                {perms.create_child ? <CreateChild label="Organisation" onCreate={async (b) => { await api.createOrganisation(id, b); await orgs.reload(); }} /> : null}
              </Section>
            )],
            ["defaults", "Defaults", () => (
              <ConfigPanel view={cfg} targetId={id} canEdit={perms.edit_config} title="Enterprise defaults"
                onPatch={async (c) => { await api.patchConfig("enterprise", id, c); await st.reload(); }} />
            )],
            ["policy", "Policy", () => (pol.data ? (
              <PolicyPanel view={pol.data} targetId={id} canEdit={perms.edit_policy}
                onPatch={async (c) => { await api.patchPolicy("enterprise", id, c); await pol.reload(); }} />) : <ErrorBox error={pol.error} />)],
            ["members", "Members", () => <MembersPanel api={api} type="enterprise" scopeId={id} enterpriseId={id} canManage={perms.manage_members} />],
            ["credentials", "Credentials", () => <CredentialsPanel api={api} type="enterprise" ownerId={id} canManage={perms.manage_credentials} />],
            ["knowledge", "Knowledge", () => (
              <KnowledgePanel api={api} type="enterprise" ownerId={id} canManage={perms.edit_config}
                approved={allowed} canApprove={perms.edit_policy} onApprove={approve} />
            )],
            ["discord", "Discord", () => (
              <Section title="Enterprise Discord application"
                description="One Discord application per Enterprise. Only a platform superadmin can create, configure or control it. Organisations use it to connect their bot instances.">
                {disc.data ? (
                  disc.data.configured ? <Notice tone={disc.data.available ? "ok" : "warn"}>{disc.data.available ? "Configured and available to Organisations." : "Configured, but currently disabled."}</Notice>
                    : <Notice tone="warn">The Enterprise Discord application is not configured yet. A platform superadmin must set it up before Discord instances can be connected.</Notice>
                ) : <ErrorBox error={disc.error} />}
                {user && user.is_platform_superadmin ? <Link className="text-cyan-300 hover:underline text-sm" to={`/app/platform/enterprises/${id}/discord`}>Configure (platform superadmin)</Link> : null}
              </Section>
            )],
            ["usage", "Usage", () => <UsagePanel api={api} type="enterprise" id={id} />],
            ["audit", "Audit", () => <AuditList api={api} enterpriseId={id} />],
            ["settings", "Lifecycle", () => (
              <>
                <Rename node={node} can={perms.edit_config} onSave={async (b) => { await api.patchEnterprise(id, b); await st.reload(); }} />
                <LifecycleMenu api={api} type="enterprise" node={node} permissions={perms} onChanged={st.reload} onDeleted={() => {}} />
                {lifecycleState(node) === "deleted" ? <Button onClick={() => nav("/app")}>Back</Button> : null}
              </>
            )],
          ]} />
        </>
      );
    }}</Gate>
  );
}

export function OrganisationPage() {
  const { id } = useParams();
  const api = useApi();
  const st = useNode(api, "organisation", id);
  const bots = useLoad(() => api.bots(id), [api, id]);
  const pol = useLoad(() => api.policy("organisation", id), [api, id]);
  return (
    <Gate state={st}>{({ node, cfg, perms }) => (
      <>
        <Breadcrumbs api={api} node={node} kind="organisation" />
        <PageTitle kind="Organisation" sub={availabilityText(node)}>{node.name}</PageTitle>
        <Tabs tabs={[
          ["bots", "Bots", () => (
            <Section title="Bots">
              <ErrorBox error={bots.error} />
              <ChildList rows={(bots.data && bots.data.bots) || []} base="bots" empty="No bots yet." />
              {perms.create_child ? <CreateChild label="bot" onCreate={async (b) => { await api.createBot(id, b); await bots.reload(); }} /> : null}
            </Section>
          )],
          ["defaults", "Defaults", () => (
            <ConfigPanel view={cfg} targetId={id} canEdit={perms.edit_config} title="Organisation defaults"
              onPatch={async (c) => { await api.patchConfig("organisation", id, c); await st.reload(); }} />
          )],
          ["policy", "Policy", () => (pol.data ? (
            <PolicyPanel view={pol.data} targetId={id} canEdit={perms.edit_policy}
              onPatch={async (c) => { await api.patchPolicy("organisation", id, c); await pol.reload(); }} />) : <ErrorBox error={pol.error} />)],
          ["members", "Members", () => <MembersPanel api={api} type="organisation" scopeId={id} enterpriseId={node.enterprise_id} canManage={perms.manage_members} />],
          ["credentials", "Credentials", () => <CredentialsPanel api={api} type="organisation" ownerId={id} canManage={perms.manage_credentials} />],
          ["knowledge", "Knowledge", () => (
            <KnowledgePanel api={api} type="organisation" ownerId={id} canManage={perms.edit_config}
              approved={(pol.data && pol.data.effective && pol.data.effective["knowledge.allowed_sources"]) || []} />
          )],
          ["usage", "Usage", () => <UsagePanel api={api} type="organisation" id={id} />],
          ["settings", "Lifecycle", () => (
            <>
              <Rename node={node} can={perms.edit_config} onSave={async (b) => { await api.patchOrganisation(id, b); await st.reload(); }} />
              <LifecycleMenu api={api} type="organisation" node={node} permissions={perms} onChanged={st.reload} />
            </>
          )],
        ]} />
      </>
    )}</Gate>
  );
}

function BotLogo({ api, bot, can, onChanged }) {
  const { busy, error, notice, run } = useAction();
  const [file, setFile] = useState(null);
  return (
    <Section title="Logo" description="Shown in the webchat widget. PNG, JPEG, GIF or WebP up to 256 KB; the server checks the file itself.">
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      <p className="text-sm text-slate-300 mb-2">{bot.logo ? `Logo set (${bot.logo.content_type || "image"}).` : "No logo."}</p>
      {can ? (
        <form className="flex flex-wrap gap-2 items-end" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.putLogo(bot.id, file); await onChanged(); }, "Logo updated."); }}>
          <div>
            <label htmlFor="logo-file" className="text-xs text-slate-400 block">Logo file</label>
            <input id="logo-file" type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(e) => setFile(e.target.files[0] || null)} />
          </div>
          <Button size="sm" type="submit" disabled={busy || !file || file.size > 256 * 1024}>Upload</Button>
          {bot.logo ? <Button size="sm" variant="ghost" type="button" onClick={() => run(async () => { await api.deleteLogo(bot.id); await onChanged(); }, "Logo removed.")}>Remove</Button> : null}
        </form>
      ) : null}
    </Section>
  );
}

function CreateInstance({ api, botId, onCreated }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("webchat");
  const [cred, setCred] = useState("");
  const { busy, error, run } = useAction();
  return (
    <form className="max-w-sm mt-3" onSubmit={(e) => { e.preventDefault(); run(async () => {
      const channel = type === "telegram" ? { type, credential_id: cred.trim() } : { type };
      await api.createInstance(botId, { name, channel }); setName(""); await onCreated();
    }); }}>
      <h3 className="text-sm font-semibold mb-2">New instance</h3>
      <ErrorBox>{error}</ErrorBox>
      <TextField label="Name" value={name} onChange={setName} required maxLength={100} />
      <SelectField label="Channel" value={type} onChange={setType} options={[["webchat", "Webchat"], ["telegram", "Telegram"], ["discord", "Discord"]]} />
      {type === "telegram" ? <TextField label="Telegram credential id" value={cred} onChange={setCred} required
        hint="A Telegram bot token stored as an Organisation or Enterprise credential you may use." /> : null}
      {type === "discord" ? <p className="text-xs text-slate-400 mb-2">After creating it, connect it to a Discord server with the Enterprise Discord application.</p> : null}
      <Button size="sm" type="submit" disabled={busy || !name.trim()}>Create instance</Button>
    </form>
  );
}

export function BotPage() {
  const { id } = useParams();
  const api = useApi();
  const st = useNode(api, "bot", id);
  const inst = useLoad(() => api.instances(id), [api, id]);
  const integ = useLoad(() => api.integrations(id), [api, id]);
  const [zname, setZname] = useState("");
  const z = useAction();
  return (
    <Gate state={st}>{({ node, cfg, perms }) => (
      <>
        <Breadcrumbs api={api} node={node} kind="bot" />
        <PageTitle kind="Bot" sub={availabilityText(node)}>{node.name}</PageTitle>
        <Tabs tabs={[
          ["instances", "Instances", () => (
            <Section title="Bot instances" description="Discord, Telegram and Webchat connections of this bot.">
              <ErrorBox error={inst.error} />
              <ChildList rows={(inst.data && inst.data.instances) || []} base="instances" empty="No instances yet."
                columns={[{ key: "channel", label: "Channel", render: (r) => (r.channel && r.channel.type) || "—" }]} />
              {perms.create_child ? <CreateInstance api={api} botId={id} onCreated={inst.reload} /> : null}
            </Section>
          )],
          ["behaviour", "Behaviour", () => (
            <ConfigPanel view={cfg} targetId={id} canEdit={perms.edit_config} title="Behaviour and AI"
              onPatch={async (c) => { await api.patchConfig("bot", id, c); await st.reload(); }} />
          )],
          ["integrations", "Integrations", () => (
            <Section title="Integrations" description="Zendesk is a Bot Integration (not an instance). BitBotPro never creates Zendesk tickets.">
              <ErrorBox error={integ.error} />
              <ErrorBox>{z.error}</ErrorBox>
              <DataTable caption="Integrations" rows={(integ.data && integ.data.integrations) || []} empty="No integrations." columns={[
                { key: "name", label: "Name", render: (r) => <Link className="text-cyan-300 hover:underline" to={`/app/integrations/${r.id}`}>{r.name}</Link> },
                { key: "type", label: "Type" },
                { key: "status", label: "Status", render: (r) => <StateBadge state={r.deletion ? "deleting" : r.status} /> },
                { key: "connection", label: "Connection", render: (r) => (r.connection && r.connection.status) || "—" },
              ]} />
              {perms.create_child ? (
                <form className="max-w-sm mt-3" onSubmit={(e) => { e.preventDefault(); z.run(async () => { await api.createIntegration(id, { type: "zendesk", name: zname }); setZname(""); await integ.reload(); }); }}>
                  <TextField label="New Zendesk integration name" value={zname} onChange={setZname} required maxLength={100} />
                  <Button size="sm" type="submit" disabled={z.busy || !zname.trim()}>Add Zendesk integration</Button>
                </form>
              ) : null}
            </Section>
          )],
          ["credentials", "Credentials", () => (
            <Section title="Credentials" description="Credentials are owned by the Enterprise or an Organisation and are used here by reference only; secrets are never inherited or shown. Select the AI credential under Behaviour (ai.credential_id).">
              <DataTable caption="Credentials referenced by this bot" rows={Object.entries((cfg && cfg.credentials) || {}).map(([k, v]) => ({ key: k, v }))}
                empty="No credential is referenced by this bot's configuration yet." columns={[
                  { key: "key", label: "Credential" }, { key: "v", label: "Details", render: (r) => displayValue(r.v) }]} />
            </Section>
          )],
          ["members", "Members", () => <MembersPanel api={api} type="bot" scopeId={id} enterpriseId={node.enterprise_id} canManage={perms.manage_members} />],
          ["usage", "Usage", () => <UsagePanel api={api} type="bot" id={id} />],
          ["settings", "Logo & lifecycle", () => (
            <>
              <Rename node={node} can={perms.edit_config} onSave={async (b) => { await api.patchBot(id, b); await st.reload(); }} />
              <BotLogo api={api} bot={node} can={perms.edit_config} onChanged={st.reload} />
              <LifecycleMenu api={api} type="bot" node={node} permissions={perms} onChanged={st.reload} />
            </>
          )],
        ]} />
      </>
    )}</Gate>
  );
}
