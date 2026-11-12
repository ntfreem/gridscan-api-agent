import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import { toast } from "sonner";
import {
  Headphones, CheckCircle, AlertCircle, RefreshCw, Eye, EyeOff,
  Trash2, Save, Power, Loader2, Copy, Check, MessageSquare, Users,
  ExternalLink, Clock,
} from "lucide-react";
import { colors, fonts, T, onFocus, onBlur } from "../theme";

const card = {
  backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
  borderRadius: "12px", padding: "20px", marginBottom: "16px",
};

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  return (
    <div style={{ marginBottom: "10px" }}>
      {label && <label style={{ ...T.label, marginBottom: "4px", display: "block" }}>{label}</label>}
      <div style={{ display: "flex", gap: "6px" }}>
        <input readOnly value={value} style={{ ...T.input, flex: 1, fontSize: "11px", fontFamily: fonts.mono, color: colors.text.secondary }} />
        <button onClick={copy} data-testid="copy-webhook-url" style={{
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

export default function ZendeskSettings() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [tickets, setTickets] = useState([]);

  // Form
  const [subdomain, setSubdomain] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [credentialsChanged, setCredentialsChanged] = useState(false);
  const [autoReply, setAutoReply] = useState(false);
  const [agentAssist, setAgentAssist] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get("/admin/zendesk-config");
      setConfig(res.data);
      setAutoReply(res.data.auto_reply_enabled || false);
      setAgentAssist(res.data.agent_assist_enabled ?? true);
      setIsActive(res.data.is_active || false);
      setSubdomain(""); setEmail(""); setApiToken("");
      setCredentialsChanged(false);
      // Fetch webhook URL if connected
      if (res.data.connected) {
        try {
          const wh = await api.get("/admin/zendesk-config/webhook-url");
          setWebhookUrl(wh.data.webhook_url || "");
        } catch {}
        // Fetch recent tickets
        try {
          const tk = await api.get("/admin/zendesk-tickets");
          setTickets(tk.data.tickets || []);
        } catch {}
      }
    } catch {
      toast.error("Failed to load Zendesk config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleConnect = async () => {
    if (!subdomain.trim() || !email.trim() || !apiToken.trim()) {
      toast.error("All fields are required");
      return;
    }
    setSaving(true);
    try {
      const res = await api.put("/admin/zendesk-config", {
        subdomain: subdomain.trim(), email: email.trim(), api_token: apiToken.trim(),
      });
      toast.success("Zendesk connected!");
      if (res.data.webhook_url) setWebhookUrl(res.data.webhook_url);
      setCredentialsChanged(false);
      await fetchConfig();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to connect");
    } finally {
      setSaving(false);
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
      toast.success(`Connected! ${res.data.user_name} (${res.data.user_email}) on ${res.data.subdomain}.zendesk.com`);
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
            <span style={{
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

      {/* Connection Card */}
      <div style={card} data-testid="zendesk-connection-card">
        <h3 style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 14px" }}>
          Connection
        </h3>

        {connected && !credentialsChanged ? (
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
                  {config.zendesk_user_name || config.email} &middot; Token: {config.api_token_masked}
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
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setCredentialsChanged(true)} data-testid="zendesk-change-creds-btn"
                style={{
                  padding: "8px 14px", borderRadius: "8px",
                  border: `1px solid ${colors.border.default}`,
                  backgroundColor: colors.bg.base, color: colors.text.secondary,
                  fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
                }}>
                Change Credentials
              </button>
              <button onClick={handleDisconnect} disabled={disconnecting} data-testid="zendesk-disconnect-btn"
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
          <div>
            <div style={{
              display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 14px",
              borderRadius: "10px", backgroundColor: "rgba(23,165,137,0.04)",
              border: "1px solid rgba(23,165,137,0.1)", marginBottom: "14px",
            }}>
              <AlertCircle size={16} color="#17A589" style={{ marginTop: "1px", flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: "12px", color: colors.text.secondary, fontFamily: fonts.body, lineHeight: 1.5 }}>
                Go to <strong>Zendesk Admin Center &rarr; Apps &rarr; APIs &rarr; API tokens</strong> and create a token.
                Use the email of the admin account and the generated token below.{" "}
                <a href="https://support.zendesk.com/hc/en-us/articles/4408889192858" target="_blank" rel="noopener noreferrer"
                  style={{ color: "#17A589", textDecoration: "none", fontWeight: 600 }}>Zendesk docs</a>
              </p>
            </div>

            <label style={T.label}>Subdomain</label>
            <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "10px" }}>
              <input value={subdomain} onChange={e => setSubdomain(e.target.value)}
                placeholder="your-company"
                data-testid="zendesk-subdomain-input"
                style={{ ...T.input, borderTopRightRadius: 0, borderBottomRightRadius: 0, flex: 1 }}
                onFocus={onFocus} onBlur={onBlur}
              />
              <span style={{
                padding: "8px 12px", backgroundColor: colors.bg.surface,
                border: `1px solid ${colors.border.default}`, borderLeft: "none",
                borderTopRightRadius: "10px", borderBottomRightRadius: "10px",
                fontFamily: fonts.mono, fontSize: "12px", color: colors.text.muted,
              }}>.zendesk.com</span>
            </div>

            <label style={T.label}>Admin Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@company.com" type="email"
              data-testid="zendesk-email-input"
              style={{ ...T.input, marginBottom: "10px" }}
              onFocus={onFocus} onBlur={onBlur}
            />

            <label style={T.label}>API Token</label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input type={showToken ? "text" : "password"} value={apiToken}
                  onChange={e => setApiToken(e.target.value)}
                  placeholder="Zendesk API token"
                  data-testid="zendesk-token-input"
                  style={{ ...T.input, paddingRight: "40px" }}
                  onFocus={onFocus} onBlur={onBlur}
                />
                <button onClick={() => setShowToken(!showToken)} type="button"
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "4px" }}>
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={handleConnect} disabled={saving || !subdomain.trim() || !email.trim() || !apiToken.trim()}
                data-testid="zendesk-connect-btn"
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "9px 20px", borderRadius: "10px", border: "none",
                  background: "linear-gradient(135deg, #03363D, #17A589)",
                  color: "#fff", fontSize: "13px", fontWeight: "600",
                  fontFamily: fonts.body,
                  cursor: saving || !subdomain.trim() || !email.trim() || !apiToken.trim() ? "not-allowed" : "pointer",
                  opacity: saving || !subdomain.trim() || !email.trim() || !apiToken.trim() ? 0.5 : 1,
                }}>
                {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
                {saving ? "Connecting..." : "Connect"}
              </button>
              {credentialsChanged && connected && (
                <button onClick={() => { setCredentialsChanged(false); setSubdomain(""); setEmail(""); setApiToken(""); }}
                  style={{ fontSize: "12px", color: colors.text.muted, background: "none", border: `1px solid ${colors.border.default}`, borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontFamily: fonts.body }}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Settings — only when connected */}
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
                Add this URL as a webhook in Zendesk Admin Center, then create a trigger for "Ticket is Created".
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
