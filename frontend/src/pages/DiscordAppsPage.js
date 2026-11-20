/**
 * Discord Application management — per-enterprise Discord app setup.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import {
  Zap, Loader2, Save, RotateCcw, Power, PowerOff, Radio, Image, ArrowLeft,
} from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur } from "../theme";
import { toast } from "sonner";

export default function DiscordAppsPage() {
  const { enterpriseId } = useParams();
  const { api, isSuperAdmin, enterprises } = useSession();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [appId, setAppId] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [token, setToken] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const entId = enterpriseId;

  useEffect(() => {
    if (!entId) { setLoading(false); return; }
    setLoading(true);
    api.discordApp(entId).then(d => {
      setApp(d);
      setAppId(d?.application_id || d?.app_id || "");
      setPublicKey(d?.public_key || "");
    }).catch(() => setApp(null))
    .finally(() => setLoading(false));
  }, [entId, api]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { application_id: appId, public_key: publicKey };
      if (token) body.token = token;
      if (clientSecret) body.client_secret = clientSecret;
      await api.putDiscordApp(entId, body);
      toast.success("Discord application saved");
      setToken(""); setClientSecret("");
      const updated = await api.discordApp(entId);
      if (updated) setApp(updated);
    } catch (err) { toast.error(err.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  const handleRotateToken = async () => {
    if (!window.confirm("Rotate the bot token? The old token will stop working.")) return;
    try {
      await api.discordAppRotateToken(entId, token || undefined);
      toast.success("Token rotated");
    } catch (err) { toast.error(err.detail || "Rotate failed"); }
  };

  const handleEnable = async () => {
    try {
      await api.discordAppEnable(entId);
      toast.success("Discord application enabled");
      const updated = await api.discordApp(entId);
      if (updated) setApp(updated);
    } catch (err) { toast.error(err.detail || "Enable failed"); }
  };

  const handleDisable = async () => {
    try {
      await api.discordAppDisable(entId);
      toast.success("Discord application disabled");
      const updated = await api.discordApp(entId);
      if (updated) setApp(updated);
    } catch (err) { toast.error(err.detail || "Disable failed"); }
  };

  const handleGateway = async (op) => {
    try {
      await api.discordAppGateway(entId, op);
      toast.success(`Gateway ${op}`);
    } catch (err) { toast.error(err.detail || `Gateway ${op} failed`); }
  };

  if (!isSuperAdmin) {
    return (
      <div style={{ ...T.page, textAlign: "center", paddingTop: "80px" }}>
        <Zap size={32} color={colors.border.default} style={{ margin: "0 auto 12px" }} />
        <p style={{ fontFamily: fonts.heading, fontSize: "18px", fontWeight: "600", color: colors.text.primary }}>Superadmin access required</p>
      </div>
    );
  }

  // If no enterpriseId, show enterprise list
  if (!entId) {
    return (
      <div style={T.page} data-testid="discord-apps-list">
        <p style={T.overline}>Platform</p>
        <h1 style={T.h1}>Discord Applications</h1>
        <div style={{ display: "grid", gap: "8px" }}>
          {enterprises.map(ent => (
            <div key={ent.id} style={{ ...T.card, display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", cursor: "pointer", transition: "all 0.15s" }}
              onClick={() => navigate(`/admin/platform/enterprises/${ent.id}/discord`)}
              onMouseEnter={e => e.currentTarget.style.borderColor = colors.brand.discord}
              onMouseLeave={e => e.currentTarget.style.borderColor = colors.border.default}>
              <Zap size={16} color={colors.brand.discord} />
              <span style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: "600", color: colors.text.primary, flex: 1 }}>{ent.name}</span>
              <ArrowLeft size={13} color={colors.text.muted} style={{ transform: "rotate(180deg)" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={{ ...T.page, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "100px" }}>
      <Loader2 size={20} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
    </div>;
  }

  const ent = enterprises.find(e => e.id === entId);

  return (
    <div style={T.page} data-testid="discord-app-page">
      <button onClick={() => navigate("/admin/platform/discord")} style={{ ...T.btnGhost, marginBottom: "16px" }}>
        <ArrowLeft size={13} /> All Discord Apps
      </button>
      <p style={T.overline}>{ent?.name || "Enterprise"}</p>
      <h1 style={{ ...T.h1, marginBottom: "24px" }}>Discord Application</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* App configuration */}
        <div style={T.card}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <Zap size={16} color={colors.brand.discord} />
            <p style={T.sectionTitle}>Application Setup</p>
          </div>
          <label style={T.label}>Application ID</label>
          <input value={appId} onChange={e => setAppId(e.target.value)} data-testid="discord-app-id"
            placeholder="Discord application ID" style={{ ...T.input, marginBottom: "12px" }} onFocus={onFocus} onBlur={onBlur} />
          <label style={T.label}>Public Key</label>
          <input value={publicKey} onChange={e => setPublicKey(e.target.value)} data-testid="discord-public-key"
            placeholder="Discord public key" style={{ ...T.input, marginBottom: "12px" }} onFocus={onFocus} onBlur={onBlur} />
          <label style={T.label}>Bot Token (write-only)</label>
          <input value={token} onChange={e => setToken(e.target.value)} type="password" data-testid="discord-token"
            placeholder="Enter new token to rotate" style={{ ...T.input, marginBottom: "12px" }} onFocus={onFocus} onBlur={onBlur} />
          <label style={T.label}>Client Secret (write-only)</label>
          <input value={clientSecret} onChange={e => setClientSecret(e.target.value)} type="password" data-testid="discord-client-secret"
            placeholder="Enter new secret to rotate" style={{ ...T.input, marginBottom: "16px" }} onFocus={onFocus} onBlur={onBlur} />
          <button onClick={handleSave} disabled={saving} data-testid="save-discord-app"
            style={{ ...T.btnPrimary, opacity: saving ? 0.6 : 1 }}>
            {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
            {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>

        {/* Controls */}
        <div style={T.card}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <Power size={16} color={colors.brand.success} />
            <p style={T.sectionTitle}>Controls</p>
          </div>
          <div style={{
            padding: "10px 14px", borderRadius: radius.md, marginBottom: "14px",
            backgroundColor: app?.enabled ? "rgba(52,211,153,0.06)" : "rgba(148,163,184,0.06)",
            border: `1px solid ${app?.enabled ? "rgba(52,211,153,0.2)" : colors.border.default}`,
          }}>
            <span style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "500", color: app?.enabled ? colors.brand.success : colors.text.muted }}>
              {app?.enabled ? "Application Enabled" : "Application Disabled"}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
            {!app?.enabled ? (
              <button onClick={handleEnable} style={T.btnPrimary}><Power size={14} /> Enable</button>
            ) : (
              <button onClick={handleDisable} style={{ ...T.btnGhost, color: colors.brand.error, borderColor: "rgba(244,63,94,0.3)" }}>
                <PowerOff size={14} /> Disable
              </button>
            )}
            <button onClick={handleRotateToken} style={T.btnGhost}><RotateCcw size={14} /> Rotate Token</button>
          </div>

          <p style={{ ...T.monoLabel, marginBottom: "8px" }}>Gateway</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button onClick={() => handleGateway("connect")} style={T.btnGhost}><Radio size={12} /> Connect</button>
            <button onClick={() => handleGateway("disconnect")} style={T.btnGhost}><PowerOff size={12} /> Disconnect</button>
            <button onClick={() => handleGateway("reconnect")} style={T.btnGhost}><RotateCcw size={12} /> Reconnect</button>
          </div>
        </div>
      </div>
    </div>
  );
}
