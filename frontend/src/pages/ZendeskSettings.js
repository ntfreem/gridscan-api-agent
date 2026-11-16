import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import {
  Headphones, CheckCircle, AlertCircle, RefreshCw, Trash2,
  Save, Power, Loader2, Copy, Check, MessageSquare, Users,
  ExternalLink, Clock, Shield, Link2, LogIn, Settings, Eye, EyeOff,
  Download, Zap, Key,
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

  // OAuth client config
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [oauthClientIdMasked, setOauthClientIdMasked] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [savingOAuth, setSavingOAuth] = useState(false);
  const [showOAuthSetup, setShowOAuthSetup] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("");

  // Sidebar app
  const [sidebarKey, setSidebarKey] = useState("");
  const [sidebarKeyCopied, setSidebarKeyCopied] = useState(false);
  const [regeneratingKey, setRegeneratingKey] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

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

  const { selectedInstance } = useAuth();

  // Track which selectedInstance.id the latest fetch was for
  const fetchSeqRef = useRef(0);

  // Derive action header from the config that was successfully loaded.
  // This guarantees the Test/Save/Disconnect calls always use the same
  // instance_id that the GET /zendesk-config returned data for.
  const getHeaders = useCallback(() => {
    const iid = config?.instance_id || selectedInstance?.id || localStorage.getItem("bf_instance_id");
    return iid ? { "X-Instance-ID": iid } : {};
  }, [config, selectedInstance]);

  // Reset state when the selected instance (bot) changes
  useEffect(() => {
    setConfig(null);
    setWebhookUrl("");
    setTickets([]);
    setSidebarKey("");
    setLoading(true);
  }, [selectedInstance?.id]);

  const fetchConfig = useCallback(async () => {
    // Wait for instance to be selected (ensures X-Instance-ID header is set)
    if (!selectedInstance?.id) return;
    // Track this fetch so stale responses are ignored
    const seq = ++fetchSeqRef.current;
    try {
      const headers = { "X-Instance-ID": selectedInstance.id };
      const [cfgRes, oauthClientRes, cbRes] = await Promise.all([
        api.get("/admin/zendesk-config", { headers }),
        api.get("/admin/zendesk/oauth/client-config", { headers }).catch(() => ({ data: { configured: false } })),
        api.get("/admin/zendesk/oauth/callback-url", { headers }).catch(() => ({ data: { callback_url: "" } })),
      ]);
      // If a newer fetch has started, discard this stale response
      if (seq !== fetchSeqRef.current) return;
      setCallbackUrl(cbRes.data.callback_url || "");
      setConfig(cfgRes.data);
      setAutoReply(cfgRes.data.auto_reply_enabled || false);
      setAgentAssist(cfgRes.data.agent_assist_enabled ?? true);
      setIsActive(cfgRes.data.is_active || false);
      setSubdomain("");
      setOauthClientIdMasked(oauthClientRes.data.client_id_masked || "");
      if (cfgRes.data.connected) {
        const h = { "X-Instance-ID": cfgRes.data.instance_id || selectedInstance.id };
        try {
          const wh = await api.get("/admin/zendesk-config/webhook-url", { headers: h });
          if (seq !== fetchSeqRef.current) return;
          setWebhookUrl(wh.data.webhook_url || "");
        } catch { /* ignore */ }
        try {
          const tk = await api.get("/admin/zendesk-tickets", { headers: h });
          if (seq !== fetchSeqRef.current) return;
          setTickets(tk.data.tickets || []);
        } catch { /* ignore */ }
        try {
          const sk = await api.get("/admin/zendesk/sidebar-key", { headers: h });
          if (seq !== fetchSeqRef.current) return;
          setSidebarKey(sk.data.sidebar_api_key || "");
        } catch { /* ignore */ }
      }
    } catch {
      if (seq !== fetchSeqRef.current) return;
      toast.error("Failed to load Zendesk config");
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [selectedInstance]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  /* ── Save OAuth Client Config ── */
  const handleSaveOAuthClient = async (e) => {
    e.preventDefault();
    if (!oauthClientId.trim() || !oauthClientSecret.trim()) {
      toast.error("Both Client ID and Client Secret are required");
      return;
    }
    setSavingOAuth(true);
    try {
      await api.post("/admin/zendesk/oauth/client-config", {
        client_id: oauthClientId.trim(),
        client_secret: oauthClientSecret.trim(),
      }, { headers: getHeaders() });
      toast.success("OAuth credentials saved!");
      setOauthClientId("");
      setOauthClientSecret("");
      setShowOAuthSetup(false);
      await fetchConfig();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save credentials");
    } finally {
      setSavingOAuth(false);
    }
  };

  const handleRemoveOAuthClient = async () => {
    if (!window.confirm("Remove stored OAuth client credentials? You'll need to re-enter them to connect.")) return;
    try {
      await api.delete("/admin/zendesk/oauth/client-config", { headers: getHeaders() });
      toast.success("OAuth credentials removed");
      await fetchConfig();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to remove");
    }
  };

  /* ── OAuth Connect ── */
  const handleConnect = async () => {
    const sub = normalizeSubdomain(subdomain);
    if (!sub) {
      toast.error("Enter your Zendesk subdomain (e.g. your-company)");
      return;
    }
    setConnecting(true);
    try {
      const res = await api.post("/admin/zendesk/oauth/start", { subdomain: sub }, { headers: getHeaders() });
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
      const res = await api.post("/admin/zendesk/oauth/start", { subdomain: sub }, { headers: getHeaders() });
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
      }, { headers: getHeaders() });
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
      const res = await api.post("/admin/zendesk-config/test", {}, { headers: getHeaders() });
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
      await api.delete("/admin/zendesk-config", { headers: getHeaders() });
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
      await api.put("/admin/zendesk-config", { is_active: next }, { headers: getHeaders() });
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
              /* OAuth not configured — show setup form */
              <div>
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 14px",
                  borderRadius: "10px", backgroundColor: "rgba(251,191,36,0.04)",
                  border: "1px solid rgba(251,191,36,0.15)", marginBottom: "14px",
                }}>
                  <Settings size={16} color="#FBBF24" style={{ marginTop: "1px", flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#FBBF24", fontFamily: fonts.body }}>
                      OAuth Setup Required
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: colors.text.secondary, fontFamily: fonts.body, lineHeight: 1.5 }}>
                      Enter your Zendesk OAuth Client ID and Secret below.
                      Create them in{" "}
                      <a href="https://support.zendesk.com/hc/en-us/articles/4408845965210" target="_blank" rel="noopener noreferrer"
                        style={{ color: "#17A589", textDecoration: "none", fontWeight: 600 }}>Zendesk Admin Center</a>{" "}
                      → Apps &amp; integrations → APIs → OAuth clients.
                    </p>
                  </div>
                </div>

                {/* Callback URL — show first so user can configure Zendesk */}
                {callbackUrl && (
                  <div style={{
                    padding: "12px 14px", borderRadius: "10px", marginBottom: "14px",
                    backgroundColor: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.15)",
                  }}>
                    <p style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: "600", color: colors.text.primary, fontFamily: fonts.body }}>
                      <Link2 size={12} style={{ display: "inline", verticalAlign: "-1px", marginRight: "6px" }} />
                      Step 1: Add this Redirect URL to your Zendesk OAuth client
                    </p>
                    <p style={{ margin: "0 0 8px", fontSize: "11px", color: colors.text.muted, fontFamily: fonts.body, lineHeight: 1.5 }}>
                      In Zendesk Admin Center → Apps &amp; integrations → APIs → OAuth clients → your app, paste this exact URL under <strong>Redirect URLs</strong>:
                    </p>
                    <CopyField value={callbackUrl} />
                  </div>
                )}

                <form onSubmit={handleSaveOAuthClient}>
                  <p style={{ margin: "0 0 12px", fontSize: "12px", fontWeight: "600", color: colors.text.primary, fontFamily: fonts.body }}>
                    Step 2: Enter your OAuth credentials
                  </p>
                  <label style={T.label}>Client ID (Identifier)</label>
                  <input value={oauthClientId} onChange={e => setOauthClientId(e.target.value)}
                    placeholder="e.g. bitbotpro" data-testid="zendesk-oauth-client-id-input"
                    style={{ ...T.input, marginBottom: "12px" }} onFocus={onFocus} onBlur={onBlur} />

                  <label style={T.label}>Client Secret</label>
                  <div style={{ position: "relative", marginBottom: "16px" }}>
                    <input value={oauthClientSecret} onChange={e => setOauthClientSecret(e.target.value)}
                      type={showSecret ? "text" : "password"} placeholder="Paste the secret from Zendesk"
                      data-testid="zendesk-oauth-client-secret-input"
                      style={{ ...T.input, paddingRight: "40px" }} onFocus={onFocus} onBlur={onBlur} />
                    <button type="button" onClick={() => setShowSecret(!showSecret)}
                      style={{
                        position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer", color: colors.text.muted,
                        padding: "4px",
                      }}>
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  <button type="submit" disabled={savingOAuth || !oauthClientId.trim() || !oauthClientSecret.trim()}
                    data-testid="zendesk-save-oauth-client-btn"
                    style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "10px 24px", borderRadius: "10px", border: "none",
                      background: "linear-gradient(135deg, #03363D, #17A589)",
                      color: "#fff", fontSize: "13px", fontWeight: "600",
                      fontFamily: fonts.body,
                      cursor: savingOAuth || !oauthClientId.trim() || !oauthClientSecret.trim() ? "not-allowed" : "pointer",
                      opacity: savingOAuth || !oauthClientId.trim() || !oauthClientSecret.trim() ? 0.5 : 1,
                    }}>
                    {savingOAuth ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
                    {savingOAuth ? "Saving..." : "Save Credentials"}
                  </button>
                </form>
              </div>
            ) : (
              /* OAuth configured — show connect form */
              <div>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: "10px",
                  backgroundColor: "rgba(23,165,137,0.04)", border: "1px solid rgba(23,165,137,0.1)",
                  marginBottom: "14px",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flex: 1 }}>
                    <Shield size={16} color="#17A589" style={{ marginTop: "1px", flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: "12px", color: colors.text.secondary, fontFamily: fonts.body, lineHeight: 1.5 }}>
                      OAuth configured{oauthClientIdMasked ? ` (${oauthClientIdMasked})` : ""}. Connect securely — you&apos;ll be redirected to Zendesk to authorize.
                    </p>
                  </div>
                  <button onClick={handleRemoveOAuthClient} data-testid="zendesk-remove-oauth-client-btn"
                    title="Remove OAuth credentials"
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: colors.text.muted, padding: "4px", flexShrink: 0,
                    }}>
                    <Trash2 size={13} />
                  </button>
                </div>

                {callbackUrl && (
                  <div style={{
                    padding: "10px 14px", borderRadius: "10px", marginBottom: "14px",
                    backgroundColor: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.12)",
                  }}>
                    <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "600", color: colors.text.secondary, fontFamily: fonts.body }}>
                      Redirect URL for Zendesk OAuth client:
                    </p>
                    <CopyField value={callbackUrl} />
                  </div>
                )}

                <label style={T.label}>Zendesk Subdomain</label>
                <p style={{ margin: "0 0 6px", fontSize: "11px", color: colors.text.muted, fontFamily: fonts.body }}>
                  Enter just the subdomain — e.g. <strong>your-company</strong>. If you paste a full URL like https://your-company.zendesk.com, we'll extract it for you.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "14px" }}>
                  <input
                    value={subdomain}
                    onChange={e => setSubdomain(e.target.value)}
                    onBlur={e => {
                      const normalized = normalizeSubdomain(e.target.value);
                      if (normalized && normalized !== e.target.value) setSubdomain(normalized);
                    }}
                    placeholder="your-company"
                    data-testid="zendesk-subdomain-input"
                    style={{ ...T.input, borderTopRightRadius: 0, borderBottomRightRadius: 0, flex: 1 }}
                    onFocus={onFocus}
                    onKeyDown={e => { if (e.key === "Enter") handleConnect(); }}
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
                  disabled={connecting || !subdomain.trim()}
                  data-testid="zendesk-oauth-connect-btn"
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "10px 24px", borderRadius: "10px", border: "none",
                    background: "linear-gradient(135deg, #03363D, #17A589)",
                    color: "#fff", fontSize: "14px", fontWeight: "600", fontFamily: fonts.body,
                    cursor: connecting || !subdomain.trim() ? "not-allowed" : "pointer",
                    opacity: connecting || !subdomain.trim() ? 0.5 : 1,
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

          {/* Sidebar App */}
          <div style={{ ...card, borderColor: "rgba(96,165,250,0.2)" }} data-testid="zendesk-sidebar-card">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <Zap size={16} color="#60A5FA" />
              <h3 style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
                Sidebar App — Agent Assist
              </h3>
            </div>
            <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, margin: "0 0 14px", lineHeight: 1.5 }}>
              Install the BitBot Pro sidebar in Zendesk so agents can generate AI reply suggestions on any ticket — without auto-replying.
            </p>

            {/* Step 1: Download */}
            <div style={{
              padding: "12px 14px", borderRadius: "10px", marginBottom: "12px",
              backgroundColor: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.12)",
            }}>
              <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: "600", color: colors.text.primary, fontFamily: fonts.body }}>
                Step 1: Download the app
              </p>
              <button
                onClick={async () => {
                  setDownloadingZip(true);
                  try {
                    const res = await api.get("/admin/zendesk/sidebar-app.zip", { responseType: "blob" });
                    const url = URL.createObjectURL(res.data);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "bitbot-pro-zendesk-sidebar.zip";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                    toast.success("Sidebar app ZIP downloaded");
                  } catch {
                    toast.error("Failed to download sidebar app");
                  } finally {
                    setDownloadingZip(false);
                  }
                }}
                disabled={downloadingZip}
                data-testid="zendesk-download-sidebar-btn"
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "8px 16px", borderRadius: "8px", border: "none",
                  background: "linear-gradient(135deg, #2563EB, #3B82F6)",
                  color: "#fff", fontSize: "12px", fontWeight: "600",
                  fontFamily: fonts.body, cursor: downloadingZip ? "not-allowed" : "pointer",
                  opacity: downloadingZip ? 0.5 : 1,
                }}
              >
                {downloadingZip ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={13} />}
                {downloadingZip ? "Downloading..." : "Download Sidebar App (.zip)"}
              </button>
            </div>

            {/* Step 2: Install instructions */}
            <div style={{
              padding: "12px 14px", borderRadius: "10px", marginBottom: "12px",
              backgroundColor: colors.bg.base, border: `1px solid ${colors.border.default}`,
            }}>
              <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: "600", color: colors.text.primary, fontFamily: fonts.body }}>
                Step 2: Install in Zendesk
              </p>
              <ol style={{ margin: 0, paddingLeft: "18px", fontFamily: fonts.body, fontSize: "11px", color: colors.text.secondary, lineHeight: 1.8 }}>
                <li>Go to <strong>Zendesk Admin Center → Apps and integrations → Apps → Zendesk Support apps</strong></li>
                <li>Click <strong>Upload private app</strong>, select the downloaded ZIP</li>
                <li>When prompted, paste the <strong>Sidebar API Key</strong> below into the settings</li>
                <li>The BitBot Pro URL will be pre-filled — verify it matches your deployment</li>
                <li>Click <strong>Install</strong></li>
              </ol>
            </div>

            {/* Step 3: API Key */}
            <div style={{
              padding: "12px 14px", borderRadius: "10px",
              backgroundColor: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.12)",
            }}>
              <p style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: "600", color: colors.text.primary, fontFamily: fonts.body }}>
                <Key size={12} style={{ display: "inline", verticalAlign: "-1px", marginRight: "6px" }} />
                Step 3: Sidebar API Key
              </p>
              <p style={{ margin: "0 0 8px", fontSize: "11px", color: colors.text.muted, fontFamily: fonts.body }}>
                Paste this key into the app settings when installing. It authenticates sidebar requests to BitBot Pro.
              </p>
              {sidebarKey ? (
                <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                  <input
                    readOnly
                    value={sidebarKey}
                    data-testid="zendesk-sidebar-key-input"
                    style={{ ...T.input, flex: 1, fontSize: "11px", fontFamily: fonts.mono, color: colors.text.secondary }}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(sidebarKey).then(() => {
                        setSidebarKeyCopied(true);
                        setTimeout(() => setSidebarKeyCopied(false), 1500);
                      });
                    }}
                    data-testid="zendesk-sidebar-key-copy-btn"
                    style={{
                      padding: "6px 12px", borderRadius: "8px",
                      border: `1px solid ${colors.border.default}`,
                      backgroundColor: sidebarKeyCopied ? "rgba(52,211,153,0.08)" : colors.bg.base,
                      color: sidebarKeyCopied ? "#34D399" : colors.text.muted,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: "4px",
                      fontSize: "11px", fontFamily: fonts.body,
                    }}
                  >
                    {sidebarKeyCopied ? <Check size={12} /> : <Copy size={12} />}
                    {sidebarKeyCopied ? "Copied" : "Copy"}
                  </button>
                </div>
              ) : (
                <p style={{ margin: "0 0 8px", fontSize: "11px", color: colors.text.muted, fontFamily: fonts.mono }}>
                  Loading...
                </p>
              )}
              <button
                onClick={async () => {
                  if (!window.confirm("Regenerate the sidebar API key? The current key will stop working. You'll need to update the key in your Zendesk app settings.")) return;
                  setRegeneratingKey(true);
                  try {
                    const res = await api.post("/admin/zendesk/sidebar-key/regenerate");
                    setSidebarKey(res.data.sidebar_api_key);
                    toast.success("Sidebar API key regenerated");
                  } catch {
                    toast.error("Failed to regenerate key");
                  } finally {
                    setRegeneratingKey(false);
                  }
                }}
                disabled={regeneratingKey}
                data-testid="zendesk-sidebar-key-regen-btn"
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "6px 12px", borderRadius: "8px",
                  border: `1px solid ${colors.border.default}`,
                  backgroundColor: colors.bg.base, color: colors.text.muted,
                  fontSize: "11px", fontFamily: fonts.body, cursor: "pointer",
                }}
              >
                <RefreshCw size={11} /> {regeneratingKey ? "Regenerating..." : "Regenerate Key"}
              </button>
            </div>
          </div>

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
