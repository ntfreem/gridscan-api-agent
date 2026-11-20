/**
 * BotOverview — single bot detail page.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { Bot, Network, Settings, BookOpen, Headphones, ArrowRight, Loader2 } from "lucide-react";
import { colors, fonts, radius, T, rowEnter, rowLeave } from "../theme";

export default function BotOverview() {
  const { botId } = useParams();
  const { api, selectBot } = useSession();
  const navigate = useNavigate();
  const [bot, setBot] = useState(null);
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!botId) return;
    setLoading(true);
    Promise.all([
      api.bot(botId).catch(() => null),
      api.instances(botId).catch(() => ({ instances: [] })),
    ]).then(([botData, instData]) => {
      if (botData) {
        setBot(botData);
        selectBot(botData);
      }
      setInstances(instData?.instances || instData || []);
    }).finally(() => setLoading(false));
  }, [botId, api]);

  if (loading) {
    return (
      <div style={{ ...T.page, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "100px" }}>
        <Loader2 size={20} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!bot) {
    return (
      <div style={{ ...T.page, textAlign: "center", paddingTop: "80px" }}>
        <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.text.muted }}>Bot not found.</p>
      </div>
    );
  }

  const links = [
    { label: "Settings", desc: "Configure bot behaviour", icon: Settings, to: `/admin/bots/${botId}/settings` },
    { label: "Knowledge", desc: "Manage knowledge sources", icon: BookOpen, to: `/admin/bots/${botId}/knowledge` },
    { label: "Instances", desc: `${instances.length} channel instance${instances.length !== 1 ? "s" : ""}`, icon: Network, to: `/admin/bots/${botId}/instances` },
    { label: "Integrations", desc: "Zendesk, external APIs", icon: Headphones, to: `/admin/bots/${botId}/integrations` },
  ];

  return (
    <div style={T.page} data-testid="bot-overview-page">
      <p style={T.overline}>Bot</p>
      <h1 style={{ ...T.h1, marginBottom: "24px" }}>{bot.name}</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px", marginBottom: "28px" }}>
        {links.map(l => (
          <div key={l.label}
            style={{ ...T.card, padding: "18px 20px", cursor: "pointer", transition: "all 0.2s" }}
            onClick={() => navigate(l.to)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = colors.brand.light; e.currentTarget.style.boxShadow = colors.shadow.cardHover; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border.default; e.currentTarget.style.boxShadow = colors.shadow.card; }}
          >
            <l.icon size={18} color={colors.brand.light} style={{ marginBottom: "8px" }} />
            <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 3px" }}>{l.label}</p>
            <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: 0 }}>{l.desc}</p>
          </div>
        ))}
      </div>

      {/* Instances list */}
      {instances.length > 0 && (
        <div style={T.card}>
          <p style={{ ...T.monoLabel, marginBottom: "14px" }}>Instances</p>
          <div style={{ display: "grid", gap: "6px" }}>
            {instances.map(inst => (
              <div key={inst.id}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "10px 14px", borderRadius: radius.md,
                  backgroundColor: colors.bg.panel, cursor: "pointer", transition: "background-color 0.15s",
                }}
                onClick={() => navigate(`/admin/instances/${inst.id}`)}
                onMouseEnter={rowEnter} onMouseLeave={rowLeave}
              >
                <Network size={14} color={colors.brand.light} />
                <span style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "500", color: colors.text.primary, flex: 1 }}>
                  {inst.name || inst.channel || "Instance"}
                </span>
                <span style={{
                  fontFamily: fonts.mono, fontSize: "10px", fontWeight: "600",
                  padding: "2px 8px", borderRadius: radius.full,
                  color: inst.channel === "discord" ? "#5865F2" : inst.channel === "telegram" ? "#26A5E4" : "#60A5FA",
                  backgroundColor: inst.channel === "discord" ? "rgba(88,101,242,0.1)" : inst.channel === "telegram" ? "rgba(38,165,228,0.1)" : "rgba(96,165,250,0.1)",
                  textTransform: "uppercase",
                }}>
                  {inst.channel || "web"}
                </span>
                <ArrowRight size={12} color={colors.text.muted} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
