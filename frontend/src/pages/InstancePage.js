/**
 * Instance detail page — manage individual channel instance (Discord/Telegram/Webchat).
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import {
  Network, Settings, Zap, Send, Globe, Loader2, CheckCircle, XCircle,
  Link2, Unlink, TestTube, RefreshCw, Copy, Code2, MessageSquare,
} from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur } from "../theme";
import { toast } from "sonner";

const CHANNEL_META = {
  discord: { label: "Discord", icon: Zap, color: "#5865F2" },
  telegram: { label: "Telegram", icon: Send, color: "#26A5E4" },
  webchat: { label: "Webchat", icon: Globe, color: "#60A5FA" },
  web: { label: "Webchat", icon: Globe, color: "#60A5FA" },
};

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
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!instanceId) return;
    setLoading(true);
    try {
      const [instData, statusData] = await Promise.all([
        api.instance(instanceId).catch(() => null),
        api.channelStatus(instanceId).catch(() => null),
      ]);
      if (instData) { setInstance(instData); setName(instData.name || ""); }
      if (statusData) setChannelStatus(statusData);
      // Load embed snippet for webchat
      if (instData?.channel === "webchat" || instData?.channel === "web") {
        try {
          const snippet = await api.embedSnippet(instanceId);
          setEmbedSnippet(snippet);
        } catch {}
      }
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [instanceId, api]);

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

      {/* Webchat Embed Snippet */}
      {(instance.channel === "webchat" || instance.channel === "web") && embedSnippet && (
        <div style={{ ...T.card, marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Code2 size={16} color="#34D399" />
            <p style={T.sectionTitle}>Embed Snippet</p>
          </div>
          <p style={T.hint}>Copy this snippet and paste it into your website's HTML to add the chat widget.</p>
          <div style={{ position: "relative", marginTop: "8px" }}>
            <pre style={{
              backgroundColor: colors.bg.panel, padding: "14px 16px", borderRadius: radius.md,
              fontFamily: fonts.mono, fontSize: "12px", color: colors.text.primary,
              overflow: "auto", maxHeight: "200px", border: `1px solid ${colors.border.default}`,
              lineHeight: "1.5",
            }}>
              {typeof embedSnippet === "string" ? embedSnippet : JSON.stringify(embedSnippet, null, 2)}
            </pre>
            <button onClick={() => { navigator.clipboard.writeText(typeof embedSnippet === "string" ? embedSnippet : JSON.stringify(embedSnippet)); toast.success("Copied!"); }}
              style={{ position: "absolute", top: "8px", right: "8px", ...T.btnGhost, padding: "4px 8px" }}>
              <Copy size={12} /> Copy
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
