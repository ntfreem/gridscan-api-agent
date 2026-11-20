/**
 * BotInstances — manage channel instances for a bot (Discord, Telegram, Webchat).
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import {
  Network, Plus, Loader2, Zap, Send, Globe, ArrowRight, Settings,
  CheckCircle, XCircle, AlertTriangle,
} from "lucide-react";
import { colors, fonts, radius, T, rowEnter, rowLeave, onFocus, onBlur } from "../theme";
import { toast } from "sonner";

const CHANNEL_META = {
  discord: { label: "Discord", icon: Zap, color: "#5865F2" },
  telegram: { label: "Telegram", icon: Send, color: "#26A5E4" },
  webchat: { label: "Webchat", icon: Globe, color: "#60A5FA" },
  web: { label: "Webchat", icon: Globe, color: "#60A5FA" },
};

export default function BotInstancesPage() {
  const { botId } = useParams();
  const { api } = useSession();
  const navigate = useNavigate();
  const [bot, setBot] = useState(null);
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [channel, setChannel] = useState("webchat");
  const [instName, setInstName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    if (!botId) return;
    setLoading(true);
    try {
      const [botData, instData] = await Promise.all([
        api.bot(botId).catch(() => null),
        api.instances(botId).catch(() => ({ instances: [] })),
      ]);
      if (botData) setBot(botData);
      setInstances(instData?.instances || instData || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [botId, api]);

  const handleCreate = async () => {
    if (!instName.trim()) return;
    setCreating(true);
    try {
      const data = await api.createInstance(botId, { name: instName.trim(), channel });
      toast.success(`Instance "${instName.trim()}" created`);
      setInstName(""); setShowCreate(false);
      fetchData();
      if (data?.id) navigate(`/admin/instances/${data.id}`);
    } catch (err) { toast.error(err.detail || "Failed to create instance"); }
    finally { setCreating(false); }
  };

  if (loading) {
    return (
      <div style={{ ...T.page, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "100px" }}>
        <Loader2 size={20} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={T.page} data-testid="bot-instances-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <p style={T.overline}>{bot?.name || "Bot"}</p>
          <h1 style={{ ...T.h1, marginBottom: 0 }}>Instances</h1>
        </div>
        <button onClick={() => setShowCreate(true)} data-testid="create-instance-btn" style={T.btnPrimary}>
          <Plus size={14} /> New Instance
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        }} onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div data-testid="create-instance-modal" style={{
            width: "420px", backgroundColor: colors.bg.panel, borderRadius: "16px",
            border: `1px solid ${colors.border.default}`, padding: "28px",
          }}>
            <h2 style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: "0 0 16px" }}>
              New Instance
            </h2>
            <label style={T.label}>Instance Name</label>
            <input value={instName} onChange={e => setInstName(e.target.value)} data-testid="instance-name-input"
              placeholder="e.g. Support Bot #1" style={{ ...T.input, marginBottom: "12px" }} onFocus={onFocus} onBlur={onBlur} />
            <label style={T.label}>Channel</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
              {["discord", "telegram", "webchat"].map(ch => {
                const meta = CHANNEL_META[ch];
                const selected = channel === ch;
                return (
                  <button key={ch} onClick={() => setChannel(ch)} data-testid={`channel-${ch}`}
                    style={{
                      padding: "12px", borderRadius: radius.md, cursor: "pointer",
                      backgroundColor: selected ? `${meta.color}14` : colors.bg.surface,
                      border: `1.5px solid ${selected ? meta.color : colors.border.default}`,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                      transition: "all 0.15s",
                    }}>
                    <meta.icon size={20} color={selected ? meta.color : colors.text.muted} />
                    <span style={{ fontFamily: fonts.body, fontSize: "11px", fontWeight: "600", color: selected ? meta.color : colors.text.secondary }}>
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowCreate(false)} style={T.btnGhost}>Cancel</button>
              <button onClick={handleCreate} disabled={creating || !instName.trim()} data-testid="confirm-create-instance"
                style={{ ...T.btnPrimary, opacity: creating || !instName.trim() ? 0.6 : 1 }}>
                {creating ? "Creating..." : "Create Instance"}
              </button>
            </div>
          </div>
        </div>
      )}

      {instances.length === 0 ? (
        <div style={{ ...T.card, textAlign: "center", padding: "48px 24px" }}>
          <Network size={32} color={colors.border.default} style={{ margin: "0 auto 12px" }} />
          <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "600", color: colors.text.primary, margin: "0 0 6px" }}>
            No instances yet
          </p>
          <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary }}>
            Create a channel instance to connect your bot.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {instances.map(inst => {
            const meta = CHANNEL_META[inst.channel] || CHANNEL_META.web;
            return (
              <div key={inst.id} data-testid={`instance-card-${inst.id}`}
                style={{
                  ...T.card, display: "flex", alignItems: "center", gap: "14px",
                  padding: "16px 20px", cursor: "pointer", transition: "all 0.2s",
                }}
                onClick={() => navigate(`/admin/instances/${inst.id}`)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = meta.color; e.currentTarget.style.boxShadow = colors.shadow.cardHover; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border.default; e.currentTarget.style.boxShadow = colors.shadow.card; }}
              >
                <div style={{
                  width: "36px", height: "36px", borderRadius: radius.md,
                  backgroundColor: `${meta.color}14`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <meta.icon size={18} color={meta.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
                    {inst.name || `${meta.label} Instance`}
                  </p>
                  <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "2px 0 0" }}>
                    {meta.label} • {inst.state || "active"}
                  </p>
                </div>
                <span style={{
                  fontFamily: fonts.mono, fontSize: "10px", fontWeight: "600",
                  padding: "2px 8px", borderRadius: radius.full,
                  color: inst.connected ? colors.brand.success : colors.text.muted,
                  backgroundColor: inst.connected ? "rgba(52,211,153,0.08)" : "rgba(148,163,184,0.08)",
                  textTransform: "uppercase",
                }}>
                  {inst.connected ? "connected" : "disconnected"}
                </span>
                <ArrowRight size={14} color={colors.text.muted} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
