/**
 * Bot Instance page (C7–C9). Discord, Telegram and Webchat are channels of a
 * Bot Instance.
 *
 * D-Q14: ONE DISCORD APPLICATION PER ENTERPRISE. Only a platform superadmin
 * configures it. This page lets Organisation admins invite and connect their
 * instance with it; it has NO application controls (no token, secret,
 * gateway, avatar, permissions or intents).
 */
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ConfigPanel from "../components/ConfigPanel";
import { LifecycleMenu } from "../components/Lifecycle";
import { Breadcrumbs, PageTitle, Tabs } from "../components/Shell";
import { CheckField, ConfirmButton, DataTable, ErrorBox, KeyValues, Loading, Notice, Section, SelectField, StateBadge, TextField } from "../components/common";
import { DeliveriesPanel } from "./Ops";
import UsagePanel from "../components/Usage";
import { useApi } from "../session";
import { availabilityText, fmtDate, useAction, useLoad } from "../util";
import { useNode } from "./Hierarchy";

const LISTEN = [["mention_only", "Only when mentioned"], ["all_channels", "All channels it can see"], ["specific_channels", "Selected channels"]];

export function DiscordPanel({ api, instance, perms, onChanged }) {
  const id = instance.id;
  const ch = instance.channel || {};
  const status = useLoad(() => api.channelStatus(id), [api, id]);
  const avail = useLoad(() => api.discordAvailability(instance.enterprise_id), [api, instance.enterprise_id]);
  const channels = useLoad(() => (ch.guild_id ? api.discordChannels(id) : Promise.resolve(null)), [api, id, ch.guild_id]);
  const links = useLoad(() => (perms.manage_channel ? api.discordShareLinks(id) : Promise.resolve({ share_links: [] })), [api, id, perms.manage_channel]);
  const handoffs = useLoad(() => (ch.guild_id ? api.discordHandoffs(id) : Promise.resolve({ handoffs: [] })), [api, id, ch.guild_id]);
  const { busy, error, notice, run } = useAction();
  const [s, setS] = useState({
    listen_mode: ch.listen_mode || "mention_only", channel_ids: ch.channel_ids || [], reply_style: ch.reply_style || "natural",
    mention_overrides_channels: ch.mention_overrides_channels !== false, passive_mode: Boolean(ch.passive_mode),
    staff_role_name: ch.staff_role_name || "", handoff_cooldown_minutes: ch.handoff_cooldown_minutes ?? 15,
    handoff_followup_message: ch.handoff_followup_message || "", dm_enabled: Boolean(ch.dm_enabled),
  });
  const [nick, setNick] = useState("");
  const [shareGuild, setShareGuild] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [newLink, setNewLink] = useState("");
  const [hoChannel, setHoChannel] = useState("");
  const [hoMinutes, setHoMinutes] = useState(30);
  const app = (avail.data || (status.data && status.data.application)) || {};
  const can = perms.manage_channel;
  const reload = async () => { await Promise.all([status.reload(), channels.reload(), onChanged()]); };

  if (avail.loading || status.loading) return <Loading />;
  if (!app.configured) {
    return (
      <Section title="Discord">
        <Notice tone="warn">The Enterprise Discord application is not configured yet. A platform superadmin must set it up before this instance can be connected. Contact your platform administrator.</Notice>
      </Section>
    );
  }
  const st = status.data || {};
  const chans = (channels.data && channels.data.channels) || [];
  return (
    <>
      <Section title="Discord connection" description="Uses your Enterprise's Discord application. Only a platform superadmin can change the application itself.">
        {!app.available ? <Notice tone="warn">The Enterprise Discord application is currently disabled by the platform superadmin.</Notice> : null}
        <ErrorBox>{error}</ErrorBox>
        <Notice tone="ok">{notice}</Notice>
        <KeyValues rows={[
          ["Status", st.connected ? <StateBadge state="connected" /> : <StateBadge state="not connected" />],
          ["Server (guild) id", st.guild_id || "—"],
          ["Gateway", (st.gateway && st.gateway.state) || "—"],
          st.pending_channel_selection ? ["Action needed", "This server is shared: choose the channels this instance uses (pending selections expire after 30 minutes)."] : null,
        ]} />
        {can ? (
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" type="button" disabled={busy || !app.available} onClick={() => run(async () => {
              const r = await api.discordInstallUrl(id);
              window.open(r.url, "_blank", "noopener,noreferrer");
            }, "Discord opened in a new tab. Choose your server and approve; you will return to BitBotPro.")}>
              {st.connected ? "Reconnect / change server" : "Add to Discord server"}</Button>
            <Button size="sm" variant="outline" type="button" disabled={busy || !st.connected} onClick={() => run(() => api.channelTest(id), "Test message sent.")}>Send test</Button>
            {st.connected ? <ConfirmButton confirmLabel="Disconnect" onConfirm={() => run(async () => { await api.channelDisconnect(id); await reload(); }, "Disconnected.")}>Disconnect</ConfirmButton> : null}
          </div>
        ) : null}
      </Section>

      {ch.guild_id ? (
        <Section title="Listening and replies">
          <form onSubmit={(e) => { e.preventDefault(); run(async () => { await api.discordSettings(id, s); await reload(); }, "Discord settings saved."); }}>
            <SelectField label="Listen mode" value={s.listen_mode} onChange={(v) => setS({ ...s, listen_mode: v })} options={LISTEN} disabled={!can} />
            {s.listen_mode === "specific_channels" || (channels.data && !channels.data.whole_server_available) ? (
              <fieldset className="mb-3">
                <legend className="text-sm text-slate-200 mb-1">Channels</legend>
                {channels.loading ? <Loading /> : chans.map((c) => (
                  <CheckField key={c.id} label={`#${c.name}${c.state !== "available" ? ` (${c.state})` : ""}`} disabled={!can || c.state !== "available"}
                    checked={s.channel_ids.includes(c.id)}
                    onChange={(on) => setS({ ...s, channel_ids: on ? [...s.channel_ids, c.id] : s.channel_ids.filter((x) => x !== c.id) })} />
                ))}
                {channels.data && !channels.data.whole_server_available ? <p className="text-xs text-slate-400">Another instance shares this server, so only selected channels can be used.</p> : null}
              </fieldset>
            ) : null}
            <CheckField label="A mention works in any channel" checked={s.mention_overrides_channels} disabled={!can} onChange={(v) => setS({ ...s, mention_overrides_channels: v })} />
            <SelectField label="Reply style" value={s.reply_style} onChange={(v) => setS({ ...s, reply_style: v })} disabled={!can}
              options={[["natural", "Natural"], ["with_mention", "Mention the user"]]} />
            <CheckField label="Passive mode" hint="Read and learn context without replying unless addressed." checked={s.passive_mode} disabled={!can} onChange={(v) => setS({ ...s, passive_mode: v })} />
            <CheckField label="Answer direct messages" checked={s.dm_enabled} disabled={!can} onChange={(v) => setS({ ...s, dm_enabled: v })} />
            <TextField label="Staff role name (handoff)" value={s.staff_role_name} onChange={(v) => setS({ ...s, staff_role_name: v })} disabled={!can}
              hint="When a member with this role replies, the bot pauses in that channel." />
            <TextField label="Handoff cooldown (minutes)" type="number" min={1} value={s.handoff_cooldown_minutes}
              onChange={(v) => setS({ ...s, handoff_cooldown_minutes: Number(v) })} disabled={!can} />
            <TextField label="Message after handoff ends" value={s.handoff_followup_message} onChange={(v) => setS({ ...s, handoff_followup_message: v })} disabled={!can} />
            {can ? <Button size="sm" type="submit" disabled={busy}>Save settings</Button> : null}
          </form>
          {can ? (
            <form className="mt-4 max-w-sm" onSubmit={(e) => { e.preventDefault(); run(() => api.discordNickname(id, nick || null), "Nickname updated."); }}>
              <TextField label="Nickname in this server" value={nick} onChange={setNick} maxLength={32} hint="Leave empty to use the application name." />
              <Button size="sm" variant="outline" type="submit" disabled={busy}>Set nickname</Button>
            </form>
          ) : null}
        </Section>
      ) : null}

      {ch.guild_id ? (
        <Section title="Staff handoffs" description="While a handoff is active the bot stays quiet in that channel.">
          <DataTable caption="Active handoffs" rows={(handoffs.data && handoffs.data.handoffs) || []} empty="No active handoffs." columns={[
            { key: "channel_id", label: "Channel", render: (h) => (chans.find((c) => c.id === h.channel_id) || {}).name || h.channel_id },
            { key: "active_until", label: "Until", render: (h) => fmtDate(h.active_until) },
            { key: "x", label: "", render: (h) => can ? <Button size="sm" variant="outline" type="button"
              onClick={() => run(async () => { await api.discordResumeHandoff(id, h.channel_id); await handoffs.reload(); }, "The bot resumed in that channel.")}>Resume bot</Button> : null },
          ]} />
          {can && chans.length ? (
            <form className="flex flex-wrap gap-2 items-end mt-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.discordStartHandoff(id, hoChannel, Number(hoMinutes)); await handoffs.reload(); }, "Handoff started."); }}>
              <SelectField label="Channel" value={hoChannel} onChange={setHoChannel} options={[["", "Choose…"], ...chans.map((c) => [c.id, `#${c.name}`])]} />
              <TextField label="Minutes" type="number" min={1} max={1440} value={hoMinutes} onChange={setHoMinutes} />
              <Button size="sm" type="submit" disabled={busy || !hoChannel}>Pause bot</Button>
            </form>
          ) : null}
        </Section>
      ) : null}

      {can ? (
        <Section title="Invite a server administrator" description="If you do not manage the Discord server yourself, send its administrator a single-use link. They add the bot; you never see their Discord account.">
          {newLink ? <Notice tone="ok">Link created: <code className="break-all">{newLink}</code></Notice> : null}
          <form className="max-w-md" onSubmit={(e) => { e.preventDefault(); run(async () => {
            const r = await api.discordCreateShareLink(id, { expected_guild_id: shareGuild.trim() || undefined, email: shareEmail.trim() || undefined });
            setNewLink(r.url); setShareEmail(""); await links.reload();
          }, "Invitation link created."); }}>
            <TextField label="Restrict to server id (optional)" value={shareGuild} onChange={setShareGuild} inputMode="numeric" />
            <TextField label="Email it to (optional)" type="email" value={shareEmail} onChange={setShareEmail} />
            <Button size="sm" type="submit" disabled={busy}>Create invitation link</Button>
          </form>
          <DataTable caption="Invitation links" rows={(links.data && links.data.share_links) || []} empty="No invitation links." columns={[
            { key: "status", label: "Status", render: (l) => <StateBadge state={l.status} /> },
            { key: "expected_guild_id", label: "Server", render: (l) => l.expected_guild_id || "Any" },
            { key: "expires_at", label: "Expires", render: (l) => fmtDate(l.expires_at) },
            { key: "used", label: "Used", render: (l) => (l.used_at ? `${fmtDate(l.used_at)} (${l.used_for_guild})` : "—") },
            { key: "x", label: "", render: (l) => l.status === "active" ? <ConfirmButton confirmLabel="Revoke"
              onConfirm={() => run(async () => { await api.discordRevokeShareLink(id, l.id); await links.reload(); }, "Link revoked.")}>Revoke</ConfirmButton> : null },
          ]} />
        </Section>
      ) : null}
    </>
  );
}

