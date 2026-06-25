import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Zap, CheckCircle, AlertCircle, ExternalLink, RefreshCw, Radio, Hash, MessageSquare, AtSign, Link2, Server, Shield, Settings, Save, Eye, EyeOff, UserCheck, Megaphone, Plus, Trash2, Mail } from "lucide-react";
import { colors, fonts, T, onFocus, onBlur } from "../theme";

const LISTEN_MODES = [
  { key: "mention_only", icon: AtSign, label: "Mention Only", desc: "Responds when @tagged or in DMs" },
  { key: "all_channels", icon: Radio, label: "All Channels", desc: "Responds to every human message" },
  { key: "specific_channels", icon: Hash, label: "Specific Channels", desc: "Pick which channels to monitor" },
];

const REPLY_STYLES = [
  { key: "natural", icon: MessageSquare, label: "Natural reply", desc: "Replies without mentioning the user" },
  { key: "with_mention", icon: AtSign, label: "With @mention", desc: "Pings the user in the reply" },
];

const modeBtn = (active) => ({
  flex: 1, padding: "10px 12px", border: `1px solid ${active ? colors.brand.cyan : colors.border.default}`,
  borderRadius: "10px", backgroundColor: active ? "rgba(96,165,250,0.06)" : colors.bg.base,
  color: active ? colors.text.primary : colors.text.secondary, cursor: "pointer",
  fontFamily: fonts.body, fontSize: "12px", fontWeight: active ? "600" : "400",
  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "3px",
  transition: "all 0.2s",
});

const channelChip = (selected) => ({
  display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px",
  border: `1px solid ${selected ? colors.brand.cyan : colors.border.default}`,
  borderRadius: "10px", backgroundColor: selected ? "rgba(96,165,250,0.06)" : colors.bg.base,
  cursor: "pointer", transition: "all 0.2s",
  fontFamily: fonts.body, fontSize: "12px",
  color: selected ? colors.text.primary : colors.text.secondary,
});

function CredentialField({ label, value, onChange, placeholder, isSecret, testId, hint }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={T.label}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={isSecret && !show ? "password" : "text"}
          value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} data-testid={testId}
          style={{ ...T.input, paddingRight: isSecret ? "40px" : undefined }}
          onFocus={onFocus} onBlur={onBlur}
        />
        {isSecret && (
          <button onClick={() => setShow(!show)} type="button"
            style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "4px" }}>
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {hint && <p style={T.hint}>{hint}</p>}
    </div>
  );
}

function AppCredentialsPanel() {
  const [creds, setCreds] = useState({ client_id: "", client_secret: "", redirect_uri: "", bot_token: "" });
  const [existing, setExisting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.get(`/discord/app-config`).then(r => {
      setExisting(r.data);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    const payload = {};
    if (creds.client_id.trim()) payload.client_id = creds.client_id.trim();
    if (creds.client_secret.trim()) payload.client_secret = creds.client_secret.trim();
    if (creds.redirect_uri.trim()) payload.redirect_uri = creds.redirect_uri.trim();
    if (creds.bot_token.trim()) payload.bot_token = creds.bot_token.trim();
    if (Object.keys(payload).length === 0) { toast.error("No changes to save"); return; }
    setSaving(true);
    try {
      await api.put(`/discord/app-config`, payload);
      toast.success("Discord credentials updated! Restart the bot to apply changes.");
      setCreds({ client_id: "", client_secret: "", redirect_uri: "", bot_token: "" });
      const r = await api.get(`/discord/app-config`);
      setExisting(r.data);
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to update"); }
    finally { setSaving(false); }
  };

  const allConfigured = existing?.has_client_id && existing?.has_client_secret && existing?.has_redirect_uri && existing?.has_bot_token;

  return (
    <div style={{ ...T.card, marginBottom: "20px", borderColor: allConfigured ? "rgba(52,211,153,0.2)" : colors.border.default }}>
      <button
        onClick={() => setExpanded(!expanded)}
        data-testid="app-credentials-toggle"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
          background: "none", border: "none", cursor: "pointer", padding: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "rgba(96,165,250,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Settings size={18} color={colors.brand.cyan} />
          </div>
          <div style={{ textAlign: "left" }}>
            <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>Discord App Credentials</p>
            <p style={{ fontFamily: fonts.body, fontSize: "11px", color: allConfigured ? colors.brand.success : colors.text.secondary, margin: "2px 0 0" }}>
              {allConfigured ? "All credentials configured" : "Configure your Discord application details"}
            </p>
          </div>
        </div>
        <span style={{ color: colors.text.muted, fontSize: "18px", transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none" }}>
          &#9662;
        </span>
      </button>

      {expanded && (
        <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: `1px solid ${colors.border.subtle}` }}>
          {/* Status indicators */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "20px" }}>
            {[
              { label: "Client ID", ok: existing?.has_client_id, display: existing?.client_id },
              { label: "Client Secret", ok: existing?.has_client_secret, display: existing?.client_secret },
              { label: "Redirect URI", ok: existing?.has_redirect_uri, display: existing?.redirect_uri },
              { label: "Bot Token", ok: existing?.has_bot_token, display: existing?.bot_token },
            ].map(({ label, ok, display }) => (
              <div key={label} style={{
                display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px",
                backgroundColor: ok ? "rgba(52,211,153,0.04)" : "rgba(244,63,94,0.04)",
                border: `1px solid ${ok ? "rgba(52,211,153,0.15)" : "rgba(244,63,94,0.15)"}`,
                borderRadius: "8px",
              }}>
                {ok ? <CheckCircle size={12} color={colors.brand.success} /> : <AlertCircle size={12} color={colors.brand.error} />}
                <span style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.secondary }}>{label}</span>
                {ok && display && <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, marginLeft: "auto" }}>{display}</span>}
              </div>
            ))}
          </div>

          <CredentialField
            label="Client ID" value={creds.client_id} onChange={v => setCreds(p => ({ ...p, client_id: v }))}
            placeholder={existing?.client_id || "Your Discord Application Client ID"}
            testId="app-client-id" hint="From Discord Developer Portal > Your App > General Information"
          />
          <CredentialField
            label="Client Secret" value={creds.client_secret} onChange={v => setCreds(p => ({ ...p, client_secret: v }))}
            placeholder={existing?.has_client_secret ? "Current: " + existing.client_secret : "Your Discord Application Client Secret"}
            isSecret testId="app-client-secret" hint="From Discord Developer Portal > Your App > General Information"
          />
          <CredentialField
            label="Redirect URI" value={creds.redirect_uri} onChange={v => setCreds(p => ({ ...p, redirect_uri: v }))}
            placeholder={existing?.redirect_uri || window.location.origin + "/api/discord/callback"}
            testId="app-redirect-uri"
            hint={`Must match exactly in Discord Developer Portal > OAuth2 > Redirects. Suggested: ${window.location.origin}/api/discord/callback`}
          />
          <CredentialField
            label="Bot Token" value={creds.bot_token} onChange={v => setCreds(p => ({ ...p, bot_token: v }))}
            placeholder={existing?.has_bot_token ? "Current: " + existing.bot_token : "Your Discord Bot Token"}
            isSecret testId="app-bot-token" hint="From Discord Developer Portal > Your App > Bot > Reset Token"
          />

          <button onClick={handleSave} disabled={saving} data-testid="save-app-credentials-btn"
            style={{ ...T.btnPrimary, opacity: saving ? 0.6 : 1, marginTop: "4px" }}>
            <Save size={14} /> {saving ? "Saving..." : "Save Credentials"}
          </button>
          <p style={{ ...T.hint, marginTop: "8px" }}>
            Leave fields empty to keep existing values. Only filled fields are updated.
          </p>
        </div>
      )}
    </div>
  );
}


