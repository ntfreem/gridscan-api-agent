import { useState, useEffect } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { MessageSquare, BookOpen, CheckCircle, Zap, Globe, Send, Monitor, Code2, Headphones } from "lucide-react";
import { colors, fonts, radius, T, rowEnter, rowLeave } from "../theme";

function StatCard({ title, value, icon: Icon, color }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
      style={{
        ...T.card,
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
        transform: hovered ? "translateY(-3px)" : "none",
        boxShadow: hovered ? colors.shadow.cardHover : colors.shadow.card,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <p style={T.monoLabel}>{title}</p>
        <div style={{ width: "32px", height: "32px", borderRadius: radius.md, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={16} color={color} />
        </div>
      </div>
      <p style={{ fontFamily: fonts.heading, fontSize: "38px", fontWeight: "700", color: colors.text.primary, margin: "6px 0 0", letterSpacing: "-1px" }}>
        {value ?? "\u2014"}
      </p>
    </div>
  );
}

const PLATFORMS = [
  { key: "web", label: "Web", icon: Globe, color: "#60A5FA" },
  { key: "discord", label: "Discord", icon: Monitor, color: "#5865F2" },
  { key: "telegram", label: "Telegram", icon: Send, color: "#0088CC" },
  { key: "api", label: "API", icon: Code2, color: "#A78BFA" },
  { key: "zendesk", label: "Zendesk", icon: Headphones, color: "#03363D" },
];

function PlatformCard({ label, icon: Icon, color, value }) {
  return (
    <div data-testid={`platform-${label.toLowerCase()}`} style={{
      flex: 1, minWidth: "100px", padding: "14px 16px",
      backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
      borderRadius: "10px", textAlign: "center",
    }}>
      <div style={{
        width: "32px", height: "32px", borderRadius: "10px",
        background: `${color}14`, display: "flex", alignItems: "center",
        justifyContent: "center", margin: "0 auto 8px",
      }}>
        <Icon size={15} color={color} />
      </div>
      <p style={{ fontFamily: fonts.heading, fontSize: "28px", fontWeight: "700", color: colors.text.primary, margin: 0, letterSpacing: "-0.5px" }}>
        {value}
      </p>
      <p style={{ fontFamily: fonts.body, fontSize: "11px", color, margin: "3px 0 0", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </p>
    </div>
  );
}

function TrendChart({ data }) {
  if (!data || data.length === 0) return null;

  const platformColors = { web: "#60A5FA", discord: "#5865F2", telegram: "#0088CC", api: "#A78BFA", zendesk: "#03363D" };
  const maxVal = Math.max(1, ...data.map(d => Math.max(d.web || 0, d.discord || 0, d.telegram || 0, d.api || 0)));
  const chartH = 140;
  const barW = 8;
  const groupGap = 28;

  return (
    <div data-testid="platform-trend-chart" style={{
      backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
      borderRadius: "12px", padding: "20px", marginBottom: "20px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <p style={T.monoLabel}>Messages — Last 7 Days</p>
        <div style={{ display: "flex", gap: "14px" }}>
          {PLATFORMS.map(p => (
            <div key={p.key} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "2px", backgroundColor: platformColors[p.key] }} />
              <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase" }}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: `${chartH + 28}px`, paddingTop: "8px" }}>
        {data.map((d, i) => {
          const bars = PLATFORMS.map(p => ({ key: p.key, val: d[p.key] || 0, color: platformColors[p.key] }));
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: `${chartH}px` }}>
                {bars.map(b => (
                  <div key={b.key} title={`${b.key}: ${b.val}`} style={{
                    width: `${barW}px`, borderRadius: "3px 3px 0 0",
                    height: `${Math.max(2, (b.val / maxVal) * chartH)}px`,
                    backgroundColor: b.val > 0 ? b.color : `${b.color}20`,
                    transition: "height 0.4s ease",
                  }} />
                ))}
              </div>
              <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>{d.date}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlatformBadge({ platform }) {
  const map = {
    discord: { bg: "rgba(88,101,242,0.12)", text: "#5865F2" },
    telegram: { bg: "rgba(0,136,204,0.12)", text: "#0088CC" },
    web: { bg: "rgba(59,130,246,0.12)", text: colors.brand.primary },
    api: { bg: "rgba(167,139,250,0.12)", text: "#A78BFA" },
    zendesk: { bg: "rgba(3,54,61,0.12)", text: "#03363D" },
  };
  const c = map[platform] || map.web;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: radius.sm,
      fontSize: "11px", fontFamily: fonts.mono,
      textTransform: "uppercase", letterSpacing: "0.05em",
      backgroundColor: c.bg, color: c.text,
    }}>{platform}</span>
  );
}

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { selectedInstance, user } = useAuth();
  const instanceId = selectedInstance?.id;

  useEffect(() => {
    if (!selectedInstance) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      api.get(`/analytics/overview`),
      api.get(`/conversations?limit=6`),
      api.get(`/analytics/daily-by-platform`),
    ]).then(([ov, convs, trend]) => {
      setOverview(ov.data);
      setConversations(convs.data.conversations || []);
      setTrendData(trend.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedInstance]);

  if (loading) {
    return (
      <div style={{ ...T.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: fonts.mono, color: colors.text.secondary, fontSize: "13px" }}>Loading...</p>
      </div>
    );
  }

  if (!selectedInstance) {
    return (
      <div style={{ ...T.page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <p style={{ fontFamily: fonts.heading, fontSize: "22px", fontWeight: "700", color: colors.text.primary, margin: "0 0 8px" }}>
          No workspace selected
        </p>
        <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.text.secondary }}>
          {user?.role === "superadmin"
            ? "Create an instance from the Instances page, then select it from the sidebar."
            : "Contact your admin to get access to a workspace."}
        </p>
      </div>
    );
  }

  const pb = overview?.platform_breakdown || {};

  return (
    <div style={T.page}>
      <p style={T.overline}>Overview</p>
      <h1 style={T.h1}>Dashboard</h1>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        <StatCard title="Conversations" value={overview?.total_conversations ?? 0} icon={MessageSquare} color={colors.brand.blue} />
        <StatCard title="Total Messages" value={overview?.total_messages ?? 0} icon={Zap} color={colors.brand.success} />
        <StatCard title="Knowledge Sources" value={overview?.knowledge_sources ?? 0} icon={BookOpen} color={colors.text.secondary} />
        <StatCard title="Training Examples" value={overview?.approved_for_training ?? 0} icon={CheckCircle} color={colors.brand.success} />
      </div>

      {/* Platform Breakdown Cards */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        {PLATFORMS.map(p => (
          <PlatformCard key={p.key} label={p.label} icon={p.icon} color={p.color} value={pb[p.key] ?? 0} />
        ))}
      </div>

      {/* Trend Chart */}
      <TrendChart data={trendData} />

      {/* Quick Actions */}
      <div style={{ ...T.card, marginBottom: "24px" }}>
        <p style={{ ...T.monoLabel, marginBottom: "14px" }}>Quick Actions</p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <a href="/admin/knowledge" data-testid="quick-add-knowledge" style={{
            display: "inline-block", padding: "9px 18px", backgroundColor: colors.brand.blue,
            color: colors.text.primary, borderRadius: "10px", fontSize: "13px",
            fontFamily: fonts.body, fontWeight: "500", textDecoration: "none",
            border: `1px solid rgba(96, 165, 250, 0.3)`,
          }}>Add Knowledge Source</a>
          <a href={`/chat${instanceId ? `?instance=${instanceId}` : ""}`} target="_blank" rel="noopener noreferrer" data-testid="quick-test-chat" style={{
            display: "inline-block", padding: "9px 18px", backgroundColor: colors.bg.panel,
            border: `1px solid ${colors.border.default}`, color: colors.text.primary, borderRadius: "10px",
            fontSize: "13px", fontFamily: fonts.body, fontWeight: "500", textDecoration: "none",
          }}>Test Chat Demo</a>
          <a href="/admin/telegram" data-testid="quick-telegram" style={{
            display: "inline-block", padding: "9px 18px", backgroundColor: "rgba(0,136,204,0.08)",
            border: `1px solid rgba(0,136,204,0.2)`, color: "#0088CC", borderRadius: "10px",
            fontSize: "13px", fontFamily: fonts.body, fontWeight: "500", textDecoration: "none",
          }}>Connect Telegram</a>
        </div>
      </div>

      {/* Recent Conversations */}
      <div style={{ backgroundColor: colors.bg.surface, border: `1px solid ${colors.border.default}`, borderRadius: "10px", overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${colors.border.default}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>Recent Conversations</p>
          <a href="/admin/conversations" style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.brand.cyan, textDecoration: "none" }}>View all</a>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${colors.border.subtle}` }}>
              {["Session ID", "Platform", "Messages", "Date", "Status"].map(h => (
                <th key={h} style={T.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {conversations.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "48px 20px", textAlign: "center", color: colors.text.secondary, fontFamily: fonts.body, fontSize: "14px" }}>
                  No conversations yet — <a href={`/chat${instanceId ? `?instance=${instanceId}` : ""}`} target="_blank" rel="noopener noreferrer" style={{ color: colors.brand.cyan }}>start a chat demo</a>
                </td>
              </tr>
            ) : conversations.map((conv) => (
              <tr key={conv.session_id}
                style={{ borderBottom: `1px solid ${colors.border.faint}`, transition: "background-color 0.2s ease", cursor: "pointer" }}
                onMouseEnter={rowEnter}
                onMouseLeave={rowLeave}
                onClick={() => window.location.href = "/admin/conversations"}
                data-testid="dashboard-conversation-row"
              >
                <td style={{ ...T.td, fontFamily: fonts.mono, fontSize: "12px", color: colors.text.secondary }}>
                  {conv.session_id?.slice(0, 14)}...
                </td>
                <td style={T.td}><PlatformBadge platform={conv.platform} /></td>
                <td style={T.td}>{conv.messages?.length ?? 0}</td>
                <td style={{ ...T.td, color: colors.text.secondary, fontSize: "12px" }}>
                  {conv.created_at ? new Date(conv.created_at).toLocaleDateString() : "\u2014"}
                </td>
                <td style={T.td}>
                  {conv.is_approved_for_training
                    ? <span style={{ color: colors.brand.success, fontFamily: fonts.mono, fontSize: "11px" }}>APPROVED</span>
                    : <span style={{ color: colors.text.muted, fontFamily: fonts.mono, fontSize: "11px" }}>PENDING</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
