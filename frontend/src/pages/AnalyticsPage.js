/**
 * Analytics / Usage page — usage data for the selected entity.
 */
import { useState, useEffect } from "react";
import { useSession } from "../context/SessionContext";
import { BarChart2, Loader2, TrendingUp, MessageSquare, Bot, Calendar } from "lucide-react";
import { colors, fonts, radius, T } from "../theme";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

function UsageStat({ label, value, sub, icon: Icon, color }) {
  return (
    <div style={{ ...T.card, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <div style={{
          width: "28px", height: "28px", borderRadius: radius.md,
          backgroundColor: `${color}14`, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={14} color={color} />
        </div>
        <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {label}
        </span>
      </div>
      <p style={{ fontFamily: fonts.heading, fontSize: "26px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>{value ?? "—"}</p>
      {sub && <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "2px 0 0" }}>{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { selectedEnterprise, selectedOrg, api } = useSession();
  const [period, setPeriod] = useState("30d");
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState("organisation");
  const [auditLogs, setAuditLogs] = useState([]);

  const ownerId = scope === "enterprise" ? selectedEnterprise?.id : selectedOrg?.id;
  const ownerType = scope === "enterprise" ? "enterprise" : "organisation";

  useEffect(() => {
    if (!ownerId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      api.usage(ownerType, ownerId, period).catch(() => null),
      scope === "enterprise" && selectedEnterprise?.id
        ? api.enterpriseAudit(selectedEnterprise.id, 50).catch(() => ({ events: [] }))
        : Promise.resolve({ events: [] }),
    ]).then(([usageData, auditData]) => {
      setUsage(usageData);
      setAuditLogs(auditData?.events || auditData || []);
    }).finally(() => setLoading(false));
  }, [ownerId, ownerType, period, scope, api, selectedEnterprise]);

  if (!selectedEnterprise) {
    return (
      <div style={{ ...T.page, textAlign: "center", paddingTop: "80px" }}>
        <BarChart2 size={32} color={colors.border.default} style={{ margin: "0 auto 12px" }} />
        <p style={{ fontFamily: fonts.heading, fontSize: "18px", fontWeight: "600", color: colors.text.primary }}>Select an enterprise first</p>
      </div>
    );
  }

  return (
    <div style={T.page} data-testid="analytics-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <p style={T.overline}>Analytics</p>
          <h1 style={{ ...T.h1, marginBottom: 0 }}>Usage</h1>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select value={scope} onChange={e => setScope(e.target.value)}
            style={{ ...T.input, width: "auto", padding: "8px 12px", fontSize: "12px" }}>
            <option value="organisation">Organisation</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select value={period} onChange={e => setPeriod(e.target.value)} data-testid="period-select"
            style={{ ...T.input, width: "auto", padding: "8px 12px", fontSize: "12px" }}>
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px" }}><Loader2 size={20} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} /></div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", marginBottom: "24px" }}>
            <UsageStat label="Messages" value={usage?.messages ?? usage?.total_messages ?? "—"} icon={MessageSquare} color="#60A5FA" />
            <UsageStat label="Conversations" value={usage?.conversations ?? usage?.total_conversations ?? "—"} icon={TrendingUp} color="#34D399" />
            <UsageStat label="AI Tokens" value={usage?.ai_tokens != null ? usage.ai_tokens.toLocaleString() : "—"} icon={Bot} color="#A78BFA" />
            <UsageStat label="Period" value={PERIODS.find(p => p.value === period)?.label || period} icon={Calendar} color={colors.brand.warning} />
          </div>

          {/* Raw usage data */}
          {usage && (
            <div style={{ ...T.card, marginBottom: "24px" }}>
              <p style={{ ...T.monoLabel, marginBottom: "12px" }}>Usage Details</p>
              <pre style={{
                backgroundColor: colors.bg.panel, padding: "12px", borderRadius: radius.md,
                fontFamily: fonts.mono, fontSize: "11px", color: colors.text.secondary,
                overflow: "auto", maxHeight: "200px", border: `1px solid ${colors.border.muted}`,
              }}>
                {JSON.stringify(usage, null, 2)}
              </pre>
            </div>
          )}

          {/* Audit logs */}
          {scope === "enterprise" && auditLogs.length > 0 && (
            <div style={T.card}>
              <p style={{ ...T.monoLabel, marginBottom: "12px" }}>Recent Audit Events</p>
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                {auditLogs.map((ev, i) => (
                  <div key={ev.id || i} style={{
                    padding: "7px 0", borderBottom: i < auditLogs.length - 1 ? `1px solid ${colors.border.muted}` : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, flexShrink: 0 }}>
                        {ev.created_at ? new Date(ev.created_at).toLocaleString() : "—"}
                      </span>
                      <span style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.primary, fontWeight: "500" }}>
                        {ev.action || ev.event_type || ev.type}
                      </span>
                    </div>
                    {ev.actor_email && <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "1px 0 0" }}>by {ev.actor_email}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
