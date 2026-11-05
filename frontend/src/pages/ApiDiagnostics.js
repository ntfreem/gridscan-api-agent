import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import { toast } from "sonner";
import {
  Activity, Shield, Zap, Brain, FileText, AlertTriangle, CheckCircle,
  XCircle, Play, RefreshCw, ChevronDown, ChevronRight, Search,
  Clock, Database, Globe, Cpu, BarChart3, Eye, Info, Loader2
} from "lucide-react";
import { colors, fonts, T, radius } from "../theme";

// ── Status helpers ──────────────────────────────────────────────────────
const STATUS_COLORS = {
  pass: colors.brand.success,
  warning: colors.brand.warning,
  fail: colors.brand.error,
  error: colors.brand.error,
  skipped: colors.text.muted,
  unknown: colors.text.muted,
  no_kb: colors.brand.warning,
  empty: colors.brand.warning,
};

function StatusBadge({ status, label }) {
  const c = STATUS_COLORS[status] || colors.text.muted;
  const icon = status === "pass" ? <CheckCircle size={12} /> :
    status === "fail" || status === "error" ? <XCircle size={12} /> :
    status === "warning" ? <AlertTriangle size={12} /> :
    <Info size={12} />;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      padding: "2px 10px", borderRadius: radius.full,
      backgroundColor: `${c}18`, color: c,
      fontFamily: fonts.mono, fontSize: "11px", fontWeight: "600",
    }}>
      {icon} {label || status.toUpperCase()}
    </span>
  );
}

function CoverageBar({ covered, total, label }) {
  const pct = total > 0 ? Math.round(covered / total * 100) : 0;
  const c = pct >= 75 ? colors.brand.success : pct >= 40 ? colors.brand.warning : colors.brand.error;
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "12px", color: colors.text.secondary }}>{label}</span>
        <span style={{ fontSize: "12px", fontFamily: fonts.mono, color: c, fontWeight: "600" }}>
          {covered}/{total} ({pct}%)
        </span>
      </div>
      <div style={{
        height: "6px", borderRadius: "3px",
        backgroundColor: colors.bg.panel, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: "3px",
          backgroundColor: c, transition: "width 0.5s ease",
        }} />
      </div>
    </div>
  );
}

function ScoreGauge({ score, label }) {
  const c = score >= 75 ? colors.brand.success : score >= 40 ? colors.brand.warning : colors.brand.error;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: "72px", height: "72px", borderRadius: "50%",
        border: `3px solid ${c}`, display: "flex", alignItems: "center",
        justifyContent: "center", margin: "0 auto 6px",
        backgroundColor: `${c}10`,
      }}>
        <span style={{ fontSize: "20px", fontWeight: "700", color: c, fontFamily: fonts.mono }}>
          {Math.round(score)}
        </span>
      </div>
      <span style={{ fontSize: "11px", color: colors.text.muted }}>{label}</span>
    </div>
  );
}

// ── Collapsible Section ─────────────────────────────────────────────────
function Section({ title, icon, defaultOpen = false, children, badge, actions }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      border: `1px solid ${colors.border.default}`, borderRadius: radius.md,
      marginBottom: "12px", overflow: "hidden",
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "12px 16px", cursor: "pointer",
          backgroundColor: open ? colors.bg.panel : "transparent",
          transition: "background 0.15s",
        }}
      >
        {open ? <ChevronDown size={14} color={colors.text.muted} /> :
          <ChevronRight size={14} color={colors.text.muted} />}
        {icon}
        <span style={{ fontSize: "13px", fontWeight: "600", color: colors.text.primary, flex: 1 }}>
          {title}
        </span>
        {badge}
        {actions && <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: "6px" }}>{actions}</div>}
      </div>
      {open && (
        <div style={{ padding: "16px", borderTop: `1px solid ${colors.border.muted}` }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Small action button ─────────────────────────────────────────────────
function ActionBtn({ children, onClick, loading, variant = "default", disabled, style: extra }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: "5px",
    padding: "6px 14px", borderRadius: radius.sm,
    fontSize: "12px", fontWeight: "600", cursor: disabled ? "not-allowed" : "pointer",
    border: "none", opacity: disabled ? 0.5 : 1,
    transition: "all 0.15s",
  };
  const variants = {
    default: { backgroundColor: colors.bg.panel, color: colors.text.secondary },
    primary: { backgroundColor: colors.brand.primary, color: "#fff" },
    warning: { backgroundColor: `${colors.brand.warning}22`, color: colors.brand.warning },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...extra }}
      onClick={onClick} disabled={disabled || loading}>
      {loading ? <Loader2 size={12} className="spin" /> : null}
      {children}
    </button>
  );
}

