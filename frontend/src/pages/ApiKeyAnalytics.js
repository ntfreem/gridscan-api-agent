import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import {
  Activity, TrendingUp, Zap, DollarSign, Clock, CheckCircle, XCircle,
  ChevronDown, ChevronRight, BarChart2, RefreshCw, Key, ArrowLeft,
  Server, Hash, AlertTriangle, Copy, ToggleLeft, ToggleRight,
  Globe, Plug, ArrowUpRight, Layers
} from "lucide-react";
import { colors, fonts, T, radius, onFocus, onBlur } from "../theme";

// ── Mini bar chart (pure CSS) ───────────────────────────────────────
function MiniBar({ data, maxVal, color, height = 80 }) {
  const max = maxVal || Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height }}>
      {data.map((d, i) => (
        <div key={i} title={`${d.label}: ${d.value}`} style={{
          flex: 1, minWidth: "4px", maxWidth: "16px",
          height: `${Math.max((d.value / max) * 100, 2)}%`,
          backgroundColor: color || colors.brand.primary,
          borderRadius: "2px 2px 0 0",
          opacity: d.value > 0 ? 1 : 0.15,
          transition: "height 0.3s ease",
        }} />
      ))}
    </div>
  );
}

// ── Stat Card ───────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, accent }) {
  return (
    <div style={{
      padding: "18px 20px", backgroundColor: colors.bg.surface,
      border: `1px solid ${colors.border.muted}`, borderRadius: radius.lg,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: "-8px", right: "-8px", width: "48px", height: "48px",
        borderRadius: "50%", backgroundColor: `${accent || color || colors.brand.primary}08`,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <Icon size={14} color={color || colors.text.muted} />
        <span style={{ fontFamily: fonts.mono, fontSize: "9px", textTransform: "uppercase",
          letterSpacing: "0.1em", color: colors.text.muted }}>{label}</span>
      </div>
      <p style={{ fontFamily: fonts.heading, fontSize: "24px", fontWeight: "700",
        color: color || colors.text.primary, margin: 0, lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

// ── Key Selector ────────────────────────────────────────────────────
function KeySelector({ keys, selected, onSelect }) {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      {keys.map(k => {
        const isActive = selected === k.id;
        return (
          <button
            key={k.id}
            data-testid={`key-select-${k.id}`}
            onClick={() => onSelect(k.id)}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 16px", borderRadius: radius.md,
              backgroundColor: isActive ? `${colors.brand.primary}12` : colors.bg.surface,
              border: `1px solid ${isActive ? colors.brand.primary : colors.border.muted}`,
              cursor: "pointer", transition: "all 0.15s",
              fontFamily: fonts.mono, fontSize: "12px",
              color: isActive ? colors.brand.light : colors.text.secondary,
            }}
          >
            <Key size={13} />
            <span>{k.key_prefix}...</span>
            {k.label && <span style={{ fontFamily: fonts.body, color: colors.text.muted, fontSize: "11px" }}>({k.label})</span>}
            {k.is_active
              ? <ToggleRight size={14} color={colors.brand.success} />
              : <ToggleLeft size={14} color={colors.text.muted} />}
          </button>
        );
      })}
    </div>
  );
}

// ── Detail Panel ────────────────────────────────────────────────────
function AnalyticsDetail({ keyId, days }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!keyId) return;
    setLoading(true);
    api.get(`/admin/api-key-analytics/${keyId}?days=${days}`)
      .then(r => setData(r.data))
      .catch(() => toast.error("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, [keyId, days]);

  if (loading) return <div style={{ textAlign: "center", padding: "40px", color: colors.text.muted }}>Loading analytics...</div>;
  if (!data) return <div style={{ textAlign: "center", padding: "40px", color: colors.text.muted }}>No data</div>;

  const s = data.summary || {};
  const byDay = data.requests_by_day || [];
  const models = data.model_breakdown || [];
  const platforms = data.platform_breakdown || [];
  const errors = data.error_breakdown || [];
  const costs = data.cost_by_model || [];
  const recent = data.recent_requests || [];

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
        <StatCard icon={Activity} label="Total Requests" value={s.total_requests?.toLocaleString()} color={colors.brand.primary} />
        <StatCard icon={CheckCircle} label="Successful" value={s.successful?.toLocaleString()} sub={`${s.success_rate}% success rate`} color={colors.brand.success} />
        <StatCard icon={XCircle} label="Failed" value={s.failed?.toLocaleString()} color={s.failed > 0 ? colors.brand.error : colors.text.muted} />
        <StatCard icon={Clock} label="Avg Latency" value={`${s.avg_duration_ms}ms`} sub={`${s.min_duration_ms}ms — ${s.max_duration_ms}ms`} color={colors.brand.warning} />
        <StatCard icon={Hash} label="Input Tokens" value={s.total_input_tokens?.toLocaleString()} color={colors.text.secondary} />
        <StatCard icon={Hash} label="Output Tokens" value={s.total_output_tokens?.toLocaleString()} color={colors.text.secondary} />
        <StatCard icon={DollarSign} label="Est. Cost" value={`$${s.estimated_cost_usd}`} color={colors.brand.warning} />
      </div>

      {/* Requests over time */}
      {byDay.length > 0 && (
        <div style={{ ...T.card }}>
          <h3 style={{ ...T.sectionTitle, marginBottom: "16px" }}>
            <TrendingUp size={14} style={{ marginRight: "6px" }} /> Requests Over Time
          </h3>
          <div style={{ display: "flex", gap: "20px" }}>
            <div style={{ flex: 1 }}>
              <MiniBar data={byDay.map(d => ({ label: d.date, value: d.total }))} color={colors.brand.primary} height={100} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted }}>{byDay[0]?.date}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted }}>{byDay[byDay.length-1]?.date}</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ ...T.monoLabel, marginBottom: "6px" }}>Avg Latency by Day</p>
              <MiniBar data={byDay.map(d => ({ label: d.date, value: d.avg_duration_ms }))} color={colors.brand.warning} height={80} />
            </div>
          </div>
          {/* Day-by-day table */}
          <div style={{ maxHeight: "200px", overflowY: "auto", marginTop: "12px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fonts.mono, fontSize: "11px" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.border.muted}` }}>
                  {["Date", "Requests", "OK", "Fail", "In Tokens", "Out Tokens", "Avg ms"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: colors.text.muted, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byDay.map(d => (
                  <tr key={d.date} style={{ borderBottom: `1px solid ${colors.border.muted}15` }}>
                    <td style={{ padding: "5px 8px", color: colors.text.secondary }}>{d.date}</td>
                    <td style={{ padding: "5px 8px", color: colors.text.primary, fontWeight: "600" }}>{d.total}</td>
                    <td style={{ padding: "5px 8px", color: colors.brand.success }}>{d.successful}</td>
                    <td style={{ padding: "5px 8px", color: d.failed > 0 ? colors.brand.error : colors.text.muted }}>{d.failed}</td>
                    <td style={{ padding: "5px 8px", color: colors.text.muted }}>{d.input_tokens?.toLocaleString()}</td>
                    <td style={{ padding: "5px 8px", color: colors.text.muted }}>{d.output_tokens?.toLocaleString()}</td>
                    <td style={{ padding: "5px 8px", color: colors.text.muted }}>{d.avg_duration_ms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Model + Platform + Errors row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
        {/* Model breakdown */}
        <div style={{ ...T.card }}>
          <h3 style={{ ...T.sectionTitle, marginBottom: "12px" }}>
            <Server size={14} style={{ marginRight: "6px" }} /> Model Breakdown
          </h3>
          {models.length === 0 ? <p style={{ color: colors.text.muted, fontSize: "12px" }}>No data</p> : (
            <div style={{ display: "grid", gap: "6px" }}>
              {models.map(m => (
                <div key={m.model} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px" }}>
                  <span style={{ fontFamily: fonts.mono, color: colors.text.primary, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {(m.model || "unknown").replace(/^(emergent|anthropic|openai|ollama):/, "")}
                  </span>
                  <span style={{ fontFamily: fonts.mono, color: colors.brand.primary, fontWeight: "600" }}>{m.count}</span>
                  <span style={{ fontFamily: fonts.mono, color: colors.text.muted, fontSize: "10px" }}>{m.avg_duration_ms}ms</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Platform breakdown */}
        <div style={{ ...T.card }}>
          <h3 style={{ ...T.sectionTitle, marginBottom: "12px" }}>
            <BarChart2 size={14} style={{ marginRight: "6px" }} /> Platform
          </h3>
          {platforms.length === 0 ? <p style={{ color: colors.text.muted, fontSize: "12px" }}>No data</p> : (
            <div style={{ display: "grid", gap: "6px" }}>
              {platforms.map(p => (
                <div key={p.platform} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                  <span style={{ fontFamily: fonts.body, color: colors.text.secondary, flex: 1, textTransform: "capitalize" }}>{p.platform}</span>
                  <span style={{ fontFamily: fonts.mono, color: colors.brand.primary, fontWeight: "600" }}>{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error breakdown */}
        <div style={{ ...T.card }}>
          <h3 style={{ ...T.sectionTitle, marginBottom: "12px" }}>
            <AlertTriangle size={14} style={{ marginRight: "6px" }} /> Errors
          </h3>
          {errors.length === 0 ? <p style={{ color: colors.text.muted, fontSize: "12px" }}>No errors recorded</p> : (
            <div style={{ display: "grid", gap: "6px" }}>
              {errors.map(e => (
                <div key={e.error_type} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                  <span style={{ fontFamily: fonts.mono, color: colors.brand.error, flex: 1 }}>{e.error_type}</span>
                  <span style={{ fontFamily: fonts.mono, color: colors.brand.error, fontWeight: "600" }}>{e.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cost breakdown */}
      {costs.length > 0 && (
        <div style={{ ...T.card }}>
          <h3 style={{ ...T.sectionTitle, marginBottom: "12px" }}>
            <DollarSign size={14} style={{ marginRight: "6px" }} /> Cost Breakdown by Model
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fonts.mono, fontSize: "11px" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border.muted}` }}>
                {["Model", "Requests", "Input Tokens", "Output Tokens", "Cost"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: colors.text.muted, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {costs.map(c => (
                <tr key={c.model} style={{ borderBottom: `1px solid ${colors.border.muted}15` }}>
                  <td style={{ padding: "5px 8px", color: colors.text.primary }}>{(c.model || "").replace(/^(emergent|anthropic|openai|ollama):/, "")}</td>
                  <td style={{ padding: "5px 8px", color: colors.text.secondary }}>{c.requests}</td>
                  <td style={{ padding: "5px 8px", color: colors.text.muted }}>{c.input_tokens?.toLocaleString()}</td>
                  <td style={{ padding: "5px 8px", color: colors.text.muted }}>{c.output_tokens?.toLocaleString()}</td>
                  <td style={{ padding: "5px 8px", color: colors.brand.warning, fontWeight: "600" }}>${c.cost?.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent requests */}
      {recent.length > 0 && (
        <div style={{ ...T.card }}>
          <h3 style={{ ...T.sectionTitle, marginBottom: "12px" }}>
            <Activity size={14} style={{ marginRight: "6px" }} /> Recent Requests
          </h3>
          <div style={{ maxHeight: "300px", overflowY: "auto" }}>
            {recent.map((r, i) => (
              <div key={r.id || i} style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "6px 8px", fontSize: "11px", fontFamily: fonts.mono,
                borderBottom: `1px solid ${colors.border.muted}15`,
              }}>
                {r.success
                  ? <CheckCircle size={12} color={colors.brand.success} />
                  : <XCircle size={12} color={colors.brand.error} />}
                <span style={{ color: colors.text.muted, minWidth: "140px" }}>
                  {new Date(r.timestamp).toLocaleString()}
                </span>
                <span style={{ color: colors.text.secondary, minWidth: "120px" }}>
                  {(r.model_used || "").replace(/^(emergent|anthropic|openai|ollama):/, "")}
                </span>
                <span style={{ color: colors.text.muted, minWidth: "60px" }}>{r.duration_ms || 0}ms</span>
                <span style={{ color: colors.text.muted, minWidth: "80px" }}>
                  {r.input_tokens || 0}→{r.output_tokens || 0} tok
                </span>
                <span style={{ color: colors.text.muted }}>{r.platform}</span>
                {r.error_type && <span style={{ color: colors.brand.error }}>{r.error_type}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Integration Usage Section ────────────────────────────────────────
function IntegrationUsageSection({ days }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [selectedIntg, setSelectedIntg] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/admin/integration-usage-analytics?days=${days}`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "24px", color: colors.text.muted }}>Loading integration usage...</div>
  );
  if (!data || (data.totals?.total_requests === 0 && (!data.integrations || data.integrations.length === 0))) {
    return (
      <div style={{ ...T.card, textAlign: "center", padding: "32px" }} data-testid="integration-usage-empty">
        <Plug size={32} color={colors.text.muted} style={{ marginBottom: "8px" }} />
        <p style={{ color: colors.text.secondary, fontSize: "13px", margin: 0 }}>
          No external API integration calls recorded in the last {days} days.
        </p>
        <p style={{ color: colors.text.muted, fontSize: "11px", margin: "4px 0 0" }}>
          Add integrations (e.g. Gridscan) under Bot Settings to start tracking usage.
        </p>
      </div>
    );
  }

  const totals = data.totals || {};
  const integrations = data.integrations || [];
  const byDay = data.requests_by_day || [];
  const topEps = data.top_endpoints || [];
  const errors = data.error_breakdown || [];
  const recent = data.recent_requests || [];

  return (
    <div style={{ display: "grid", gap: "16px" }} data-testid="integration-usage-section">
      {/* Header */}
      <div
        style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? <ChevronDown size={16} color={colors.text.muted} /> : <ChevronRight size={16} color={colors.text.muted} />}
        <Globe size={16} color={colors.brand.primary} />
        <h2 style={{ ...T.h2, margin: 0, fontSize: "16px" }} data-testid="integration-usage-title">External Integration Usage</h2>
        <span style={{
          fontFamily: fonts.mono, fontSize: "10px", padding: "2px 8px", borderRadius: radius.full,
          backgroundColor: `${colors.brand.primary}12`, color: colors.brand.primary,
        }}>
          {totals.total_requests?.toLocaleString()} calls
        </span>
      </div>

      {expanded && (
        <div style={{ display: "grid", gap: "16px" }}>
          {/* Totals row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px" }}>
            <StatCard icon={Activity} label="Total Calls" value={totals.total_requests?.toLocaleString()} color={colors.brand.primary} />
            <StatCard icon={CheckCircle} label="Successful" value={totals.successful?.toLocaleString()}
              sub={`${totals.success_rate}% success`} color={colors.brand.success} />
            <StatCard icon={XCircle} label="Failed" value={totals.failed?.toLocaleString()}
              color={totals.failed > 0 ? colors.brand.error : colors.text.muted} />
          </div>

          {/* Per-integration cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px" }}>
            {integrations.map(intg => {
              const isSelected = selectedIntg === intg.integration_id;
              return (
                <div
                  key={intg.integration_id}
                  data-testid={`intg-card-${intg.integration_id}`}
                  onClick={() => setSelectedIntg(isSelected ? null : intg.integration_id)}
                  style={{
                    padding: "14px 16px", borderRadius: radius.lg, cursor: "pointer",
                    backgroundColor: isSelected ? `${colors.brand.primary}08` : colors.bg.surface,
                    border: `1px solid ${isSelected ? colors.brand.primary : colors.border.muted}`,
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <Plug size={13} color={isSelected ? colors.brand.light : colors.text.muted} />
                    <span style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: "600", color: colors.text.primary }}>
                      {intg.name}
                    </span>
                    <span style={{
                      marginLeft: "auto", fontSize: "10px", fontFamily: fonts.mono,
                      padding: "2px 6px", borderRadius: radius.full,
                      backgroundColor: intg.success_rate >= 90 ? "rgba(52,211,153,0.1)" : "rgba(239,68,68,0.1)",
                      color: intg.success_rate >= 90 ? colors.brand.success : colors.brand.error,
                    }}>
                      {intg.success_rate}%
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", fontSize: "11px" }}>
                    <div>
                      <p style={{ color: colors.text.muted, margin: "0 0 2px", fontFamily: fonts.mono, fontSize: "9px", textTransform: "uppercase" }}>Calls</p>
                      <p style={{ color: colors.text.primary, fontWeight: "600", margin: 0, fontFamily: fonts.heading, fontSize: "15px" }}>
                        {intg.total_requests?.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: colors.text.muted, margin: "0 0 2px", fontFamily: fonts.mono, fontSize: "9px", textTransform: "uppercase" }}>Avg ms</p>
                      <p style={{ color: colors.text.secondary, fontWeight: "600", margin: 0, fontFamily: fonts.heading, fontSize: "15px" }}>
                        {intg.avg_duration_ms}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: colors.text.muted, margin: "0 0 2px", fontFamily: fonts.mono, fontSize: "9px", textTransform: "uppercase" }}>Data</p>
                      <p style={{ color: colors.text.secondary, fontWeight: "600", margin: 0, fontFamily: fonts.heading, fontSize: "15px" }}>
                        {intg.total_bytes > 1048576
                          ? `${(intg.total_bytes / 1048576).toFixed(1)}MB`
                          : intg.total_bytes > 1024
                            ? `${(intg.total_bytes / 1024).toFixed(0)}KB`
                            : `${intg.total_bytes}B`}
                      </p>
                    </div>
                  </div>
                  {intg.base_url && (
                    <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "8px 0 0",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {intg.base_url}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Requests over time bar chart */}
          {byDay.length > 0 && (
            <div style={{ ...T.card }}>
              <h3 style={{ ...T.sectionTitle, marginBottom: "14px" }}>
                <TrendingUp size={14} style={{ marginRight: "6px" }} /> Integration Calls Over Time
              </h3>
              <MiniBar data={byDay.map(d => ({ label: d.date, value: d.total }))} color={colors.brand.primary} height={90} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted }}>{byDay[0]?.date}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted }}>{byDay[byDay.length - 1]?.date}</span>
              </div>
            </div>
          )}

          {/* Top endpoints + Errors row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            {/* Top endpoints */}
            <div style={{ ...T.card }}>
              <h3 style={{ ...T.sectionTitle, marginBottom: "12px" }}>
                <Layers size={14} style={{ marginRight: "6px" }} /> Top Endpoints
              </h3>
              {topEps.length === 0
                ? <p style={{ color: colors.text.muted, fontSize: "12px" }}>No data</p>
                : (
                  <div style={{ display: "grid", gap: "4px", maxHeight: "220px", overflowY: "auto" }}>
                    {topEps.map((ep, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: "8px", fontSize: "11px",
                        padding: "4px 6px", borderRadius: radius.sm,
                        backgroundColor: i % 2 === 0 ? "transparent" : `${colors.bg.surface}80`,
                      }}>
                        <span style={{ fontFamily: fonts.mono, color: colors.text.muted, minWidth: "70px", fontSize: "10px",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ep.integration_name}
                        </span>
                        <span style={{ fontFamily: fonts.mono, color: colors.text.primary, flex: 1,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ep.endpoint_path}
                        </span>
                        <span style={{ fontFamily: fonts.mono, color: colors.brand.primary, fontWeight: "600", minWidth: "30px", textAlign: "right" }}>
                          {ep.total}
                        </span>
                        <span style={{ fontFamily: fonts.mono, color: colors.text.muted, fontSize: "10px", minWidth: "40px" }}>
                          {ep.avg_duration_ms}ms
                        </span>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            {/* Error breakdown */}
            <div style={{ ...T.card }}>
              <h3 style={{ ...T.sectionTitle, marginBottom: "12px" }}>
                <AlertTriangle size={14} style={{ marginRight: "6px" }} /> Integration Errors
              </h3>
              {errors.length === 0
                ? <p style={{ color: colors.text.muted, fontSize: "12px" }}>No errors recorded</p>
                : (
                  <div style={{ display: "grid", gap: "6px" }}>
                    {errors.map(e => (
                      <div key={e.error} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                        <span style={{ fontFamily: fonts.mono, color: colors.brand.error, flex: 1,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {e.error}
                        </span>
                        <span style={{ fontFamily: fonts.mono, color: colors.brand.error, fontWeight: "600" }}>{e.count}</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* Recent integration requests */}
          {recent.length > 0 && (
            <div style={{ ...T.card }}>
              <h3 style={{ ...T.sectionTitle, marginBottom: "12px" }}>
                <Activity size={14} style={{ marginRight: "6px" }} /> Recent Integration Calls
              </h3>
              <div style={{ maxHeight: "250px", overflowY: "auto" }}>
                {recent.map((r, i) => (
                  <div key={r.id || i} style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "5px 8px", fontSize: "11px", fontFamily: fonts.mono,
                    borderBottom: `1px solid ${colors.border.muted}15`,
                  }}>
                    {r.success
                      ? <CheckCircle size={12} color={colors.brand.success} />
                      : <XCircle size={12} color={colors.brand.error} />}
                    <span style={{ color: colors.text.muted, minWidth: "130px" }}>
                      {new Date(r.timestamp).toLocaleString()}
                    </span>
                    <span style={{ color: colors.brand.primary, minWidth: "80px", fontWeight: "500" }}>
                      {r.integration_name}
                    </span>
                    <span style={{ color: colors.text.secondary, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.endpoint_path}
                    </span>
                    <span style={{
                      fontSize: "10px", padding: "1px 5px", borderRadius: radius.sm, fontWeight: "600",
                      backgroundColor: r.http_status >= 200 && r.http_status < 300 ? "rgba(52,211,153,0.1)" : "rgba(239,68,68,0.1)",
                      color: r.http_status >= 200 && r.http_status < 300 ? colors.brand.success : colors.brand.error,
                    }}>
                      {r.http_status}
                    </span>
                    <span style={{ color: colors.text.muted, minWidth: "50px" }}>{r.duration_ms || 0}ms</span>
                    {r.error_category && <span style={{ color: colors.brand.error, fontSize: "10px" }}>{r.error_category}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════
export default function ApiKeyAnalytics() {
  const { selectedInstance } = useAuth();
  const instanceId = selectedInstance?.id;
  const [keys, setKeys] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const loadKeys = useCallback(async () => {
    if (!instanceId) return;
    setLoading(true);
    try {
      const r = await api.get("/admin/api-key-analytics?days=" + days);
      setKeys(r.data || []);
      // Auto-select first key if none selected
      if (!selectedKey && r.data?.length > 0) {
        setSelectedKey(r.data[0].id);
      }
    } catch { }
    finally { setLoading(false); }
  }, [instanceId, days]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  if (!instanceId) {
    return (
      <div style={T.page}>
        <p style={T.overline}>API Key Analytics</p>
        <h1 style={T.h1}>API Key Analytics</h1>
        <div style={{ ...T.card, textAlign: "center", padding: "48px" }}>
          <Activity size={40} color={colors.text.muted} style={{ marginBottom: "12px" }} />
          <p style={{ color: colors.text.secondary, fontSize: "14px" }}>Select a workspace first.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={T.page} data-testid="api-key-analytics-page">
      <p style={T.overline}>API Key Analytics</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <h1 style={{ ...T.h1, margin: 0 }}>Usage Analytics</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <select
            data-testid="days-filter"
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            style={{ ...T.input, width: "auto", fontSize: "12px", padding: "7px 12px", cursor: "pointer" }}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button data-testid="refresh-analytics" style={T.btnGhost} onClick={loadKeys}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Key overview cards */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px", color: colors.text.muted }}>Loading...</div>
      ) : keys.length === 0 ? (
        <div style={{ ...T.card, textAlign: "center", padding: "48px" }}>
          <Key size={40} color={colors.text.muted} style={{ marginBottom: "12px" }} />
          <p style={{ color: colors.text.secondary, fontSize: "14px", marginBottom: "4px" }}>No API keys found.</p>
          <p style={{ color: colors.text.muted, fontSize: "12px" }}>Create API keys in Bot Settings to enable external chat access and usage tracking.</p>
        </div>
      ) : (
        <>
          {/* Overview grid — compact summary per key */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px", marginBottom: "20px" }}>
            {keys.map(k => {
              const a = k.analytics || {};
              const isSelected = selectedKey === k.id;
              return (
                <div
                  key={k.id}
                  data-testid={`key-card-${k.id}`}
                  onClick={() => setSelectedKey(k.id)}
                  style={{
                    padding: "16px", borderRadius: radius.lg, cursor: "pointer",
                    backgroundColor: isSelected ? `${colors.brand.primary}08` : colors.bg.surface,
                    border: `1px solid ${isSelected ? colors.brand.primary : colors.border.muted}`,
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <Key size={13} color={isSelected ? colors.brand.light : colors.text.muted} />
                    <span style={{ fontFamily: fonts.mono, fontSize: "12px", color: colors.text.primary }}>{k.key_prefix}...</span>
                    {k.label && <span style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted }}>({k.label})</span>}
                    <span style={{
                      marginLeft: "auto", fontSize: "10px", fontFamily: fonts.mono,
                      padding: "2px 6px", borderRadius: radius.full,
                      backgroundColor: k.is_active ? "rgba(52,211,153,0.1)" : "rgba(100,116,139,0.1)",
                      color: k.is_active ? colors.brand.success : colors.text.muted,
                    }}>
                      {k.is_active ? "active" : "disabled"}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", fontSize: "11px" }}>
                    <div>
                      <p style={{ color: colors.text.muted, margin: "0 0 2px", fontFamily: fonts.mono, fontSize: "9px", textTransform: "uppercase" }}>Requests</p>
                      <p style={{ color: colors.text.primary, fontWeight: "600", margin: 0, fontFamily: fonts.heading, fontSize: "16px" }}>{a.total_requests || 0}</p>
                    </div>
                    <div>
                      <p style={{ color: colors.text.muted, margin: "0 0 2px", fontFamily: fonts.mono, fontSize: "9px", textTransform: "uppercase" }}>Success</p>
                      <p style={{ color: colors.brand.success, fontWeight: "600", margin: 0, fontFamily: fonts.heading, fontSize: "16px" }}>{a.successful || 0}</p>
                    </div>
                    <div>
                      <p style={{ color: colors.text.muted, margin: "0 0 2px", fontFamily: fonts.mono, fontSize: "9px", textTransform: "uppercase" }}>Avg ms</p>
                      <p style={{ color: colors.text.secondary, fontWeight: "600", margin: 0, fontFamily: fonts.heading, fontSize: "16px" }}>{a.avg_duration_ms || 0}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed view */}
          {selectedKey && <AnalyticsDetail keyId={selectedKey} days={days} />}
        </>
      )}

      {/* ── External Integration Usage ── */}
      <div style={{ marginTop: "28px", borderTop: `1px solid ${colors.border.muted}`, paddingTop: "24px" }}>
        <IntegrationUsageSection days={days} />
      </div>
    </div>
  );
}
