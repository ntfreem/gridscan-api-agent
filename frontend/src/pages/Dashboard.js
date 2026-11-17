import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  MessageSquare, Bot, Network, BookOpen, Link2, Sparkles,
  Zap, Globe, Send, Headphones, Code2, Loader2,
  ArrowRight, BarChart3, Building2,
} from "lucide-react";
import { colors, fonts, radius, T, rowEnter, rowLeave } from "../theme";
import v2 from "../utils/v2api";
import { toast } from "sonner";

const PROVIDER_META = {
  discord: { label: "Discord", icon: Zap, color: "#5865F2" },
  telegram: { label: "Telegram", icon: Send, color: "#26A5E4" },
  zendesk: { label: "Zendesk", icon: Headphones, color: "#03363D" },
  web: { label: "Web", icon: Globe, color: "#60A5FA" },
  api: { label: "API", icon: Code2, color: "#A78BFA" },
};

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`} style={{ ...T.card, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
        <div style={{
          width: "30px", height: "30px", borderRadius: radius.md,
          backgroundColor: `${color}14`, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={14} color={color} />
        </div>
        <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {label}
        </span>
      </div>
      <p style={{ fontFamily: fonts.heading, fontSize: "30px", fontWeight: "700", color: colors.text.primary, margin: 0, letterSpacing: "-0.5px" }}>
        {value ?? "—"}
      </p>
      {sub && <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "3px 0 0" }}>{sub}</p>}
    </div>
  );
}

function PlatformBar({ label, icon: Icon, color, count, total }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 0" }}>
      <div style={{ width: "20px", display: "flex", justifyContent: "center" }}>
        <Icon size={13} color={color} />
      </div>
      <span style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, width: "70px" }}>{label}</span>
      <div style={{ flex: 1, height: "6px", backgroundColor: colors.bg.panel, borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: "3px", transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.primary, fontWeight: "600", minWidth: "32px", textAlign: "right" }}>
        {count}
      </span>
    </div>
  );
}

function PlatformBadge({ platform }) {
  const meta = PROVIDER_META[platform] || PROVIDER_META.web;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      padding: "2px 8px", borderRadius: radius.sm,
      fontSize: "10px", fontFamily: fonts.mono, fontWeight: "600",
      textTransform: "uppercase", letterSpacing: "0.04em",
      backgroundColor: `${meta.color}12`, color: meta.color,
    }}>
      <meta.icon size={9} /> {meta.label}
    </span>
  );
}

export default function Dashboard() {
  const { selectedOrg, user, orgs } = useAuth();
  const navigate = useNavigate();
  const orgId = selectedOrg?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    v2.orgOverview(orgId)
      .then(res => setData(res.data))
      .catch((e) => toast.error(e.response?.data?.detail || "Failed to load overview"))
      .finally(() => setLoading(false));
  }, [orgId]);

  if (loading) {
    return (
      <div style={{ ...T.page, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "100px" }}>
        <Loader2 size={20} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!selectedOrg) {
    return (
      <div style={{ ...T.page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", paddingTop: "80px" }}>
        <Building2 size={36} color={colors.border.default} style={{ marginBottom: "12px" }} />
        <p style={{ fontFamily: fonts.heading, fontSize: "20px", fontWeight: "700", color: colors.text.primary, margin: "0 0 6px" }}>
          {(orgs || []).length === 0 ? "No organisations yet" : "No organisation selected"}
        </p>
        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, maxWidth: "460px", lineHeight: 1.6 }}>
          {(orgs || []).length === 0
            ? "Bots live inside an organisation (Workspace → Organisation → Bot). Create an organisation to add your first bot."
            : "Select an organisation from the sidebar to see its dashboard."}
        </p>
        {(orgs || []).length === 0 && (
          <button
            data-testid="dashboard-create-org-btn"
            onClick={() => navigate("/admin/organisations?create=1&next=/admin/bots")}
            style={{ ...T.btnPrimary, marginTop: "16px", padding: "8px 16px", fontSize: "12px" }}
          >
            Create organisation
          </button>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ ...T.page, textAlign: "center", paddingTop: "80px" }}>
        <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.text.muted }}>
          Failed to load overview data.
        </p>
      </div>
    );
  }

  const pb = data.platform_breakdown || {};
  const totalConvs = data.total_conversations || 0;

  return (
    <div style={T.page} data-testid="org-overview-page">
      <p style={T.overline}>{data.org?.name || "Organisation"}</p>
      <h1 style={{ ...T.h1, marginBottom: "24px" }}>Overview</h1>

      {/* Top Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        <StatCard label="Bots" value={data.bots} icon={Bot} color={colors.brand.light} />
        <StatCard label="Connections" value={data.connections} sub={`${data.active_connections} active`} icon={Network} color={colors.brand.success} />
        <StatCard label="Conversations" value={data.total_conversations} icon={MessageSquare} color="#60A5FA" />
        <StatCard label="Messages" value={data.total_messages} icon={BarChart3} color={colors.brand.warning} />
        <StatCard label="Knowledge" value={data.knowledge_sources} icon={BookOpen} color="#34D399" />
        <StatCard label="Suggestions" value={data.suggestions} sub={`${data.pending_suggestions} pending`} icon={Sparkles} color="#A78BFA" />
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>

        {/* Conversations by Platform */}
        <div style={T.card}>
          <p style={{ ...T.monoLabel, marginBottom: "14px" }}>Conversations by Platform</p>
          {Object.keys(PROVIDER_META).map(key => {
            const meta = PROVIDER_META[key];
            const count = pb[key] || 0;
            if (count === 0 && !["discord", "telegram", "zendesk", "web"].includes(key)) return null;
            return (
              <PlatformBar key={key} label={meta.label} icon={meta.icon} color={meta.color}
                count={count} total={totalConvs} />
            );
          })}
          {totalConvs === 0 && (
            <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, textAlign: "center", padding: "12px" }}>
              No conversations yet
            </p>
          )}
        </div>

        {/* Connections by Provider */}
        <div style={T.card}>
          <p style={{ ...T.monoLabel, marginBottom: "14px" }}>Connections by Provider</p>
          {Object.entries(data.provider_breakdown || {}).map(([prov, stats]) => {
            const meta = PROVIDER_META[prov] || PROVIDER_META.web;
            return (
              <div key={prov} style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "8px 0",
                borderBottom: `1px solid ${colors.border.faint}`,
              }}>
                <meta.icon size={14} color={meta.color} />
                <span style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.primary, flex: 1 }}>
                  {meta.label}
                </span>
                <span style={{
                  fontFamily: fonts.mono, fontSize: "10px", color: colors.brand.success,
                  padding: "2px 8px", borderRadius: radius.full,
                  backgroundColor: "rgba(52,211,153,0.08)",
                }}>
                  {stats.active} active
                </span>
                {stats.total - stats.active > 0 && (
                  <span style={{
                    fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted,
                    padding: "2px 8px", borderRadius: radius.full,
                    backgroundColor: "rgba(148,163,184,0.08)",
                  }}>
                    {stats.total - stats.active} paused
                  </span>
                )}
              </div>
            );
          })}
          {Object.keys(data.provider_breakdown || {}).length === 0 && (
            <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, textAlign: "center", padding: "12px" }}>
              No connections yet
            </p>
          )}

          {/* Mode breakdown mini */}
          {Object.keys(data.mode_breakdown || {}).length > 0 && (
            <>
              <p style={{ ...T.monoLabel, marginTop: "16px", marginBottom: "8px" }}>By Response Mode</p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {Object.entries(data.mode_breakdown).map(([mode, count]) => (
                  <span key={mode} style={{
                    fontFamily: fonts.mono, fontSize: "10px", color: colors.text.secondary,
                    padding: "4px 10px", borderRadius: radius.full,
                    backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.muted}`,
                  }}>
                    {mode.replace("_", " ")} <span style={{ fontWeight: "600", color: colors.text.primary }}>{count}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bot Summaries */}
      {data.bot_summaries?.length > 0 && (
        <div style={{ ...T.card, marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <p style={T.monoLabel}>Bots</p>
            <button onClick={() => navigate("/admin/bots")}
              style={{ ...T.btnGhost, fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
              View all <ArrowRight size={11} />
            </button>
          </div>
          <div style={{ display: "grid", gap: "6px" }}>
            {data.bot_summaries.map(b => (
              <div key={b.id}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "10px 14px", borderRadius: radius.md,
                  backgroundColor: colors.bg.panel, cursor: "pointer",
                  transition: "background-color 0.15s",
                }}
                onClick={() => navigate(`/admin/bots/${b.id}`)}
                onMouseEnter={rowEnter} onMouseLeave={rowLeave}
                data-testid={`bot-summary-${b.id}`}
              >
                <Bot size={14} color={colors.brand.light} />
                <span style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "600", color: colors.text.primary, flex: 1 }}>
                  {b.name}
                </span>
                <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>
                  {b.active_connections} routes
                </span>
                <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>
                  {b.conversations} convos
                </span>
                <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>
                  {b.knowledge_sources} KB
                </span>
                <ArrowRight size={12} color={colors.text.muted} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Conversations */}
      <div style={{ backgroundColor: colors.bg.surface, border: `1px solid ${colors.border.default}`, borderRadius: radius.lg, overflow: "hidden" }}>
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${colors.border.default}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
            Recent Conversations
          </p>
        </div>
        {data.recent_conversations?.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border.subtle}` }}>
                {["Bot", "Session", "Platform", "Messages", "Date"].map(h => (
                  <th key={h} style={T.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recent_conversations.map((conv, i) => (
                <tr key={conv.session_id || i}
                  style={{ borderBottom: `1px solid ${colors.border.faint}`, transition: "background-color 0.15s" }}
                  onMouseEnter={rowEnter} onMouseLeave={rowLeave}
                >
                  <td style={{ ...T.td, fontFamily: fonts.body, fontSize: "12px", fontWeight: "500" }}>
                    {conv.bot_name}
                  </td>
                  <td style={{ ...T.td, fontFamily: fonts.mono, fontSize: "11px", color: colors.text.secondary }}>
                    {conv.session_id?.slice(0, 16)}...
                  </td>
                  <td style={T.td}><PlatformBadge platform={conv.platform} /></td>
                  <td style={{ ...T.td, fontFamily: fonts.mono, fontSize: "12px" }}>{conv.message_count}</td>
                  <td style={{ ...T.td, color: colors.text.secondary, fontSize: "11px", fontFamily: fonts.mono }}>
                    {conv.updated_at ? new Date(conv.updated_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <MessageSquare size={28} color={colors.border.default} style={{ margin: "0 auto 8px" }} />
            <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.muted }}>
              No conversations yet across this organisation's bots.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
