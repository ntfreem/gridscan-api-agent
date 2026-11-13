import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Bot, Network, BookOpen, Settings, Zap, Send, Headphones, Link2, Loader2, Edit2, Check, X } from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur } from "@/theme";
import { toast } from "sonner";
import v2 from "@/utils/v2api";

const PROVIDER_META = {
  discord: { label: "Discord", icon: Zap, color: "#5865F2" },
  telegram: { label: "Telegram", icon: Send, color: "#26A5E4" },
  zendesk: { label: "Zendesk", icon: Headphones, color: "#03363D" },
};

export default function BotOverview() {
  const { botId } = useParams();
  const { selectedOrg, selectBot } = useAuth();
  const navigate = useNavigate();
  const orgId = selectedOrg?.id;

  const [bot, setBot] = useState(null);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!orgId || !botId) return;
    setLoading(true);
    Promise.all([
      v2.getBot(orgId, botId),
      v2.listConnections(orgId, botId),
    ]).then(([botRes, connRes]) => {
      setBot(botRes.data);
      selectBot(botRes.data);
      setConnections(connRes.data.connections || []);
      setNewName(botRes.data.name);
    }).catch(() => toast.error("Failed to load bot"))
      .finally(() => setLoading(false));
  }, [orgId, botId]);

  const saveName = async () => {
    if (!newName.trim() || newName === bot.name) { setEditingName(false); return; }
    try {
      await v2.updateBot(orgId, botId, { name: newName.trim() });
      setBot(prev => ({ ...prev, name: newName.trim() }));
      toast.success("Bot name updated");
    } catch {
      toast.error("Failed to update name");
    }
    setEditingName(false);
  };

  if (loading) return (
    <div style={{ ...T.page, display: "flex", justifyContent: "center", paddingTop: "80px" }}>
      <Loader2 size={24} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
    </div>
  );

  if (!bot) return (
    <div style={T.page}>
      <p style={{ ...T.sectionSub, textAlign: "center", marginTop: "60px" }}>Bot not found.</p>
    </div>
  );

  const activeConns = connections.filter(c => c.enabled);

  return (
    <div style={T.page} data-testid="bot-overview-page">
      <p style={T.overline}>Bot Overview</p>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "28px" }}>
        <div style={{
          width: "48px", height: "48px", borderRadius: radius.lg,
          background: `linear-gradient(135deg, ${colors.brand.primary}30, ${colors.brand.light}15)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Bot size={24} color={colors.brand.light} />
        </div>
        <div style={{ flex: 1 }}>
          {editingName ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                style={{ ...T.input, width: "260px", padding: "6px 12px", fontSize: "18px", fontFamily: fonts.heading, fontWeight: "700" }}
                onFocus={onFocus} onBlur={onBlur} autoFocus
                onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                data-testid="edit-bot-name-input" />
              <button onClick={saveName} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
                <Check size={16} color={colors.brand.success} />
              </button>
              <button onClick={() => { setEditingName(false); setNewName(bot.name); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
                <X size={16} color={colors.text.muted} />
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 style={{ ...T.h1, margin: 0 }}>{bot.name}</h1>
              <button onClick={() => setEditingName(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}
                data-testid="edit-bot-name-btn">
                <Edit2 size={14} color={colors.text.muted} />
              </button>
            </div>
          )}
          {bot.description && (
            <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: "4px 0 0" }}>
              {bot.description}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", marginBottom: "28px" }}>
        {[
          { label: "Connections", value: bot.connection_count || 0, sub: `${activeConns.length} active`, icon: Network, color: colors.brand.primary },
          { label: "Knowledge Sources", value: bot.knowledge_source_count || 0, icon: BookOpen, color: "#34D399" },
          { label: "Knowledge Gate", value: bot.knowledge_gate || "strict", icon: Settings, color: colors.brand.warning },
        ].map((s, i) => (
          <div key={i} style={{ ...T.card, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <s.icon size={14} color={s.color} />
              <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {s.label}
              </span>
            </div>
            <p style={{ fontFamily: fonts.heading, fontSize: "22px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
              {s.value}
            </p>
            {s.sub && <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "2px 0 0" }}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Active Connections */}
      <div style={T.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <h3 style={T.sectionTitle}>Active Connections</h3>
          <button onClick={() => navigate(`/admin/bots/${botId}/integrations`)}
            style={{ ...T.btnGhost, fontSize: "11px" }}>
            Manage →
          </button>
        </div>
        {connections.length === 0 ? (
          <p style={{ ...T.sectionSub, textAlign: "center", padding: "16px" }}>No connections yet. Add one in Integrations.</p>
        ) : (
          <div style={{ display: "grid", gap: "6px" }}>
            {connections.slice(0, 5).map(conn => {
              const meta = PROVIDER_META[conn.provider] || { label: conn.provider, icon: Link2, color: colors.text.muted };
              return (
                <div key={conn.id} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "8px 12px", borderRadius: radius.md,
                  backgroundColor: colors.bg.panel, opacity: conn.enabled ? 1 : 0.5,
                }}>
                  <meta.icon size={14} color={meta.color} />
                  <span style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.primary, flex: 1 }}>
                    {conn.name}
                  </span>
                  <span style={{
                    fontFamily: fonts.mono, fontSize: "9px",
                    color: conn.enabled ? colors.brand.success : colors.text.muted,
                  }}>
                    {conn.enabled ? "active" : "disabled"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
