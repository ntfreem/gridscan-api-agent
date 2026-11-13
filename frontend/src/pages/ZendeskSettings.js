import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../utils/api";
import { toast } from "sonner";
import {
  Headphones, CheckCircle, AlertCircle, RefreshCw, Trash2,
  Save, Power, Loader2, Copy, Check, MessageSquare, Users,
  ExternalLink, Clock, Shield, Link2, LogIn,
} from "lucide-react";
import { colors, fonts, T, onFocus, onBlur } from "../theme";

const card = {
  backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
  borderRadius: "12px", padding: "20px", marginBottom: "16px",
};

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div style={{ marginBottom: "10px" }}>
      {label && <label style={{ ...T.label, marginBottom: "4px", display: "block" }}>{label}</label>}
      <div style={{ display: "flex", gap: "6px" }}>
        <input readOnly value={value} style={{ ...T.input, flex: 1, fontSize: "11px", fontFamily: fonts.mono, color: colors.text.secondary }} />
        <button onClick={copy} data-testid="copy-field-btn" style={{
          padding: "6px 12px", borderRadius: "8px", border: `1px solid ${colors.border.default}`,
          backgroundColor: copied ? "rgba(52,211,153,0.08)" : colors.bg.base,
          color: copied ? "#34D399" : colors.text.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px",
          fontSize: "11px", fontFamily: fonts.body,
        }}>
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/* ── Subdomain normalizer ── */
function normalizeSubdomain(raw) {
  let s = raw.trim().replace(/\/+$/, "");
  if (s.includes("://")) s = s.split("://")[1];
  if (s.includes(".zendesk.com")) s = s.split(".zendesk.com")[0];
  s = s.split("/")[0].toLowerCase();
  return s;
}