export function TelegramPanel({ api, instance, perms, onChanged }) {
  const id = instance.id;
  const ch = instance.channel || {};
  const status = useLoad(() => api.channelStatus(id), [api, id]);
  const { busy, error, notice, run } = useAction();
  const [mode, setMode] = useState(ch.listen_mode || "mention_or_command");
  const [chats, setChats] = useState((ch.chat_ids || []).join(", "));
  const [cred, setCred] = useState(ch.credential_id || "");
  const can = perms.manage_channel;
  const st = status.data || {};
  return (
    <>
      <Section title="Telegram connection">
        <ErrorBox>{error}</ErrorBox>
        <Notice tone="ok">{notice}</Notice>
        {status.loading ? <Loading /> : <ErrorBox error={status.error} />}
        <KeyValues rows={[
          ["Bot", st.bot_username ? `@${st.bot_username}` : "—"],
          ["Webhook", st.registered ? `Registered ${fmtDate(st.registered_at)}` : "Not registered"],
          st.sync_error ? ["Last error", st.sync_error] : null,
        ]} />
        {can ? (
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" type="button" disabled={busy} onClick={() => run(async () => { await api.channelConnect(id); await status.reload(); }, "Webhook registered with Telegram.")}>Connect</Button>
            <Button size="sm" variant="outline" type="button" disabled={busy || !st.registered} onClick={() => run(() => api.channelTest(id), "Telegram responded.")}>Test</Button>
            <Button size="sm" variant="outline" type="button" disabled={busy} onClick={() => run(async () => { await api.channelRotateSecret(id); await status.reload(); }, "Webhook secret rotated.")}>Rotate webhook secret</Button>
            <ConfirmButton confirmLabel="Disconnect" onConfirm={() => run(async () => { await api.channelDisconnect(id); await status.reload(); }, "Disconnected.")}>Disconnect</ConfirmButton>
          </div>
        ) : null}
      </Section>
      <Section title="Telegram settings">
        <form className="max-w-md" onSubmit={(e) => { e.preventDefault(); run(async () => {
          const chat_ids = chats.split(",").map((x) => x.trim()).filter(Boolean);
          await api.patchInstance(id, { channel: { type: "telegram", credential_id: cred.trim(), listen_mode: mode, chat_ids } });
          await onChanged();
        }, "Saved."); }}>
          <TextField label="Telegram credential id" value={cred} onChange={setCred} disabled={!can} required />
          <SelectField label="Listen mode" value={mode} onChange={setMode} disabled={!can}
            options={[["mention_or_command", "Mentions and commands"], ["dm_only", "Direct messages only"], ["all", "All messages"]]} />
          <TextField label="Allowed chat ids (optional)" value={chats} onChange={setChats} disabled={!can} hint="Comma-separated. Empty: any chat." />
          {can ? <Button size="sm" type="submit" disabled={busy}>Save</Button> : null}
        </form>
      </Section>
      <DeliveriesPanel api={api} instanceId={id} canResolve={can} />
    </>
  );
}

