import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Network, Plus, Loader2, Zap, Send, Headphones, Link2, Power, PowerOff,
  CheckCircle, AlertCircle, ExternalLink, Copy, Mail, RefreshCw, Globe,
  MessageSquare, AtSign, Hash, Radio, Shield, WifiOff, ChevronRight, Settings,
  Eye, Code, Users, Server,
} from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur } from "@/theme";
import { toast } from "sonner";
import v2 from "@/utils/v2api";
import api from "@/utils/api";

const PROVIDER_META = {
  discord: { label: "Discord", icon: Zap, color: "#5865F2", desc: "Connect your bot to Discord servers and channels" },
  telegram: { label: "Telegram", icon: Send, color: "#26A5E4", desc: "Reply to messages in Telegram groups and DMs" },
  zendesk: { label: "Zendesk", icon: Headphones, color: "#17A589", desc: "Auto-reply to tickets or assist agents with AI" },
};

const RESPONSE_MODES = [
  { value: "auto_reply", label: "Auto-Reply", desc: "Bot replies to customers automatically" },
  { value: "agent_assist", label: "Agent Assist", desc: "Suggests replies for agents to review" },
  { value: "internal_note", label: "Internal Note", desc: "Adds AI suggestion as a private note" },
];

function ModeBadge({ mode }) {
  const modeMap = {
    auto_reply: { label: "Auto-Reply", bg: "rgba(52,211,153,0.08)", color: "#34D399", border: "rgba(52,211,153,0.2)" },
    agent_assist: { label: "Agent Assist", bg: "rgba(96,165,250,0.08)", color: "#60A5FA", border: "rgba(96,165,250,0.2)" },
    internal_note: { label: "Internal Note", bg: "rgba(251,191,36,0.08)", color: "#FBBF24", border: "rgba(251,191,36,0.2)" },
  };
  const m = modeMap[mode] || modeMap.agent_assist;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: radius.full,
      fontSize: "10px", fontWeight: "600", fontFamily: fonts.mono, letterSpacing: "0.02em",
      backgroundColor: m.bg, color: m.color, border: `1px solid ${m.border}`,
    }}>
      {m.label}
    </span>
  );
}

/* ── Toggle switch component ── */
function ToggleSwitch({ on, onChange, testId }) {
  return (
    <button onClick={onChange} data-testid={testId} style={{
      width: "42px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer",
      backgroundColor: on ? "#5865F2" : "rgba(148,163,184,0.2)",
      position: "relative", transition: "background-color 0.2s", flexShrink: 0,
    }}>
      <div style={{
        width: "18px", height: "18px", borderRadius: "50%", backgroundColor: "#fff",
        position: "absolute", top: "3px", left: on ? "21px" : "3px",
        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }} />
    </button>
  );
}

const cardStyle = {
  padding: "20px", borderRadius: "14px", marginBottom: "16px",
  backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
};