export default function ZendeskSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [tickets, setTickets] = useState([]);

  // Form
  const [subdomain, setSubdomain] = useState("");
  const [autoReply, setAutoReply] = useState(false);
  const [agentAssist, setAgentAssist] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  /* ── Handle OAuth callback result from URL params ── */
  useEffect(() => {
    const oauthResult = searchParams.get("oauth");
    if (oauthResult === "success") {
      toast.success("Zendesk connected via OAuth!");
      setSearchParams({}, { replace: true });
    } else if (oauthResult === "error") {
      const msg = searchParams.get("message") || "OAuth authorization failed.";
      toast.error(msg, { duration: 8000 });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get("/admin/zendesk-config");
      setConfig(res.data);
      setAutoReply(res.data.auto_reply_enabled || false);
      setAgentAssist(res.data.agent_assist_enabled ?? true);
      setIsActive(res.data.is_active || false);
      setSubdomain("");
      if (res.data.connected) {
        try {
          const wh = await api.get("/admin/zendesk-config/webhook-url");
          setWebhookUrl(wh.data.webhook_url || "");
        } catch { /* ignore */ }
        try {
          const tk = await api.get("/admin/zendesk-tickets");
          setTickets(tk.data.tickets || []);
        } catch { /* ignore */ }
      }
    } catch {
      toast.error("Failed to load Zendesk config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  /* ── OAuth Connect ── */
  const handleConnect = async () => {
    const sub = normalizeSubdomain(subdomain);
    if (!sub) {
      toast.error("Enter your Zendesk subdomain (e.g. your-company)");
      return;
    }
    setConnecting(true);
    try {
      const res = await api.post("/admin/zendesk/oauth/start", { subdomain: sub });
      window.location.href = res.data.redirect_url;
    } catch (e) {
      const detail = e.response?.data?.detail || "Failed to start Zendesk authorization.";
      toast.error(detail, { duration: 8000 });
      setConnecting(false);
    }
  };

  /* ── Reconnect (re-initiate OAuth for existing subdomain) ── */
  const handleReconnect = async () => {
    const sub = config?.subdomain;
    if (!sub) return;
    setConnecting(true);
    try {
      const res = await api.post("/admin/zendesk/oauth/start", { subdomain: sub });
      window.location.href = res.data.redirect_url;
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to start reconnection.");
      setConnecting(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.put("/admin/zendesk-config", {
        auto_reply_enabled: autoReply,
        agent_assist_enabled: agentAssist,
        is_active: isActive,
      });
      toast.success("Settings saved");
      await fetchConfig();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await api.post("/admin/zendesk-config/test");
      toast.success(`Connected! ${res.data.user_name} (${res.data.user_email}) on ${res.data.subdomain}.zendesk.com — Auth: ${res.data.auth_type === "oauth" ? "OAuth" : "API Token"}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect Zendesk from this instance? Suggestions and event logs will be removed.")) return;
    setDisconnecting(true);
    try {
      await api.delete("/admin/zendesk-config");
      toast.success("Zendesk disconnected");
      setWebhookUrl("");
      setTickets([]);
      await fetchConfig();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleToggleActive = async () => {
    const next = !isActive;
    setIsActive(next);
    try {
      await api.put("/admin/zendesk-config", { is_active: next });
      toast.success(next ? "Zendesk integration activated" : "Zendesk integration paused");
      await fetchConfig();
    } catch (e) {
      setIsActive(!next);
      toast.error(e.response?.data?.detail || "Failed to toggle");
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <Loader2 size={24} color={colors.text.muted} style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  const connected = config?.connected;
  const authType = config?.auth_type;
  const oauthConfigured = config?.oauth_configured;
  const needsReauth = config?.oauth_needs_reauth;

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: "0 16px" }} data-testid="zendesk-settings-page">
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "linear-gradient(135deg, #03363D, #17A589)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Headphones size={18} color="#fff" />
          </div>
          <h1 style={{ fontFamily: fonts.heading, fontSize: "22px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
            Zendesk
          </h1>
          {connected && (
            <span data-testid="zendesk-status-badge" style={{
              fontSize: "11px", fontFamily: fonts.mono, padding: "3px 10px",
              borderRadius: "20px", letterSpacing: "0.05em",
              backgroundColor: isActive ? "rgba(52,211,153,0.1)" : "rgba(251,191,36,0.1)",
              color: isActive ? "#34D399" : "#FBBF24",
              border: `1px solid ${isActive ? "rgba(52,211,153,0.2)" : "rgba(251,191,36,0.2)"}`,
            }}>
              {isActive ? "ACTIVE" : "PAUSED"}
            </span>
          )}
        </div>
        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: 0 }}>
          Auto-reply to support tickets and provide AI suggestions to agents using your knowledge base.
        </p>
      </div>

      {/* ── Connection Card ── */}
      <div style={card} data-testid="zendesk-connection-card">
        <h3 style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 14px" }}>
          Connection
        </h3>

        {connected && !needsReauth ? (
          /* ── Connected state ── */
          <div>
            <div style={{
              display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px",
              borderRadius: "10px", backgroundColor: "rgba(52,211,153,0.06)",
              border: "1px solid rgba(52,211,153,0.15)", marginBottom: "14px",
            }}>
              <CheckCircle size={16} color="#34D399" />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#34D399", fontFamily: fonts.body }}>
                  Connected to {config.subdomain}.zendesk.com
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: colors.text.muted, fontFamily: fonts.mono }}>
                  {authType === "oauth" ? (
                    <>
                      <Shield size={10} style={{ display: "inline", verticalAlign: "-1px", marginRight: "4px" }} />
                      OAuth &middot; {config.zendesk_user_name || config.zendesk_user_email}
                      {config.zendesk_user_role ? ` (${config.zendesk_user_role})` : ""}
                    </>
                  ) : (
                    <>{config.zendesk_user_name || config.email} &middot; Token: {config.api_token_masked}</>
                  )}
                </p>
              </div>
              <button onClick={handleTest} disabled={testing} data-testid="zendesk-test-btn"
                style={{
                  display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px",
                  borderRadius: "8px", border: `1px solid ${colors.border.default}`,
                  backgroundColor: colors.bg.base, color: colors.text.secondary,
                  fontSize: "11px", fontFamily: fonts.body, cursor: "pointer",
                }}>
                <RefreshCw size={12} className={testing ? "spin" : ""} /> Test
              </button>
            </div>

            {authType === "oauth" && config.oauth_scopes && (
              <div style={{ marginBottom: "12px", padding: "8px 12px", borderRadius: "8px", backgroundColor: colors.bg.base, border: `1px solid ${colors.border.default}` }}>
                <p style={{ margin: 0, fontSize: "11px", color: colors.text.muted, fontFamily: fonts.mono }}>
                  Scopes: {config.oauth_scopes}
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button onClick={handleReconnect} disabled={connecting} data-testid="zendesk-reconnect-btn"
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "8px 14px", borderRadius: "8px",
                  border: `1px solid ${colors.border.default}`,
                  backgroundColor: colors.bg.base, color: colors.text.secondary,
                  fontSize: "12px", fontFamily: fonts.body, cursor: connecting ? "not-allowed" : "pointer",
                  opacity: connecting ? 0.5 : 1,
                }}>
                {connecting ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={12} />}
                Reconnect
              </button>
              <button onClick={handleDisconnect} disabled={disconnecting} data-testid="zendesk-disconnect-btn"
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "8px 14px", borderRadius: "8px",
                  border: "1px solid rgba(244,63,94,0.2)",
                  backgroundColor: "rgba(244,63,94,0.06)", color: "#F43F5E",
                  fontSize: "12px", fontFamily: fonts.body, cursor: disconnecting ? "not-allowed" : "pointer",
                }}>
                <Trash2 size={12} /> Disconnect
              </button>
            </div>
          </div>
        ) : needsReauth ? (
          /* ── Needs re-authorization ── */
          <div>
            <div style={{
              display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 14px",
              borderRadius: "10px", backgroundColor: "rgba(251,191,36,0.06)",
              border: "1px solid rgba(251,191,36,0.2)", marginBottom: "14px",
            }}>
              <AlertCircle size={16} color="#FBBF24" style={{ marginTop: "1px", flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#FBBF24", fontFamily: fonts.body }}>
                  Authorization Expired
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: colors.text.secondary, fontFamily: fonts.body, lineHeight: 1.5 }}>
                  The OAuth token for <strong>{config.subdomain}.zendesk.com</strong> has expired or was revoked.
                  Click "Reconnect" to re-authorize and restore the connection.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={handleReconnect} disabled={connecting} data-testid="zendesk-reauth-btn"
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "9px 20px", borderRadius: "10px", border: "none",
                  background: "linear-gradient(135deg, #03363D, #17A589)",
                  color: "#fff", fontSize: "13px", fontWeight: "600",
                  fontFamily: fonts.body, cursor: connecting ? "not-allowed" : "pointer",
                  opacity: connecting ? 0.5 : 1,
                }}>
                {connecting ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <LogIn size={14} />}
                Reconnect with Zendesk
              </button>
              <button onClick={handleDisconnect} disabled={disconnecting}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "8px 14px", borderRadius: "8px",
                  border: "1px solid rgba(244,63,94,0.2)",
                  backgroundColor: "rgba(244,63,94,0.06)", color: "#F43F5E",
                  fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
                }}>
                <Trash2 size={12} /> Disconnect
              </button>
            </div>
          </div>
        ) : (
          /* ── Not connected — OAuth setup form ── */
          <div>
            {!oauthConfigured ? (
              /* OAuth not configured by admin */
              <div style={{
                display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 14px",
                borderRadius: "10px", backgroundColor: "rgba(244,63,94,0.04)",
                border: "1px solid rgba(244,63,94,0.15)", marginBottom: "14px",
              }}>
                <AlertCircle size={16} color="#F43F5E" style={{ marginTop: "1px", flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#F43F5E", fontFamily: fonts.body }}>
                    OAuth Not Configured
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: colors.text.secondary, fontFamily: fonts.body, lineHeight: 1.5 }}>
                    A Zendesk administrator must create an OAuth client and set the{" "}
                    <code style={{ fontSize: "11px", padding: "1px 4px", backgroundColor: "rgba(244,63,94,0.08)", borderRadius: "3px" }}>ZENDESK_OAUTH_CLIENT_ID</code> and{" "}
                    <code style={{ fontSize: "11px", padding: "1px 4px", backgroundColor: "rgba(244,63,94,0.08)", borderRadius: "3px" }}>ZENDESK_OAUTH_CLIENT_SECRET</code>{" "}
                    environment variables. See the{" "}
                    <a href="https://support.zendesk.com/hc/en-us/articles/4408845965210" target="_blank" rel="noopener noreferrer"
                      style={{ color: "#17A589", textDecoration: "none", fontWeight: 600 }}>Zendesk OAuth setup guide</a>.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 14px",
                borderRadius: "10px", backgroundColor: "rgba(23,165,137,0.04)",
                border: "1px solid rgba(23,165,137,0.1)", marginBottom: "14px",
              }}>
                <Shield size={16} color="#17A589" style={{ marginTop: "1px", flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: "12px", color: colors.text.secondary, fontFamily: fonts.body, lineHeight: 1.5 }}>
                  Connect securely via OAuth. You&apos;ll be redirected to Zendesk to authorize access.
                  No passwords are collected. BitBot Pro requests{" "}
                  <code style={{ fontSize: "10px", padding: "1px 4px", backgroundColor: "rgba(23,165,137,0.08)", borderRadius: "3px" }}>tickets:read tickets:write users:read</code>{" "}
                  scopes only.
                </p>
              </div>
            )}

            <label style={T.label}>Zendesk Subdomain</label>
            <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "14px" }}>
              <input
                value={subdomain}
                onChange={e => setSubdomain(e.target.value)}
                placeholder="your-company or https://your-company.zendesk.com"
                data-testid="zendesk-subdomain-input"
                style={{ ...T.input, borderTopRightRadius: 0, borderBottomRightRadius: 0, flex: 1 }}
                onFocus={onFocus} onBlur={onBlur}
                onKeyDown={e => { if (e.key === "Enter" && oauthConfigured) handleConnect(); }}
              />
              <span style={{
                padding: "8px 12px", backgroundColor: colors.bg.surface,
                border: `1px solid ${colors.border.default}`, borderLeft: "none",
                borderTopRightRadius: "10px", borderBottomRightRadius: "10px",
                fontFamily: fonts.mono, fontSize: "12px", color: colors.text.muted,
                whiteSpace: "nowrap",
              }}>.zendesk.com</span>
            </div>

            {subdomain.trim() && (
              <p style={{ margin: "-8px 0 12px", fontSize: "11px", color: colors.text.muted, fontFamily: fonts.mono }}>
                Will connect to: <strong>{normalizeSubdomain(subdomain) || "..."}.zendesk.com</strong>
              </p>
            )}

            <button
              onClick={handleConnect}
              disabled={connecting || !subdomain.trim() || !oauthConfigured}
              data-testid="zendesk-oauth-connect-btn"
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 24px", borderRadius: "10px", border: "none",
                background: oauthConfigured ? "linear-gradient(135deg, #03363D, #17A589)" : colors.bg.surface,
                color: oauthConfigured ? "#fff" : colors.text.muted,
                fontSize: "14px", fontWeight: "600", fontFamily: fonts.body,
                cursor: connecting || !subdomain.trim() || !oauthConfigured ? "not-allowed" : "pointer",
                opacity: connecting || !subdomain.trim() || !oauthConfigured ? 0.5 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {connecting ? (
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Link2 size={16} />
              )}
              {connecting ? "Redirecting to Zendesk..." : "Connect with Zendesk"}
            </button>
          </div>
        )}
      </div>

      {/* ── Settings — only when connected ── */}
      {connected && (
        <>
          {/* Active Toggle */}
          <div style={card} data-testid="zendesk-active-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 3px" }}>
                  Integration Status
                </h3>
                <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, margin: 0 }}>
                  {isActive ? "Webhook is live — processing incoming tickets" : "Paused — webhooks will be ignored"}
                </p>
              </div>
              <button onClick={handleToggleActive} data-testid="zendesk-toggle-active-btn"
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "8px 16px", borderRadius: "10px",
                  border: `1px solid ${isActive ? "rgba(52,211,153,0.3)" : colors.border.default}`,
                  backgroundColor: isActive ? "rgba(52,211,153,0.08)" : colors.bg.base,
                  color: isActive ? "#34D399" : colors.text.secondary,
                  fontSize: "12px", fontWeight: "600", fontFamily: fonts.body, cursor: "pointer",
                }}>
                <Power size={14} /> {isActive ? "Active" : "Paused"}
              </button>
            </div>
          </div>

          {/* Mode Toggles */}
          <div style={card} data-testid="zendesk-mode-card">
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
                  border: "none", cursor: "pointer", position: "relative", transition: "background-color 0.2s",
                  flexShrink: 0,
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
                  border: "none", cursor: "pointer", position: "relative", transition: "background-color 0.2s",
                  flexShrink: 0,
                }}>
                <div style={{
                  width: "18px", height: "18px", borderRadius: "50%", backgroundColor: "#fff",
                  position: "absolute", top: "3px", left: agentAssist ? "21px" : "3px",
                  transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                }} />
              </button>
            </div>

            {autoReply && (
              <div style={{
                padding: "10px 14px", borderRadius: "8px", marginBottom: "14px",
                backgroundColor: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)",
              }}>
                <p style={{ margin: 0, fontSize: "11px", color: "#FBBF24", fontFamily: fonts.body, lineHeight: 1.5 }}>
                  Auto-Reply will post public responses to customers. Ensure your knowledge base is accurate and up-to-date.
                  Tickets are tagged <code style={{ fontSize: "10px", padding: "1px 4px", backgroundColor: "rgba(251,191,36,0.1)", borderRadius: "3px" }}>ai_processed</code> to prevent loops.
                </p>
              </div>
            )}

            <button onClick={handleSaveSettings} disabled={saving} data-testid="zendesk-save-settings-btn"
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "9px 20px", borderRadius: "10px", border: "none",
                background: "linear-gradient(135deg, #03363D, #17A589)",
                color: "#fff", fontSize: "13px", fontWeight: "600",
                fontFamily: fonts.body, cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.5 : 1,
              }}>
              {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
              Save Settings
            </button>
          </div>

          {/* Webhook URL */}
          {webhookUrl && (
            <div style={card} data-testid="zendesk-webhook-card">
              <h3 style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 4px" }}>
                Webhook Setup
              </h3>
              <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, margin: "0 0 12px" }}>
                Add this URL as a webhook in Zendesk Admin Center, then create a trigger for &quot;Ticket is Created&quot;.
              </p>
              <CopyField label="Webhook URL" value={webhookUrl} />
              <div style={{ marginTop: "10px" }}>
                <a href={`https://${config.subdomain}.zendesk.com/admin/objects-rules/rules/triggers`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "5px",
                    fontSize: "12px", color: "#17A589", textDecoration: "none", fontFamily: fonts.body,
                  }}>
                  <ExternalLink size={12} /> Open Zendesk Triggers
                </a>
              </div>
            </div>
          )}

          {/* Processed Tickets */}
          {tickets.length > 0 && (
            <div style={card} data-testid="zendesk-tickets-card">
              <h3 style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 14px" }}>
                Recent Processed Tickets
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {tickets.slice(0, 10).map((t, i) => (
                  <div key={i} style={{
                    padding: "10px 14px", borderRadius: "8px",
                    backgroundColor: colors.bg.base, border: `1px solid ${colors.border.default}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.secondary }}>
                        #{t.ticket_id}
                      </span>
                      <span style={{
                        fontSize: "10px", fontFamily: fonts.mono, padding: "2px 8px", borderRadius: "10px",
                        backgroundColor: t.action_taken === "auto_reply" ? "rgba(23,165,137,0.1)" : "rgba(96,165,250,0.1)",
                        color: t.action_taken === "auto_reply" ? "#17A589" : "#60A5FA",
                        textTransform: "uppercase",
                      }}>
                        {t.action_taken || "pending"}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", color: colors.text.primary, fontFamily: fonts.body, fontWeight: "500" }}>
                      {t.subject || "No subject"}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: "11px", color: colors.text.muted, fontFamily: fonts.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.suggestion?.slice(0, 120) || ""}...
                    </p>
                    {t.created_at && (
                      <p style={{ margin: "4px 0 0", fontSize: "10px", color: colors.text.muted, fontFamily: fonts.mono, display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={10} /> {new Date(t.created_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* How It Works */}
          <div style={{ ...card, backgroundColor: "rgba(23,165,137,0.03)", borderColor: "rgba(23,165,137,0.12)" }}>
            <h3 style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 10px" }}>
              How It Works
            </h3>
            <ul style={{ margin: 0, paddingLeft: "18px", fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, lineHeight: 1.8 }}>
              <li>A Zendesk trigger fires when a new ticket is created and sends a webhook to BitBot Pro</li>
              <li>BitBot Pro fetches the ticket content, searches your Knowledge Base, and runs API integrations</li>
              <li>An AI response is generated based on your bot&apos;s personality and knowledge</li>
              <li><strong>Auto-Reply</strong>: Response is posted as a public ticket comment</li>
              <li><strong>Agent Assist</strong>: Response is stored for agents to view in the Zendesk sidebar app</li>
              <li>All ticket conversations appear in the Conversations tab with platform: <code style={{ fontSize: "11px", padding: "1px 5px", backgroundColor: "rgba(23,165,137,0.1)", borderRadius: "3px", color: "#17A589" }}>zendesk</code></li>
            </ul>
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } } .spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}