/** W12: curl example for the public chat endpoints (no secrets: the public id is public). */
export function apiExample(snippet) {
  // derived from the server-supplied widget URL (…/public/widget/<public_id>), which carries the API origin
  const base = String(snippet.widget_url || "").replace(/\/widget\/[^/]+$/, `/instances/${snippet.public_id}`);
  return [
    `curl -s -X POST ${base}/sessions -H 'Content-Type: application/json' -d '{}'`,
    "# → {\"session_id\": \"…\", \"session_token\": \"…\"}",
    `curl -s -X POST ${base}/chat -H 'Content-Type: application/json' \\`,
    `  -H 'X-Chat-Session-Token: <session_token>' -d '{"session_id": "<session_id>", "message": "Hello"}'`,
  ].join("\n");
}

export function WebchatPanel({ api, instance, perms, onChanged }) {
  const id = instance.id;
  const ch = instance.channel || {};
  const snip = useLoad(() => api.embedSnippet(id), [api, id]);
  const convs = useLoad(() => api.conversations(id), [api, id]);
  const [open, setOpen] = useState(null);
  const [origins, setOrigins] = useState((ch.allowed_origins || []).join(", "));
  const { busy, error, notice, run } = useAction();
  const can = perms.manage_channel;
  const viewConv = (sid) => run(async () => setOpen(await api.conversation(id, sid)));
  return (
    <>
      <Section title="Embed" description="The widget is hosted by the API, so the allowed origins below are enforced by the browser (frame-ancestors).">
        <ErrorBox>{error}</ErrorBox>
        <Notice tone="ok">{notice}</Notice>
        {snip.data ? (
          <>
            <label htmlFor="embed-code" className="text-sm text-slate-300">Paste this into your website</label>
            <textarea id="embed-code" readOnly rows={3} value={snip.data.script} className="w-full font-mono text-xs bg-black/40 rounded p-2 text-white mt-1" />
            <p className="text-xs text-slate-400 mt-1">Widget page: <a className="text-cyan-300 hover:underline break-all" href={snip.data.widget_url} target="_blank" rel="noopener noreferrer">{snip.data.widget_url}</a></p>
            <label htmlFor="api-example" className="text-sm text-slate-300 block mt-3">Public chat API example (W12)</label>
            <textarea id="api-example" readOnly rows={5} value={apiExample(snip.data)} className="w-full font-mono text-xs bg-black/40 rounded p-2 text-white mt-1" />
            <p className="text-xs text-slate-400">Each message counts as real usage. Calls from websites must come from an allowed origin.</p>
          </>
        ) : <ErrorBox error={snip.error} />}
        {perms.edit_config ? (
          <div className="mt-3">
            <Button size="sm" variant="outline" type="button" disabled={busy || instance.available === false} onClick={() => run(async () => {
              const r = await api.previewSession(id);
              window.open(r.preview_url, "_blank", "noopener,noreferrer");
            }, "Preview opened in a new tab. Preview messages are labelled as preview but still count against quotas.")}>Open preview</Button>
          </div>
        ) : null}
        <form className="max-w-md mt-3" onSubmit={(e) => { e.preventDefault(); run(async () => {
          const allowed_origins = origins.split(",").map((x) => x.trim()).filter(Boolean);
          await api.patchInstance(id, { channel: { type: "webchat", allowed_origins } }); await onChanged();
        }, "Allowed origins saved."); }}>
          <TextField label="Allowed website origins" value={origins} onChange={setOrigins} disabled={!can}
            hint="https://shop.example, https://www.example — empty allows any site unless the Enterprise policy restricts it." />
          {can ? <Button size="sm" type="submit" disabled={busy}>Save origins</Button> : null}
        </form>
        <p className="text-xs text-slate-400 mt-2">Widget title, welcome message, theme and default-open are configured under Overrides (widget.*); the logo is set on the bot.</p>
      </Section>
      <Section title="Conversations" description="Approve a good reply to use it as a tone example for this bot (up to 10).">
        <ErrorBox error={convs.error} />
        <DataTable caption="Conversations" rows={(convs.data && convs.data.conversations) || []} empty="No conversations yet." columns={[
          { key: "session_id", label: "Session", render: (c) => <Button size="sm" variant="link" type="button" onClick={() => viewConv(c.session_id)}>{c.session_id.slice(0, 10)}…</Button> },
          { key: "messages", label: "Messages" },
          { key: "updated_at", label: "Last activity", render: (c) => fmtDate(c.updated_at) },
        ]} />
        {open ? (
          <div className="mt-3 border border-white/10 rounded p-3" aria-label="Conversation transcript">
            <div className="flex justify-between mb-2"><h3 className="text-sm font-semibold">Transcript</h3>
              <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(null)}>Close</Button></div>
            <ol className="space-y-2">
              {open.messages.map((m) => (
                <li key={m.id} className={`text-sm rounded p-2 ${m.role === "user" ? "bg-white/5" : "bg-cyan-950/30"}`}>
                  <span className="text-xs text-slate-400 block">{m.role === "user" ? "Visitor" : "Bot"}</span>
                  <span className="whitespace-pre-wrap">{m.text}</span>
                  {m.role === "assistant" && perms.edit_config ? (
                    <Button size="sm" variant="outline" type="button" className="ml-2" onClick={() => run(() => api.approveMessage(id, open.session_id, m.id),
                      (r) => `Approved as a tone example (${r.tone_examples} stored).`)}>Approve tone</Button>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </Section>
    </>
  );
}

export function InstancePage() {
  const { id } = useParams();
  const api = useApi();
  const st = useNode(api, "instance", id);
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <ErrorBox error={st.error} />;
  const { node, cfg, perms } = st.data;
  const type = (node.channel && node.channel.type) || "";
  const panel = { discord: DiscordPanel, telegram: TelegramPanel, webchat: WebchatPanel }[type];
  return (
    <>
      <Breadcrumbs api={api} node={node} kind="instance" />
      <PageTitle kind={`${type ? type[0].toUpperCase() + type.slice(1) : ""} instance`} sub={availabilityText(node)}>{node.name}</PageTitle>
      <Tabs tabs={[
        ["channel", "Channel", () => (panel ? React.createElement(panel, { api, instance: node, perms, onChanged: st.reload }) : <Notice tone="warn">Unknown channel type.</Notice>)],
        ["overrides", "Overrides", () => (
          <ConfigPanel view={cfg} targetId={id} canEdit={perms.edit_config} title="Instance overrides"
            onPatch={async (c) => { await api.patchConfig("instance", id, c); await st.reload(); }} />
        )],
        ["usage", "Usage", () => <UsagePanel api={api} type="instance" id={id} />],
        ["settings", "Lifecycle", () => <LifecycleMenu api={api} type="instance" node={node} permissions={perms} onChanged={st.reload} />],
      ]} />
    </>
  );
}
