/**
 * Dashboard — Original Emergent design adapted for Spec 012 hierarchy.
 * Shows overview data for the selected Organisation.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import {
  MessageSquare, Bot, Network, BookOpen,
  Zap, Globe, Send, Headphones, Code2, Loader2,
  ArrowRight, BarChart3, Building2, Briefcase, Plus,
} from "lucide-react";
import { colors, fonts, radius, T, rowEnter, rowLeave } from "../theme";

const PROVIDER_META = {
  discord: { label: "Discord", icon: Zap, color: "#5865F2" },
  telegram: { label: "Telegram", icon: Send, color: "#26A5E4" },
  zendesk: { label: "Zendesk", icon: Headphones, color: "#03363D" },
  webchat: { label: "Webchat", icon: Globe, color: "#60A5FA" },
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

export default function Dashboard() {
  const { selectedOrg, selectedEnterprise, bots, api, organisations } = useSession();
  const navigate = useNavigate();

  const [botList, setBotList] = useState([]);
  const [instanceCounts, setInstanceCounts] = useState({});
  const [loading, setLoading] = useState(true);

  const orgId = selectedOrg?.id;

  useEffect(() => {
    if (!orgId) { setLoading(false); setBotList([]); return; }
    setLoading(true);
    api.bots(orgId)
      .then(data => {
        const list = data.bots || data || [];
        setBotList(list);
        // Fetch instance counts for each bot
        return Promise.allSettled(
          list.map(b => api.instances(b.id).then(d => ({ botId: b.id, count: (d.instances || d || []).length })))
        );
      })
      .then(results => {
        const counts = {};
        results?.forEach(r => {
          if (r.status === "fulfilled") counts[r.value.botId] = r.value.count;
        });
        setInstanceCounts(counts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId, api]);

  if (loading) {
    return (
      <div style={{ ...T.page, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "100px" }}>
        <Loader2 size={20} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!selectedEnterprise) {
    return (
      <div style={{ ...T.page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", paddingTop: "80px" }}>
        <Briefcase size={36} color={colors.border.default} style={{ marginBottom: "12px" }} />
        <p style={{ fontFamily: fonts.heading, fontSize: "20px", fontWeight: "700", color: colors.text.primary, margin: "0 0 6px" }}>
          No enterprise selected
        </p>
        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary }}>
          Select an enterprise from the sidebar to get started.
        </p>
      </div>
    );
  }

  if (!selectedOrg) {
    return (
      <div style={{ ...T.page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", paddingTop: "80px" }}>
        <Building2 size={36} color={colors.border.default} style={{ marginBottom: "12px" }} />
        <p style={{ fontFamily: fonts.heading, fontSize: "20px", fontWeight: "700", color: colors.text.primary, margin: "0 0 6px" }}>
          No organisation selected
        </p>
        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary }}>
          Select an organisation from the sidebar to see its dashboard.
        </p>
      </div>
    );
  }

  const totalInstances = Object.values(instanceCounts).reduce((a, b) => a + b, 0);

  return (
    <div style={T.page} data-testid="dashboard-page">
      <p style={T.overline}>{selectedEnterprise?.name} / {selectedOrg?.name}</p>
      <h1 style={{ ...T.h1, marginBottom: "24px" }}>Overview</h1>

      {/* Top Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        <StatCard label="Bots" value={botList.length} icon={Bot} color={colors.brand.light} />
        <StatCard label="Instances" value={totalInstances} icon={Network} color={colors.brand.success} />
        <StatCard label="Organisations" value={organisations.length} icon={Building2} color="#60A5FA" />
      </div>

      {/* Bot List */}
      {botList.length > 0 ? (
        <div style={{ ...T.card, marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <p style={T.monoLabel}>Bots</p>
            <button onClick={() => navigate("/admin/bots")}
              style={{ ...T.btnGhost, fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
              View all <ArrowRight size={11} />
            </button>
          </div>
          <div style={{ display: "grid", gap: "6px" }}>
            {botList.map(b => (
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
                  {instanceCounts[b.id] || 0} instance{(instanceCounts[b.id] || 0) !== 1 ? "s" : ""}
                </span>
                <span style={{
                  fontFamily: fonts.mono, fontSize: "10px", fontWeight: "600",
                  padding: "2px 8px", borderRadius: radius.full,
                  color: b.state === "active" ? colors.brand.success : colors.text.muted,
                  backgroundColor: b.state === "active" ? "rgba(52,211,153,0.08)" : "rgba(148,163,184,0.08)",
                }}>
                  {b.state || "active"}
                </span>
                <ArrowRight size={12} color={colors.text.muted} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ ...T.card, textAlign: "center", padding: "48px 24px" }}>
          <Bot size={32} color={colors.border.default} style={{ margin: "0 auto 12px" }} />
          <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "600", color: colors.text.primary, margin: "0 0 6px" }}>
            No bots yet
          </p>
          <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, marginBottom: "16px" }}>
            Create your first AI bot to get started.
          </p>
          <button
            onClick={() => navigate("/admin/bots")}
            data-testid="create-first-bot-btn"
            style={{ ...T.btnPrimary, margin: "0 auto", justifyContent: "center" }}
          >
            <Plus size={14} /> Create Bot
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
        {[
          { label: "Knowledge", desc: "Manage knowledge sources", icon: BookOpen, to: "/admin/knowledge", color: "#34D399" },
          { label: "Credentials", desc: "AI & integration keys", icon: BarChart3, to: "/admin/credentials", color: "#A78BFA" },
          { label: "Members", desc: "Team & access", icon: Building2, to: "/admin/members", color: "#60A5FA" },
        ].map(q => (
          <div key={q.label}
            style={{ ...T.card, padding: "16px 18px", cursor: "pointer", transition: "all 0.2s" }}
            onClick={() => navigate(q.to)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = q.color; e.currentTarget.style.boxShadow = colors.shadow.cardHover; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border.default; e.currentTarget.style.boxShadow = colors.shadow.card; }}
          >
            <q.icon size={18} color={q.color} style={{ marginBottom: "8px" }} />
            <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 3px" }}>{q.label}</p>
            <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: 0 }}>{q.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
