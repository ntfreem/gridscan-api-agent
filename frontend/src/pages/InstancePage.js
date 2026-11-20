/**
 * Instance detail page — manage individual channel instance (Discord/Telegram/Webchat).
 * Enhanced webchat embed customization with appearance config.
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import {
  Network, Settings, Zap, Send, Globe, Loader2, CheckCircle, XCircle,
  Link2, Unlink, TestTube, RefreshCw, Copy, Code2, MessageSquare,
  Palette, Type, MessageCircle, Layout, Save, Eye,
} from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur } from "../theme";
import { toast } from "sonner";

const CHANNEL_META = {
  discord: { label: "Discord", icon: Zap, color: "#5865F2" },
  telegram: { label: "Telegram", icon: Send, color: "#26A5E4" },
  webchat: { label: "Webchat", icon: Globe, color: "#60A5FA" },
  web: { label: "Webchat", icon: Globe, color: "#60A5FA" },
};

function WebchatConfigPanel({ api, instanceId, runtimeConfig, onRefresh }) {
  const [config, setConfig] = useState({
    title: "",
    subtitle: "",
    greeting: "",
    placeholder: "",
    primary_color: "#3B82F6",
    text_color: "#FFFFFF",
    bg_color: "#1E293B",
    position: "bottom-right",
    width: "380",
    height: "600",
    auto_open: false,
    auto_open_delay: 3,
    show_branding: true,
  });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("appearance");

  useEffect(() => {
    if (runtimeConfig) {
      setConfig(prev => ({
        ...prev,
        title: runtimeConfig.title || runtimeConfig.bot_name || prev.title,
        subtitle: runtimeConfig.subtitle || prev.subtitle,
        greeting: runtimeConfig.greeting || runtimeConfig.welcome_message || prev.greeting,
        placeholder: runtimeConfig.placeholder || runtimeConfig.input_placeholder || prev.placeholder,
        primary_color: runtimeConfig.primary_color || runtimeConfig.theme_color || prev.primary_color,
        text_color: runtimeConfig.text_color || prev.text_color,
        bg_color: runtimeConfig.bg_color || runtimeConfig.background_color || prev.bg_color,
        position: runtimeConfig.position || prev.position,
        width: String(runtimeConfig.width || prev.width),
        height: String(runtimeConfig.height || prev.height),
        auto_open: runtimeConfig.auto_open ?? prev.auto_open,
        auto_open_delay: runtimeConfig.auto_open_delay ?? prev.auto_open_delay,
        show_branding: runtimeConfig.show_branding ?? prev.show_branding,
      }));
    }
  }, [runtimeConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const changes = {};
      Object.entries(config).forEach(([k, v]) => {
        if (v !== "" && v !== undefined) changes[k] = v;
      });
      if (changes.width) changes.width = Number(changes.width);
      if (changes.height) changes.height = Number(changes.height);
      await api.patchConfig("instance", instanceId, changes);
      toast.success("Webchat configuration saved");
      if (onRefresh) onRefresh();
    } catch (err) { toast.error(err.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  const updateField = (key, value) => setConfig(p => ({ ...p, [key]: value }));

  const configTabs = [
    { key: "appearance", label: "Appearance", icon: Palette },
    { key: "content", label: "Content", icon: Type },
    { key: "behavior", label: "Behavior", icon: Layout },
  ];

  return (
    <div style={{ ...T.card, marginBottom: "16px" }} data-testid="webchat-config-panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Palette size={16} color={colors.brand.light} />
          <p style={T.sectionTitle}>Webchat Customization</p>
        </div>
        <button onClick={handleSave} disabled={saving} data-testid="save-webchat-config"
          style={{ ...T.btnPrimary, padding: "8px 16px", fontSize: "12px", opacity: saving ? 0.6 : 1 }}>
          {saving ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={12} />}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Config sub-tabs */}
      <div style={{ display: "flex", gap: "3px", marginBottom: "18px", padding: "3px", backgroundColor: colors.bg.panel, borderRadius: radius.md }}>
        {configTabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} data-testid={`webchat-tab-${t.key}`}
            style={{
              flex: 1, padding: "7px 12px", borderRadius: radius.sm, border: "none", cursor: "pointer",
              fontFamily: fonts.body, fontSize: "12px", fontWeight: activeTab === t.key ? "600" : "400",
              color: activeTab === t.key ? colors.brand.light : colors.text.muted,
              backgroundColor: activeTab === t.key ? colors.bg.surface : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
              transition: "all 0.15s",
            }}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* Appearance tab */}
      {activeTab === "appearance" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={T.label}>Primary Color</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input type="color" value={config.primary_color} onChange={e => updateField("primary_color", e.target.value)}
                data-testid="webchat-primary-color"
                style={{ width: "40px", height: "36px", border: `1px solid ${colors.border.default}`, borderRadius: radius.sm, cursor: "pointer", backgroundColor: "transparent", padding: "2px" }} />
              <input value={config.primary_color} onChange={e => updateField("primary_color", e.target.value)}
                style={{ ...T.input, fontFamily: fonts.mono, fontSize: "12px" }} onFocus={onFocus} onBlur={onBlur} />
            </div>
          </div>
          <div>
            <label style={T.label}>Text Color</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input type="color" value={config.text_color} onChange={e => updateField("text_color", e.target.value)}
                data-testid="webchat-text-color"
                style={{ width: "40px", height: "36px", border: `1px solid ${colors.border.default}`, borderRadius: radius.sm, cursor: "pointer", backgroundColor: "transparent", padding: "2px" }} />
              <input value={config.text_color} onChange={e => updateField("text_color", e.target.value)}
                style={{ ...T.input, fontFamily: fonts.mono, fontSize: "12px" }} onFocus={onFocus} onBlur={onBlur} />
            </div>
          </div>
          <div>
            <label style={T.label}>Background Color</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input type="color" value={config.bg_color} onChange={e => updateField("bg_color", e.target.value)}
                data-testid="webchat-bg-color"
                style={{ width: "40px", height: "36px", border: `1px solid ${colors.border.default}`, borderRadius: radius.sm, cursor: "pointer", backgroundColor: "transparent", padding: "2px" }} />
              <input value={config.bg_color} onChange={e => updateField("bg_color", e.target.value)}
                style={{ ...T.input, fontFamily: fonts.mono, fontSize: "12px" }} onFocus={onFocus} onBlur={onBlur} />
            </div>
          </div>
          <div>
            <label style={T.label}>Position</label>
            <select value={config.position} onChange={e => updateField("position", e.target.value)}
              data-testid="webchat-position"
              style={{ ...T.input, fontSize: "13px" }}>
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
            </select>
          </div>
          <div>
            <label style={T.label}>Width (px)</label>
            <input value={config.width} onChange={e => updateField("width", e.target.value)} type="number" min="300" max="600"
              data-testid="webchat-width"
              style={{ ...T.input, fontSize: "13px" }} onFocus={onFocus} onBlur={onBlur} />
          </div>
          <div>
            <label style={T.label}>Height (px)</label>
            <input value={config.height} onChange={e => updateField("height", e.target.value)} type="number" min="400" max="800"
              data-testid="webchat-height"
              style={{ ...T.input, fontSize: "13px" }} onFocus={onFocus} onBlur={onBlur} />
          </div>
        </div>
      )}

      {/* Content tab */}
      {activeTab === "content" && (
        <div style={{ display: "grid", gap: "14px" }}>
          <div>
            <label style={T.label}>Chat Title</label>
            <input value={config.title} onChange={e => updateField("title", e.target.value)}
              data-testid="webchat-title" placeholder="e.g. Support Assistant"
              style={T.input} onFocus={onFocus} onBlur={onBlur} />
            <p style={T.hint}>Displayed in the chat widget header.</p>
          </div>
          <div>
            <label style={T.label}>Subtitle</label>
            <input value={config.subtitle} onChange={e => updateField("subtitle", e.target.value)}
              data-testid="webchat-subtitle" placeholder="e.g. Typically replies in minutes"
              style={T.input} onFocus={onFocus} onBlur={onBlur} />
          </div>
          <div>
            <label style={T.label}>Greeting Message</label>
            <textarea value={config.greeting} onChange={e => updateField("greeting", e.target.value)}
              data-testid="webchat-greeting" placeholder="e.g. Hi! How can I help you today?"
              rows={3} style={T.textarea} onFocus={onFocus} onBlur={onBlur} />
            <p style={T.hint}>First message shown when the widget opens.</p>
          </div>
          <div>
            <label style={T.label}>Input Placeholder</label>
            <input value={config.placeholder} onChange={e => updateField("placeholder", e.target.value)}
              data-testid="webchat-placeholder" placeholder="e.g. Type your message..."
              style={T.input} onFocus={onFocus} onBlur={onBlur} />
          </div>
        </div>
      )}

      {/* Behavior tab */}
      {activeTab === "behavior" && (
        <div style={{ display: "grid", gap: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <label style={{ ...T.label, marginBottom: 0 }}>Auto-Open Widget</label>
              <p style={{ ...T.hint, marginTop: "2px" }}>Automatically open the chat widget after a delay.</p>
            </div>
            <button onClick={() => updateField("auto_open", !config.auto_open)} data-testid="webchat-auto-open"
              style={{
                width: "44px", height: "24px", borderRadius: radius.full, border: "none",
                cursor: "pointer", position: "relative", transition: "background-color 0.2s",
                backgroundColor: config.auto_open ? colors.brand.primary : colors.bg.panel,
              }}>
              <span style={{
                position: "absolute", top: "2px", width: "20px", height: "20px", borderRadius: "50%",
                backgroundColor: "#fff", transition: "left 0.2s",
                left: config.auto_open ? "22px" : "2px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }} />
            </button>
          </div>
          {config.auto_open && (
            <div>
              <label style={T.label}>Auto-Open Delay (seconds)</label>
              <input value={config.auto_open_delay} onChange={e => updateField("auto_open_delay", Number(e.target.value))}
                type="number" min="0" max="60" data-testid="webchat-auto-open-delay"
                style={{ ...T.input, width: "120px" }} onFocus={onFocus} onBlur={onBlur} />
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <label style={{ ...T.label, marginBottom: 0 }}>Show Branding</label>
              <p style={{ ...T.hint, marginTop: "2px" }}>Display "Powered by BitBot Pro" in the widget footer.</p>
            </div>
            <button onClick={() => updateField("show_branding", !config.show_branding)} data-testid="webchat-show-branding"
              style={{
                width: "44px", height: "24px", borderRadius: radius.full, border: "none",
                cursor: "pointer", position: "relative", transition: "background-color 0.2s",
                backgroundColor: config.show_branding ? colors.brand.primary : colors.bg.panel,
              }}>
              <span style={{
                position: "absolute", top: "2px", width: "20px", height: "20px", borderRadius: "50%",
                backgroundColor: "#fff", transition: "left 0.2s",
                left: config.show_branding ? "22px" : "2px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }} />
            </button>
          </div>
        </div>
      )}

      {/* Live preview mini widget */}
      <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: `1px solid ${colors.border.muted}` }}>
        <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "10px" }}>
          <Eye size={10} style={{ verticalAlign: "middle", marginRight: "4px" }} /> Preview
        </p>
        <div style={{
          width: "280px", height: "180px", borderRadius: "12px", overflow: "hidden",
          border: `1px solid ${colors.border.default}`, margin: "0 auto",
          display: "flex", flexDirection: "column",
          backgroundColor: config.bg_color || "#1E293B",
        }}>
          {/* Mini header */}
          <div style={{
            padding: "10px 12px",
            backgroundColor: config.primary_color || "#3B82F6",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <MessageCircle size={14} color={config.text_color || "#FFF"} />
            <div>
              <p style={{ fontFamily: fonts.body, fontSize: "11px", fontWeight: "600", color: config.text_color || "#FFF", margin: 0 }}>
                {config.title || "Chat Assistant"}
              </p>
              {config.subtitle && (
                <p style={{ fontFamily: fonts.body, fontSize: "8px", color: `${config.text_color || "#FFF"}AA`, margin: 0 }}>
                  {config.subtitle}
                </p>
              )}
            </div>
          </div>
          {/* Mini chat body */}
          <div style={{ flex: 1, padding: "8px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            {config.greeting && (
              <div style={{
                backgroundColor: `${config.primary_color || "#3B82F6"}22`,
                borderRadius: "8px 8px 8px 2px", padding: "6px 8px", maxWidth: "80%",
              }}>
                <p style={{ fontFamily: fonts.body, fontSize: "9px", color: config.text_color || "#CCC", margin: 0, lineHeight: "1.3" }}>
                  {config.greeting.substring(0, 60)}{config.greeting.length > 60 ? "..." : ""}
                </p>
              </div>
            )}
            <div style={{
              backgroundColor: `rgba(255,255,255,0.05)`,
              borderRadius: "6px", padding: "5px 8px",
            }}>
              <p style={{ fontFamily: fonts.body, fontSize: "8px", color: `${config.text_color || "#FFF"}66`, margin: 0 }}>
                {config.placeholder || "Type a message..."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InstancePage() {
  const { instanceId } = useParams();
  const { api } = useSession();
  const navigate = useNavigate();
  const [instance, setInstance] = useState(null);
  const [channelStatus, setChannelStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [embedSnippet, setEmbedSnippet] = useState(null);
  const [runtimeConfig, setRuntimeConfig] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!instanceId) return;
    setLoading(true);
    try {
      const [instData, statusData] = await Promise.all([
        api.instance(instanceId).catch(() => null),
        api.channelStatus(instanceId).catch(() => null),
      ]);
      if (instData) { setInstance(instData); setName(instData.name || ""); }
      if (statusData) setChannelStatus(statusData);
      // Load embed snippet and runtime config for webchat
      if (instData?.channel === "webchat" || instData?.channel === "web") {
        const [snippet, rtConfig] = await Promise.all([
          api.embedSnippet(instanceId).catch(() => null),
          api.runtimeConfig(instanceId).catch(() => null),
        ]);
        if (snippet) setEmbedSnippet(snippet);
        if (rtConfig) setRuntimeConfig(rtConfig);
      }
    } catch {}
    finally { setLoading(false); }
  }, [instanceId, api]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await api.channelConnect(instanceId);
      toast.success("Channel connected");
      fetchData();
    } catch (err) { toast.error(err.detail || "Connect failed"); }
    finally { setConnecting(false); }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await api.channelDisconnect(instanceId);
      toast.success("Channel disconnected");
      fetchData();
    } catch (err) { toast.error(err.detail || "Disconnect failed"); }
    finally { setDisconnecting(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const r = await api.channelTest(instanceId);
      toast.success(r.message || "Test passed");
    } catch (err) { toast.error(err.detail || "Test failed"); }
    finally { setTesting(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patchInstance(instanceId, { name });
      toast.success("Instance updated");
      fetchData();
    } catch (err) { toast.error(err.detail || "Update failed"); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div style={{ ...T.page, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "100px" }}>
        <Loader2 size={20} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!instance) {
    return <div style={T.page}><p style={{ color: colors.text.muted }}>Instance not found.</p></div>;
  }

  const meta = CHANNEL_META[instance.channel] || CHANNEL_META.web;
  const isConnected = channelStatus?.connected || instance.connected;

  return (
    <div style={T.page} data-testid="instance-page">
      <p style={T.overline}>{meta.label} Instance</p>
      <h1 style={{ ...T.h1, marginBottom: "24px" }}>{instance.name || "Instance"}</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        {/* General */}
        <div style={T.card}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <Settings size={16} color={colors.brand.light} />
            <p style={T.sectionTitle}>General</p>
          </div>
          <label style={T.label}>Instance Name</label>
          <input value={name} onChange={e => setName(e.target.value)} data-testid="instance-name"
            style={{ ...T.input, marginBottom: "12px" }} onFocus={onFocus} onBlur={onBlur} />
          <button onClick={handleSave} disabled={saving} data-testid="save-instance-btn"
            style={{ ...T.btnPrimary, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>

        {/* Connection Status */}
        <div style={T.card}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <meta.icon size={16} color={meta.color} />
            <p style={T.sectionTitle}>Connection</p>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "12px 16px", borderRadius: radius.md,
            backgroundColor: isConnected ? "rgba(52,211,153,0.06)" : "rgba(148,163,184,0.06)",
            border: `1px solid ${isConnected ? "rgba(52,211,153,0.2)" : colors.border.default}`,
            marginBottom: "14px",
          }}>
            {isConnected ? <CheckCircle size={16} color={colors.brand.success} /> : <XCircle size={16} color={colors.text.muted} />}
            <span style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "500", color: isConnected ? colors.brand.success : colors.text.muted }}>
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {!isConnected ? (
              <button onClick={handleConnect} disabled={connecting} data-testid="connect-channel-btn"
                style={{ ...T.btnPrimary, opacity: connecting ? 0.6 : 1 }}>
                {connecting ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Link2 size={14} />}
                {connecting ? "Connecting..." : "Connect"}
              </button>
            ) : (
              <button onClick={handleDisconnect} disabled={disconnecting}
                style={{ ...T.btnGhost, color: colors.brand.error, borderColor: "rgba(244,63,94,0.3)" }}>
                {disconnecting ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Unlink size={14} />}
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            )}
            <button onClick={handleTest} disabled={testing} data-testid="test-channel-btn"
              style={T.btnGhost}>
              {testing ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <TestTube size={14} />}
              Test
            </button>
          </div>
        </div>
      </div>

      {/* Webchat Customization Panel */}
      {(instance.channel === "webchat" || instance.channel === "web") && (
        <WebchatConfigPanel api={api} instanceId={instanceId} runtimeConfig={runtimeConfig} onRefresh={fetchData} />
      )}

      {/* Webchat Embed Snippet */}
      {(instance.channel === "webchat" || instance.channel === "web") && embedSnippet && (
        <div style={{ ...T.card, marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Code2 size={16} color="#34D399" />
            <p style={T.sectionTitle}>Embed Code</p>
          </div>
          <p style={T.hint}>Copy this snippet and paste it into your website's HTML, just before the closing <code style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.brand.light }}>&lt;/body&gt;</code> tag.</p>
          <div style={{ position: "relative", marginTop: "10px" }}>
            <pre data-testid="embed-snippet-code" style={{
              backgroundColor: colors.bg.panel, padding: "16px 18px", borderRadius: radius.md,
              fontFamily: fonts.mono, fontSize: "12px", color: colors.text.primary,
              overflow: "auto", maxHeight: "240px", border: `1px solid ${colors.border.default}`,
              lineHeight: "1.6", whiteSpace: "pre-wrap", wordBreak: "break-all",
            }}>
              {typeof embedSnippet === "string" ? embedSnippet : JSON.stringify(embedSnippet, null, 2)}
            </pre>
            <button onClick={() => { navigator.clipboard.writeText(typeof embedSnippet === "string" ? embedSnippet : JSON.stringify(embedSnippet)); toast.success("Embed code copied!"); }}
              data-testid="copy-embed-btn"
              style={{ position: "absolute", top: "10px", right: "10px", ...T.btnPrimary, padding: "6px 12px", fontSize: "11px" }}>
              <Copy size={11} /> Copy
            </button>
          </div>
        </div>
      )}

      {/* Channel-specific details */}
      {channelStatus && (
        <div style={T.card}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <MessageSquare size={16} color={colors.brand.light} />
            <p style={T.sectionTitle}>Channel Details</p>
          </div>
          <pre style={{
            backgroundColor: colors.bg.panel, padding: "12px", borderRadius: radius.md,
            fontFamily: fonts.mono, fontSize: "11px", color: colors.text.secondary,
            overflow: "auto", maxHeight: "200px", border: `1px solid ${colors.border.muted}`,
          }}>
            {JSON.stringify(channelStatus, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
