import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  Link2, Plus, Loader2, Zap, Send, Headphones, WifiOff, Wifi, RefreshCw,
  CheckCircle, AlertCircle, Eye, EyeOff, ExternalLink, Copy, BookOpen, X, Save,
  Shield, Power, MessageSquare, Users, Settings,
} from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur } from "@/theme";
import { toast } from "sonner";
import v2 from "@/utils/v2api";

import { API_ORIGIN } from "../utils/apiBase";

const PROVIDER_META = {
  discord: { label: "Discord", icon: Zap, color: "#5865F2" },
  telegram: { label: "Telegram", icon: Send, color: "#26A5E4" },
  zendesk: { label: "Zendesk", icon: Headphones, color: "#03363D" },
};

const PROVIDER_FIELDS = {
  telegram: [
    { key: "bot_token", label: "Bot Token", type: "password", required: true, hint: "BotFather → /newbot → copy token" },
  ],
  zendesk: [
    { key: "subdomain", label: "Zendesk Subdomain", type: "text", required: true, hint: "e.g., mycompany (from mycompany.zendesk.com)" },
    { key: "auth_type", label: "Auth Type", type: "select", options: ["oauth", "api_token"], required: true },
    { key: "api_token", label: "API Token (if token auth)", type: "password" },
    { key: "user_email", label: "Admin Email", type: "text" },
  ],
};

function StatusBadge({ status }) {
  const isConn = status === "connected";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 10px", borderRadius: radius.full,
      fontSize: "10px", fontWeight: "600", fontFamily: fonts.mono,
      backgroundColor: isConn ? "rgba(52,211,153,0.08)" : "rgba(244,63,94,0.08)",
      color: isConn ? colors.brand.success : colors.brand.error,
      border: `1px solid ${isConn ? "rgba(52,211,153,0.2)" : "rgba(244,63,94,0.2)"}`,
    }}>
      {isConn ? <Wifi size={9} /> : <WifiOff size={9} />} {status}
    </span>
  );
}

/* ── Discord-specific guided setup ── */

function CredField({ label, value, onChange, placeholder, isSecret, hint, testId }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={T.label}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={isSecret && !show ? "password" : "text"}
          value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} data-testid={testId}
          style={{ ...T.input, paddingRight: isSecret ? "38px" : undefined }}
          onFocus={onFocus} onBlur={onBlur}
        />
        {isSecret && (
          <button onClick={() => setShow(!show)} type="button"
            style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "4px" }}>
            {show ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
      </div>
      {hint && <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "4px 0 0" }}>{hint}</p>}
    </div>
  );
}

function CredBadge({ ok, label, display }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px",
      backgroundColor: ok ? "rgba(52,211,153,0.04)" : "rgba(244,63,94,0.04)",
      border: `1px solid ${ok ? "rgba(52,211,153,0.2)" : "rgba(244,63,94,0.15)"}`,
      borderRadius: radius.md, minWidth: "180px",
    }}>
      {ok ? <CheckCircle size={13} color={colors.brand.success} /> : <AlertCircle size={13} color={colors.brand.error} />}
      <span style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.secondary }}>{label}</span>
      {ok && display && <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, marginLeft: "auto" }}>{display}</span>}
      {!ok && <span style={{ fontFamily: fonts.body, fontSize: "10px", color: colors.brand.error, marginLeft: "auto" }}>Not set</span>}
    </div>
  );
}