/* ── Discord Detail View (production-matching feature set) ── */
function DiscordDetail({ connection, account, botName, onToggle, onBack, onCreateConnection, accounts, orgId, botId, saving, onRefresh }) {
  const conn = connection;
  const isConnected = !!conn;
  const overrides = conn?.overrides || {};

  const [addMode, setAddMode] = useState("auto_reply");
  const [listenMode, setListenMode] = useState(overrides.listen_mode || conn?.destination?.listen_mode || "all_channels");
  const [replyStyle, setReplyStyle] = useState(overrides.reply_style || "natural");
  const [passiveMode, setPassiveMode] = useState(overrides.passive_mode || false);
  const [scriptedMode, setScriptedMode] = useState(overrides.scripted_mode || false);
  const [staffRole, setStaffRole] = useState(overrides.human_takeover?.staff_role_name || "");
  const [cooldown, setCooldown] = useState(overrides.human_takeover?.cooldown_minutes ?? 15);
  const [resumeCommand] = useState(overrides.human_takeover?.resume_command || "!bot resume");
  const [followUpMsg, setFollowUpMsg] = useState(overrides.human_takeover?.follow_up_message || "Is there anything else I can help with?");
  const [savingConfig, setSavingConfig] = useState(false);

  // V1 live-state: bot status, channels, handoff
  const [botStatus, setBotStatus] = useState({ status: "offline", bot_name: null });
  const [handoffChannels, setHandoffChannels] = useState([]);
  const [channels, setChannels] = useState([]);
  const [monitoredChannelIds, setMonitoredChannelIds] = useState(overrides.monitored_channel_ids || conn?.destination?.monitored_channel_ids || []);
  const [fetchingChannels, setFetchingChannels] = useState(false);
  const [starting, setStarting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [resumingHandoff, setResumingHandoff] = useState(false);
  const [inviting, setInviting] = useState(false);
  const pollRef = useRef(null);

  // Invite URL from account credentials
  const clientId = account?.credentials_masked?.application_id || account?.credentials_masked?.client_id || account?.credentials_display?.client_id || "";
  const inviteUrl = clientId
    ? `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot+applications.commands&permissions=2147483648`
    : null;

  const isOnline = botStatus.status === "online";

  // Poll bot status + handoff status via V1 api
  const loadStatus = useCallback(() => {
    api.get("/discord/status").then(r => setBotStatus(r.data)).catch(() => {});
    api.get("/discord/handoff-status").then(r => setHandoffChannels(r.data?.channels || [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadStatus();
    pollRef.current = setInterval(loadStatus, 5000);
    return () => clearInterval(pollRef.current);
  }, [loadStatus]);

  // Fetch channels from Discord for specific_channels mode
  const fetchChannels = async () => {
    setFetchingChannels(true);
    try {
      const res = await api.get("/discord/channels");
      setChannels(res.data);
      if (res.data.length === 0) toast.info("No text channels found.");
      else toast.success(`Found ${res.data.length} channel(s)`);
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to fetch channels"); }
    finally { setFetchingChannels(false); }
  };

  const toggleChannel = (id) => setMonitoredChannelIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  // Start / restart bot
  const startBot = async () => {
    setStarting(true);
    try { await api.post("/discord/restart"); toast.success("Discord bot starting..."); setTimeout(loadStatus, 3000); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed to start bot"); }
    finally { setStarting(false); }
  };

  // Sync name to Discord
  const syncName = async () => {
    setSyncing(true);
    try { const res = await api.post("/discord/sync-name"); toast.success(res.data?.message || "Name synced"); setTimeout(loadStatus, 2000); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed to sync name"); }
    finally { setSyncing(false); }
  };

  // Resume from handoff
  const resumeHandoff = async () => {
    setResumingHandoff(true);
    try {
      const r = await api.post("/discord/handoff-resume");
      toast.success(r.data?.cleared > 0 ? `Bot resumed in ${r.data.cleared} channel(s)` : "No active handoffs");
      setHandoffChannels([]);
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to resume"); }
    finally { setResumingHandoff(false); }
  };

  // Invite bot via OAuth
  const inviteBot = async () => {
    setInviting(true);
    try {
      const res = await api.get("/discord/oauth-url");
      window.location.href = res.data.url;
    } catch {
      // Fallback to manual invite URL
      if (inviteUrl) window.open(inviteUrl, "_blank");
      else toast.error("Add an Application ID in Discord App Setup to generate the invite link.");
      setInviting(false);
    }
  };

  const handleCreate = () => {
    const discordAccount = accounts.find(a => a.provider === "discord");
    if (!discordAccount) { toast.error("Set up a Discord account in Discord App Setup first."); return; }
    onCreateConnection({
      account_id: discordAccount.id,
      name: `Discord — ${botName || "Bot"}`,
      response_mode: addMode,
      destination: { listen_mode: listenMode },
    });
  };

  const handleSaveConfig = async () => {
    if (!conn) return;
    setSavingConfig(true);
    try {
      await v2.updateConnection(orgId, botId, conn.id, {
        destination: { ...conn.destination, listen_mode: listenMode, monitored_channel_ids: monitoredChannelIds },
        overrides: {
          listen_mode: listenMode,
          reply_style: replyStyle,
          passive_mode: passiveMode,
          scripted_mode: scriptedMode,
          monitored_channel_ids: monitoredChannelIds,
          human_takeover: {
            staff_role_name: staffRole,
            cooldown_minutes: cooldown,
            resume_command: resumeCommand,
            follow_up_message: followUpMsg,
          },
        },
      });
      // Also save to V1 config for the running bot
      try {
        await api.put("/discord/config", {
          is_active: conn.enabled,
          listen_mode: listenMode,
          reply_style: replyStyle,
          monitored_channel_ids: monitoredChannelIds,
          staff_role_name: staffRole,
          handoff_cooldown_minutes: cooldown,
          handoff_followup_message: followUpMsg,
          passive_mode: passiveMode,
        });
      } catch { /* V1 sync is best-effort */ }
      toast.success("Configuration saved");
      onRefresh();
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setSavingConfig(false);
    }
  };

  // Group channels by guild
  const channelsByGuild = channels.reduce((acc, ch) => {
    (acc[ch.guild_name] = acc[ch.guild_name] || []).push(ch);
    return acc;
  }, {});

  return (
    <div data-testid="discord-detail-view">
      {/* Banner — link to Discord App Setup */}
      <div data-testid="discord-app-setup-banner" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px", borderRadius: "12px", marginBottom: "20px",
        backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Settings size={16} color={colors.text.muted} />
          <span style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary }}>
            <strong style={{ color: colors.text.primary }}>Discord App Setup</strong> · Manage global app credentials and view setup guide
          </span>
        </div>
        <a href="/admin/accounts/discord" style={{
          display: "flex", alignItems: "center", gap: "4px",
          fontFamily: fonts.body, fontSize: "12px", fontWeight: "600", color: colors.brand.light, textDecoration: "none",
        }}>
          Open <ChevronRight size={14} />
        </a>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* ═══ Left column ═══ */}
        <div>
          {/* Connect to Discord / Invite */}
          <div style={{
            padding: "20px", borderRadius: "14px", marginBottom: "16px",
            border: `1px solid ${isConnected ? "rgba(52,211,153,0.2)" : colors.border.default}`,
            backgroundColor: isConnected ? "rgba(52,211,153,0.03)" : colors.bg.panel,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "rgba(88,101,242,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Server size={18} color="#5865F2" />
              </div>
              <div>
                <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>Connect to Discord</p>
                <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.secondary, margin: "2px 0 0" }}>Invite the bot to your Discord server</p>
              </div>
            </div>

            {isConnected && (
              <div data-testid="discord-guild-info" style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px", borderRadius: "10px", marginBottom: "16px",
                backgroundColor: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <CheckCircle size={15} color="#34D399" />
                  <div>
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: "500", color: "#34D399", fontFamily: fonts.body }}>
                      Connected to "{conn.name.replace(/^Discord — /, "")}"
                    </p>
                    {conn.destination?.guild_id && (
                      <p style={{ margin: "2px 0 0", fontSize: "10px", color: colors.text.secondary, fontFamily: fonts.mono }}>
                        Guild ID: {conn.destination.guild_id}
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={() => onToggle(conn)} data-testid="discord-disconnect-btn" style={{
                  display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "8px", cursor: "pointer",
                  border: "1px solid rgba(244,63,94,0.2)", backgroundColor: "rgba(244,63,94,0.06)",
                  color: "#F43F5E", fontSize: "12px", fontFamily: fonts.body,
                }}>
                  <WifiOff size={12} /> Disconnect
                </button>
              </div>
            )}

            {!isConnected && !accounts.find(a => a.provider === "discord") && (
              <div style={{ padding: "14px", backgroundColor: colors.bg.base, borderRadius: "10px", border: `1px solid ${colors.border.default}`, marginBottom: "16px" }}>
                <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: 0 }}>
                  Discord OAuth is not configured. Open <a href="/admin/accounts/discord" style={{ color: colors.brand.light }}>Discord App Setup</a> to configure credentials.
                </p>
              </div>
            )}

            {/* Invite Bot button */}
            <button onClick={inviteBot} disabled={inviting} data-testid="discord-invite-btn" style={{
              width: "100%", padding: "13px 20px", backgroundColor: "#5865F2",
              color: "#FFFFFF", border: "none", borderRadius: "10px",
              fontSize: "14px", fontFamily: fonts.body, fontWeight: "600",
              cursor: inviting ? "not-allowed" : "pointer", opacity: inviting ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              transition: "all 0.2s", marginBottom: "16px",
            }}>
              <Link2 size={16} />
              {inviting ? "Redirecting to Discord..." : isConnected ? "Invite to Another Server" : "Invite Bot to Server"}
            </button>

            {/* Share invite link */}
            <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: colors.bg.base, border: `1px solid ${colors.border.default}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Link2 size={14} color={colors.text.secondary} />
                  <span style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: "600", color: colors.text.primary }}>Share invite link</span>
                </div>
                <span style={{ fontFamily: fonts.body, fontSize: "10px", color: colors.text.muted }}>For another server admin</span>
              </div>
              <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, margin: "0 0 10px", lineHeight: "1.5" }}>
                Send this link to anyone with Manage Server permission on a Discord server. They click it, authorize the bot, and it lands in your admin panel ready to configure. They never need to log into BitBot Pro.
              </p>
              {inviteUrl ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input value={inviteUrl} readOnly style={{ ...T.input, flex: 1, fontSize: "11px", fontFamily: fonts.mono, color: colors.text.muted }} data-testid="discord-invite-url" />
                    <button onClick={() => { navigator.clipboard.writeText(inviteUrl); toast.success("Copied invite link"); }} data-testid="discord-copy-invite" style={{
                      display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px", borderRadius: "8px",
                      border: `1px solid ${colors.border.default}`, backgroundColor: colors.bg.panel,
                      color: colors.text.secondary, fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
                    }}>
                      <Copy size={12} /> Copy
                    </button>
                    <button onClick={() => { window.open(`mailto:?subject=Join our Discord bot&body=${encodeURIComponent(inviteUrl)}`); }} style={{
                      display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px", borderRadius: "8px",
                      border: `1px solid ${colors.border.default}`, backgroundColor: colors.bg.panel,
                      color: colors.text.secondary, fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
                    }}>
                      <Mail size={12} /> Email
                    </button>
                  </div>
                  <p style={{ fontFamily: fonts.body, fontSize: "10px", color: colors.text.muted, margin: "10px 0 0", lineHeight: "1.5" }}>
                    Anyone with this link can invite the bot. The new server auto-links to this instance. In mobile, visit{" "}
                    <a href="/admin/accounts/discord" style={{ color: colors.brand.light, textDecoration: "none" }}>Discord App Setup</a>.
                  </p>
                </>
              ) : (
                <div style={{ padding: "10px 14px", borderRadius: "8px", backgroundColor: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
                  <p style={{ fontFamily: fonts.body, fontSize: "11px", color: "#FBBF24", margin: 0 }}>
                    <AlertCircle size={12} style={{ display: "inline", verticalAlign: "-2px", marginRight: "6px" }} />
                    Add an Application ID in <a href="/admin/accounts/discord" style={{ color: colors.brand.light }}>Discord App Setup</a> to generate the invite link.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Setup Guide */}
          <div style={cardStyle} data-testid="discord-setup-guide">
            <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: "0 0 24px" }}>Setup Guide</p>
            {[
              { n: "01", title: "Enable Message Content Intent", desc: "Go to the Discord Developer Portal, select your app, navigate to \"Bot\" settings, and enable \"Message Content Intent\".", link: { label: "Open Discord Developer Portal", url: "https://discord.com/developers/applications" } },
              { n: "02", title: "Invite Bot to Your Server", desc: "Click the \"Invite Bot to Server\" button above. Select a server and authorize the bot." },
              { n: "03", title: "Configure & Start", desc: "Set your preferred listen mode and reply style, toggle Active, save, then start the bot." },
            ].map(s => (
              <div key={s.n} style={{ display: "flex", gap: "16px", marginBottom: "22px" }}>
                <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: "#5865F2", flexShrink: 0, paddingTop: "2px", minWidth: "24px" }}>{s.n}</span>
                <div>
                  <p style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "500", color: colors.text.primary, margin: "0 0 4px" }}>{s.title}</p>
                  <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: "0 0 6px", lineHeight: "1.6" }}>{s.desc}</p>
                  {s.link && (
                    <a href={s.link.url} target="_blank" rel="noopener noreferrer" style={{
                      fontSize: "12px", color: colors.brand.light, fontFamily: fonts.body,
                      textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px",
                    }}>
                      {s.link.label} <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Create connection (when not connected) */}
          {!isConnected && accounts.find(a => a.provider === "discord") && (
            <div style={cardStyle}>
              <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 12px" }}>Response Mode</p>
              <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                {RESPONSE_MODES.slice(0, 2).map(mode => (
                  <button key={mode.value} onClick={() => setAddMode(mode.value)} style={{
                    flex: 1, padding: "10px", borderRadius: "8px", cursor: "pointer", textAlign: "center",
                    border: `1px solid ${addMode === mode.value ? "#5865F250" : colors.border.default}`,
                    backgroundColor: addMode === mode.value ? "#5865F20a" : colors.bg.base,
                    color: addMode === mode.value ? "#5865F2" : colors.text.secondary,
                    fontFamily: fonts.body, fontSize: "12px", fontWeight: "600",
                  }}>{mode.label}</button>
                ))}
              </div>
              <button onClick={handleCreate} disabled={saving} data-testid="discord-connect-btn" style={{
                ...T.btnPrimary, width: "100%", justifyContent: "center", opacity: saving ? 0.5 : 1,
              }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} Connect Discord Bot
              </button>
            </div>
          )}
        </div>

        {/* ═══ Right column ═══ */}
        <div>
          {/* Bot Status */}
          <div style={{ ...cardStyle, borderColor: isOnline ? "rgba(52,211,153,0.3)" : colors.border.default }} data-testid="discord-bot-status-card">
            <p style={{ fontFamily: fonts.mono, fontSize: "10px", letterSpacing: "0.1em", color: colors.text.muted, margin: "0 0 12px", textTransform: "uppercase" }}>Bot Status</p>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: isOnline ? "#34D399" : colors.text.muted, boxShadow: isOnline ? "0 0 12px #34D399" : "none", flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: fonts.heading, fontSize: "18px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>{isOnline ? "Online" : "Offline"}</p>
                {botStatus.bot_name && <p style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.secondary, margin: "2px 0 0" }}>{botStatus.bot_name}</p>}
              </div>
              <button onClick={loadStatus} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: colors.text.secondary, padding: "4px" }}><RefreshCw size={14} /></button>
            </div>
            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: `1px solid ${colors.border.default}` }}>
              <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: "0 0 10px" }}>
                Bot name is set in <strong style={{ color: colors.text.primary }}>Bot Settings</strong>. Sync it to Discord here.
              </p>
              <button onClick={syncName} disabled={syncing} data-testid="sync-name-btn" style={{
                display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px",
                borderRadius: "8px", border: `1px solid ${colors.border.default}`, backgroundColor: colors.bg.base,
                color: colors.text.secondary, fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
                opacity: syncing ? 0.6 : 1,
              }}>
                <RefreshCw size={11} /> {syncing ? "Syncing..." : "Sync Name to Discord"}
              </button>
            </div>
          </div>

          {/* Configuration — Bot Active */}
          <div style={cardStyle} data-testid="discord-config-card">
            <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: "0 0 20px" }}>Configuration</p>
            <div>
              <label style={T.label}>Bot Active</label>
              {isConnected ? (
                <button onClick={() => onToggle(conn)} data-testid="discord-active-toggle" style={{
                  display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px",
                  backgroundColor: conn.enabled ? "rgba(52,211,153,0.06)" : colors.bg.panel,
                  border: `1px solid ${conn.enabled ? "rgba(52,211,153,0.3)" : colors.border.default}`,
                  borderRadius: "10px", cursor: "pointer",
                  color: conn.enabled ? "#34D399" : colors.text.secondary,
                  fontFamily: fonts.body, fontSize: "13px", fontWeight: "500", transition: "all 0.2s",
                }}>
                  {conn.enabled ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                  {conn.enabled ? "Active" : "Inactive"}
                </button>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "10px", backgroundColor: "rgba(148,163,184,0.08)", color: colors.text.muted, fontFamily: fonts.body, fontSize: "13px", fontWeight: "500" }}>
                  <PowerOff size={14} /> Not Connected
                </span>
              )}
            </div>
          </div>

          {/* Listen Mode */}
          <div style={cardStyle} data-testid="discord-listen-mode-card">
            <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: "0 0 16px" }}>Listen Mode</p>
            <div style={{ display: "flex", gap: "8px", marginBottom: listenMode === "specific_channels" ? "20px" : "0" }}>
              {[
                { value: "mention_only", label: "Mention Only", icon: AtSign, desc: "Responds when @tagged or in DMs" },
                { value: "all_channels", label: "All Channels", icon: Radio, desc: "Responds to every human message" },
                { value: "specific_channels", label: "Specific Channels", icon: Hash, desc: "Pick which channels to monitor" },
              ].map(mode => (
                <button key={mode.value} onClick={() => setListenMode(mode.value)} data-testid={`listen-mode-${mode.value}`} style={{
                  flex: 1, padding: "10px 12px", borderRadius: "10px", cursor: "pointer",
                  border: `1px solid ${listenMode === mode.value ? "#5865F250" : colors.border.default}`,
                  backgroundColor: listenMode === mode.value ? "rgba(96,165,250,0.06)" : colors.bg.base,
                  color: listenMode === mode.value ? colors.text.primary : colors.text.secondary,
                  fontFamily: fonts.body, fontSize: "12px", fontWeight: listenMode === mode.value ? "600" : "400",
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "3px",
                  transition: "all 0.2s",
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><mode.icon size={12} />{mode.label}</span>
                  <span style={{ fontSize: "10px", color: colors.text.secondary, fontFamily: fonts.body }}>{mode.desc}</span>
                </button>
              ))}
            </div>

            {/* Specific Channels selector */}
            {listenMode === "specific_channels" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <label style={{ ...T.label, margin: 0 }}>Select Channels to Monitor</label>
                  <button onClick={fetchChannels} disabled={fetchingChannels} data-testid="fetch-channels-btn" style={{
                    display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px",
                    borderRadius: "8px", border: `1px solid ${colors.border.default}`, backgroundColor: colors.bg.base,
                    color: colors.text.secondary, fontSize: "11px", fontFamily: fonts.body, cursor: "pointer",
                    opacity: fetchingChannels ? 0.6 : 1,
                  }}>
                    <RefreshCw size={11} className={fetchingChannels ? "animate-spin" : ""} />
                    {fetchingChannels ? "Fetching..." : "Fetch Channels"}
                  </button>
                </div>
                {channels.length === 0 && (
                  <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, padding: "16px", backgroundColor: colors.bg.base, borderRadius: "10px", border: `1px solid ${colors.border.default}`, margin: 0 }}>
                    Click "Fetch Channels" to load channels from your Discord server.
                    {monitoredChannelIds.length > 0 && ` (${monitoredChannelIds.length} saved)`}
                  </p>
                )}
                {Object.entries(channelsByGuild).map(([guildName, guildChannels]) => (
                  <div key={guildName} style={{ marginBottom: "12px" }}>
                    <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>{guildName}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {guildChannels.map(ch => (
                        <button key={ch.id} onClick={() => toggleChannel(ch.id)} data-testid={`channel-${ch.id}`} style={{
                          display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px",
                          border: `1px solid ${monitoredChannelIds.includes(ch.id) ? "#5865F250" : colors.border.default}`,
                          borderRadius: "10px", backgroundColor: monitoredChannelIds.includes(ch.id) ? "rgba(96,165,250,0.06)" : colors.bg.base,
                          cursor: "pointer", transition: "all 0.2s",
                          fontFamily: fonts.body, fontSize: "12px",
                          color: monitoredChannelIds.includes(ch.id) ? colors.text.primary : colors.text.secondary,
                        }}>
                          <Hash size={11} /> {ch.name}
                          {monitoredChannelIds.includes(ch.id) && <CheckCircle size={10} color="#34D399" />}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {monitoredChannelIds.length > 0 && (
                  <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.brand.light, marginTop: "8px" }}>
                    {monitoredChannelIds.length} channel{monitoredChannelIds.length !== 1 ? "s" : ""} selected
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Reply Style */}
          <div style={cardStyle} data-testid="discord-reply-style-card">
            <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: "0 0 16px" }}>Reply Style</p>
            <div style={{ display: "flex", gap: "8px" }}>
              {[
                { value: "natural", icon: MessageSquare, label: "Natural reply", desc: "Replies without mentioning the user" },
                { value: "mention", icon: AtSign, label: "With @mention", desc: "Pings the user in the reply" },
              ].map(s => (
                <button key={s.value} onClick={() => setReplyStyle(s.value)} data-testid={`reply-style-${s.value}`} style={{
                  flex: 1, padding: "10px 12px", borderRadius: "10px", cursor: "pointer",
                  border: `1px solid ${replyStyle === s.value ? "#5865F250" : colors.border.default}`,
                  backgroundColor: replyStyle === s.value ? "rgba(96,165,250,0.06)" : colors.bg.base,
                  color: replyStyle === s.value ? colors.text.primary : colors.text.secondary,
                  fontFamily: fonts.body, fontSize: "12px", fontWeight: replyStyle === s.value ? "600" : "400",
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "3px",
                  transition: "all 0.2s",
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><s.icon size={12} />{s.label}</span>
                  <span style={{ fontSize: "10px", color: colors.text.secondary, fontFamily: fonts.body }}>{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Passive Mode */}
          <div style={{ ...cardStyle, borderColor: passiveMode ? "rgba(96,165,250,0.3)" : colors.border.default }} data-testid="discord-passive-mode-card">
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <Radio size={15} color={passiveMode ? colors.brand.light : colors.text.muted} />
                  <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>Passive Mode</p>
                  {passiveMode && (
                    <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.brand.light, backgroundColor: "rgba(96,165,250,0.1)", padding: "2px 8px", borderRadius: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Active
                    </span>
                  )}
                </div>
                <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: 0, lineHeight: "1.6" }}>
                  Only reply when the bot detects a real question it can answer confidently from your knowledge base.
                  Silently ignores small talk, greetings, opinions, and off-topic chatter.
                  Direct @mentions and DMs always get a reply, regardless of this setting.
                </p>
              </div>
              <ToggleSwitch on={passiveMode} onChange={() => setPassiveMode(!passiveMode)} testId="toggle-passive-mode" />
            </div>
            {passiveMode && (
              <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, marginTop: "12px", marginBottom: 0, padding: "8px 12px", backgroundColor: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: "8px", lineHeight: "1.5" }}>
                <strong style={{ color: colors.text.primary }}>Tip:</strong> Best paired with <em>All Channels</em> listen mode in busy servers — the bot will quietly monitor every channel and only chime in when it has a useful answer.
              </p>
            )}
          </div>

          {/* Scripted Mode */}
          <div style={cardStyle} data-testid="discord-scripted-mode-card">
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <Code size={15} color={scriptedMode ? colors.brand.light : colors.text.muted} />
                  <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>Scripted Mode</p>
                  {scriptedMode && (
                    <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.brand.light, backgroundColor: "rgba(96,165,250,0.1)", padding: "2px 8px", borderRadius: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Active
                    </span>
                  )}
                </div>
                <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: 0, lineHeight: "1.6" }}>
                  Bypasses the knowledge base and reply with a fixed maintenance/incident message. Useful for service outages, bridge pauses, or scheduled downtime. First reply to a user is verbatim; follow-ups get rephrased so it doesn't feel robotic.
                </p>
              </div>
              <ToggleSwitch on={scriptedMode} onChange={() => setScriptedMode(!scriptedMode)} testId="toggle-scripted-mode" />
            </div>
          </div>

          {/* Human Takeover */}
          <div style={cardStyle} data-testid="discord-human-takeover-card">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <Users size={16} color={colors.brand.light} />
              <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>Human Takeover</p>
            </div>
            <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: "0 0 16px", lineHeight: "1.6" }}>
              When a team member with the designated role replies in a channel, the bot automatically goes silent in that specific channel. It continues monitoring all other channels. After the cooldown, the bot re-engages.
            </p>

            <div style={{ marginBottom: "14px" }}>
              <label style={T.label}>Staff Role Name</label>
              <input value={staffRole} onChange={e => setStaffRole(e.target.value)}
                placeholder="e.g. Support, Moderator" style={T.input}
                onFocus={onFocus} onBlur={onBlur} data-testid="staff-role-name" />
              <p style={T.hint}>Discord role name for staff members. Leave empty to disable human takeover.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
              <div>
                <label style={T.label}>Cooldown (minutes)</label>
                <input type="number" min="1" max="120" value={cooldown}
                  onChange={e => setCooldown(Math.max(1, parseInt(e.target.value) || 15))}
                  style={T.input} data-testid="cooldown-minutes" onFocus={onFocus} onBlur={onBlur} />
                <p style={T.hint}>Time before bot re-engages after staff stops replying.</p>
              </div>
              <div>
                <label style={T.label}>Resume Command</label>
                <div style={{ padding: "10px 14px", backgroundColor: colors.bg.base, borderRadius: "10px", border: `1px solid ${colors.border.default}`, fontFamily: fonts.mono, fontSize: "13px", color: colors.brand.light }}>
                  {resumeCommand}
                </div>
                <p style={T.hint}>Staff can type this to hand back to the bot immediately.</p>
              </div>
            </div>

            <div style={{ marginBottom: "18px" }}>
              <label style={T.label}>Follow-up Message</label>
              <input value={followUpMsg} onChange={e => setFollowUpMsg(e.target.value)}
                placeholder="Is there anything else I can help with?" style={T.input}
                onFocus={onFocus} onBlur={onBlur} data-testid="follow-up-message" />
              <p style={T.hint}>Message the bot sends when it re-engages after cooldown.</p>
            </div>

            {/* Currently in handoff — live from API */}
            <div style={{
              padding: "14px 16px", borderRadius: "10px",
              backgroundColor: handoffChannels.length > 0 ? "rgba(251,191,36,0.05)" : colors.bg.base,
              border: `1px solid ${handoffChannels.length > 0 ? "rgba(251,191,36,0.25)" : colors.border.default}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: handoffChannels.length > 0 ? "10px" : 0 }}>
                <div>
                  <p style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
                    Currently in handoff
                    <span style={{ marginLeft: "8px", fontFamily: fonts.mono, fontSize: "11px", color: handoffChannels.length > 0 ? "#FBBF24" : colors.text.muted }}>
                      {handoffChannels.length} channel{handoffChannels.length === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.secondary, margin: "3px 0 0", lineHeight: "1.5" }}>
                    Bot is silent here until cooldown ends, a non-staff user posts, or you click Resume.
                  </p>
                </div>
                <button onClick={resumeHandoff} disabled={resumingHandoff || handoffChannels.length === 0} data-testid="resume-bot-now" style={{
                  padding: "8px 14px",
                  backgroundColor: handoffChannels.length > 0 ? "#34D399" : colors.bg.panel,
                  color: handoffChannels.length > 0 ? "#FFFFFF" : colors.text.muted,
                  border: "none", borderRadius: "8px",
                  fontFamily: fonts.body, fontSize: "12px", fontWeight: "600",
                  cursor: (resumingHandoff || handoffChannels.length === 0) ? "not-allowed" : "pointer",
                  opacity: resumingHandoff ? 0.6 : 1,
                  display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
                }}>
                  <RefreshCw size={12} /> {resumingHandoff ? "Resuming..." : "Resume Bot Now"}
                </button>
              </div>
              {handoffChannels.length > 0 && (
                <ul style={{ margin: "8px 0 0", paddingLeft: "16px", fontFamily: fonts.mono, fontSize: "11px", color: colors.text.secondary, lineHeight: "1.7" }}>
                  {handoffChannels.map((c) => (
                    <li key={c.channel_id} data-testid="handoff-channel-row">
                      #{c.channel_name || c.channel_id} — silent for ~{c.elapsed_min} min, {c.remaining_min} min remaining
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Save + Start */}
          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={handleSaveConfig} disabled={savingConfig || !isConnected} data-testid="save-config-btn" style={{
              ...T.btnPrimary, flex: 1, justifyContent: "center",
              opacity: (savingConfig || !isConnected) ? 0.6 : 1,
            }}>
              {savingConfig ? "Saving..." : "Save Configuration"}
            </button>
            <button onClick={startBot} disabled={starting} data-testid="start-bot-btn" style={{
              padding: "11px 20px", backgroundColor: colors.bg.panel,
              color: "#34D399", border: "1px solid rgba(52,211,153,0.3)",
              borderRadius: "10px", fontSize: "13px", fontFamily: fonts.body, fontWeight: "500",
              cursor: starting ? "not-allowed" : "pointer", opacity: starting ? 0.6 : 1,
              display: "flex", alignItems: "center", gap: "7px", transition: "all 0.2s", flexShrink: 0,
            }}>
              <Zap size={13} /> {starting ? "Starting..." : "Start Bot"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Telegram Detail View ── */
function TelegramDetail({ connection, account, onToggle, onCreateConnection, accounts, orgId, botId, botName, saving, onRefresh }) {
  const conn = connection;
  const isConnected = !!conn;
  const hasTgAccount = !!accounts.find(a => a.provider === "telegram");

  const [botToken, setBotToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [addMode, setAddMode] = useState("auto_reply");

  // Connect: create account + connection in one flow
  const handleConnect = async () => {
    if (!botToken.trim()) { toast.error("Enter a bot token"); return; }
    setConnecting(true);
    try {
      // If no Telegram account exists, create one first
      let accountId;
      const existingAccount = accounts.find(a => a.provider === "telegram");
      if (existingAccount) {
        accountId = existingAccount.id;
      } else {
        const res = await v2.createAccount(orgId, {
          provider: "telegram",
          name: "Telegram Bot",
          credentials: { bot_token: botToken.trim() },
        });
        accountId = res.data.id;
        toast.success("Telegram account created");
      }
      // Now create the connection
      await onCreateConnection({
        account_id: accountId,
        name: `Telegram — ${botName || "Bot"}`,
        response_mode: addMode,
        destination: {},
      });
      setBotToken("");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to connect Telegram bot");
    } finally {
      setConnecting(false);
    }
  };

  // Test existing connection
  const handleTest = async () => {
    setTesting(true);
    try {
      const tgAccount = accounts.find(a => a.provider === "telegram");
      if (!tgAccount) { toast.error("No Telegram account found"); setTesting(false); return; }
      const res = await v2.testAccount(orgId, tgAccount.id);
      toast.success(`Bot verified: @${res.data.username || "connected"}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Test failed — check the bot token");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div data-testid="telegram-detail-view">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "8px" }}>
        <div style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: "rgba(38,165,228,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Send size={22} color="#26A5E4" />
        </div>
        <h1 style={{ fontFamily: fonts.heading, fontSize: "28px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>Telegram</h1>
      </div>
      <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.text.secondary, margin: "0 0 28px", lineHeight: "1.6" }}>
        Connect a Telegram bot to respond to messages using your knowledge base and API integrations.
      </p>

      {/* Bot Connection Card */}
      <div style={{
        padding: "24px", borderRadius: "14px", maxWidth: "720px",
        backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
      }}>
        <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "600", color: colors.text.primary, margin: "0 0 16px" }}>
          Bot Connection
        </p>

        {/* Info box */}
        <div style={{
          display: "flex", gap: "10px", padding: "14px 16px", borderRadius: "10px", marginBottom: "20px",
          backgroundColor: "rgba(38,165,228,0.05)", border: "1px solid rgba(38,165,228,0.15)",
        }}>
          <AlertCircle size={16} color="#26A5E4" style={{ flexShrink: 0, marginTop: "2px" }} />
          <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: 0, lineHeight: "1.6" }}>
            Create a bot with <strong style={{ color: colors.text.primary }}>@BotFather</strong> on Telegram, then paste the token below. Make sure to disable "Group Privacy" in BotFather settings if you want the bot to read all group messages.
          </p>
        </div>

        {isConnected ? (
          /* Connected state */
          <>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 16px", borderRadius: "10px", marginBottom: "16px",
              backgroundColor: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <CheckCircle size={16} color="#34D399" />
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#34D399", fontFamily: fonts.body }}>
                    Bot connected
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: colors.text.secondary, fontFamily: fonts.mono }}>
                    via {conn.account_name || account?.name || "Telegram Bot"} · {conn.enabled ? "Active" : "Paused"}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={handleTest} disabled={testing} data-testid="telegram-test-btn" style={{
                  display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "8px",
                  border: `1px solid ${colors.border.default}`, backgroundColor: colors.bg.base,
                  color: colors.text.secondary, fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
                  opacity: testing ? 0.6 : 1,
                }}>
                  <RefreshCw size={11} /> {testing ? "Testing..." : "Test"}
                </button>
                <button onClick={() => onToggle(conn)} data-testid="telegram-disconnect-btn" style={{
                  display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "8px",
                  border: `1px solid ${conn.enabled ? "rgba(244,63,94,0.2)" : "rgba(52,211,153,0.2)"}`,
                  backgroundColor: conn.enabled ? "rgba(244,63,94,0.06)" : "rgba(52,211,153,0.06)",
                  color: conn.enabled ? "#F43F5E" : "#34D399",
                  fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
                }}>
                  {conn.enabled ? <><PowerOff size={12} /> Disable</> : <><Power size={12} /> Enable</>}
                </button>
              </div>
            </div>

            {/* Response Mode (when connected) */}
            <div style={{ paddingTop: "16px", borderTop: `1px solid ${colors.border.default}` }}>
              <p style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: "500", color: colors.text.secondary, margin: "0 0 8px" }}>
                Response Mode
              </p>
              <ModeBadge mode={conn.response_mode} />
            </div>
          </>
        ) : (
          /* Not connected — show token input */
          <>
            {hasTgAccount ? (
              /* Account exists, just need to create a connection */
              <div>
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "8px", marginBottom: "16px",
                  backgroundColor: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)",
                }}>
                  <CheckCircle size={14} color="#34D399" />
                  <p style={{ fontFamily: fonts.body, fontSize: "12px", color: "#34D399", margin: 0 }}>
                    Telegram account configured. Connect it to this bot below.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                  {RESPONSE_MODES.slice(0, 2).map(mode => (
                    <button key={mode.value} onClick={() => setAddMode(mode.value)} style={{
                      flex: 1, padding: "10px", borderRadius: "8px", cursor: "pointer", textAlign: "center",
                      border: `1px solid ${addMode === mode.value ? "rgba(38,165,228,0.5)" : colors.border.default}`,
                      backgroundColor: addMode === mode.value ? "rgba(38,165,228,0.06)" : colors.bg.base,
                      fontFamily: fonts.body, fontSize: "12px", fontWeight: "600",
                      color: addMode === mode.value ? "#26A5E4" : colors.text.secondary,
                    }}>{mode.label}</button>
                  ))}
                </div>
                <button onClick={() => {
                  const tgAccount = accounts.find(a => a.provider === "telegram");
                  onCreateConnection({
                    account_id: tgAccount.id,
                    name: `Telegram — ${botName || "Bot"}`,
                    response_mode: addMode,
                    destination: {},
                  });
                }} disabled={saving} data-testid="telegram-connect-existing-btn" style={{
                  ...T.btnPrimary, width: "100%", justifyContent: "center",
                  backgroundColor: "#26A5E4", opacity: saving ? 0.6 : 1,
                }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Connect Telegram Bot
                </button>
              </div>
            ) : (
              /* No account — show token input form */
              <div>
                <label style={T.label}>Bot Token</label>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <div style={{ flex: 1, position: "relative" }}>
                    <input
                      type={showToken ? "text" : "password"}
                      value={botToken}
                      onChange={e => setBotToken(e.target.value)}
                      placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyz"
                      style={{ ...T.input, width: "100%", paddingRight: "40px" }}
                      onFocus={onFocus} onBlur={onBlur}
                      data-testid="telegram-token-input"
                    />
                    <button
                      onClick={() => setShowToken(!showToken)}
                      data-testid="telegram-toggle-token"
                      style={{
                        position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer",
                        color: colors.text.muted, padding: "4px",
                      }}>
                      <Eye size={16} />
                    </button>
                  </div>
                  <button
                    onClick={handleConnect}
                    disabled={connecting || !botToken.trim()}
                    data-testid="telegram-connect-btn"
                    style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "10px 24px", borderRadius: "10px", border: "none",
                      backgroundColor: "#26A5E4", color: "#fff",
                      fontFamily: fonts.body, fontSize: "14px", fontWeight: "600",
                      cursor: (connecting || !botToken.trim()) ? "not-allowed" : "pointer",
                      opacity: (connecting || !botToken.trim()) ? 0.6 : 1,
                      flexShrink: 0, whiteSpace: "nowrap",
                    }}>
                    <Send size={14} /> {connecting ? "Connecting..." : "Connect"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Zendesk Detail View (full production feature set) ── */
function ZendeskDetail({ connection, account, onToggle, onCreateConnection, accounts, orgId, botId, botName, saving, onRefresh }) {
  const conn = connection;
  const isConnected = !!conn;
  const hasZdAccount = !!accounts.find(a => a.provider === "zendesk");
  const creds = account?.credentials_masked || {};

  // Form state for new connections
  const [subdomain, setSubdomain] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [addMode, setAddMode] = useState("agent_assist");

  // V1 live config
  const [zdConfig, setZdConfig] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [sidebarKey, setSidebarKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [autoReply, setAutoReply] = useState(false);
  const [agentAssist, setAgentAssist] = useState(true);

  const ZD = "#17A589";

  // Load Zendesk config from V1
  useEffect(() => {
    if (!isConnected) return;
    api.get("/admin/zendesk-config").then(r => {
      setZdConfig(r.data);
      setAutoReply(r.data?.response_mode === "auto_reply");
      setAgentAssist(r.data?.response_mode === "agent_assist" || r.data?.response_mode === "both" || r.data?.agent_assist_enabled);
    }).catch(() => {});
    api.get("/admin/zendesk-config/webhook-url").then(r => setWebhookUrl(r.data?.webhook_url || "")).catch(() => {});
    api.get("/admin/zendesk/sidebar-key").then(r => setSidebarKey(r.data?.sidebar_api_key || "")).catch(() => {});
  }, [isConnected]);

  const handleTest = async () => {
    setTesting(true);
    try {
      await api.post("/admin/zendesk-config/test");
      toast.success("Zendesk connection verified");
    } catch (e) { toast.error(e.response?.data?.detail || "Test failed"); }
    finally { setTesting(false); }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const mode = autoReply && agentAssist ? "both" : autoReply ? "auto_reply" : agentAssist ? "agent_assist" : "agent_assist";
      await api.put("/admin/zendesk-config", { response_mode: mode, agent_assist_enabled: agentAssist });
      toast.success("Settings saved");
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to save"); }
    finally { setSavingSettings(false); }
  };

  const handleRegenerateKey = async () => {
    setRegenerating(true);
    try {
      const r = await api.post("/admin/zendesk/sidebar-key/regenerate");
      setSidebarKey(r.data?.sidebar_api_key || "");
      toast.success("API key regenerated");
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to regenerate"); }
    finally { setRegenerating(false); }
  };

  const handleConnect = async () => {
    if (!subdomain.trim() || !email.trim() || !apiToken.trim()) { toast.error("All fields are required"); return; }
    setConnecting(true);
    try {
      let accountId;
      const existing = accounts.find(a => a.provider === "zendesk");
      if (existing) { accountId = existing.id; }
      else {
        const res = await v2.createAccount(orgId, {
          provider: "zendesk", name: `${subdomain}.zendesk.com`,
          credentials: { subdomain: subdomain.trim(), user_email: email.trim(), api_token: apiToken.trim(), auth_type: "api_token" },
        });
        accountId = res.data.id;
        toast.success("Zendesk account created");
      }
      await onCreateConnection({ account_id: accountId, name: `Zendesk — ${botName || "Bot"}`, response_mode: addMode, destination: {} });
      setSubdomain(""); setEmail(""); setApiToken("");
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to connect"); }
    finally { setConnecting(false); }
  };

  const connSubdomain = creds.subdomain || zdConfig?.subdomain || "";
  const connEmail = creds.user_email || creds.email || zdConfig?.email || "";
  const connScopes = zdConfig?.scopes || "tickets:read tickets:write users:read";

  return (
    <div data-testid="zendesk-detail-view" style={{ maxWidth: "780px" }}>

      {/* ── Connection ── */}
      <div style={cardStyle} data-testid="zendesk-connection-card">
        <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "600", color: colors.text.primary, margin: "0 0 16px" }}>Connection</p>

        {isConnected ? (
          <>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 16px", borderRadius: "10px", marginBottom: "12px",
              backgroundColor: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <CheckCircle size={16} color="#34D399" />
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#34D399", fontFamily: fonts.body }}>
                    Connected to {connSubdomain ? `${connSubdomain}.zendesk.com` : "Zendesk"}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: "11px", color: colors.text.secondary, fontFamily: fonts.mono }}>
                    {connEmail && <>Email: {connEmail}. </>}Scopes: {connScopes}
                  </p>
                </div>
              </div>
              <button onClick={handleTest} disabled={testing} data-testid="zendesk-test-btn" style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "8px",
                border: `1px solid ${colors.border.default}`, backgroundColor: colors.bg.base,
                color: colors.text.secondary, fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
                opacity: testing ? 0.6 : 1,
              }}>
                <RefreshCw size={11} /> {testing ? "Testing..." : "Test"}
              </button>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => onToggle(conn)} data-testid="zendesk-reconnect-btn" style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "8px",
                border: `1px solid ${colors.border.default}`, backgroundColor: colors.bg.base,
                color: colors.text.secondary, fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
              }}>
                <RefreshCw size={11} /> Reconnect
              </button>
              <button onClick={() => onToggle(conn)} data-testid="zendesk-disconnect-btn" style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "8px",
                border: "1px solid rgba(244,63,94,0.2)", backgroundColor: "rgba(244,63,94,0.06)",
                color: "#F43F5E", fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
              }}>
                <WifiOff size={11} /> Disconnect
              </button>
            </div>
          </>
        ) : (
          /* Not connected — token form or account-exists CTA */
          hasZdAccount ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "8px", marginBottom: "16px", backgroundColor: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)" }}>
                <CheckCircle size={14} color="#34D399" />
                <p style={{ fontFamily: fonts.body, fontSize: "12px", color: "#34D399", margin: 0 }}>Zendesk account configured. Connect it to this bot below.</p>
              </div>
              <button onClick={() => {
                const a = accounts.find(x => x.provider === "zendesk");
                onCreateConnection({ account_id: a.id, name: `Zendesk — ${botName || "Bot"}`, response_mode: addMode, destination: {} });
              }} disabled={saving} data-testid="zendesk-connect-existing-btn" style={{ ...T.btnPrimary, width: "100%", justifyContent: "center", backgroundColor: ZD }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Headphones size={14} />} Connect Zendesk Bot
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", gap: "10px", padding: "14px 16px", borderRadius: "10px", marginBottom: "18px", backgroundColor: `${ZD}08`, border: `1px solid ${ZD}25` }}>
                <AlertCircle size={16} color={ZD} style={{ flexShrink: 0, marginTop: "2px" }} />
                <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: 0, lineHeight: "1.6" }}>
                  Go to <strong style={{ color: colors.text.primary }}>Zendesk Admin → Apps and Integrations → APIs → Zendesk API</strong> and generate an API token. Use the subdomain from your Zendesk URL (e.g. <strong style={{ color: colors.text.primary }}>mycompany</strong>.zendesk.com).
                </p>
              </div>
              <div style={{ marginBottom: "14px" }}>
                <label style={T.label}>Subdomain</label>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <input value={subdomain} onChange={e => setSubdomain(e.target.value)} placeholder="mycompany" style={{ ...T.input, flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: "none" }} onFocus={onFocus} onBlur={onBlur} data-testid="zendesk-subdomain-input" />
                  <span style={{ padding: "10px 14px", backgroundColor: colors.bg.base, border: `1px solid ${colors.border.default}`, borderTopRightRadius: "10px", borderBottomRightRadius: "10px", fontFamily: fonts.mono, fontSize: "12px", color: colors.text.muted, whiteSpace: "nowrap" }}>.zendesk.com</span>
                </div>
              </div>
              <div style={{ marginBottom: "14px" }}>
                <label style={T.label}>Admin Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@company.com" style={{ ...T.input, width: "100%" }} onFocus={onFocus} onBlur={onBlur} data-testid="zendesk-email-input" />
              </div>
              <div style={{ marginBottom: "18px" }}>
                <label style={T.label}>API Token</label>
                <div style={{ position: "relative" }}>
                  <input type={showToken ? "text" : "password"} value={apiToken} onChange={e => setApiToken(e.target.value)} placeholder="Your Zendesk API token" style={{ ...T.input, width: "100%", paddingRight: "40px" }} onFocus={onFocus} onBlur={onBlur} data-testid="zendesk-token-input" />
                  <button onClick={() => setShowToken(!showToken)} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "4px" }}><Eye size={16} /></button>
                </div>
              </div>
              <button onClick={handleConnect} disabled={connecting || !subdomain.trim() || !email.trim() || !apiToken.trim()} data-testid="zendesk-connect-btn" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%", padding: "12px 24px", borderRadius: "10px", border: "none", backgroundColor: ZD, color: "#fff", fontFamily: fonts.body, fontSize: "14px", fontWeight: "600", cursor: connecting ? "not-allowed" : "pointer", opacity: (connecting || !subdomain.trim() || !email.trim() || !apiToken.trim()) ? 0.6 : 1,
              }}>
                <Headphones size={14} /> {connecting ? "Connecting..." : "Connect"}
              </button>
            </div>
          )
        )}
      </div>

      {/* ── Only show remaining sections when connected ── */}
      {isConnected && (
        <>
          {/* ── Integration Status ── */}
          <div style={cardStyle} data-testid="zendesk-status-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>Integration Status</p>
              <span style={{
                display: "flex", alignItems: "center", gap: "6px", padding: "5px 14px", borderRadius: "8px",
                backgroundColor: conn.enabled ? "rgba(52,211,153,0.1)" : "rgba(244,63,94,0.1)",
                color: conn.enabled ? "#34D399" : "#F43F5E",
                fontFamily: fonts.body, fontSize: "12px", fontWeight: "600",
              }}>
                {conn.enabled ? <CheckCircle size={13} /> : <PowerOff size={13} />}
                {conn.enabled ? "Active" : "Inactive"}
              </span>
            </div>
            <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.secondary, margin: "8px 0 0" }}>
              Webhooks and AI responses are {conn.enabled ? "currently running" : "paused"} for incoming tickets.
            </p>
          </div>

          {/* ── Response Mode ── */}
          <div style={cardStyle} data-testid="zendesk-response-mode-card">
            <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "600", color: colors.text.primary, margin: "0 0 16px" }}>Response Mode</p>

            {/* Auto-Reply */}
            <div style={{
              display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "14px",
              padding: "14px 16px", borderRadius: "10px", marginBottom: "10px",
              backgroundColor: autoReply ? `${ZD}08` : colors.bg.base,
              border: `1px solid ${autoReply ? `${ZD}30` : colors.border.default}`,
            }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <MessageSquare size={16} color={autoReply ? ZD : colors.text.muted} style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 4px" }}>Auto-Reply</p>
                  <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: 0, lineHeight: "1.5" }}>
                    Automatically post a public AI-generated reply when a new ticket is created.
                  </p>
                </div>
              </div>
              <ToggleSwitch on={autoReply} onChange={() => setAutoReply(!autoReply)} testId="toggle-auto-reply" />
            </div>

            {/* Agent Assist */}
            <div style={{
              display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "14px",
              padding: "14px 16px", borderRadius: "10px", marginBottom: "16px",
              backgroundColor: agentAssist ? `${ZD}08` : colors.bg.base,
              border: `1px solid ${agentAssist ? `${ZD}30` : colors.border.default}`,
            }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <Users size={16} color={agentAssist ? ZD : colors.text.muted} style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 4px" }}>Agent Assist</p>
                  <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: 0, lineHeight: "1.5" }}>
                    Sends AI suggestions for agents to review via the Zendesk sidebar app.
                  </p>
                </div>
              </div>
              <ToggleSwitch on={agentAssist} onChange={() => setAgentAssist(!agentAssist)} testId="toggle-agent-assist" />
            </div>

            <button onClick={handleSaveSettings} disabled={savingSettings} data-testid="zendesk-save-settings-btn" style={{
              ...T.btnPrimary, backgroundColor: ZD, opacity: savingSettings ? 0.6 : 1,
            }}>
              <Shield size={14} /> {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          </div>

          {/* ── Webhook Setup ── */}
          <div style={cardStyle} data-testid="zendesk-webhook-card">
            <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "600", color: colors.text.primary, margin: "0 0 6px" }}>Webhook Setup</p>
            <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: "0 0 16px", lineHeight: "1.5" }}>
              Add this URL as a webhook in Zendesk Admin Center, then create a trigger for "Ticket is Created".
            </p>

            <label style={T.label}>Webhook URL</label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <input value={webhookUrl} readOnly style={{ ...T.input, flex: 1, fontSize: "11px", fontFamily: fonts.mono, color: colors.text.muted }} data-testid="zendesk-webhook-url" />
              <button onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copied webhook URL"); }} data-testid="zendesk-copy-webhook" style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px", borderRadius: "8px",
                border: `1px solid ${colors.border.default}`, backgroundColor: colors.bg.base,
                color: colors.text.secondary, fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
              }}>
                <Copy size={12} /> Copy
              </button>
            </div>

            <a href={connSubdomain ? `https://${connSubdomain}.zendesk.com/admin/objects-rules/rules/triggers` : "https://support.zendesk.com"} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              fontFamily: fonts.body, fontSize: "12px", color: colors.brand.light, textDecoration: "none",
            }}>
              <ExternalLink size={11} /> Open Zendesk Triggers
            </a>
          </div>

          {/* ── Sidebar App – Agent Assist ── */}
          <div style={cardStyle} data-testid="zendesk-sidebar-card">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <Settings size={16} color={ZD} />
              <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>Sidebar App — Agent Assist</p>
            </div>
            <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: "0 0 20px", lineHeight: "1.5" }}>
              Install the BitBot Pro sidebar in Zendesk so agents can generate AI suggestions on any ticket — without auto-replying.
            </p>

            {/* Step 1 */}
            <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: colors.bg.base, border: `1px solid ${colors.border.default}`, marginBottom: "14px" }}>
              <p style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: "600", color: colors.text.primary, margin: "0 0 10px" }}>Step 1: Download the app</p>
              <button data-testid="zendesk-download-sidebar" style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 18px", borderRadius: "8px", border: "none", cursor: "pointer",
                backgroundColor: ZD, color: "#fff",
                fontFamily: fonts.body, fontSize: "13px", fontWeight: "600",
              }}>
                <ExternalLink size={13} /> Download Sidebar App (.zip)
              </button>
            </div>

            {/* Step 2 */}
            <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: colors.bg.base, border: `1px solid ${colors.border.default}`, marginBottom: "14px" }}>
              <p style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: "600", color: colors.text.primary, margin: "0 0 10px" }}>Step 2: Install in Zendesk</p>
              <ol style={{ margin: 0, paddingLeft: "18px", fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, lineHeight: "1.8" }}>
                <li>Go to <strong style={{ color: colors.text.primary }}>Zendesk Admin Center → Apps and Integrations → Apps → Zendesk Support apps</strong>.</li>
                <li>Click <strong style={{ color: colors.text.primary }}>Upload private app</strong>, select the downloaded .ZIP.</li>
                <li>When prompted, paste the <strong style={{ color: colors.text.primary }}>Sidebar API Key</strong> below into the settings.</li>
                <li>The Sidebar Pro URL will be pre-filled — verify it matches your deployment.</li>
                <li>Click <strong style={{ color: colors.text.primary }}>Install</strong>.</li>
              </ol>
            </div>

            {/* Step 3 */}
            <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: colors.bg.base, border: `1px solid ${colors.border.default}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                <Shield size={14} color={ZD} />
                <p style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>Step 3: Sidebar API Key</p>
              </div>
              <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.secondary, margin: "0 0 10px", lineHeight: "1.5" }}>
                Paste this key into the app settings when installing. It authenticates your Zendesk requests to BitBot Pro.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <input value={sidebarKey} readOnly style={{ ...T.input, flex: 1, fontSize: "11px", fontFamily: fonts.mono, color: colors.text.muted }} data-testid="zendesk-sidebar-key" />
                <button onClick={() => { navigator.clipboard.writeText(sidebarKey); toast.success("Copied API key"); }} data-testid="zendesk-copy-sidebar-key" style={{
                  display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px", borderRadius: "8px",
                  border: `1px solid ${colors.border.default}`, backgroundColor: colors.bg.panel,
                  color: colors.text.secondary, fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
                }}>
                  <Copy size={12} /> Copy
                </button>
              </div>
              <button onClick={handleRegenerateKey} disabled={regenerating} data-testid="zendesk-regenerate-key" style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "8px",
                border: `1px solid ${colors.border.default}`, backgroundColor: colors.bg.panel,
                color: colors.text.secondary, fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
                opacity: regenerating ? 0.6 : 1,
              }}>
                <RefreshCw size={11} /> {regenerating ? "Regenerating..." : "Regenerate key"}
              </button>
            </div>
          </div>

          {/* ── How it Works ── */}
          <div style={cardStyle} data-testid="zendesk-how-it-works">
            <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "600", color: colors.text.primary, margin: "0 0 14px" }}>How it Works</p>
            <ul style={{ margin: 0, paddingLeft: "18px", fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, lineHeight: "2" }}>
              <li>A Zendesk trigger fires when a new ticket is created and sends a webhook to BitBot Pro.</li>
              <li>BitBot Pro fetches the ticket content, searches your Knowledge Base, and runs API Integrations.</li>
              <li>An AI response is generated based on your bot's personality and knowledge.</li>
              <li><strong style={{ color: ZD }}>Auto-Reply:</strong> Response is posted as a public ticket comment.</li>
              <li><strong style={{ color: ZD }}>Agent Assist:</strong> Response is sent for agents to view in the Zendesk sidebar app.</li>
              <li>All ticket conversations appear in the Conversations tab with platform: <strong style={{ color: colors.text.primary }}>zendesk</strong>.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Main Integrations Page ── */
export default function IntegrationsPage() {
  const { selectedOrg, selectedBot } = useAuth();
  const orgId = selectedOrg?.id;
  const botId = selectedBot?.id;

  const [connections, setConnections] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeProvider, setActiveProvider] = useState(null);

  const fetchData = async () => {
    if (!orgId || !botId) return;
    setLoading(true);
    try {
      const [connRes, accRes] = await Promise.all([
        v2.listConnections(orgId, botId),
        v2.listAccounts(orgId),
      ]);
      setConnections(connRes.data.connections || []);
      setAccounts((accRes.data.accounts || []).filter(a => a.status === "connected"));
    } catch {
      toast.error("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [orgId, botId]);

  const handleToggle = async (conn) => {
    try {
      const res = await v2.toggleConnection(orgId, botId, conn.id);
      setConnections(prev => prev.map(c => c.id === conn.id ? { ...c, enabled: res.data.enabled } : c));
      toast.success(res.data.enabled ? "Connection enabled" : "Connection disabled");
    } catch {
      toast.error("Failed to toggle connection");
    }
  };

  const handleCreateConnection = async (data) => {
    setSaving(true);
    try {
      await v2.createConnection(orgId, botId, data);
      toast.success("Connection created");
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create connection");
    } finally {
      setSaving(false);
    }
  };

  // Build lookup: provider → first connection
  const connByProvider = {};
  for (const c of connections) {
    if (!connByProvider[c.provider]) connByProvider[c.provider] = c;
  }
  const accByProvider = {};
  for (const a of accounts) {
    if (!accByProvider[a.provider]) accByProvider[a.provider] = a;
  }

  if (!selectedBot) return (
    <div style={T.page}>
      <p style={{ ...T.sectionSub, textAlign: "center", marginTop: "60px" }}>Select a bot to manage integrations.</p>
    </div>
  );

  // Provider detail view
  if (activeProvider) {
    const conn = connByProvider[activeProvider];
    const acc = accByProvider[activeProvider];
    const commonProps = {
      connection: conn, account: acc, onToggle: handleToggle,
      onCreateConnection: handleCreateConnection, accounts, orgId, botId,
      botName: selectedBot?.name, saving, onRefresh: fetchData,
    };

    return (
      <div style={T.page} data-testid="integrations-page">
        <button onClick={() => setActiveProvider(null)} style={{ ...T.btnGhost, marginBottom: "16px", fontSize: "12px" }}
          data-testid="back-to-integrations">
          ← Back to Integrations
        </button>
        {activeProvider === "discord" && <DiscordDetail {...commonProps} />}
        {activeProvider === "telegram" && <TelegramDetail {...commonProps} />}
        {activeProvider === "zendesk" && <ZendeskDetail {...commonProps} />}
      </div>
    );
  }

  // Main page — 3 provider cards
  return (
    <div style={T.page} data-testid="integrations-page">
      <p style={T.overline}>Connections</p>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ ...T.h1, margin: "0 0 6px" }}>Integrations</h1>
        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: 0 }}>
          Connect this bot to messaging platforms. Each bot has one connection per provider.
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
          <Loader2 size={24} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {Object.entries(PROVIDER_META).map(([key, meta]) => {
            const conn = connByProvider[key];
            const isActive = conn?.enabled;
            const Icon = meta.icon;
            return (
              <button key={key} onClick={() => setActiveProvider(key)}
                data-testid={`provider-card-${key}`}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px",
                  padding: "20px", borderRadius: "14px", cursor: "pointer", textAlign: "left", width: "100%",
                  border: `1px solid ${conn ? meta.color + "40" : colors.border.default}`,
                  backgroundColor: conn ? meta.color + "08" : colors.bg.panel,
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = meta.color; e.currentTarget.style.boxShadow = `0 0 0 1px ${meta.color}30`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = conn ? meta.color + "40" : colors.border.default; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <div style={{
                    width: "42px", height: "42px", borderRadius: "12px",
                    backgroundColor: meta.color + "18",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={20} color={meta.color} />
                  </div>
                  {conn ? (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "20px",
                      backgroundColor: isActive ? "rgba(52,211,153,0.1)" : "rgba(251,146,60,0.1)",
                      border: `1px solid ${isActive ? "rgba(52,211,153,0.2)" : "rgba(251,146,60,0.2)"}`,
                    }}>
                      {isActive ? <CheckCircle size={12} color="#34D399" /> : <PowerOff size={12} color="#FB923C" />}
                      <span style={{
                        fontSize: "11px", fontWeight: "600", fontFamily: fonts.mono,
                        color: isActive ? "#34D399" : "#FB923C",
                      }}>{isActive ? "Active" : "Paused"}</span>
                    </div>
                  ) : (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "20px",
                      backgroundColor: colors.bg.surface, border: `1px solid ${colors.border.default}`,
                    }}>
                      <Plus size={12} color={colors.text.muted} />
                      <span style={{ fontSize: "11px", fontWeight: "500", color: colors.text.muted, fontFamily: fonts.mono }}>Connect</span>
                    </div>
                  )}
                </div>
                <div>
                  <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: "0 0 3px" }}>
                    {meta.label}
                  </p>
                  <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, margin: 0, lineHeight: "1.4" }}>
                    {meta.desc}
                  </p>
                </div>
                {conn && (
                  <div style={{
                    width: "100%", padding: "8px 12px", borderRadius: "8px",
                    backgroundColor: colors.bg.base, border: `1px solid ${colors.border.default}`, marginTop: "-4px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <ModeBadge mode={conn.response_mode} />
                      <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>
                        via {conn.account_name}
                      </span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