// ── Cost Indicator ──────────────────────────────────────────────────────
function CostTag({ type }) {
  if (type === "free") return (
    <span style={{
      fontSize: "10px", padding: "1px 6px", borderRadius: radius.full,
      backgroundColor: `${colors.brand.success}18`, color: colors.brand.success,
      fontWeight: "600",
    }}>FREE</span>
  );
  return (
    <span style={{
      fontSize: "10px", padding: "1px 6px", borderRadius: radius.full,
      backgroundColor: `${colors.brand.warning}18`, color: colors.brand.warning,
      fontWeight: "600",
    }}>{type === "api" ? "API CALL" : type === "llm" ? "LLM TOKENS" : "LLM + API"}</span>
  );
}


// ══════════════════════════════════════════════════════════════════════════
// Instance-Wide Summary
// ══════════════════════════════════════════════════════════════════════════

export function InstanceDiagnosticsSummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/diagnostics/instance-summary")
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return null;

  return (
    <div data-testid="instance-diagnostics-summary" style={{
      ...T.card, marginBottom: "20px", padding: "16px 20px",
      border: `1px solid ${colors.border.default}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
        <Shield size={16} color={colors.brand.light} />
        <span style={{ fontSize: "13px", fontWeight: "700", color: colors.text.primary }}>
          Instance Intelligence Summary
        </span>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "14px",
      }}>
        <StatCard icon={<Database size={14} />} label="KB Sources" value={data.knowledge_base?.active_sources ?? 0} />
        <StatCard icon={<Globe size={14} />} label="Integrations" value={`${data.integrations?.enabled ?? 0}/${data.integrations?.total ?? 0}`} />
        <StatCard icon={<Zap size={14} />} label="Endpoints"
          value={`${data.endpoints?.enabled ?? 0}/${data.endpoints?.total ?? 0}`} />
        <StatCard icon={<FileText size={14} />} label="Doc Coverage"
          value={`${data.documentation_coverage_pct ?? 0}%`}
          color={data.documentation_coverage_pct >= 75 ? colors.brand.success :
            data.documentation_coverage_pct >= 40 ? colors.brand.warning : colors.brand.error} />
        <StatCard icon={<Cpu size={14} />} label="LLM Provider"
          value={(data.llm_provider || "emergent").charAt(0).toUpperCase() + (data.llm_provider || "emergent").slice(1)} />
        <StatCard icon={<Brain size={14} />} label="Last Unified Test"
          value={data.last_unified_test ? new Date(data.last_unified_test.timestamp).toLocaleDateString() : "Never"}
          color={data.last_unified_test?.status === "pass" ? colors.brand.success : colors.text.muted} />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      padding: "10px 12px", borderRadius: radius.sm,
      backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.muted}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
        <span style={{ color: colors.text.muted }}>{icon}</span>
        <span style={{ fontSize: "10px", color: colors.text.muted, textTransform: "uppercase",
          letterSpacing: "0.04em", fontWeight: "600" }}>{label}</span>
      </div>
      <span style={{ fontSize: "16px", fontWeight: "700", fontFamily: fonts.mono,
        color: color || colors.text.primary }}>{value}</span>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════
// Per-Integration Diagnostics Panel
// ══════════════════════════════════════════════════════════════════════════

export default function ApiDiagnostics({ integrationId, integrationName }) {
  const [scan, setScan] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Discovery test state
  const [discoveryQ, setDiscoveryQ] = useState("");
  const [discoveryExpected, setDiscoveryExpected] = useState("");
  const [discoveryResult, setDiscoveryResult] = useState(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);

  // Execution test state
  const [execEpId, setExecEpId] = useState("");
  const [execParams, setExecParams] = useState("{}");
  const [execResult, setExecResult] = useState(null);
  const [execLoading, setExecLoading] = useState(false);

  // Unified test state
  const [unifiedQ, setUnifiedQ] = useState("");
  const [unifiedResult, setUnifiedResult] = useState(null);
  const [unifiedLoading, setUnifiedLoading] = useState(false);

  // Endpoints list for selection
  const [endpoints, setEndpoints] = useState([]);

  useEffect(() => {
    if (integrationId) {
      api.get(`/integrations/${integrationId}/endpoints`)
        .then(r => setEndpoints(r.data?.endpoints || []))
        .catch(() => {});
    }
  }, [integrationId]);

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    api.get(`/integrations/${integrationId}/diagnostics/history?limit=15`)
      .then(r => setHistory(r.data?.history || []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [integrationId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── Passive Scan ──────────────────────────────────────────────────────
  const runScan = async () => {
    setScanLoading(true);
    try {
      const r = await api.get(`/integrations/${integrationId}/diagnostics/scan`);
      setScan(r.data);
      loadHistory();
      toast.success("Documentation scan complete");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Scan failed");
    } finally { setScanLoading(false); }
  };

  // ── Discovery Test ────────────────────────────────────────────────────
  const runDiscovery = async () => {
    if (!discoveryQ.trim()) return toast.error("Enter a question");
    setDiscoveryLoading(true);
    try {
      const r = await api.post(`/integrations/${integrationId}/diagnostics/discovery`, {
        question: discoveryQ,
        expected_endpoint_id: discoveryExpected || null,
      });
      setDiscoveryResult(r.data);
      loadHistory();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Discovery test failed");
    } finally { setDiscoveryLoading(false); }
  };

  // ── Execution Test ────────────────────────────────────────────────────
  const runExecution = async () => {
    if (!execEpId) return toast.error("Select an endpoint");
    setExecLoading(true);
    let params = {};
    try { params = JSON.parse(execParams); } catch { params = {}; }
    try {
      const r = await api.post(`/integrations/${integrationId}/diagnostics/execution`, {
        endpoint_id: execEpId, parameters: params,
      });
      setExecResult(r.data);
      loadHistory();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Execution test failed");
    } finally { setExecLoading(false); }
  };

  // ── Unified Test ──────────────────────────────────────────────────────
  const runUnified = async () => {
    if (!unifiedQ.trim()) return toast.error("Enter a question");
    setUnifiedLoading(true);
    try {
      const r = await api.post(`/integrations/${integrationId}/diagnostics/unified`, {
        question: unifiedQ,
      });
      setUnifiedResult(r.data);
      loadHistory();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Unified test failed");
    } finally { setUnifiedLoading(false); }
  };

  const enabledEps = endpoints.filter(e => e.enabled && e.executable);

  return (
    <div data-testid="api-diagnostics-panel">
      {/* ─── Documentation Scan ─────────────────────────────────────── */}
      <Section
        title="Documentation Coverage"
        icon={<FileText size={14} color={colors.brand.light} />}
        defaultOpen={true}
        badge={<CostTag type="free" />}
        actions={
          <ActionBtn onClick={runScan} loading={scanLoading} variant="primary">
            <Search size={11} /> Run Scan
          </ActionBtn>
        }
      >
        {!scan ? (
          <p style={{ color: colors.text.muted, fontSize: "12px" }}>
            Run a documentation scan to analyse API schema coverage. This is free and makes no API or LLM calls.
          </p>
        ) : (
          <div>
            <div style={{ display: "flex", gap: "24px", marginBottom: "16px", flexWrap: "wrap" }}>
              <ScoreGauge score={scan.overall_score} label="Overall Score" />
              <div style={{ flex: 1, minWidth: "200px" }}>
                <div style={{ display: "flex", gap: "12px", marginBottom: "8px", flexWrap: "wrap" }}>
                  <StatusBadge status={scan.status} />
                  <span style={{ fontSize: "11px", color: colors.text.muted }}>
                    {scan.total_endpoints} endpoints ({scan.enabled_endpoints} enabled)
                  </span>
                  <span style={{ fontSize: "11px", color: colors.text.muted }}>
                    Source: {scan.doc_source_type}
                  </span>
                </div>
                {scan.doc_sources && Object.keys(scan.doc_sources).length > 0 && (
                  <div style={{ fontSize: "11px", color: colors.text.muted, marginBottom: "8px" }}>
                    Doc origins: {Object.entries(scan.doc_sources).map(([k, v]) => `${k} (${v})`).join(", ")}
                  </div>
                )}
              </div>
            </div>
            {scan.metrics && (
              <div>
                <CoverageBar {...scan.metrics.response_schema_coverage} label="Response Schema Coverage" />
                <CoverageBar {...scan.metrics.field_description_coverage} label="Field Description Coverage" />
                <CoverageBar {...scan.metrics.parameter_documentation} label="Parameter Documentation" />
                <CoverageBar {...scan.metrics.endpoint_description_coverage} label="Endpoint Description Coverage" />
                <CoverageBar {...scan.metrics.response_example_coverage} label="Response Example Coverage" />
                <CoverageBar {...scan.metrics.error_documentation_coverage} label="Error Documentation Coverage" />
                {scan.metrics.field_description_coverage?.fields_with_units > 0 && (
                  <div style={{ fontSize: "11px", color: colors.text.muted, marginTop: "4px" }}>
                    Fields with unit annotations: {scan.metrics.field_description_coverage.fields_with_units}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ─── AI Discovery Test ──────────────────────────────────────── */}
      <Section
        title="AI Endpoint Discovery"
        icon={<Brain size={14} color={colors.brand.warning} />}
        badge={<CostTag type="llm" />}
      >
        <p style={{ color: colors.text.muted, fontSize: "12px", marginBottom: "12px" }}>
          Test whether the LLM selects the correct endpoint for a natural-language question.
          Optionally specify the expected endpoint to evaluate correctness.
        </p>
        <div style={{ display: "grid", gap: "10px", marginBottom: "12px" }}>
          <input
            data-testid="discovery-question-input"
            style={T.input}
            placeholder="Ask a natural-language question (e.g., 'What is the current tip of the blockchain?')"
            value={discoveryQ}
            onChange={e => setDiscoveryQ(e.target.value)}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px" }}>
            <select
              data-testid="discovery-expected-select"
              style={{ ...T.input, cursor: "pointer" }}
              value={discoveryExpected}
              onChange={e => setDiscoveryExpected(e.target.value)}
            >
              <option value="">Expected endpoint (optional)</option>
              {enabledEps.map(ep => (
                <option key={ep.id} value={ep.id}>
                  {ep.method} {ep.path} — {ep.summary?.slice(0, 50) || ""}
                </option>
              ))}
            </select>
            <ActionBtn onClick={runDiscovery} loading={discoveryLoading} variant="primary" data-testid="run-discovery-btn">
              <Play size={11} /> Test Discovery
            </ActionBtn>
          </div>
        </div>
        {discoveryResult && <DiscoveryResults data={discoveryResult} />}
      </Section>

      {/* ─── Endpoint Execution Test ────────────────────────────────── */}
      <Section
        title="Endpoint Execution & Schema Validation"
        icon={<Zap size={14} color={colors.brand.primary} />}
        badge={<CostTag type="api" />}
      >
        <p style={{ color: colors.text.muted, fontSize: "12px", marginBottom: "12px" }}>
          Execute a specific endpoint and validate the response against the stored schema.
        </p>
        <div style={{ display: "grid", gap: "10px", marginBottom: "12px" }}>
          <select
            data-testid="exec-endpoint-select"
            style={{ ...T.input, cursor: "pointer" }}
            value={execEpId}
            onChange={e => setExecEpId(e.target.value)}
          >
            <option value="">Select an endpoint to test</option>
            {enabledEps.map(ep => (
              <option key={ep.id} value={ep.id}>
                {ep.method} {ep.path} — {ep.summary?.slice(0, 50) || ""}
              </option>
            ))}
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px" }}>
            <input
              data-testid="exec-params-input"
              style={{ ...T.input, fontFamily: fonts.mono, fontSize: "12px" }}
              placeholder='Parameters as JSON, e.g. {"pool_id":"pool1..."}'
              value={execParams}
              onChange={e => setExecParams(e.target.value)}
            />
            <ActionBtn onClick={runExecution} loading={execLoading} variant="primary">
              <Play size={11} /> Execute
            </ActionBtn>
          </div>
        </div>
        {execResult && <ExecutionResults data={execResult} />}
      </Section>

      {/* ─── Unified Reasoning Test ─────────────────────────────────── */}
      <Section
        title="Unified KB + API Reasoning"
        icon={<Activity size={14} color={colors.brand.success} />}
        badge={<CostTag type="both" />}
      >
        <p style={{ color: colors.text.muted, fontSize: "12px", marginBottom: "12px" }}>
          Full pipeline test: KB retrieval → endpoint discovery → LLM selection → API execution →
          schema retrieval → context assembly → final answer. This tests the complete AI reasoning chain.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", marginBottom: "12px" }}>
          <input
            data-testid="unified-question-input"
            style={T.input}
            placeholder="Ask a question that needs both KB and API data..."
            value={unifiedQ}
            onChange={e => setUnifiedQ(e.target.value)}
          />
          <ActionBtn onClick={runUnified} loading={unifiedLoading} variant="primary">
            <Play size={11} /> Run Full Test
          </ActionBtn>
        </div>
        {unifiedResult && <UnifiedResults data={unifiedResult} />}
      </Section>

      {/* ─── Diagnostic History ─────────────────────────────────────── */}
      <Section
        title="Diagnostic History"
        icon={<Clock size={14} color={colors.text.muted} />}
        actions={
          <ActionBtn onClick={loadHistory} loading={historyLoading}>
            <RefreshCw size={11} /> Refresh
          </ActionBtn>
        }
      >
        {history.length === 0 ? (
          <p style={{ color: colors.text.muted, fontSize: "12px" }}>No diagnostic runs recorded yet.</p>
        ) : (
          <div style={{ maxHeight: "300px", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.border.muted}` }}>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>Timestamp</th>
                  <th style={thStyle}>Details</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} style={{ borderBottom: `1px solid ${colors.border.muted}` }}>
                    <td style={tdStyle}>
                      <span style={{ fontFamily: fonts.mono }}>{h.diagnostic_type?.replace("_", " ")}</span>
                    </td>
                    <td style={tdStyle}><StatusBadge status={h.status} /></td>
                    <td style={tdStyle}>
                      <span style={{ fontFamily: fonts.mono }}>{h.duration_ms}ms</span>
                    </td>
                    <td style={tdStyle}>
                      {new Date(h.timestamp).toLocaleString()}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: colors.text.muted, fontSize: "11px" }}>
                        {h.error_details?.slice(0, 60) || (h.results?.question?.slice(0, 60)) || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}