function StepCard({ step, title, children }) {
  return (
    <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
      <div style={{
        flexShrink: 0, width: "26px", height: "26px", borderRadius: "50%",
        backgroundColor: "rgba(96,165,250,0.12)", border: `1px solid ${colors.brand.light}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: fonts.mono, fontSize: "11px", fontWeight: "600", color: colors.brand.light,
      }}>{step}</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: "600", color: colors.text.primary, margin: "0 0 4px" }}>{title}</p>
        <div style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, lineHeight: "1.6" }}>{children}</div>
      </div>
    </div>
  );
}

function DiscordSetupPanel({ onSave, onCancel, saving, editAccount }) {
  const [name, setName] = useState(editAccount?.name || "");
  const [creds, setCreds] = useState({ client_id: "", client_secret: "", bot_token: "" });
  const suggestedRedirect = `${API_ORIGIN || window.location.origin}/api/discord/callback`;

  const existing = editAccount?.credentials_display || {};
  const hasClientId = !!existing.client_id;
  const hasClientSecret = !!existing.client_secret;
  const hasBotToken = !!existing.bot_token;
  const allSet = hasClientId && hasClientSecret && hasBotToken;

  const handleSubmit = () => {
    if (!name.trim()) { toast.error("Account name is required"); return; }
    const credentials = {};
    if (creds.client_id.trim()) credentials.client_id = creds.client_id.trim();
    if (creds.client_secret.trim()) credentials.client_secret = creds.client_secret.trim();
    if (creds.bot_token.trim()) credentials.bot_token = creds.bot_token.trim();
    credentials.redirect_uri = suggestedRedirect;
    if (!editAccount && !creds.bot_token.trim()) {
      toast.error("Bot Token is required for a new connection");
      return;
    }
    onSave({ name: name.trim(), credentials });
  };

  const isEdit = !!editAccount;

  return (
    <div data-testid="discord-setup-panel" style={{ marginBottom: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "10px",
          background: "linear-gradient(135deg, #4752C4, #5865F2)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Zap size={18} color="#fff" />
        </div>
        <h2 style={{ fontFamily: fonts.heading, fontSize: "22px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
          Discord App Setup
        </h2>
        {isEdit && allSet && (
          <span style={{
            fontSize: "11px", fontFamily: fonts.mono, padding: "3px 10px", borderRadius: "20px", letterSpacing: "0.05em",
            backgroundColor: "rgba(52,211,153,0.1)", color: "#34D399", border: "1px solid rgba(52,211,153,0.2)",
          }}>CONFIGURED</span>
        )}
      </div>
      <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: "0 0 20px" }}>
        Configure the global Discord application that powers every bot instance on this platform.
        {!isEdit && " You only need to do this once."}
      </p>

      {/* Always two columns: config + guide */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Left column — config + form */}
        <div>
          {/* Current config (for existing accounts) */}
          {isEdit && (
            <div style={{ ...T.card, padding: "16px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
                  Current Configuration
                </p>
                {editAccount?.updated_at && (
                  <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>
                    {new Date(editAccount.updated_at).toLocaleDateString()} {new Date(editAccount.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              <p style={{ fontFamily: fonts.body, fontSize: "11px", color: allSet ? colors.brand.success : colors.text.muted, margin: "0 0 12px" }}>
                {allSet ? "All credentials configured" : "Some credentials missing"}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <CredBadge ok={hasClientId} label="Client ID" display={existing.client_id} />
                <CredBadge ok={hasClientSecret} label="Client Secret" display={existing.client_secret} />
                <CredBadge ok={true} label="Redirect URI" display={suggestedRedirect.replace("https://", "").slice(0, 35) + "..."} />
                <CredBadge ok={hasBotToken} label="Bot Token" display={existing.bot_token} />
              </div>
            </div>
          )}

          {/* Account name */}
          {!isEdit && (
            <div style={{ marginBottom: "16px" }}>
              <label style={T.label}>Account Name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g., My Discord Bot" style={T.input}
                onFocus={onFocus} onBlur={onBlur} data-testid="discord-account-name" />
            </div>
          )}

          {/* Credential form */}
          <div style={{ ...T.card, padding: "16px" }}>
            <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 4px" }}>
              {isEdit ? "Update Credentials" : "Enter Credentials"}
            </p>
            <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, margin: "0 0 14px" }}>
              {isEdit ? "Paste values from your Discord Developer Portal. Leave blank to keep existing values." : "Paste your Discord app credentials from the Developer Portal."}
            </p>

            <CredField label="Client ID" value={creds.client_id}
              onChange={v => setCreds(p => ({ ...p, client_id: v }))}
              placeholder={isEdit ? (existing.client_id ? `Current: ${existing.client_id}` : "Developer Portal → General Information") : "Developer Portal → General Information"}
              testId="discord-client-id"
              hint="Developer Portal → Your App → General Information" />

            <CredField label="Client Secret" value={creds.client_secret}
              onChange={v => setCreds(p => ({ ...p, client_secret: v }))}
              placeholder={isEdit ? "Leave blank to keep current" : "OAuth2 → Reset Secret"}
              isSecret testId="discord-client-secret"
              hint="Developer Portal → Your App → OAuth2 → Reset Secret" />

            <div style={{ marginBottom: "14px" }}>
              <label style={T.label}>Redirect URI</label>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input value={suggestedRedirect} readOnly
                  style={{ ...T.input, flex: 1, color: colors.text.muted, cursor: "default" }}
                  data-testid="discord-redirect-uri" />
                <button onClick={() => { navigator.clipboard.writeText(suggestedRedirect); toast.success("Copied redirect URI"); }}
                  style={{ ...T.btnGhost, padding: "8px", flexShrink: 0 }} title="Copy">
                  <Copy size={13} />
                </button>
              </div>
              <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "4px 0 0" }}>
                Must match exactly in Discord Developer Portal → OAuth2 → Redirects
              </p>
            </div>

            <CredField label="Bot Token" value={creds.bot_token}
              onChange={v => setCreds(p => ({ ...p, bot_token: v }))}
              placeholder={isEdit ? "Leave blank to keep current" : "Bot → Reset Token"}
              isSecret testId="discord-bot-token"
              hint="Developer Portal → Your App → Bot → Reset Token" />

            <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
              <button onClick={handleSubmit} disabled={saving || !name.trim()}
                data-testid="discord-save-btn"
                style={{ ...T.btnPrimary, opacity: saving || (!isEdit && !name.trim()) ? 0.5 : 1, display: "flex", alignItems: "center", gap: "6px" }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isEdit ? "Save Changes" : "Connect Discord"}
              </button>
            </div>
          </div>
        </div>

        {/* Right column — Setup Guide (always visible) */}
        <div style={{ ...T.card, padding: "20px", alignSelf: "start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <BookOpen size={16} color={colors.brand.light} />
            <div>
              <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
                Developer Portal Setup Guide
              </p>
              <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, margin: "2px 0 0" }}>
                One-time setup for the global Discord app
              </p>
            </div>
          </div>

          <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer"
            data-testid="discord-dev-portal-link"
            style={{ display: "flex", alignItems: "center", gap: "6px", color: colors.brand.light, fontFamily: fonts.body, fontSize: "12px", fontWeight: "600", textDecoration: "none", marginBottom: "20px" }}>
            <ExternalLink size={13} /> Open Discord Developer Portal
          </a>

          <StepCard step="1" title="Create the Application">
            On the Developer Portal, click <strong>New Application</strong>, name it (e.g., "BitBot Pro"), and accept the terms.
          </StepCard>
          <StepCard step="2" title="Set App Branding">
            Under <strong>General Information</strong>, upload an icon and add a short description. This is what users see on the invite screen.
          </StepCard>
          <StepCard step="3" title="Create the Bot User">
            Open the <strong>Bot</strong> tab → click <strong>Reset Token</strong> and copy it. Enable all three Privileged Gateway Intents: <strong>Presence</strong>, <strong>Server Members</strong>, <strong>Message Content</strong>. Save changes.
          </StepCard>
          <StepCard step="4" title="Copy OAuth2 Credentials">
            Open the <strong>OAuth2</strong> tab → copy <strong>Client ID</strong>, then click <strong>Reset Secret</strong> and copy it. You'll paste both in the form on the left.
          </StepCard>
          <StepCard step="5" title="Add Redirect URI">
            In <strong>OAuth2 → Redirects</strong>, click <strong>Add Redirect</strong> and paste:
            <div style={{
              fontFamily: fonts.mono, fontSize: "11px", color: colors.brand.light,
              padding: "8px 12px", marginTop: "6px",
              backgroundColor: "rgba(96,165,250,0.06)", borderRadius: radius.sm,
              border: `1px solid rgba(96,165,250,0.15)`, wordBreak: "break-all",
            }}>
              {suggestedRedirect}
            </div>
            <p style={{ fontSize: "10px", color: colors.text.muted, marginTop: "4px" }}>
              Must match exactly — including https://, no trailing slash.
            </p>
          </StepCard>
          <StepCard step="6" title="Set Bot Permissions">
            Under <strong>OAuth2 → URL Generator</strong>, check <strong>bot</strong> and <strong>applications.commands</strong>. Under Bot Permissions, select <strong>Send Messages</strong>, <strong>Read Message History</strong>, <strong>Manage Nicknames</strong>.
          </StepCard>
        </div>
      </div>
    </div>
  );
}

/* ── Zendesk-specific setup & settings panel ── */

const zdCard = {
  backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
  borderRadius: "12px", padding: "20px", marginBottom: "16px",
};

function ZendeskSetupPanel({ onSave, onCancel, saving, editAccount, orgId, onDisconnect, onReconnect, onRefresh }) {
  const [name, setName] = useState(editAccount?.name || "");
  const [subdomain, setSubdomain] = useState("");
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [authType, setAuthType] = useState("oauth");
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Response mode state (from metadata)
  const [autoReply, setAutoReply] = useState(editAccount?.metadata?.auto_reply_enabled || false);
  const [agentAssist, setAgentAssist] = useState(editAccount?.metadata?.agent_assist_enabled ?? true);

  const isEdit = !!editAccount;
  const isConnected = editAccount?.status === "connected";
  const creds = editAccount?.credentials_masked || {};
  const callbackUrl = `${API_ORIGIN || window.location.origin}/api/zendesk/oauth/callback`;

  const normalizeSubdomain = (raw) => {
    let s = raw.trim().replace(/\/+$/, "");
    if (s.includes("://")) s = s.split("://")[1];
    if (s.includes(".zendesk.com")) s = s.split(".zendesk.com")[0];
    s = s.split("/")[0].toLowerCase();
    return s;
  };

  const handleTest = async () => {
    if (!orgId || !editAccount?.id) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await v2.testAccount(orgId, editAccount.id);
      setTestResult(res.data);
      toast.success(`Connected! ${res.data.user_name} (${res.data.user_role}) on ${res.data.subdomain}.zendesk.com`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Test failed");
      setTestResult({ ok: false, error: e.response?.data?.detail || "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveNew = () => {
    if (!name.trim()) { toast.error("Account name is required"); return; }
    const sub = normalizeSubdomain(subdomain);
    if (!sub) { toast.error("Enter your Zendesk subdomain"); return; }
    const credentials = { subdomain: sub, auth_type: authType };
    if (authType === "oauth") {
      if (oauthClientId.trim()) credentials.oauth_client_id = oauthClientId.trim();
      if (oauthClientSecret.trim()) credentials.oauth_client_secret = oauthClientSecret.trim();
    } else {
      if (!apiToken.trim()) { toast.error("API Token is required"); return; }
      credentials.api_token = apiToken.trim();
      credentials.user_email = userEmail.trim();
    }
    onSave({ name: name.trim(), credentials, metadata: { auto_reply_enabled: false, agent_assist_enabled: true } });
  };

  const handleSaveSettings = async () => {
    if (!orgId || !editAccount?.id) return;
    try {
      const update = { metadata: { auto_reply_enabled: autoReply, agent_assist_enabled: agentAssist } };
      if (name.trim() && name.trim() !== editAccount.name) update.name = name.trim();
      await v2.updateAccount(orgId, editAccount.id, update);
      toast.success("Settings saved");
      if (onRefresh) onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save settings");
    }
  };

  // ── Edit / Connected view — matches the screenshot design ──
  if (isEdit && isConnected) {
    const sub = creds.subdomain || editAccount?.metadata?.subdomain || "unknown";
    const aType = creds.auth_type || "oauth";
    const uEmail = creds.user_email || "";
    const userName = testResult?.user_name || editAccount?.metadata?.user_name || "";
    const userRole = testResult?.user_role || editAccount?.metadata?.user_role || "";
    const scopes = editAccount?.metadata?.oauth_scopes || "tickets:read tickets:write users:read";

    return (
      <div data-testid="zendesk-setup-panel" style={{ maxWidth: "680px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "linear-gradient(135deg, #03363D, #17A589)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Headphones size={18} color="#fff" />
            </div>
            <h2 style={{ fontFamily: fonts.heading, fontSize: "22px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
              Zendesk
            </h2>
            <span data-testid="zendesk-status-badge" style={{
              fontSize: "11px", fontFamily: fonts.mono, padding: "3px 10px", borderRadius: "20px", letterSpacing: "0.05em",
              backgroundColor: "rgba(52,211,153,0.1)", color: "#34D399", border: "1px solid rgba(52,211,153,0.2)",
            }}>ACTIVE</span>
          </div>
          <button onClick={onCancel} style={{ ...T.btnGhost, padding: "6px", visibility: "hidden" }}><X size={16} /></button>
        </div>
        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: "0 0 24px" }}>
          Auto-reply to support tickets and provide AI suggestions to agents using your knowledge base.
        </p>

        {/* Connection Card */}
        <div style={zdCard} data-testid="zendesk-connection-card">
          <h3 style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 14px" }}>
            Connection
          </h3>
          <div style={{
            display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", borderRadius: "10px",
            backgroundColor: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)", marginBottom: "14px",
          }}>
            <CheckCircle size={16} color="#34D399" />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#34D399", fontFamily: fonts.body }}>
                Connected to {sub}.zendesk.com
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: colors.text.muted, fontFamily: fonts.mono }}>
                <Shield size={10} style={{ display: "inline", verticalAlign: "-1px", marginRight: "4px" }} />
                {aType === "oauth" ? "OAuth" : "API Token"}
                {userName && <> &middot; {userName}</>}
                {userRole && <> ({userRole})</>}
                {!userName && uEmail && <> &middot; {uEmail}</>}
              </p>
            </div>
            <button onClick={handleTest} disabled={testing} data-testid="zendesk-test-btn"
              style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px",
                borderRadius: "8px", border: `1px solid ${colors.border.default}`,
                backgroundColor: colors.bg.base, color: colors.text.secondary,
                fontSize: "11px", fontFamily: fonts.body, cursor: testing ? "not-allowed" : "pointer",
              }}>
              <RefreshCw size={12} className={testing ? "animate-spin" : ""} /> Test
            </button>
          </div>

          {/* Scopes */}
          <div style={{
            marginBottom: "12px", padding: "8px 12px", borderRadius: "8px",
            backgroundColor: colors.bg.base, border: `1px solid ${colors.border.default}`,
          }}>
            <p style={{ margin: 0, fontSize: "11px", color: colors.text.muted, fontFamily: fonts.mono }}>
              Scopes: {scopes}
            </p>
          </div>

          {/* Reconnect + Disconnect */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button onClick={() => onReconnect && onReconnect(editAccount)} data-testid="zendesk-reconnect-btn"
              style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px", borderRadius: "8px",
                border: `1px solid ${colors.border.default}`, backgroundColor: colors.bg.base,
                color: colors.text.secondary, fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
              }}>
              <RefreshCw size={12} /> Reconnect
            </button>
            <button onClick={() => onDisconnect && onDisconnect(editAccount)} data-testid="zendesk-disconnect-btn"
              style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px", borderRadius: "8px",
                border: "1px solid rgba(244,63,94,0.2)", backgroundColor: "rgba(244,63,94,0.06)",
                color: "#F43F5E", fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
              }}>
              <WifiOff size={12} /> Disconnect
            </button>
          </div>
        </div>

        {/* Integration Status */}
        <div style={zdCard} data-testid="zendesk-status-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h3 style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 3px" }}>
                Integration Status
              </h3>
              <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, margin: 0 }}>
                Webhook is live — processing incoming tickets
              </p>
            </div>
            <span data-testid="zendesk-active-badge" style={{
              display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "10px",
              border: "1px solid rgba(52,211,153,0.3)", backgroundColor: "rgba(52,211,153,0.08)",
              color: "#34D399", fontSize: "12px", fontWeight: "600", fontFamily: fonts.body,
            }}>
              <Power size={14} /> Active
            </span>
          </div>
        </div>

        {/* Response Mode */}
        <div style={zdCard} data-testid="zendesk-mode-card">
          <h3 style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 14px" }}>
            Response Mode
          </h3>

          {/* Auto-Reply */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px", borderRadius: "10px", marginBottom: "10px",
            backgroundColor: autoReply ? "rgba(23,165,137,0.06)" : colors.bg.base,
            border: `1px solid ${autoReply ? "rgba(23,165,137,0.2)" : colors.border.default}`,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <MessageSquare size={16} color={autoReply ? "#17A589" : colors.text.muted} style={{ marginTop: "2px" }} />
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: colors.text.primary, fontFamily: fonts.body }}>
                  Auto-Reply
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: colors.text.muted, fontFamily: fonts.body }}>
                  Automatically post a public AI-generated reply when a new ticket is created
                </p>
              </div>
            </div>
            <button onClick={() => setAutoReply(!autoReply)} data-testid="zendesk-toggle-auto-reply"
              style={{
                width: "42px", height: "24px", borderRadius: "12px",
                backgroundColor: autoReply ? "#17A589" : "rgba(148,163,184,0.2)",
                border: "none", cursor: "pointer", position: "relative", transition: "background-color 0.2s", flexShrink: 0,
              }}>
              <div style={{
                width: "18px", height: "18px", borderRadius: "50%", backgroundColor: "#fff",
                position: "absolute", top: "3px", left: autoReply ? "21px" : "3px",
                transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }} />
            </button>
          </div>

          {/* Agent Assist */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px", borderRadius: "10px", marginBottom: "14px",
            backgroundColor: agentAssist ? "rgba(96,165,250,0.06)" : colors.bg.base,
            border: `1px solid ${agentAssist ? "rgba(96,165,250,0.2)" : colors.border.default}`,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <Users size={16} color={agentAssist ? "#60A5FA" : colors.text.muted} style={{ marginTop: "2px" }} />
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: colors.text.primary, fontFamily: fonts.body }}>
                  Agent Assist
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: colors.text.muted, fontFamily: fonts.body }}>
                  Store AI suggestions for agents to review via the Zendesk sidebar app
                </p>
              </div>
            </div>
            <button onClick={() => setAgentAssist(!agentAssist)} data-testid="zendesk-toggle-agent-assist"
              style={{
                width: "42px", height: "24px", borderRadius: "12px",
                backgroundColor: agentAssist ? "#60A5FA" : "rgba(148,163,184,0.2)",
                border: "none", cursor: "pointer", position: "relative", transition: "background-color 0.2s", flexShrink: 0,
              }}>
              <div style={{
                width: "18px", height: "18px", borderRadius: "50%", backgroundColor: "#fff",
                position: "absolute", top: "3px", left: agentAssist ? "21px" : "3px",
                transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }} />
            </button>
          </div>

          <button onClick={handleSaveSettings} data-testid="zendesk-save-settings-btn"
            style={{
              display: "flex", alignItems: "center", gap: "6px", padding: "9px 20px", borderRadius: "10px", border: "none",
              background: "linear-gradient(135deg, #03363D, #17A589)",
              color: "#fff", fontSize: "13px", fontWeight: "600", fontFamily: fonts.body, cursor: "pointer",
            }}>
            <Save size={14} /> Save Settings
          </button>
        </div>
      </div>
    );
  }

  // ── New account setup / Disconnected edit ──
  return (
    <div data-testid="zendesk-setup-panel" style={{ marginBottom: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "linear-gradient(135deg, #03363D, #17A589)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Headphones size={20} color="#fff" />
          </div>
          <h2 style={{ fontFamily: fonts.heading, fontSize: "20px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
            {isEdit ? "Zendesk Account Settings" : "Zendesk Setup"}
          </h2>
        </div>
        <button onClick={onCancel} style={{ ...T.btnGhost, padding: "6px" }}><X size={16} /></button>
      </div>
      <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: "0 0 20px" }}>
        {isEdit
          ? "Update your Zendesk account credentials."
          : "Connect your Zendesk account to enable AI-powered ticket responses. Follow the setup guide on the right."}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: isEdit ? "1fr" : "1fr 1fr", gap: "20px" }}>
        {/* Left column — form */}
        <div>
          <div style={{ marginBottom: "16px" }}>
            <label style={T.label}>Account Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g., Production Zendesk"
              style={T.input} onFocus={onFocus} onBlur={onBlur} data-testid="zendesk-account-name" />
          </div>

          <div style={{ ...T.card, padding: "16px" }}>
            <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 14px" }}>
              {isEdit ? "Update Credentials" : "Enter Credentials"}
            </p>

            {/* Subdomain */}
            <label style={T.label}>Zendesk Subdomain</label>
            <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "14px" }}>
              <input value={subdomain}
                onChange={e => setSubdomain(e.target.value)}
                onBlur={e => { const n = normalizeSubdomain(e.target.value); if (n && n !== e.target.value) setSubdomain(n); }}
                placeholder={isEdit && creds.subdomain ? creds.subdomain : "your-company"}
                style={{ ...T.input, borderTopRightRadius: 0, borderBottomRightRadius: 0, flex: 1 }}
                onFocus={onFocus} data-testid="zendesk-subdomain-input" />
              <span style={{
                padding: "8px 12px", backgroundColor: colors.bg.surface,
                border: `1px solid ${colors.border.default}`, borderLeft: "none",
                borderTopRightRadius: "10px", borderBottomRightRadius: "10px",
                fontFamily: fonts.mono, fontSize: "12px", color: colors.text.muted, whiteSpace: "nowrap",
              }}>.zendesk.com</span>
            </div>

            {/* Auth type */}
            <label style={T.label}>Authentication Method</label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              {["oauth", "api_token"].map(t => (
                <button key={t} onClick={() => setAuthType(t)}
                  style={{
                    flex: 1, padding: "10px", borderRadius: "8px", cursor: "pointer",
                    border: `1px solid ${authType === t ? "rgba(23,165,137,0.4)" : colors.border.default}`,
                    backgroundColor: authType === t ? "rgba(23,165,137,0.06)" : colors.bg.base,
                    color: authType === t ? "#17A589" : colors.text.secondary,
                    fontFamily: fonts.body, fontSize: "12px", fontWeight: "600",
                  }}>
                  {t === "oauth" ? "OAuth 2.0" : "API Token"}
                </button>
              ))}
            </div>

            {authType === "oauth" ? (
              <>
                <CredField label="OAuth Client ID" value={oauthClientId}
                  onChange={setOauthClientId}
                  placeholder={isEdit ? "Leave blank to keep current" : "e.g., bitbotpro"}
                  testId="zendesk-oauth-client-id"
                  hint="Zendesk Admin Center → APIs → OAuth clients → Identifier" />
                <CredField label="OAuth Client Secret" value={oauthClientSecret}
                  onChange={setOauthClientSecret} isSecret
                  placeholder={isEdit ? "Leave blank to keep current" : "Paste from Zendesk"}
                  testId="zendesk-oauth-client-secret"
                  hint="Zendesk Admin Center → APIs → OAuth clients → Secret" />
                <div style={{ marginBottom: "14px" }}>
                  <label style={T.label}>Redirect URL</label>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <input value={callbackUrl} readOnly
                      style={{ ...T.input, flex: 1, color: colors.text.muted, cursor: "default" }}
                      data-testid="zendesk-redirect-uri" />
                    <button onClick={() => { navigator.clipboard.writeText(callbackUrl); toast.success("Copied redirect URL"); }}
                      style={{ ...T.btnGhost, padding: "8px", flexShrink: 0 }} title="Copy">
                      <Copy size={13} />
                    </button>
                  </div>
                  <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "4px 0 0" }}>
                    Add this to your Zendesk OAuth client's Redirect URLs
                  </p>
                </div>
              </>
            ) : (
              <>
                <CredField label="Admin Email" value={userEmail}
                  onChange={setUserEmail}
                  placeholder="admin@company.com"
                  testId="zendesk-user-email"
                  hint="The email of a Zendesk admin or agent" />
                <CredField label="API Token" value={apiToken}
                  onChange={setApiToken} isSecret
                  placeholder="Paste your Zendesk API token"
                  testId="zendesk-api-token"
                  hint="Zendesk Admin Center → APIs → Zendesk API → Add API token" />
              </>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
              <button onClick={isEdit ? handleSaveSettings : handleSaveNew} disabled={saving || !name.trim()}
                data-testid="zendesk-save-btn"
                style={{ ...T.btnPrimary, opacity: saving || !name.trim() ? 0.5 : 1, display: "flex", alignItems: "center", gap: "6px" }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isEdit ? "Save Changes" : "Connect Zendesk"}
              </button>
              <button onClick={onCancel} style={T.btnGhost}>Cancel</button>
            </div>
          </div>
        </div>

        {/* Right column — Setup Guide (new accounts only) */}
        {!isEdit && (
          <div style={{ ...T.card, padding: "20px", alignSelf: "start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <BookOpen size={16} color="#17A589" />
              <div>
                <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
                  Zendesk Setup Guide
                </p>
                <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, margin: "2px 0 0" }}>
                  Connect via OAuth or API Token
                </p>
              </div>
            </div>

            <a href="https://support.zendesk.com/hc/en-us/articles/4408845965210" target="_blank" rel="noopener noreferrer"
              data-testid="zendesk-admin-center-link"
              style={{ display: "flex", alignItems: "center", gap: "6px", color: "#17A589", fontFamily: fonts.body, fontSize: "12px", fontWeight: "600", textDecoration: "none", marginBottom: "20px" }}>
              <ExternalLink size={13} /> Open Zendesk Admin Center Guide
            </a>

            <StepCard step="1" title="Create an OAuth Client (if using OAuth)">
              In <strong>Zendesk Admin Center</strong> → Apps &amp; integrations → APIs → OAuth clients → <strong>Add OAuth client</strong>.
              Name it "BitBot Pro" and add a description.
            </StepCard>
            <StepCard step="2" title="Add the Redirect URL">
              In your OAuth client settings, paste this exact URL under <strong>Redirect URLs</strong>:
              <div style={{
                fontFamily: fonts.mono, fontSize: "11px", color: "#17A589",
                padding: "8px 12px", marginTop: "6px",
                backgroundColor: "rgba(23,165,137,0.06)", borderRadius: radius.sm,
                border: "1px solid rgba(23,165,137,0.15)", wordBreak: "break-all",
              }}>
                {callbackUrl}
              </div>
            </StepCard>
            <StepCard step="3" title="Copy Client ID & Secret">
              Copy the <strong>Unique Identifier</strong> (Client ID) and the <strong>Secret</strong> from the OAuth client page.
              Paste them in the form on the left.
            </StepCard>
            <StepCard step="4" title="Enter Subdomain">
              Your subdomain is the part before <strong>.zendesk.com</strong>.
              For example, if your URL is <strong>mycompany.zendesk.com</strong>, enter <strong>mycompany</strong>.
            </StepCard>
            <StepCard step="5" title="Alternative: API Token Auth">
              If you prefer token auth, go to <strong>Admin Center → APIs → Zendesk API</strong>, enable Token Access, and create a new token.
              Select "API Token" in the auth method and paste the token with your admin email.
            </StepCard>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Telegram-specific setup & settings panel ── */

function TelegramSetupPanel({ onSave, onCancel, saving, editAccount, orgId, onDisconnect, onReconnect, onRefresh }) {
  const [name, setName] = useState(editAccount?.name || "");
  const [botToken, setBotToken] = useState("");
  const [testing, setTesting] = useState(false);

  const isEdit = !!editAccount;
  const isConnected = editAccount?.status === "connected";
  const creds = editAccount?.credentials_masked || {};

  const handleTest = async () => {
    if (!orgId || !editAccount?.id) return;
    setTesting(true);
    try {
      const res = await v2.testAccount(orgId, editAccount.id);
      toast.success(`Connected! Bot: @${res.data.username} (${res.data.first_name})`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleSaveNew = () => {
    if (!name.trim()) { toast.error("Account name is required"); return; }
    if (!botToken.trim()) { toast.error("Bot Token is required"); return; }
    onSave({ name: name.trim(), credentials: { bot_token: botToken.trim() } });
  };

  const handleSaveEdit = async () => {
    if (!orgId || !editAccount?.id) return;
    try {
      const update = {};
      if (name.trim() && name.trim() !== editAccount.name) update.name = name.trim();
      if (botToken.trim()) update.credentials = { bot_token: botToken.trim() };
      if (Object.keys(update).length === 0) { toast.info("No changes"); return; }
      await v2.updateAccount(orgId, editAccount.id, update);
      toast.success("Telegram account updated");
      if (onRefresh) onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save");
    }
  };

  // ── Connected settings view ──
  if (isEdit && isConnected) {
    return (
      <div data-testid="telegram-setup-panel" style={{ maxWidth: "680px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "linear-gradient(135deg, #1B95D2, #26A5E4)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Send size={18} color="#fff" />
            </div>
            <h2 style={{ fontFamily: fonts.heading, fontSize: "22px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
              Telegram
            </h2>
            <span data-testid="telegram-status-badge" style={{
              fontSize: "11px", fontFamily: fonts.mono, padding: "3px 10px", borderRadius: "20px", letterSpacing: "0.05em",
              backgroundColor: "rgba(52,211,153,0.1)", color: "#34D399", border: "1px solid rgba(52,211,153,0.2)",
            }}>ACTIVE</span>
          </div>
          <button onClick={onCancel} style={{ ...T.btnGhost, padding: "6px", visibility: "hidden" }}><X size={16} /></button>
        </div>
        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: "0 0 24px" }}>
          Auto-reply to messages in Telegram groups and direct chats using your knowledge base.
        </p>

        {/* Connection Card */}
        <div style={zdCard} data-testid="telegram-connection-card">
          <h3 style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 14px" }}>
            Connection
          </h3>
          <div style={{
            display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", borderRadius: "10px",
            backgroundColor: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)", marginBottom: "14px",
          }}>
            <CheckCircle size={16} color="#34D399" />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#34D399", fontFamily: fonts.body }}>
                Bot connected
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: colors.text.muted, fontFamily: fonts.mono }}>
                Token: {creds.bot_token || "••••••••"}
              </p>
            </div>
            <button onClick={handleTest} disabled={testing} data-testid="telegram-test-btn"
              style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px",
                borderRadius: "8px", border: `1px solid ${colors.border.default}`,
                backgroundColor: colors.bg.base, color: colors.text.secondary,
                fontSize: "11px", fontFamily: fonts.body, cursor: testing ? "not-allowed" : "pointer",
              }}>
              <RefreshCw size={12} className={testing ? "animate-spin" : ""} /> Test
            </button>
          </div>

          {/* Update token */}
          <div style={{ marginBottom: "14px" }}>
            <label style={T.label}>Update Bot Token</label>
            <CredField label="" value={botToken} onChange={setBotToken} isSecret
              placeholder="Leave blank to keep current" testId="telegram-bot-token-edit"
              hint="BotFather → /mybots → API Token" />
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button onClick={handleSaveEdit} data-testid="telegram-save-btn"
              style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px", borderRadius: "8px",
                border: "none", background: "linear-gradient(135deg, #1B95D2, #26A5E4)",
                color: "#fff", fontSize: "12px", fontWeight: "600", fontFamily: fonts.body, cursor: "pointer",
              }}>
              <Save size={12} /> Save Changes
            </button>
            <button onClick={() => onReconnect && onReconnect(editAccount)} data-testid="telegram-reconnect-btn"
              style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px", borderRadius: "8px",
                border: `1px solid ${colors.border.default}`, backgroundColor: colors.bg.base,
                color: colors.text.secondary, fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
              }}>
              <RefreshCw size={12} /> Reconnect
            </button>
            <button onClick={() => onDisconnect && onDisconnect(editAccount)} data-testid="telegram-disconnect-btn"
              style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px", borderRadius: "8px",
                border: "1px solid rgba(244,63,94,0.2)", backgroundColor: "rgba(244,63,94,0.06)",
                color: "#F43F5E", fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
              }}>
              <WifiOff size={12} /> Disconnect
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── New account setup ──
  return (
    <div data-testid="telegram-setup-panel" style={{ marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "linear-gradient(135deg, #1B95D2, #26A5E4)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Send size={20} color="#fff" />
          </div>
          <h2 style={{ fontFamily: fonts.heading, fontSize: "20px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
            Telegram Setup
          </h2>
        </div>
        <button onClick={onCancel} style={{ ...T.btnGhost, padding: "6px" }}><X size={16} /></button>
      </div>
      <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: "0 0 20px" }}>
        Connect a Telegram bot to respond to messages in groups and direct chats.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div>
          <div style={{ marginBottom: "16px" }}>
            <label style={T.label}>Account Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g., Support Bot" style={T.input}
              onFocus={onFocus} onBlur={onBlur} data-testid="telegram-account-name" />
          </div>

          <div style={{ ...T.card, padding: "16px" }}>
            <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 14px" }}>
              Enter Bot Token
            </p>
            <CredField label="Bot Token" value={botToken} onChange={setBotToken} isSecret
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              testId="telegram-bot-token"
              hint="Get this from @BotFather on Telegram" />
            <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
              <button onClick={handleSaveNew} disabled={saving || !name.trim() || !botToken.trim()}
                data-testid="telegram-save-btn"
                style={{ ...T.btnPrimary, opacity: saving || !name.trim() || !botToken.trim() ? 0.5 : 1, display: "flex", alignItems: "center", gap: "6px" }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Connect Telegram
              </button>
              <button onClick={onCancel} style={T.btnGhost}>Cancel</button>
            </div>
          </div>
        </div>

        {/* Setup Guide */}
        <div style={{ ...T.card, padding: "20px", alignSelf: "start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <BookOpen size={16} color="#26A5E4" />
            <div>
              <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
                Telegram Bot Setup Guide
              </p>
              <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, margin: "2px 0 0" }}>
                Create a bot via BotFather
              </p>
            </div>
          </div>

          <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer"
            data-testid="telegram-botfather-link"
            style={{ display: "flex", alignItems: "center", gap: "6px", color: "#26A5E4", fontFamily: fonts.body, fontSize: "12px", fontWeight: "600", textDecoration: "none", marginBottom: "20px" }}>
            <ExternalLink size={13} /> Open @BotFather on Telegram
          </a>

          <StepCard step="1" title="Start a Chat with BotFather">
            Open Telegram and search for <strong>@BotFather</strong>. Start the conversation and send <code>/newbot</code>.
          </StepCard>
          <StepCard step="2" title="Name Your Bot">
            Follow the prompts: enter a <strong>display name</strong> (e.g., "My Support Bot") and a <strong>username</strong> ending in "bot" (e.g., "my_support_bot").
          </StepCard>
          <StepCard step="3" title="Copy the API Token">
            BotFather will reply with an API token like <code>123456:ABC-DEF...</code>. Copy it and paste it into the form on the left.
          </StepCard>
          <StepCard step="4" title="Add Bot to a Group (Optional)">
            Add the bot to a Telegram group, then configure a <strong>Connection</strong> in the Integrations page to map it to a specific bot persona.
          </StepCard>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */

export default function ConnectedAccounts() {
  const { selectedOrg } = useAuth();
  const { provider } = useParams(); // "discord" | "telegram" | "zendesk"
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchAccounts = () => {
    if (!selectedOrg) return;
    setLoading(true);
    v2.listAccounts(selectedOrg.id)
      .then(r => setAccounts(r.data.accounts || []))
      .catch(() => toast.error("Failed to load accounts"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAccounts(); }, [selectedOrg]);

  // Find the existing account for this provider (one per org per provider)
  const existingAccount = accounts.find(a => a.provider === provider) || null;

  const handleDiscordSave = async ({ name, credentials }) => {
    setSaving(true);
    try {
      if (existingAccount) {
        await v2.updateAccount(selectedOrg.id, existingAccount.id, { name, credentials });
        toast.success("Discord account updated");
      } else {
        await v2.createAccount(selectedOrg.id, { provider: "discord", name, credentials });
        toast.success("Discord account connected");
      }
      fetchAccounts();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleZendeskSave = async ({ name, credentials, metadata }) => {
    setSaving(true);
    try {
      if (existingAccount) {
        await v2.updateAccount(selectedOrg.id, existingAccount.id, { name, credentials, metadata });
        toast.success("Zendesk account updated");
      } else {
        await v2.createAccount(selectedOrg.id, { provider: "zendesk", name, credentials, metadata });
        toast.success("Zendesk account connected");
      }
      fetchAccounts();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleTelegramSave = async ({ name, credentials }) => {
    setSaving(true);
    try {
      if (existingAccount) {
        await v2.updateAccount(selectedOrg.id, existingAccount.id, { name, credentials });
        toast.success("Telegram account updated");
      } else {
        await v2.createAccount(selectedOrg.id, { provider: "telegram", name, credentials });
        toast.success("Telegram account connected");
      }
      fetchAccounts();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (acc) => {
    const msg = acc.active_connection_count > 0
      ? `This account has ${acc.active_connection_count} active connection(s). Disconnecting will disable them. Continue?`
      : `Disconnect "${acc.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      const res = await v2.disconnectAccount(selectedOrg.id, acc.id);
      toast.success(res.data.warning || "Account disconnected");
      fetchAccounts();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to disconnect");
    }
  };

  const handleReconnect = async (acc) => {
    try {
      await v2.reconnectAccount(selectedOrg.id, acc.id);
      toast.success("Account reconnected");
      fetchAccounts();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to reconnect");
    }
  };

  if (!selectedOrg) return (
    <div style={T.page}>
      <p style={{ ...T.sectionSub, textAlign: "center", marginTop: "60px" }}>Select an organisation first.</p>
    </div>
  );

  if (loading) return (
    <div style={T.page}>
      <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
        <Loader2 size={24} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    </div>
  );

  const meta = PROVIDER_META[provider];
  if (!meta) return (
    <div style={T.page}>
      <p style={{ ...T.sectionSub, textAlign: "center", marginTop: "60px" }}>Unknown provider: {provider}</p>
    </div>
  );

  // Render the provider-specific panel directly
  return (
    <div style={T.page} data-testid="connected-accounts-page">
      {provider === "discord" && (
        <DiscordSetupPanel
          onSave={handleDiscordSave}
          onCancel={() => {}}
          saving={saving}
          editAccount={existingAccount}
        />
      )}
      {provider === "zendesk" && (
        <ZendeskSetupPanel
          onSave={handleZendeskSave}
          onCancel={() => {}}
          saving={saving}
          editAccount={existingAccount}
          orgId={selectedOrg?.id}
          onDisconnect={handleDisconnect}
          onReconnect={handleReconnect}
          onRefresh={fetchAccounts}
        />
      )}
      {provider === "telegram" && (
        <TelegramSetupPanel
          onSave={handleTelegramSave}
          onCancel={() => {}}
          saving={saving}
          editAccount={existingAccount}
          orgId={selectedOrg?.id}
          onDisconnect={handleDisconnect}
          onReconnect={handleReconnect}
          onRefresh={fetchAccounts}
        />
      )}
    </div>
  );
}