function ShareInviteLink() {
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailName, setEmailName] = useState("");
  const [emailNote, setEmailNote] = useState("");
  const [sending, setSending] = useState(false);

  const fetchLink = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/discord/share-oauth-url`);
      setLink(r.data?.url || "");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to generate link");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLink(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Couldn't copy. Long-press to copy manually.");
    }
  };

  const sendEmail = async () => {
    if (!emailTo.trim() || !emailTo.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    setSending(true);
    try {
      await api.post(`/discord/send-invite-email`, {
        to_email: emailTo.trim(),
        recipient_name: emailName.trim() || null,
        invite_url: link,
        custom_note: emailNote.trim() || null,
      });
      toast.success(`Invite sent to ${emailTo}`);
      setEmailOpen(false);
      setEmailTo(""); setEmailName(""); setEmailNote("");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  if (!link && !loading) return null;

  return (
    <div data-testid="share-invite-link" style={{
      marginTop: "10px", padding: "12px 14px",
      backgroundColor: colors.bg.base,
      border: `1px solid ${colors.border.default}`, borderRadius: "10px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <Link2 size={13} color={colors.brand.light} />
        <p style={{ margin: 0, fontFamily: fonts.heading, fontSize: "12px", fontWeight: "600", color: colors.text.primary }}>
          Share invite link
        </p>
        <span style={{ fontFamily: fonts.body, fontSize: "10px", color: colors.text.muted, marginLeft: "auto" }}>
          For another server admin
        </span>
      </div>
      <p style={{ margin: "0 0 10px", fontFamily: fonts.body, fontSize: "11px", color: colors.text.secondary, lineHeight: "1.5" }}>
        Send this link to anyone with Manage Server permission on a Discord server. They click it, authorize the bot,
        and it lands in your admin panel ready to configure. They never need to log into BridgeBot.
      </p>
      <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
        <input
          type="text" readOnly value={link || (loading ? "Loading…" : "")}
          data-testid="share-invite-input"
          onClick={(e) => e.target.select()}
          style={{
            flex: 1, padding: "8px 10px",
            backgroundColor: colors.bg.surface, color: colors.text.primary,
            border: `1px solid ${colors.border.subtle}`, borderRadius: "8px",
            fontFamily: fonts.mono, fontSize: "11px", outline: "none",
          }}
        />
        <button
          onClick={copy} disabled={!link} data-testid="share-invite-copy"
          style={{
            padding: "8px 12px",
            backgroundColor: copied ? "rgba(52,211,153,0.1)" : "rgba(96,165,250,0.08)",
            border: `1px solid ${copied ? "rgba(52,211,153,0.3)" : "rgba(96,165,250,0.25)"}`,
            borderRadius: "8px",
            color: copied ? colors.brand.success : colors.brand.light,
            fontFamily: fonts.body, fontSize: "11px", fontWeight: "600",
            cursor: link ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: "5px",
          }}
        >
          {copied ? <><CheckCircle size={11} /> Copied</> : <><Settings size={11} /> Copy</>}
        </button>
        <button
          onClick={() => setEmailOpen(!emailOpen)} disabled={!link} data-testid="share-invite-email-toggle"
          style={{
            padding: "8px 12px",
            backgroundColor: emailOpen ? "rgba(96,165,250,0.12)" : "rgba(96,165,250,0.08)",
            border: `1px solid rgba(96,165,250,0.25)`,
            borderRadius: "8px",
            color: colors.brand.light,
            fontFamily: fonts.body, fontSize: "11px", fontWeight: "600",
            cursor: link ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", gap: "5px",
          }}
        >
          <Mail size={11} /> {emailOpen ? "Cancel" : "Email"}
        </button>
      </div>

      {emailOpen && (
        <div data-testid="share-email-form" style={{
          marginTop: "10px",
          padding: "12px",
          backgroundColor: colors.bg.surface,
          border: `1px solid ${colors.border.default}`,
          borderRadius: "8px",
        }}>
          <p style={{ margin: "0 0 10px", fontFamily: fonts.heading, fontSize: "12px", fontWeight: "600", color: colors.text.primary }}>
            Send invite via email
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
            <input
              type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)}
              placeholder="recipient@example.com" data-testid="share-email-to"
              onFocus={onFocus} onBlur={onBlur}
              style={{ ...T.input, padding: "8px 10px", fontSize: "12px" }}
            />
            <input
              type="text" value={emailName} onChange={(e) => setEmailName(e.target.value)}
              placeholder="Recipient name (optional)" data-testid="share-email-name"
              onFocus={onFocus} onBlur={onBlur}
              style={{ ...T.input, padding: "8px 10px", fontSize: "12px" }}
            />
          </div>
          <textarea
            value={emailNote} onChange={(e) => setEmailNote(e.target.value)}
            placeholder="Optional personal note (e.g., 'Hi! This will help us reply to support tickets faster.')"
            data-testid="share-email-note"
            rows={2}
            onFocus={onFocus} onBlur={onBlur}
            style={{ ...T.input, width: "100%", padding: "8px 10px", fontSize: "12px", resize: "vertical", marginBottom: "8px" }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={sendEmail} disabled={sending || !emailTo}
              data-testid="share-email-send"
              style={{
                padding: "8px 16px",
                backgroundColor: colors.brand.light,
                color: "#0B1120", border: "none", borderRadius: "8px",
                fontFamily: fonts.body, fontSize: "12px", fontWeight: "600",
                cursor: (sending || !emailTo) ? "not-allowed" : "pointer",
                opacity: (sending || !emailTo) ? 0.6 : 1,
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              <Mail size={12} /> {sending ? "Sending…" : "Send Invite"}
            </button>
          </div>
        </div>
      )}

      <p style={{ margin: "8px 0 0", fontFamily: fonts.body, fontSize: "10px", color: colors.text.muted, lineHeight: "1.5" }}>
        Anyone with this link can invite the bot. The new server auto-links to <strong>this</strong> instance, and the
        invited admin lands on a friendly thank-you page (no BridgeBot login needed). To rotate, visit <a href="/admin/discord-app-setup" style={{ color: colors.brand.light }}>Discord App Setup</a>.
      </p>
    </div>
  );
}


export default function DiscordSettings() {
  const { user, selectedInstance } = useAuth();
  const instanceId = selectedInstance?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const [token, setToken] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [listenMode, setListenMode] = useState("mention_only");
  const [replyStyle, setReplyStyle] = useState("natural");
  const [monitoredChannelIds, setMonitoredChannelIds] = useState([]);
  const [staffRoleName, setStaffRoleName] = useState("");
  const [handoffCooldown, setHandoffCooldown] = useState(15);
  const [handoffFollowup, setHandoffFollowup] = useState("Is there anything else I can help with?");
  const [passiveMode, setPassiveMode] = useState(false);
  const [scripted, setScripted] = useState({
    enabled: false,
    primary_message: "",
    update_message: "",
    variants: [],
    acknowledgment_replies: [],
    fallback_message: "",
    max_attempts: 10,
    reset_hours: 24,
    rephrase_mode: "hybrid",
    classify_intent: true,
  });
  const [scriptedCounters, setScriptedCounters] = useState({ active_counters: 0, skips_last_24h: 0 });
  const [resettingCounters, setResettingCounters] = useState(false);
  const [handoffChannels, setHandoffChannels] = useState([]);
  const [resumingHandoff, setResumingHandoff] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [existing, setExisting] = useState(null);
  const [status, setStatus] = useState({ status: "offline", bot_name: null });
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [channels, setChannels] = useState([]);
  const [fetchingChannels, setFetchingChannels] = useState(false);
  const [inviting, setInviting] = useState(false);
  const pollRef = useRef(null);
  const isAdmin = user?.role === "superadmin";

  useEffect(() => {
    const oauthStatus = searchParams.get("oauth");
    const guild = searchParams.get("guild");
    const reason = searchParams.get("reason");
    if (oauthStatus === "success") {
      toast.success(guild ? `Bot invited to "${guild}" successfully!` : "Bot invited successfully!");
      setSearchParams({}, { replace: true });
    } else if (oauthStatus === "error") {
      toast.error(reason === "access_denied" ? "Bot invitation was cancelled." : `Failed to invite bot: ${reason || "unknown error"}`);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const loadConfig = useCallback(() => {
    api.get(`/discord/config`).then(r => {
      setExisting(r.data);
      setIsActive(r.data?.is_active || false);
      setListenMode(r.data?.listen_mode || "mention_only");
      setReplyStyle(r.data?.reply_style || "natural");
      setMonitoredChannelIds(r.data?.monitored_channel_ids || []);
      setStaffRoleName(r.data?.staff_role_name || "");
      setHandoffCooldown(r.data?.handoff_cooldown_minutes || 15);
      setHandoffFollowup(r.data?.handoff_followup_message || "Is there anything else I can help with?");
      setPassiveMode(r.data?.passive_mode || false);
      const sc = r.data?.scripted_mode || {};
      const DEFAULT_ACKS = ["You're welcome!", "Anytime — happy to help!", "No problem!", "Glad I could help."];
      setScripted({
        enabled: !!sc.enabled,
        primary_message: sc.primary_message || "",
        update_message: sc.update_message || "",
        variants: Array.isArray(sc.variants) ? sc.variants : [],
        acknowledgment_replies: (Array.isArray(sc.acknowledgment_replies) && sc.acknowledgment_replies.length > 0)
          ? sc.acknowledgment_replies
          : DEFAULT_ACKS,
        fallback_message: sc.fallback_message || "",
        max_attempts: sc.max_attempts || 10,
        reset_hours: sc.reset_hours || 24,
        rephrase_mode: sc.rephrase_mode || "hybrid",
        classify_intent: sc.classify_intent !== false,
      });
    }).catch(() => {});
  }, [instanceId]);

  const loadStatus = useCallback(() => {
    api.get(`/discord/status`).then(r => setStatus(r.data)).catch(() => {});
    api.get(`/discord/handoff-status`).then(r => setHandoffChannels(r.data?.channels || [])).catch(() => {});
    if (scripted.enabled) {
      api.get(`/discord/scripted-counters/count`).then(r => setScriptedCounters(r.data || { active_counters: 0, skips_last_24h: 0 })).catch(() => {});
    }
  }, [instanceId, scripted.enabled]);

  const handleResetScriptedCounters = async () => {
    if (!window.confirm("Reset all Scripted Mode counters for this instance?\n\nEvery user's per-channel counter goes back to zero, so the next message from anyone will receive the Primary Message again. Analytics history (scripted_skips) is preserved.\n\nContinue?")) return;
    setResettingCounters(true);
    try {
      const r = await api.post(`/discord/scripted-counters/reset`);
      toast.success(`Reset ${r.data?.cleared || 0} user counter(s). The next message will get the Primary reply.`);
      setScriptedCounters((p) => ({ ...p, active_counters: 0 }));
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to reset counters");
    } finally {
      setResettingCounters(false);
    }
  };

  useEffect(() => {
    loadConfig(); loadStatus();
    pollRef.current = setInterval(loadStatus, 5000);
    return () => clearInterval(pollRef.current);
  }, [loadConfig, loadStatus, instanceId]);

  const fetchChannels = async () => {
    setFetchingChannels(true);
    try {
      const res = await api.get(`/discord/channels`);
      setChannels(res.data);
      if (res.data.length === 0) toast.info("No text channels found.");
      else toast.success(`Found ${res.data.length} channel(s)`);
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to fetch channels"); }
    finally { setFetchingChannels(false); }
  };

  const toggleChannel = (id) => setMonitoredChannelIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);


  const disconnectGuild = async () => {
    if (!window.confirm("Disconnect this Discord server from BridgeBot? This only clears the link in BridgeBot — if the bot is still in the server, you must also remove it via Discord's Integrations page.")) {
      return;
    }
    setDisconnecting(true);
    try {
      const r = await api.post(`/discord/disconnect`);
      toast.success(r.data?.cleared_guild_id ? "Disconnected — UI is now in sync with Discord" : "No active connection to clear");
      loadStatus();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  const resumeHandoff = async () => {
    setResumingHandoff(true);
    try {
      const r = await api.post(`/discord/handoff-resume`);
      toast.success(r.data?.cleared > 0 ? `Bot resumed in ${r.data.cleared} channel(s)` : "No active handoffs");
      setHandoffChannels([]);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to resume");
    } finally {
      setResumingHandoff(false);
    }
  };

  const save = async () => {
    const update = { is_active: isActive, listen_mode: listenMode, reply_style: replyStyle, monitored_channel_ids: monitoredChannelIds, staff_role_name: staffRoleName, handoff_cooldown_minutes: handoffCooldown, handoff_followup_message: handoffFollowup, passive_mode: passiveMode, scripted_mode: scripted };
    if (token.trim()) update.bot_token = token.trim();
    setSaving(true);
    try { await api.put(`/discord/config`, update); toast.success("Discord settings saved"); setToken(""); loadConfig(); } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const syncName = async () => {
    setSyncing(true);
    try { const res = await api.post(`/discord/sync-name`); toast.success(res.data.message || "Name synced"); setTimeout(loadStatus, 2000); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed to sync name"); }
    finally { setSyncing(false); }
  };

  const startBot = async () => {
    setStarting(true);
    try { await api.post(`/discord/restart`); toast.success("Discord bot starting..."); setTimeout(loadStatus, 3000); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed to start bot"); }
    finally { setStarting(false); }
  };

  const inviteBot = async () => {
    setInviting(true);
    try {
      const res = await api.get(`/discord/oauth-url`);
      window.location.href = res.data.url;
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to generate invite link");
      setInviting(false);
    }
  };

  const isOnline = status.status === "online";
  const oauthEnabled = existing?.oauth_enabled;
  const oauthConnected = existing?.oauth_connected;

  const channelsByGuild = channels.reduce((acc, ch) => {
    (acc[ch.guild_name] = acc[ch.guild_name] || []).push(ch);
    return acc;
  }, {});

  return (
    <div style={T.page}>
      <p style={T.overline}>Integration</p>
      <h1 style={T.h1}>Discord Bot</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Left: Admin creds + Invite + Guide */}
        <div>
          {/* App Setup link (admin only) */}
          {isAdmin && (
            <a
              href="/admin/discord-app-setup"
              data-testid="open-app-setup-link"
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "12px 16px", marginBottom: "20px",
                backgroundColor: "rgba(96,165,250,0.06)",
                border: `1px solid rgba(96,165,250,0.2)`,
                borderRadius: "10px",
                textDecoration: "none",
                color: colors.text.primary,
                fontFamily: fonts.body, fontSize: "12px",
              }}
            >
              <Settings size={14} color={colors.brand.light} />
              <span style={{ flex: 1 }}>
                <b>Discord App Setup</b> · Manage global app credentials and view setup guide
              </span>
              <span style={{ color: colors.brand.light, fontSize: "11px", fontWeight: "600" }}>Open →</span>
            </a>
          )}

          {/* Invite Bot Card */}
          <div style={{ ...T.card, marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "rgba(88,101,242,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Server size={18} color={colors.brand.discord} />
              </div>
              <div>
                <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>Connect to Discord</p>
                <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.secondary, margin: "2px 0 0" }}>Invite the bot to your Discord server</p>
              </div>
            </div>

            {oauthConnected && existing?.guild_name && (
              <div data-testid="oauth-guild-info" style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px",
                backgroundColor: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)",
                borderRadius: "10px", marginBottom: "16px",
              }}>
                <CheckCircle size={15} color={colors.brand.success} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: fonts.body, fontSize: "12px", fontWeight: "500", color: colors.brand.success, margin: 0 }}>
                    Connected to "{existing.guild_name}"
                  </p>
                  <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.secondary, margin: "2px 0 0" }}>
                    Guild ID: {existing.guild_id}
                  </p>
                </div>
                <button
                  onClick={disconnectGuild}
                  disabled={disconnecting}
                  data-testid="disconnect-guild-btn"
                  title="Clear this connection (use if the bot was removed from Discord externally)"
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "rgba(244,63,94,0.08)",
                    border: `1px solid rgba(244,63,94,0.25)`,
                    borderRadius: "8px",
                    color: colors.brand.error,
                    fontFamily: fonts.body, fontSize: "11px", fontWeight: "600",
                    cursor: disconnecting ? "not-allowed" : "pointer",
                    opacity: disconnecting ? 0.6 : 1,
                    display: "flex", alignItems: "center", gap: "4px",
                  }}
                >
                  <Trash2 size={11} /> {disconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            )}

            {oauthEnabled ? (
              <>
                <button
                  onClick={inviteBot} disabled={inviting} data-testid="invite-bot-btn"
                  style={{
                    width: "100%", padding: "13px 20px", backgroundColor: colors.brand.discord,
                    color: "#FFFFFF", border: "none", borderRadius: "10px",
                    fontSize: "14px", fontFamily: fonts.body, fontWeight: "600",
                    cursor: inviting ? "not-allowed" : "pointer", opacity: inviting ? 0.7 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    transition: "all 0.2s",
                  }}
                >
                  <Link2 size={16} />
                  {inviting ? "Redirecting to Discord..." : oauthConnected ? "Invite to Another Server" : "Invite Bot to Server"}
                </button>
                <ShareInviteLink />
              </>
            ) : (
              <div style={{ padding: "14px", backgroundColor: colors.bg.base, borderRadius: "10px", border: `1px solid ${colors.border.subtle}` }}>
                <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: 0 }}>
                  Discord OAuth is not configured. {isAdmin ? <>Open <a href="/admin/discord-app-setup" style={{ color: colors.brand.light }}>Discord App Setup</a> to configure credentials.</> : "Contact the administrator to set up the Discord Application credentials."}
                </p>
              </div>
            )}
          </div>

          {/* Setup Guide */}
          <div style={{ ...T.card, marginBottom: "20px" }}>
            <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: "0 0 24px" }}>Setup Guide</p>
            {[
              { num: "01", title: "Enable Message Content Intent", desc: 'Go to the Discord Developer Portal, select your app, navigate to "Bot" settings, and enable "Message Content Intent".', link: { label: "Open Discord Developer Portal", url: "https://discord.com/developers/applications" } },
              { num: "02", title: "Invite Bot to Your Server", desc: 'Click the "Invite Bot to Server" button above. Select a server and authorize the bot.' },
              { num: "03", title: "Configure & Start", desc: "Set your preferred listen mode and reply style, toggle Active, save, then start the bot." },
            ].map(({ num, title, desc, link }) => (
              <div key={num} style={{ display: "flex", gap: "16px", marginBottom: "22px" }}>
                <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.brand.cyan, flexShrink: 0, paddingTop: "2px", minWidth: "24px" }}>{num}</span>
                <div>
                  <p style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "500", color: colors.text.primary, margin: "0 0 4px" }}>{title}</p>
                  <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: "0 0 6px", lineHeight: "1.6" }}>{desc}</p>
                  {link && <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: colors.brand.cyan, fontFamily: fonts.body, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>{link.label} <ExternalLink size={11} /></a>}
                </div>
              </div>
            ))}
          </div>

          {/* Manual Token (fallback) */}
          {!oauthConnected && (
            <div style={{ ...T.card, opacity: 0.85 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <Shield size={14} color={colors.text.muted} />
                <p style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: "600", color: colors.text.secondary, margin: 0 }}>Manual Setup (Advanced)</p>
              </div>
              <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, margin: "0 0 12px", lineHeight: "1.6" }}>
                If you prefer, you can paste your bot token directly instead of using the invite button.
              </p>
              <input type="password" value={token} onChange={e => setToken(e.target.value)}
                placeholder={existing?.bot_token_display ? `Current: ${existing.bot_token_display}` : "Paste your Discord bot token..."}
                data-testid="discord-token-input" style={T.input} onFocus={onFocus} onBlur={onBlur} />
              <p style={T.hint}>Leave empty to keep existing token.</p>
            </div>
          )}
        </div>

        {/* Right: Config */}
        <div>
          {/* Status */}
          <div style={{ ...T.card, borderColor: isOnline ? "rgba(52,211,153,0.3)" : colors.border.default, marginBottom: "20px" }}>
            <p style={{ ...T.monoLabel, marginBottom: "12px", fontSize: "10px" }}>Bot Status</p>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: isOnline ? colors.brand.success : colors.text.muted, boxShadow: isOnline ? `0 0 12px ${colors.brand.success}` : "none", flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: fonts.heading, fontSize: "18px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>{isOnline ? "Online" : "Offline"}</p>
                {status.bot_name && <p style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.secondary, margin: "2px 0 0" }}>{status.bot_name}</p>}
              </div>
              <button onClick={loadStatus} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: colors.text.secondary }}><RefreshCw size={14} /></button>
            </div>
            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: `1px solid ${colors.border.subtle}` }}>
              <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: "0 0 10px" }}>
                Bot name is set in <strong style={{ color: colors.text.primary }}>Bot Settings</strong>. Sync it to Discord here.
              </p>
              <button onClick={syncName} disabled={syncing} data-testid="sync-name-btn"
                style={{ ...T.btnGhost, opacity: syncing ? 0.6 : 1 }}>
                <RefreshCw size={11} /> {syncing ? "Syncing..." : "Sync Name to Discord"}
              </button>
            </div>
          </div>

          {/* Active toggle */}
          <div style={{ ...T.card, marginBottom: "20px" }}>
            <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: "0 0 20px" }}>Configuration</p>
            <div style={{ marginBottom: "20px" }}>
              <label style={T.label}>Bot Active</label>
              <button onClick={() => setIsActive(!isActive)} data-testid="discord-active-toggle"
                style={{
                  display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px",
                  backgroundColor: isActive ? "rgba(52,211,153,0.06)" : colors.bg.panel,
                  border: `1px solid ${isActive ? "rgba(52,211,153,0.3)" : colors.border.default}`,
                  borderRadius: "10px", cursor: "pointer",
                  color: isActive ? colors.brand.success : colors.text.secondary,
                  fontFamily: fonts.body, fontSize: "13px", fontWeight: "500", transition: "all 0.2s",
                }}>
                {isActive ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                {isActive ? "Active" : "Inactive"}
              </button>
            </div>
          </div>

          {/* Listen Mode */}
          <div style={{ ...T.card, marginBottom: "20px" }}>
            <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: "0 0 16px" }}>Listen Mode</p>
            <div style={{ display: "flex", gap: "8px", marginBottom: listenMode === "specific_channels" ? "20px" : "0" }}>
              {LISTEN_MODES.map(({ key, icon: Icon, label, desc }) => (
                <button key={key} onClick={() => setListenMode(key)} data-testid={`listen-mode-${key}`} style={modeBtn(listenMode === key)}>
                  <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><Icon size={12} />{label}</span>
                  <span style={{ fontSize: "10px", color: colors.text.secondary, fontFamily: fonts.body }}>{desc}</span>
                </button>
              ))}
            </div>

            {listenMode === "specific_channels" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <label style={{ ...T.label, margin: 0 }}>Select Channels to Monitor</label>
                  <button onClick={fetchChannels} disabled={fetchingChannels} data-testid="fetch-channels-btn" style={T.btnGhost}>
                    <RefreshCw size={11} className={fetchingChannels ? "animate-spin" : ""} />
                    {fetchingChannels ? "Fetching..." : "Fetch Channels"}
                  </button>
                </div>
                {channels.length === 0 && (
                  <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, padding: "16px", backgroundColor: colors.bg.base, borderRadius: "10px", border: `1px solid ${colors.border.subtle}`, margin: 0 }}>
                    Click "Fetch Channels" to load channels from your Discord server.
                    {monitoredChannelIds.length > 0 && ` (${monitoredChannelIds.length} saved)`}
                  </p>
                )}
                {Object.entries(channelsByGuild).map(([guildName, guildChannels]) => (
                  <div key={guildName} style={{ marginBottom: "12px" }}>
                    <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>{guildName}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {guildChannels.map(ch => (
                        <button key={ch.id} onClick={() => toggleChannel(ch.id)} data-testid={`channel-${ch.id}`} style={channelChip(monitoredChannelIds.includes(ch.id))}>
                          <Hash size={11} /> {ch.name}
                          {monitoredChannelIds.includes(ch.id) && <CheckCircle size={10} color={colors.brand.success} />}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {monitoredChannelIds.length > 0 && (
                  <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.brand.cyan, marginTop: "8px" }}>
                    {monitoredChannelIds.length} channel{monitoredChannelIds.length !== 1 ? "s" : ""} selected
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Reply Style */}
          <div style={{ ...T.card, marginBottom: "20px" }}>
            <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: "0 0 16px" }}>Reply Style</p>
            <div style={{ display: "flex", gap: "8px" }}>
              {REPLY_STYLES.map(({ key, icon: Icon, label, desc }) => (
                <button key={key} onClick={() => setReplyStyle(key)} data-testid={`reply-style-${key}`} style={modeBtn(replyStyle === key)}>
                  <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><Icon size={12} />{label}</span>
                  <span style={{ fontSize: "10px", color: colors.text.secondary, fontFamily: fonts.body }}>{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Passive Mode */}
          <div style={{ ...T.card, marginBottom: "20px", borderColor: passiveMode ? "rgba(96,165,250,0.3)" : colors.border.default }}>
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
              <button
                onClick={() => setPassiveMode(!passiveMode)}
                data-testid="passive-mode-toggle"
                role="switch"
                aria-checked={passiveMode}
                style={{
                  flexShrink: 0,
                  width: "42px", height: "24px",
                  backgroundColor: passiveMode ? colors.brand.light : colors.bg.panel,
                  border: `1px solid ${passiveMode ? colors.brand.light : colors.border.default}`,
                  borderRadius: "12px",
                  cursor: "pointer",
                  position: "relative",
                  transition: "all 0.2s",
                  padding: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "2px",
                    left: passiveMode ? "20px" : "2px",
                    width: "18px", height: "18px",
                    backgroundColor: "#FFFFFF",
                    borderRadius: "50%",
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }}
                />
              </button>
            </div>
            {passiveMode && (
              <p style={{ ...T.hint, marginTop: "12px", marginBottom: 0, padding: "8px 12px", backgroundColor: "rgba(96,165,250,0.04)", border: `1px solid rgba(96,165,250,0.15)`, borderRadius: "8px" }}>
                <strong style={{ color: colors.text.primary }}>Tip:</strong> Best paired with <em>All Channels</em> listen mode in busy servers — the bot will quietly monitor every channel and only chime in when it has a useful answer.
              </p>
            )}
          </div>

          {/* Scripted Mode (Maintenance / Incident replies) */}
          <div style={{ ...T.card, marginBottom: "20px", borderColor: scripted.enabled ? "rgba(251,191,36,0.35)" : colors.border.default, backgroundColor: scripted.enabled ? "rgba(251,191,36,0.03)" : colors.bg.surface }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "14px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <Megaphone size={15} color={scripted.enabled ? colors.brand.warning : colors.text.muted} />
                  <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>Scripted Mode</p>
                  {scripted.enabled && (
                    <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.brand.warning, backgroundColor: "rgba(251,191,36,0.12)", padding: "2px 8px", borderRadius: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Active
                    </span>
                  )}
                </div>
                <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: 0, lineHeight: "1.6" }}>
                  Bypass the knowledge base and reply with a fixed maintenance/incident message. Useful for service outages, bridge pauses, or scheduled downtime.
                  First reply to a user is verbatim; follow-ups get rephrased so it doesn{`'`}t feel robotic.
                </p>
              </div>
              <button
                onClick={() => setScripted(p => ({ ...p, enabled: !p.enabled }))}
                data-testid="scripted-mode-toggle"
                role="switch"
                aria-checked={scripted.enabled}
                style={{
                  flexShrink: 0, width: "42px", height: "24px",
                  backgroundColor: scripted.enabled ? colors.brand.warning : colors.bg.panel,
                  border: `1px solid ${scripted.enabled ? colors.brand.warning : colors.border.default}`,
                  borderRadius: "12px", cursor: "pointer", position: "relative", transition: "all 0.2s", padding: 0,
                }}
              >
                <span style={{ position: "absolute", top: "2px", left: scripted.enabled ? "20px" : "2px", width: "18px", height: "18px", backgroundColor: "#FFFFFF", borderRadius: "50%", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
              </button>
            </div>

            {scripted.enabled && (
              <div style={{ marginTop: "8px" }}>
                {/* Reply 1 — Primary */}
                <label style={T.label}>Reply 1 — Primary <span style={{ color: colors.brand.warning }}>*</span> <span style={{ color: colors.text.muted, fontWeight: "400" }}>· typically the incident announcement</span></label>
                <textarea
                  value={scripted.primary_message}
                  onChange={e => setScripted(p => ({ ...p, primary_message: e.target.value }))}
                  placeholder="USDCx bridge operations are currently paused, so minting and conversions are not processing at this time…"
                  data-testid="scripted-primary"
                  rows={5}
                  onFocus={onFocus} onBlur={onBlur}
                  style={{ ...T.input, resize: "vertical", fontFamily: fonts.body, padding: "10px 12px" }}
                />
                <p style={T.hint}>In <strong>AI/Hybrid</strong> mode this joins the unified pool — the router picks it whenever it best matches the user's question. In <strong>Manual</strong> mode it's the first reply, verbatim.</p>

                <label style={{ ...T.label, marginTop: "16px" }}>Reply 2 — Update <span style={{ color: colors.text.muted, fontWeight: "400" }}>· typically a follow-up status line</span></label>
                <textarea
                  value={scripted.update_message}
                  onChange={e => setScripted(p => ({ ...p, update_message: e.target.value }))}
                  placeholder="No new update yet — we're still working on it and will post here when there's news. Thanks for your patience."
                  data-testid="scripted-update"
                  rows={4}
                  onFocus={onFocus} onBlur={onBlur}
                  style={{ ...T.input, resize: "vertical", fontFamily: fonts.body, padding: "10px 12px" }}
                />
                <p style={T.hint}>Also joins the AI router pool. The router never repeats a line in the same conversation, so once Reply 1 + Reply 2 are used, it moves on to your Variants.</p>

                <div style={{
                  marginTop: "14px",
                  display: "flex", alignItems: "flex-start", gap: "12px",
                  padding: "10px 12px",
                  backgroundColor: scripted.classify_intent ? "rgba(96,165,250,0.05)" : colors.bg.base,
                  border: `1px solid ${scripted.classify_intent ? "rgba(96,165,250,0.2)" : colors.border.default}`,
                  borderRadius: "8px",
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: fonts.body, fontSize: "12px", fontWeight: "600", color: colors.text.primary, margin: "0 0 4px" }}>
                      Auto-detect intent (recommended)
                    </p>
                    <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.secondary, margin: 0, lineHeight: "1.5" }}>
                      Uses Claude to classify each message. Stays silent on speculation, commentary, jokes, complaints, or off-topic chatter — replies only to real questions or update requests. Adds a tiny LLM call per message (~$0.0005).
                    </p>
                  </div>
                  <button
                    onClick={() => setScripted(p => ({ ...p, classify_intent: !p.classify_intent }))}
                    data-testid="scripted-classify-toggle"
                    role="switch"
                    aria-checked={scripted.classify_intent}
                    style={{
                      flexShrink: 0, width: "38px", height: "22px",
                      backgroundColor: scripted.classify_intent ? colors.brand.light : colors.bg.panel,
                      border: `1px solid ${scripted.classify_intent ? colors.brand.light : colors.border.default}`,
                      borderRadius: "11px", cursor: "pointer", position: "relative", padding: 0, transition: "all 0.2s",
                    }}
                  >
                    <span style={{ position: "absolute", top: "2px", left: scripted.classify_intent ? "17px" : "2px", width: "16px", height: "16px", backgroundColor: "#FFFFFF", borderRadius: "50%", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                  </button>
                </div>

                {/* Rephrase mode */}
                <label style={{ ...T.label, marginTop: "16px" }}>Rephrase Mode</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {[
                    { v: "hybrid", l: "Hybrid (recommended)", d: "AI rephrase, fallback to manual" },
                    { v: "ai", l: "AI only", d: "Uses Claude tokens" },
                    { v: "manual", l: "Manual variants only", d: "Zero AI cost" },
                  ].map(({ v, l, d }) => (
                    <button
                      key={v}
                      onClick={() => setScripted(p => ({ ...p, rephrase_mode: v }))}
                      data-testid={`scripted-mode-${v}`}
                      style={{
                        flex: 1, padding: "10px 12px", textAlign: "left",
                        backgroundColor: scripted.rephrase_mode === v ? "rgba(251,191,36,0.08)" : colors.bg.base,
                        border: `1px solid ${scripted.rephrase_mode === v ? colors.brand.warning : colors.border.default}`,
                        borderRadius: "8px",
                        color: scripted.rephrase_mode === v ? colors.text.primary : colors.text.secondary,
                        fontFamily: fonts.body, fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: scripted.rephrase_mode === v ? "600" : "500" }}>{l}</div>
                      <div style={{ fontSize: "10px", color: colors.text.muted, marginTop: "3px" }}>{d}</div>
                    </button>
                  ))}
                </div>

                {/* Manual variants */}
                {(scripted.rephrase_mode === "manual" || scripted.rephrase_mode === "hybrid") && (
                  <div style={{ marginTop: "16px" }}>
                    <label style={T.label}>
                      Manual Variants <span style={{ color: colors.text.muted, fontWeight: "400" }}>(optional)</span>
                    </label>
                    {scripted.variants.map((v, i) => (
                      <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                        <textarea
                          value={v}
                          onChange={e => setScripted(p => ({ ...p, variants: p.variants.map((x, j) => j === i ? e.target.value : x) }))}
                          placeholder={`Variant ${i + 1}…`}
                          data-testid={`scripted-variant-${i}`}
                          rows={2}
                          onFocus={onFocus} onBlur={onBlur}
                          style={{ ...T.input, flex: 1, resize: "vertical", fontFamily: fonts.body, padding: "8px 10px" }}
                        />
                        <button
                          onClick={() => setScripted(p => ({ ...p, variants: p.variants.filter((_, j) => j !== i) }))}
                          data-testid={`scripted-variant-del-${i}`}
                          style={{ padding: "8px 10px", backgroundColor: "rgba(244,63,94,0.06)", border: `1px solid rgba(244,63,94,0.2)`, borderRadius: "8px", color: colors.brand.error, cursor: "pointer" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setScripted(p => ({ ...p, variants: [...p.variants, ""] }))}
                      data-testid="scripted-add-variant"
                      style={{ padding: "8px 12px", backgroundColor: "rgba(96,165,250,0.06)", border: `1px solid rgba(96,165,250,0.2)`, borderRadius: "8px", color: colors.brand.light, cursor: "pointer", fontFamily: fonts.body, fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <Plus size={12} /> Add variant
                    </button>
                  </div>
                )}

                {/* ── AI Conversation Router (msg3+) — Acknowledgment Replies ── */}
                {(scripted.rephrase_mode === "ai" || scripted.rephrase_mode === "hybrid") && (
                  <div
                    data-testid="scripted-acks-block"
                    style={{
                      marginTop: "20px",
                      padding: "14px",
                      backgroundColor: "rgba(96,165,250,0.04)",
                      border: `1px solid rgba(96,165,250,0.18)`,
                      borderRadius: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                      <Zap size={13} color={colors.brand.light} />
                      <p style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
                        Acknowledgment Replies
                      </p>
                      <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.brand.light, backgroundColor: "rgba(96,165,250,0.12)", padding: "2px 8px", borderRadius: "6px", textTransform: "uppercase", letterSpacing: "0.05em", marginLeft: "auto" }}>
                        Msg 3+ AI Router
                      </span>
                    </div>
                    <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.secondary, margin: "0 0 12px", lineHeight: "1.5" }}>
                      Short replies for &ldquo;thanks&rdquo;, &ldquo;ok&rdquo;, &ldquo;got it&rdquo;, etc. The AI router uses these whenever it detects a user is just acknowledging — never to answer a question. If a user keeps thanking you after every reply, the router cycles through these and only repeats once the list is exhausted.
                    </p>
                    {scripted.acknowledgment_replies.map((v, i) => (
                      <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                        <input
                          type="text"
                          value={v}
                          onChange={e => setScripted(p => ({ ...p, acknowledgment_replies: p.acknowledgment_replies.map((x, j) => j === i ? e.target.value : x) }))}
                          placeholder={`Acknowledgment ${i + 1}…`}
                          data-testid={`scripted-ack-${i}`}
                          onFocus={onFocus} onBlur={onBlur}
                          style={{ ...T.input, flex: 1, padding: "8px 10px" }}
                        />
                        <button
                          onClick={() => setScripted(p => ({ ...p, acknowledgment_replies: p.acknowledgment_replies.filter((_, j) => j !== i) }))}
                          data-testid={`scripted-ack-del-${i}`}
                          style={{ padding: "8px 10px", backgroundColor: "rgba(244,63,94,0.06)", border: `1px solid rgba(244,63,94,0.2)`, borderRadius: "8px", color: colors.brand.error, cursor: "pointer" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setScripted(p => ({ ...p, acknowledgment_replies: [...p.acknowledgment_replies, ""] }))}
                      data-testid="scripted-add-ack"
                      style={{ padding: "8px 12px", backgroundColor: "rgba(96,165,250,0.06)", border: `1px solid rgba(96,165,250,0.2)`, borderRadius: "8px", color: colors.brand.light, cursor: "pointer", fontFamily: fonts.body, fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <Plus size={12} /> Add acknowledgment
                    </button>
                  </div>
                )}

                {/* Max attempts + Reset hours */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "16px" }}>
                  <div>
                    <label style={T.label}>Max Replies per User</label>
                    <input type="number" min="1" max="100"
                      value={scripted.max_attempts}
                      onChange={e => setScripted(p => ({ ...p, max_attempts: parseInt(e.target.value) || 1 }))}
                      data-testid="scripted-max-attempts"
                      onFocus={onFocus} onBlur={onBlur} style={T.input}
                    />
                    <p style={T.hint}>Hard cap on bot replies per user per cooldown window (default 10). After this, silent until the counter resets.</p>
                  </div>
                  <div>
                    <label style={T.label}>Counter Reset (hours)</label>
                    <input type="number" min="1" max="168"
                      value={scripted.reset_hours}
                      onChange={e => setScripted(p => ({ ...p, reset_hours: parseInt(e.target.value) || 1 }))}
                      data-testid="scripted-reset-hours"
                      onFocus={onFocus} onBlur={onBlur} style={T.input}
                    />
                    <p style={T.hint}>Timer starts from the last interaction — once the user goes idle this long, the counter and used-reply tracking reset (fresh conversation).</p>
                  </div>
                </div>

                {/* Fallback */}
                <label style={{ ...T.label, marginTop: "16px" }}>Fallback Message</label>
                <textarea
                  value={scripted.fallback_message}
                  onChange={e => setScripted(p => ({ ...p, fallback_message: e.target.value }))}
                  placeholder="For urgent issues please open a ticket or email support@…"
                  data-testid="scripted-fallback"
                  rows={3}
                  onFocus={onFocus} onBlur={onBlur}
                  style={{ ...T.input, resize: "vertical", fontFamily: fonts.body, padding: "10px 12px" }}
                />
                <p style={T.hint}>Sent after Max Attempts is reached, instead of another rephrase.</p>

                {/* Reset Counters — admin debug helper */}
                <div
                  data-testid="scripted-counters-card"
                  style={{
                    marginTop: "16px",
                    padding: "12px 14px",
                    backgroundColor: scriptedCounters.active_counters > 0 ? "rgba(96,165,250,0.05)" : colors.bg.base,
                    border: `1px solid ${scriptedCounters.active_counters > 0 ? "rgba(96,165,250,0.22)" : colors.border.default}`,
                    borderRadius: "10px",
                    display: "flex", alignItems: "center", gap: "12px",
                  }}
                >
                  <RefreshCw size={15} color={colors.brand.light} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: fonts.body, fontSize: "12px", fontWeight: "600", color: colors.text.primary, margin: "0 0 2px" }}>
                      Active user counters
                      {" "}
                      <span data-testid="scripted-counters-count" style={{ fontFamily: fonts.mono, color: colors.brand.light, marginLeft: "4px" }}>
                        {scriptedCounters.active_counters}
                      </span>
                    </p>
                    <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.secondary, margin: 0, lineHeight: "1.5" }}>
                      {scriptedCounters.active_counters > 0
                        ? `${scriptedCounters.active_counters} user(s) are currently mid-sequence. Reset to send everyone the Primary Message again on their next ask — without waiting ${scripted.reset_hours}h.`
                        : `No active counters. The next message from any user will receive the Primary reply.`}
                    </p>
                  </div>
                  <button
                    onClick={handleResetScriptedCounters}
                    disabled={resettingCounters || scriptedCounters.active_counters === 0}
                    data-testid="scripted-reset-counters-btn"
                    style={{
                      flexShrink: 0,
                      padding: "8px 14px",
                      backgroundColor: "rgba(96,165,250,0.08)",
                      color: colors.brand.light,
                      border: `1px solid rgba(96,165,250,0.3)`,
                      borderRadius: "8px",
                      fontFamily: fonts.body, fontSize: "12px", fontWeight: "600",
                      cursor: (resettingCounters || scriptedCounters.active_counters === 0) ? "not-allowed" : "pointer",
                      opacity: (resettingCounters || scriptedCounters.active_counters === 0) ? 0.5 : 1,
                      display: "flex", alignItems: "center", gap: "6px",
                      transition: "all 0.2s",
                    }}
                  >
                    <RefreshCw size={12} /> {resettingCounters ? "Resetting…" : "Reset Counters"}
                  </button>
                </div>

                <div style={{ marginTop: "16px", padding: "10px 12px", backgroundColor: "rgba(251,191,36,0.06)", border: `1px solid rgba(251,191,36,0.18)`, borderRadius: "8px" }}>
                  <p style={{ margin: 0, fontFamily: fonts.body, fontSize: "11px", color: colors.text.secondary, lineHeight: "1.5" }}>
                    <strong style={{ color: colors.brand.warning }}>Heads up:</strong> while Scripted Mode is ON, the bot ignores the Knowledge Base completely and replies only with the configured messages. Disable it once your incident is resolved.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Human Takeover */}
          <div style={{ ...T.card, marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <UserCheck size={16} color={colors.brand.cyan} />
              <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>Human Takeover</p>
            </div>
            <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: "0 0 16px", lineHeight: "1.6" }}>
              When a team member with the designated role replies in a channel, the bot automatically goes silent in that specific channel. It continues monitoring all other channels. After the cooldown, the bot re-engages.
            </p>

            <div style={{ marginBottom: "14px" }}>
              <label style={T.label}>Staff Role Name</label>
              <input style={T.input} value={staffRoleName} onChange={e => setStaffRoleName(e.target.value)}
                placeholder="e.g. Support, Moderator" data-testid="staff-role-input" onFocus={onFocus} onBlur={onBlur} />
              <p style={T.hint}>Discord role name for staff members. Leave empty to disable human takeover.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <label style={T.label}>Cooldown (minutes)</label>
                <input style={T.input} type="number" min="1" max="120" value={handoffCooldown}
                  onChange={e => setHandoffCooldown(Math.max(1, parseInt(e.target.value) || 15))}
                  data-testid="handoff-cooldown-input" onFocus={onFocus} onBlur={onBlur} />
                <p style={T.hint}>Time before bot re-engages after staff stops replying.</p>
              </div>
              <div>
                <label style={T.label}>Resume Command</label>
                <div style={{ padding: "10px 14px", backgroundColor: colors.bg.base, borderRadius: "10px", border: `1px solid ${colors.border.subtle}`, fontFamily: fonts.mono, fontSize: "13px", color: colors.brand.cyan }}>
                  !bot resume
                </div>
                <p style={T.hint}>Staff can type this to hand back to the bot immediately.</p>
              </div>
            </div>

            <div style={{ marginTop: "14px" }}>
              <label style={T.label}>Follow-up Message</label>
              <input style={T.input} value={handoffFollowup} onChange={e => setHandoffFollowup(e.target.value)}
                placeholder="Is there anything else I can help with?" data-testid="handoff-followup-input" onFocus={onFocus} onBlur={onBlur} />
              <p style={T.hint}>Message the bot sends when it re-engages after cooldown.</p>
            </div>

            <div style={{
              marginTop: "18px", padding: "14px 16px",
              backgroundColor: handoffChannels.length > 0 ? "rgba(251,191,36,0.05)" : colors.bg.base,
              border: `1px solid ${handoffChannels.length > 0 ? "rgba(251,191,36,0.25)" : colors.border.subtle}`,
              borderRadius: "10px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: handoffChannels.length > 0 ? "10px" : 0 }}>
                <div>
                  <p style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
                    Currently in handoff
                    <span style={{ marginLeft: "8px", fontFamily: fonts.mono, fontSize: "11px", color: handoffChannels.length > 0 ? colors.brand.warning : colors.text.muted }}>
                      {handoffChannels.length} channel{handoffChannels.length === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.secondary, margin: "3px 0 0", lineHeight: "1.5" }}>
                    Bot is silent here until cooldown ends, a non-staff user posts, or you click Resume.
                  </p>
                </div>
                <button
                  onClick={resumeHandoff}
                  disabled={resumingHandoff || handoffChannels.length === 0}
                  data-testid="resume-handoff-btn"
                  style={{
                    padding: "8px 14px",
                    backgroundColor: handoffChannels.length > 0 ? colors.brand.success : colors.bg.panel,
                    color: handoffChannels.length > 0 ? "#FFFFFF" : colors.text.muted,
                    border: "none",
                    borderRadius: "8px",
                    fontFamily: fonts.body, fontSize: "12px", fontWeight: "600",
                    cursor: (resumingHandoff || handoffChannels.length === 0) ? "not-allowed" : "pointer",
                    opacity: resumingHandoff ? 0.6 : 1,
                    display: "flex", alignItems: "center", gap: "6px",
                  }}
                >
                  <RefreshCw size={12} /> {resumingHandoff ? "Resuming…" : "Resume Bot Now"}
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
            <button onClick={save} disabled={saving} data-testid="save-discord-btn"
              style={{ ...T.btnPrimary, flex: 1, justifyContent: "center", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Saving..." : "Save Configuration"}
            </button>
            <button onClick={startBot} disabled={starting} data-testid="start-discord-btn"
              style={{
                padding: "11px 20px", backgroundColor: colors.bg.panel,
                color: colors.brand.success, border: `1px solid rgba(52,211,153,0.3)`,
                borderRadius: "10px", fontSize: "13px", fontFamily: fonts.body, fontWeight: "500",
                cursor: starting ? "not-allowed" : "pointer", opacity: starting ? 0.6 : 1,
                display: "flex", alignItems: "center", gap: "7px", transition: "all 0.2s",
              }}>
              <Zap size={13} /> {starting ? "Starting..." : "Start Bot"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