const thStyle = {
  textAlign: "left", padding: "6px 8px", fontSize: "10px",
  color: colors.text.muted, fontWeight: "600", textTransform: "uppercase",
  letterSpacing: "0.04em",
};
const tdStyle = { padding: "8px 8px", verticalAlign: "middle" };

// ══════════════════════════════════════════════════════════════════════════
// Discovery Results Sub-component
// ══════════════════════════════════════════════════════════════════════════

function DiscoveryResults({ data }) {
  const [showCandidates, setShowCandidates] = useState(false);
  return (
    <div data-testid="discovery-results" style={{
      border: `1px solid ${colors.border.default}`, borderRadius: radius.sm,
      padding: "14px", backgroundColor: colors.bg.base,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
        <StatusBadge status={data.status} />
        <span style={{ fontSize: "12px", color: colors.text.muted, fontFamily: fonts.mono }}>
          {data.duration_ms}ms
        </span>
      </div>

      <div style={{ fontSize: "12px", color: colors.text.secondary, marginBottom: "8px" }}>
        <strong>Question:</strong> {data.question}
      </div>
      <div style={{ fontSize: "12px", color: colors.text.secondary, marginBottom: "8px" }}>
        <strong>Action:</strong> {data.action} — <em>{data.reason}</em>
      </div>

      {data.selected_endpoints?.length > 0 && (
        <div style={{ marginBottom: "8px" }}>
          <strong style={{ fontSize: "12px", color: colors.text.primary }}>Selected Endpoints:</strong>
          {data.selected_endpoints.map((s, i) => (
            <div key={i} style={{
              marginTop: "6px", padding: "8px 10px", borderRadius: radius.sm,
              backgroundColor: colors.bg.panel, fontSize: "12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ fontFamily: fonts.mono, color: colors.text.accent }}>
                  {s.method} {s.path}
                </span>
                {s.integration_name && (
                  <span style={{ fontSize: "10px", color: colors.text.muted }}>({s.integration_name})</span>
                )}
                <StatusBadge
                  status={s.found && s.enabled && s.executable ? "pass" : "fail"}
                  label={s.found && s.enabled && s.executable ? "Permitted" : "Denied"}
                />
              </div>
              {s.summary && <div style={{ color: colors.text.muted, marginTop: "3px" }}>{s.summary}</div>}
              {Object.keys(data.selected_endpoints[i]?.parameters || {}).length > 0 && (
                <div style={{ marginTop: "4px", fontFamily: fonts.mono, fontSize: "11px", color: colors.text.muted }}>
                  Params: {JSON.stringify(data.selected_endpoints[i].parameters)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: colors.text.muted, flexWrap: "wrap" }}>
        <span>Permissions valid: {data.all_permissions_valid ? "Yes" : "No"}</span>
        {data.correctness_evaluated && (
          <span>
            Correctness: {data.correctness === true ? "Correct" :
              data.correctness === false ? "Incorrect" : "Not evaluated"}
          </span>
        )}
        <span
          style={{ cursor: "pointer", color: colors.text.accent }}
          onClick={() => setShowCandidates(!showCandidates)}
        >
          {showCandidates ? "Hide" : "Show"} {data.candidate_count} candidates
        </span>
      </div>

      {showCandidates && data.candidate_endpoints && (
        <div style={{ marginTop: "8px", maxHeight: "200px", overflowY: "auto" }}>
          {data.candidate_endpoints.map((c, i) => (
            <div key={i} style={{
              fontSize: "11px", padding: "3px 0",
              color: c.from_target_integration ? colors.text.accent : colors.text.muted,
              fontFamily: fonts.mono,
            }}>
              [{c.endpoint_id.slice(0, 8)}] {c.method} {c.path}
              {c.from_target_integration && " ★"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════
// Execution Results Sub-component
// ══════════════════════════════════════════════════════════════════════════

function ExecutionResults({ data }) {
  const [showPreview, setShowPreview] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  return (
    <div data-testid="execution-results" style={{
      border: `1px solid ${colors.border.default}`, borderRadius: radius.sm,
      padding: "14px", backgroundColor: colors.bg.base,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
        <StatusBadge status={data.status} />
        <span style={{ fontFamily: fonts.mono, fontSize: "12px", color: colors.text.accent }}>
          {data.endpoint?.method} {data.endpoint?.path}
        </span>
        <span style={{ fontSize: "11px", color: colors.text.muted }}>HTTP {data.http_status}</span>
        <span style={{ fontSize: "11px", color: colors.text.muted, fontFamily: fonts.mono }}>
          {data.api_duration_ms}ms / {data.response_size}B
        </span>
      </div>

      {data.endpoint && (
        <div style={{ fontSize: "11px", color: colors.text.muted, marginBottom: "8px" }}>
          Doc source: <strong>{data.endpoint.doc_source}</strong> |
          Enabled: {data.endpoint.enabled ? "Yes" : "No"} |
          Executable: {data.endpoint.executable ? "Yes" : "No"}
        </div>
      )}

      {data.error && (
        <div style={{
          padding: "8px", borderRadius: radius.sm, marginBottom: "8px",
          backgroundColor: `${colors.brand.error}12`, color: colors.brand.error, fontSize: "12px",
        }}>
          {data.error}
        </div>
      )}

      {data.schema_validation && (
        <div style={{ marginBottom: "8px" }}>
          <div style={{ fontSize: "12px", fontWeight: "600", color: colors.text.primary, marginBottom: "4px" }}>
            Schema Validation
            <StatusBadge
              status={data.schema_validation.valid === true ? "pass" :
                data.schema_validation.valid === false ? "fail" : "warning"}
              label={data.schema_validation.reason}
            />
          </div>
          {data.schema_validation.field_results?.length > 0 && (
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {data.schema_validation.field_results.map((f, i) => (
                <div key={i} style={{
                  fontSize: "11px", fontFamily: fonts.mono, padding: "2px 0",
                  color: f.status === "type_match" ? colors.brand.success :
                    f.status === "present" ? colors.text.secondary :
                    f.status === "missing_required" ? colors.brand.error :
                    colors.text.muted,
                }}>
                  {f.status === "type_match" ? "✓" : f.status === "present" ? "~" :
                    f.status === "missing_required" ? "✗" : "○"} {f.field}
                  : {f.expected_type}
                  {f.actual_type ? ` → ${f.actual_type}` : ""}
                  {f.has_description ? "" : " [no description]"}
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: "11px", color: colors.text.muted, marginTop: "4px" }}>
            {data.schema_validation.fields_found}/{data.schema_validation.fields_expected} fields matched
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "8px" }}>
        {data.response_preview && (
          <ActionBtn onClick={() => setShowPreview(!showPreview)}>
            <Eye size={11} /> {showPreview ? "Hide" : "Show"} Response
          </ActionBtn>
        )}
        {data.schema_context_preview && (
          <ActionBtn onClick={() => setShowSchema(!showSchema)}>
            <Eye size={11} /> {showSchema ? "Hide" : "Show"} Schema Context
          </ActionBtn>
        )}
      </div>

      {showPreview && data.response_preview && (
        <pre style={preStyle}>{data.response_preview}</pre>
      )}
      {showSchema && data.schema_context_preview && (
        <pre style={preStyle}>{data.schema_context_preview}</pre>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════
// Unified Test Results Sub-component
// ══════════════════════════════════════════════════════════════════════════

function UnifiedResults({ data }) {
  const [showContext, setShowContext] = useState(false);
  const stepOrder = [
    "kb_retrieval", "endpoint_discovery", "llm_selection",
    "permission_validation", "api_execution", "schema_retrieval",
    "context_assembly", "answer_generation",
  ];
  const stepLabels = {
    kb_retrieval: "Knowledge Base Retrieval",
    endpoint_discovery: "Endpoint Discovery",
    llm_selection: "LLM Endpoint Selection",
    permission_validation: "Permission Validation",
    api_execution: "API Execution",
    schema_retrieval: "Response Schema Retrieval",
    context_assembly: "Combined LLM Context Assembly",
    answer_generation: "Final Answer Generation",
  };
  const stepIcons = {
    kb_retrieval: <Database size={12} />,
    endpoint_discovery: <Search size={12} />,
    llm_selection: <Brain size={12} />,
    permission_validation: <Shield size={12} />,
    api_execution: <Zap size={12} />,
    schema_retrieval: <FileText size={12} />,
    context_assembly: <BarChart3 size={12} />,
    answer_generation: <Activity size={12} />,
  };

  const steps = data.steps || {};

  return (
    <div data-testid="unified-results" style={{
      border: `1px solid ${colors.border.default}`, borderRadius: radius.sm,
      padding: "14px", backgroundColor: colors.bg.base,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <StatusBadge status={data.status} />
        <span style={{ fontFamily: fonts.mono, fontSize: "12px", color: colors.text.muted }}>
          {data.duration_ms}ms
        </span>
      </div>
      <div style={{ fontSize: "12px", color: colors.text.secondary, marginBottom: "12px" }}>
        <strong>Question:</strong> {data.question}
      </div>

      {/* Execution Trace */}
      <div style={{ marginBottom: "14px" }}>
        {stepOrder.map(key => {
          const step = steps[key];
          if (!step) return null;
          return (
            <StepRow
              key={key}
              icon={stepIcons[key]}
              label={stepLabels[key]}
              status={step.status}
              details={step}
              stepKey={key}
            />
          );
        })}
      </div>

      {/* LLM Context Verification */}
      {steps.context_assembly?.findings && (
        <div style={{ marginBottom: "14px" }}>
          <div style={{
            fontSize: "12px", fontWeight: "600", color: colors.text.primary,
            marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px",
          }}>
            <Shield size={13} color={colors.brand.light} />
            LLM Context Verification
            <StatusBadge status={steps.context_assembly.status} />
            <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.muted }}>
              {steps.context_assembly.included_count}/{steps.context_assembly.total_checks} checks passed
              ({steps.context_assembly.completeness_pct}%)
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
            {Object.entries(steps.context_assembly.findings).map(([k, v]) => (
              <div key={k} style={{
                fontSize: "11px", display: "flex", alignItems: "center", gap: "5px",
                color: v ? colors.brand.success : colors.brand.error,
              }}>
                {v ? <CheckCircle size={10} /> : <XCircle size={10} />}
                {k.replace(/_/g, " ")}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "6px", fontSize: "11px", color: colors.text.muted }}>
            <span>Context: {steps.context_assembly.context_length_chars?.toLocaleString()} chars</span>
            <span>KB: {steps.context_assembly.kb_context_length?.toLocaleString()} chars</span>
            <span>API: {steps.context_assembly.api_context_length?.toLocaleString()} chars</span>
          </div>
          {steps.context_assembly.api_sources?.length > 0 && (
            <div style={{ fontSize: "11px", color: colors.text.muted, marginTop: "3px" }}>
              Sources: {steps.context_assembly.api_sources.join(", ")}
            </div>
          )}
          <ActionBtn onClick={() => setShowContext(!showContext)} style={{ marginTop: "8px" }}>
            <Eye size={11} /> {showContext ? "Hide" : "Show"} Context Preview
          </ActionBtn>
          {showContext && steps.context_assembly.context_preview && (
            <pre style={preStyle}>{steps.context_assembly.context_preview}</pre>
          )}
        </div>
      )}

      {/* Final Answer */}
      {steps.answer_generation?.answer && (
        <div style={{
          padding: "12px", borderRadius: radius.sm,
          backgroundColor: colors.bg.panel,
          border: `1px solid ${colors.border.default}`,
        }}>
          <div style={{
            fontSize: "11px", fontWeight: "600", color: colors.text.muted,
            marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.04em",
          }}>
            Final AI Answer
          </div>
          <div style={{ fontSize: "13px", color: colors.text.primary, lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
            {steps.answer_generation.answer}
          </div>
          <div style={{ marginTop: "6px", fontSize: "10px", color: colors.text.muted }}>
            Note: This is the AI's actual response using the real pipeline.
            Technical execution success ≠ answer accuracy — review the answer content.
          </div>
        </div>
      )}
    </div>
  );
}


// ── Step Row ──────────────────────────────────────────────────────────
function StepRow({ icon, label, status, details, stepKey }) {
  const [expanded, setExpanded] = useState(false);
  const c = STATUS_COLORS[status] || colors.text.muted;
  const hasDetails = details && Object.keys(details).length > 1;

  return (
    <div style={{ marginBottom: "2px" }}>
      <div
        onClick={() => hasDetails && setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "6px 8px", borderRadius: radius.sm,
          cursor: hasDetails ? "pointer" : "default",
          backgroundColor: expanded ? `${c}08` : "transparent",
        }}
      >
        <span style={{ color: c }}>{icon}</span>
        <span style={{ fontSize: "12px", color: colors.text.secondary, flex: 1 }}>{label}</span>
        <StatusBadge status={status} />
        {hasDetails && (
          expanded ? <ChevronDown size={12} color={colors.text.muted} /> :
            <ChevronRight size={12} color={colors.text.muted} />
        )}
      </div>
      {expanded && (
        <div style={{
          marginLeft: "28px", padding: "6px 8px", fontSize: "11px",
          color: colors.text.muted, fontFamily: fonts.mono,
        }}>
          {details.error && <div style={{ color: colors.brand.error }}>{details.error}</div>}
          {details.reason && <div>Reason: {details.reason}</div>}
          {details.context_length != null && <div>Context length: {details.context_length} chars</div>}
          {details.total_endpoints != null && (
            <div>Endpoints: {details.total_endpoints} total, {details.from_target_integration} from this integration</div>
          )}
          {details.action && <div>Action: {details.action}</div>}
          {details.calls?.length > 0 && (
            <div>Calls: {details.calls.map(c => c.endpoint_id?.slice(0, 8)).join(", ")}</div>
          )}
          {details.endpoints?.length > 0 && (
            <div>
              {details.endpoints.map((e, i) => (
                <div key={i}>
                  [{e.endpoint_id?.slice(0, 8)}] permitted: {e.permitted ? "yes" : "no"}
                </div>
              ))}
            </div>
          )}
          {details.endpoints_called != null && (
            <div>Called: {details.endpoints_called}, Successful: {details.successful}</div>
          )}
          {details.details?.length > 0 && (
            <div>
              {details.details.map((d, i) => (
                <div key={i}>
                  {d.method} {d.path}: HTTP {d.http_status} {d.duration_ms}ms
                  {d.doc_source ? ` [${d.doc_source}]` : ""}
                </div>
              ))}
            </div>
          )}
          {details.endpoints_with_schema != null && (
            <div>Endpoints with schema: {details.endpoints_with_schema}</div>
          )}
          {details.preview && <pre style={{ ...preStyle, margin: "4px 0" }}>{details.preview}</pre>}
        </div>
      )}
    </div>
  );
}


const preStyle = {
  marginTop: "8px", padding: "10px", borderRadius: radius.sm,
  backgroundColor: colors.bg.surface, color: colors.text.secondary,
  fontSize: "11px", fontFamily: fonts.mono, whiteSpace: "pre-wrap",
  wordBreak: "break-word", maxHeight: "300px", overflowY: "auto",
  border: `1px solid ${colors.border.muted}`,
};
