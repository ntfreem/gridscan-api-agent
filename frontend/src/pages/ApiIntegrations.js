import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import {
  Plus, Trash2, Edit2, Save, X, RefreshCw, Play, ChevronDown, ChevronRight,
  Globe, Key, Lock, Zap, Search, ToggleLeft, ToggleRight, Activity,
  FileText, AlertTriangle, CheckCircle, XCircle, ExternalLink, Copy, Eye, EyeOff
} from "lucide-react";
import { colors, fonts, T, radius, onFocus, onBlur } from "../theme";

const AUTH_TYPES = [
  { value: "none", label: "No Authentication" },
  { value: "api_key_header", label: "API Key in Header" },
  { value: "bearer", label: "Bearer Token" },
  { value: "api_key_query", label: "API Key in Query Param" },
];

const DOC_TYPES = [
  { value: "openapi", label: "OpenAPI / Swagger" },
  { value: "custom_reference", label: "Custom Reference (JSON)" },
  { value: "manual", label: "Manual (no auto-discovery)" },
];

const EMPTY_FORM = {
  name: "", description: "", base_url: "",
  auth_type: "none", auth_header_name: "", auth_query_param: "", auth_value: "",
  doc_source_type: "openapi", doc_source_url: "", enabled: true,
};

// ── Badge ──────────────────────────────────────────────────────────────
function Badge({ children, color = colors.brand.primary, bg }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      padding: "2px 8px", borderRadius: radius.full,
      backgroundColor: bg || `${color}18`, color,
      fontFamily: fonts.mono, fontSize: "10px", fontWeight: "600",
      letterSpacing: "0.04em", lineHeight: "18px",
    }}>
      {children}
    </span>
  );
}

// ── StatusDot ──────────────────────────────────────────────────────────
function StatusDot({ ok }) {
  const c = ok ? colors.brand.success : colors.text.muted;
  return <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: c, display: "inline-block", boxShadow: ok ? `0 0 6px ${c}` : "none" }} />;
}

// ── IntegrationForm ────────────────────────────────────────────────────
function IntegrationForm({ initial, onSave, onCancel, saving }) {
  const [f, setF] = useState(initial || EMPTY_FORM);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const [showKey, setShowKey] = useState(false);

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div>
          <label style={T.label}>Integration Name *</label>
          <input data-testid="intg-name" style={T.input} value={f.name} onChange={e => set("name", e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="e.g. Cardano Koios" />
        </div>
        <div>
          <label style={T.label}>Base URL *</label>
          <input data-testid="intg-base-url" style={T.input} value={f.base_url} onChange={e => set("base_url", e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="https://api.example.com" />
        </div>
      </div>
      <div>
        <label style={T.label}>Description</label>
        <input style={T.input} value={f.description} onChange={e => set("description", e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="What does this API do?" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div>
          <label style={T.label}>Authentication Type</label>
          <select data-testid="intg-auth-type" style={{ ...T.input, cursor: "pointer" }} value={f.auth_type} onChange={e => set("auth_type", e.target.value)}>
            {AUTH_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {f.auth_type === "api_key_header" && (
          <div>
            <label style={T.label}>Header Name</label>
            <input style={T.input} value={f.auth_header_name} onChange={e => set("auth_header_name", e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="e.g. x-api-key" />
          </div>
        )}
        {f.auth_type === "api_key_query" && (
          <div>
            <label style={T.label}>Query Parameter Name</label>
            <input style={T.input} value={f.auth_query_param} onChange={e => set("auth_query_param", e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="e.g. api_key" />
          </div>
        )}
      </div>
      {f.auth_type !== "none" && (
        <div>
          <label style={T.label}>API Key / Token {initial ? "(leave blank to keep existing)" : ""}</label>
          <div style={{ position: "relative" }}>
            <input data-testid="intg-auth-value" style={{ ...T.input, paddingRight: "40px" }} type={showKey ? "text" : "password"} value={f.auth_value} onChange={e => set("auth_value", e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder={initial?.auth_value_set ? "Saved (enter new to replace)" : "Enter API key"} autoComplete="new-password" />
            <button onClick={() => setShowKey(!showKey)} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
              {showKey ? <EyeOff size={14} color={colors.text.muted} /> : <Eye size={14} color={colors.text.muted} />}
            </button>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div>
          <label style={T.label}>Documentation Type</label>
          <select data-testid="intg-doc-type" style={{ ...T.input, cursor: "pointer" }} value={f.doc_source_type} onChange={e => set("doc_source_type", e.target.value)}>
            {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {f.doc_source_type !== "manual" && (
          <div>
            <label style={T.label}>Documentation URL</label>
            <input style={T.input} value={f.doc_source_url} onChange={e => set("doc_source_url", e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="https://api.example.com/openapi.json" />
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        {onCancel && <button data-testid="intg-cancel" style={T.btnGhost} onClick={onCancel}><X size={14} /> Cancel</button>}
        <button data-testid="intg-save" style={{ ...T.btnPrimary, opacity: saving ? 0.6 : 1 }} disabled={saving || !f.name.trim() || !f.base_url.trim()} onClick={() => onSave(f)}>
          <Save size={14} /> {saving ? "Saving..." : initial ? "Update" : "Add Integration"}
        </button>
      </div>
    </div>
  );
}

// ── Schema Viewer ──────────────────────────────────────────────────────
function SchemaViewer({ schema, title }) {
  const [open, setOpen] = useState(false);
  if (!schema || (typeof schema === "object" && Object.keys(schema).length === 0)) return null;
  return (
    <div style={{ marginTop: "8px" }}>
      <button onClick={() => setOpen(!open)} style={{ ...T.btnGhost, fontSize: "11px", padding: "4px 8px", gap: "4px" }}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && (
        <pre style={{
          marginTop: "6px", padding: "10px 14px",
          backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.muted}`,
          borderRadius: radius.md, fontSize: "11px", fontFamily: fonts.mono,
          color: colors.text.secondary, overflow: "auto", maxHeight: "300px",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {typeof schema === "string" ? schema : JSON.stringify(schema, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Endpoint Row ────────────────────────────────────────────────────────
function EndpointRow({ ep, integrationId, onToggle, onTest }) {
  const [expanded, setExpanded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [params, setParams] = useState({});

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const r = await api.post("/integrations/test-endpoint", {
        integration_id: integrationId,
        endpoint_id: ep.id,
        parameters: params,
      });
      setTestResult(r.data);
    } catch (e) {
      setTestResult({ success: false, error: e.response?.data?.detail || e.message });
    } finally { setTesting(false); }
  };

  const methodColor = {
    GET: colors.brand.success, POST: colors.brand.primary,
    PUT: colors.brand.warning, DELETE: colors.brand.error,
    PATCH: "#A78BFA",
  }[ep.method] || colors.text.muted;

  return (
    <div data-testid={`endpoint-row-${ep.id}`} style={{
      border: `1px solid ${colors.border.muted}`, borderRadius: radius.md,
      marginBottom: "6px", overflow: "hidden",
      backgroundColor: ep.enabled ? "transparent" : "rgba(100,116,139,0.04)",
    }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "10px 14px", cursor: "pointer",
          transition: "background-color 0.15s",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={14} color={colors.text.muted} /> : <ChevronRight size={14} color={colors.text.muted} />}
        <Badge color={methodColor}>{ep.method}</Badge>
        <span style={{ fontFamily: fonts.mono, fontSize: "12px", color: colors.text.primary, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ep.path}
        </span>
        <span style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ep.summary}
        </span>
        {ep.category && ep.category !== "uncategorized" && (
          <Badge color={colors.text.muted}>{ep.category}</Badge>
        )}
        <button
          data-testid={`toggle-ep-${ep.id}`}
          onClick={e => { e.stopPropagation(); onToggle(ep.id, !ep.enabled); }}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "2px" }}
          title={ep.enabled ? "Disable" : "Enable"}
        >
          {ep.enabled ? <ToggleRight size={20} color={colors.brand.success} /> : <ToggleLeft size={20} color={colors.text.muted} />}
        </button>
      </div>

      {expanded && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${colors.border.muted}` }}>
          {ep.description && (
            <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: "10px 0 6px" }}>
              {ep.description}
            </p>
          )}
          {/* Parameters */}
          {ep.parameters?.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <p style={{ ...T.monoLabel, marginBottom: "6px" }}>Parameters</p>
              <div style={{ display: "grid", gap: "6px" }}>
                {ep.parameters.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontFamily: fonts.body }}>
                    <Badge color={p.required ? colors.brand.error : colors.text.muted}>
                      {p.in}
                    </Badge>
                    <span style={{ fontFamily: fonts.mono, color: colors.text.primary, fontWeight: "500" }}>{p.name}</span>
                    <span style={{ color: colors.text.muted }}>({p.type})</span>
                    {p.required && <span style={{ color: colors.brand.error, fontSize: "10px" }}>required</span>}
                    {p.description && <span style={{ color: colors.text.muted, flex: 1 }}>— {p.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Response Schema */}
          {Object.keys(ep.response_schema || {}).length > 0 && (
            <SchemaViewer schema={ep.response_schema} title="Response Schema" />
          )}
          {/* Response Examples */}
          {Object.keys(ep.response_examples || {}).length > 0 && (
            <SchemaViewer schema={ep.response_examples} title="Example Response" />
          )}
          {/* Error Responses */}
          {Object.keys(ep.error_responses || {}).length > 0 && (
            <SchemaViewer schema={ep.error_responses} title="Error Codes" />
          )}
          {/* Test Section */}
          {ep.enabled && ep.executable && (
            <div style={{ marginTop: "12px", padding: "12px", backgroundColor: colors.bg.panel, borderRadius: radius.md }}>
              <p style={{ ...T.monoLabel, marginBottom: "8px" }}>Test Endpoint</p>
              {ep.parameters?.filter(p => p.required || p.in === "path").map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <label style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.secondary, minWidth: "100px" }}>{p.name}:</label>
                  <input
                    style={{ ...T.input, padding: "6px 10px", fontSize: "12px" }}
                    value={params[p.name] || ""}
                    onChange={e => setParams(prev => ({ ...prev, [p.name]: e.target.value }))}
                    placeholder={p.description || p.name}
                    onFocus={onFocus} onBlur={onBlur}
                  />
                </div>
              ))}
              <button
                data-testid={`test-ep-${ep.id}`}
                style={{ ...T.btnGhost, marginTop: "6px", opacity: testing ? 0.6 : 1 }}
                onClick={handleTest} disabled={testing}
              >
                <Play size={12} /> {testing ? "Running..." : "Run Test"}
              </button>
              {testResult && (
                <div style={{
                  marginTop: "8px", padding: "10px", borderRadius: radius.md,
                  backgroundColor: testResult.success ? "rgba(52,211,153,0.06)" : "rgba(244,63,94,0.06)",
                  border: `1px solid ${testResult.success ? "rgba(52,211,153,0.2)" : "rgba(244,63,94,0.2)"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    {testResult.success ? <CheckCircle size={13} color={colors.brand.success} /> : <XCircle size={13} color={colors.brand.error} />}
                    <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: testResult.success ? colors.brand.success : colors.brand.error }}>
                      HTTP {testResult.status || "ERR"} — {testResult.duration_ms || 0}ms
                    </span>
                  </div>
                  {testResult.error && <p style={{ fontSize: "11px", color: colors.brand.error, margin: "4px 0 0" }}>{testResult.error}</p>}
                  {!testResult.success && !testResult.error && (
                    <p style={{ fontSize: "11px", color: colors.brand.error, margin: "4px 0 0" }}>
                      HTTP {testResult.status || "?"} — The API returned an error. Check the response below for details.
                    </p>
                  )}
                  {testResult.data && (
                    <pre style={{
                      marginTop: "6px", padding: "8px", backgroundColor: colors.bg.base,
                      borderRadius: radius.sm, fontSize: "10px", fontFamily: fonts.mono,
                      color: colors.text.secondary, overflow: "auto", maxHeight: "200px",
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                    }}>
                      {typeof testResult.data === "string" ? testResult.data : JSON.stringify(testResult.data, null, 2).slice(0, 5000)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Integration Card ────────────────────────────────────────────────────
function IntegrationCard({ intg, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEndpoints, setShowEndpoints] = useState(false);
  const [endpoints, setEndpoints] = useState([]);
  const [epCategories, setEpCategories] = useState([]);
  const [epFilter, setEpFilter] = useState("");
  const [epSearch, setEpSearch] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [connTesting, setConnTesting] = useState(false);
  const [connResult, setConnResult] = useState(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activity, setActivity] = useState(null);
  const [stats, setStats] = useState(null);

  const loadEndpoints = useCallback(async () => {
    try {
      const r = await api.get(`/integrations/${intg.id}/endpoints`, {
        params: { ...(epFilter ? { category: epFilter } : {}), ...(epSearch ? { search: epSearch } : {}) }
      });
      setEndpoints(r.data.endpoints || []);
      setEpCategories(r.data.categories || []);
    } catch { }
  }, [intg.id, epFilter, epSearch]);

  useEffect(() => {
    if (showEndpoints) loadEndpoints();
  }, [showEndpoints, loadEndpoints]);

  const handleUpdate = async (form) => {
    setSaving(true);
    try {
      await api.put(`/integrations/${intg.id}`, form);
      toast.success("Integration updated");
      setEditing(false);
      onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Update failed");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${intg.name}" and all its endpoints?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/integrations/${intg.id}`);
      toast.success("Integration deleted");
      onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Delete failed");
    } finally { setDeleting(false); }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const r = await api.post(`/integrations/${intg.id}/discover`);
      toast.success(`Discovered ${r.data.total} endpoints (${r.data.new} new, ${r.data.updated} updated)`);
      loadEndpoints();
      onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Discovery failed");
    } finally { setDiscovering(false); }
  };

  const handleConnTest = async () => {
    setConnTesting(true); setConnResult(null);
    try {
      const r = await api.post(`/integrations/${intg.id}/test-connection`);
      setConnResult(r.data);
    } catch (e) {
      setConnResult({ success: false, error: e.response?.data?.detail || e.message });
    } finally { setConnTesting(false); }
  };

  const toggleEndpoint = async (epId, enabled) => {
    try {
      await api.put(`/integrations/${intg.id}/endpoints/${epId}`, { enabled });
      setEndpoints(prev => prev.map(e => e.id === epId ? { ...e, enabled } : e));
    } catch (e) {
      toast.error("Toggle failed");
    }
  };

  const loadActivity = async () => {
    if (activityOpen) { setActivityOpen(false); return; }
    try {
      const [logsR, statsR] = await Promise.all([
        api.get(`/integrations/${intg.id}/activity?limit=20`),
        api.get(`/integrations/${intg.id}/stats`),
      ]);
      setActivity(logsR.data.logs || []);
      setStats(statsR.data || {});
      setActivityOpen(true);
    } catch { toast.error("Failed to load activity"); }
  };

  return (
    <div data-testid={`integration-card-${intg.id}`} style={{
      ...T.card, marginBottom: "16px",
      borderColor: intg.enabled ? colors.border.default : colors.border.muted,
      opacity: intg.enabled ? 1 : 0.75,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: editing ? "16px" : "0" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: radius.md,
          background: `linear-gradient(135deg, ${colors.brand.primary}30, ${colors.brand.light}20)`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Globe size={18} color={colors.brand.light} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h3 style={{ ...T.sectionTitle, margin: 0 }}>{intg.name}</h3>
            <StatusDot ok={intg.enabled} />
            {intg.auth_value_set && <Badge color={colors.brand.success}><Lock size={9} /> Auth</Badge>}
            <Badge color={colors.text.muted}>{intg.endpoint_count || 0} endpoints</Badge>
            {intg.enabled_endpoint_count > 0 && (
              <Badge color={colors.brand.success}>{intg.enabled_endpoint_count} active</Badge>
            )}
          </div>
          <p style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.muted, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {intg.base_url}
          </p>
        </div>
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          <button data-testid={`intg-test-conn-${intg.id}`} style={T.btnGhost} onClick={handleConnTest} disabled={connTesting} title="Test Connection">
            <Zap size={13} /> {connTesting ? "..." : "Test"}
          </button>
          {intg.doc_source_type !== "manual" && (
            <button data-testid={`intg-discover-${intg.id}`} style={T.btnGhost} onClick={handleDiscover} disabled={discovering} title="Discover Endpoints">
              <RefreshCw size={13} style={discovering ? { animation: "spin 1s linear infinite" } : {}} /> {discovering ? "..." : "Discover"}
            </button>
          )}
          <button style={T.btnGhost} onClick={() => setShowEndpoints(!showEndpoints)} title="View Endpoints">
            <FileText size={13} /> Endpoints
          </button>
          <button style={T.btnGhost} onClick={loadActivity} title="Activity Log">
            <Activity size={13} />
          </button>
          <button style={T.btnGhost} onClick={() => setEditing(!editing)}>
            <Edit2 size={13} />
          </button>
          <button style={{ ...T.btnGhost, borderColor: "rgba(244,63,94,0.3)", color: colors.brand.error }} onClick={handleDelete} disabled={deleting}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Connection Test Result */}
      {connResult && (
        <div style={{
          marginTop: "10px", padding: "10px 14px", borderRadius: radius.md,
          backgroundColor: connResult.success ? "rgba(52,211,153,0.06)" : "rgba(244,63,94,0.06)",
          border: `1px solid ${connResult.success ? "rgba(52,211,153,0.2)" : "rgba(244,63,94,0.2)"}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {connResult.success ? <CheckCircle size={14} color={colors.brand.success} /> : <XCircle size={14} color={colors.brand.error} />}
            <span style={{ fontFamily: fonts.body, fontSize: "12px", color: connResult.success ? colors.brand.success : colors.brand.error, fontWeight: "500" }}>
              {connResult.success
                ? `Connected (HTTP ${connResult.status}, ${connResult.duration_ms}ms)`
                : `Failed: ${connResult.error || `HTTP ${connResult.status || "unknown"} — server returned an error`}`}
            </span>
          </div>
          {/* Diagnostics: what was tested */}
          {connResult.tested_url && (
            <div style={{ marginTop: "6px", fontSize: "11px", fontFamily: fonts.mono, color: colors.text.muted }}>
              Tested: {connResult.tested_label || connResult.tested_url}
              {connResult.probes_tried > 1 && ` (${connResult.probes_tried} probes tried)`}
            </div>
          )}
          {/* Probe details on failure */}
          {!connResult.success && connResult.probe_details?.length > 0 && (
            <div style={{ marginTop: "8px", fontSize: "10px", fontFamily: fonts.mono }}>
              {connResult.probe_details.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 0", color: colors.text.muted }}>
                  {p.success
                    ? <CheckCircle size={10} color={colors.brand.success} />
                    : <XCircle size={10} color={colors.text.muted} />}
                  <span>{p.label}</span>
                  <span style={{ color: p.success ? colors.brand.success : colors.text.muted }}>
                    HTTP {p.status || "ERR"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Form */}
      {editing && (
        <div style={{ marginTop: "16px", padding: "16px", backgroundColor: colors.bg.panel, borderRadius: radius.md }}>
          <IntegrationForm initial={intg} onSave={handleUpdate} onCancel={() => setEditing(false)} saving={saving} />
        </div>
      )}

      {/* Endpoints Panel */}
      {showEndpoints && (
        <div style={{ marginTop: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={14} color={colors.text.muted} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                data-testid="ep-search"
                style={{ ...T.input, paddingLeft: "32px", fontSize: "12px", padding: "7px 10px 7px 32px" }}
                placeholder="Search endpoints..." value={epSearch}
                onChange={e => setEpSearch(e.target.value)} onFocus={onFocus} onBlur={onBlur}
              />
            </div>
            {epCategories.length > 1 && (
              <select
                data-testid="ep-category-filter"
                style={{ ...T.input, width: "auto", fontSize: "12px", padding: "7px 10px", cursor: "pointer" }}
                value={epFilter} onChange={e => { setEpFilter(e.target.value); }}
              >
                <option value="">All Categories</option>
                {epCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
          {endpoints.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px", color: colors.text.muted, fontSize: "13px" }}>
              No endpoints found. {intg.doc_source_type !== "manual" ? "Click \"Discover\" to fetch from API docs." : "Add endpoints manually."}
            </div>
          ) : (
            endpoints.map(ep => (
              <EndpointRow key={ep.id} ep={ep} integrationId={intg.id} onToggle={toggleEndpoint} />
            ))
          )}
        </div>
      )}

      {/* Activity Panel */}
      {activityOpen && (
        <div style={{ marginTop: "14px" }}>
          {stats && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "12px" }}>
              {[
                { label: "Total Requests", value: stats.total_requests || 0, color: colors.brand.primary },
                { label: "Successful", value: stats.successful || 0, color: colors.brand.success },
                { label: "Failed", value: stats.failed || 0, color: colors.brand.error },
                { label: "Avg Response", value: `${stats.avg_duration || 0}ms`, color: colors.brand.warning },
              ].map(s => (
                <div key={s.label} style={{
                  padding: "12px", backgroundColor: colors.bg.panel, borderRadius: radius.md,
                  border: `1px solid ${colors.border.muted}`,
                }}>
                  <p style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>{s.label}</p>
                  <p style={{ fontFamily: fonts.heading, fontSize: "20px", fontWeight: "700", color: s.color, margin: 0 }}>{s.value}</p>
                </div>
              ))}
            </div>
          )}
          {activity && activity.length > 0 ? (
            <div style={{ maxHeight: "250px", overflowY: "auto" }}>
              {activity.map((log, i) => (
                <div key={log.id || i} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "6px 10px", fontSize: "11px", fontFamily: fonts.mono,
                  borderBottom: `1px solid ${colors.border.muted}`,
                  color: log.success ? colors.text.secondary : colors.brand.error,
                }}>
                  {log.success ? <CheckCircle size={11} color={colors.brand.success} /> : <XCircle size={11} color={colors.brand.error} />}
                  <span style={{ color: colors.text.muted }}>{new Date(log.timestamp).toLocaleString()}</span>
                  <span>HTTP {log.http_status}</span>
                  <span>{log.duration_ms}ms</span>
                  {log.error_category && <span style={{ color: colors.brand.error }}>{log.error_category}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ textAlign: "center", color: colors.text.muted, fontSize: "12px", padding: "16px" }}>No activity recorded yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════
export default function ApiIntegrations() {
  const { selectedInstance } = useAuth();
  const instanceId = selectedInstance?.id;
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);

  const loadIntegrations = useCallback(async () => {
    if (!instanceId) return;
    setLoading(true);
    try {
      const r = await api.get("/integrations");
      setIntegrations(r.data || []);
    } catch { }
    finally { setLoading(false); }
  }, [instanceId]);

  useEffect(() => { loadIntegrations(); }, [loadIntegrations]);

  const handleAdd = async (form) => {
    setAdding(true);
    try {
      await api.post("/integrations", form);
      toast.success("Integration added");
      setShowAdd(false);
      loadIntegrations();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to add integration");
    } finally { setAdding(false); }
  };

  if (!instanceId) {
    return (
      <div style={T.page}>
        <p style={T.overline}>API Integrations</p>
        <h1 style={T.h1}>API Integrations</h1>
        <div style={{ ...T.card, textAlign: "center", padding: "48px" }}>
          <Globe size={40} color={colors.text.muted} style={{ marginBottom: "12px" }} />
          <p style={{ color: colors.text.secondary, fontSize: "14px" }}>Select a workspace first to manage API integrations.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={T.page} data-testid="api-integrations-page">
      <p style={T.overline}>API Integrations</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <h1 style={{ ...T.h1, margin: 0 }}>API Integrations</h1>
        <button
          data-testid="add-integration-btn"
          style={T.btnPrimary}
          onClick={() => setShowAdd(!showAdd)}
        >
          {showAdd ? <X size={14} /> : <Plus size={14} />}
          {showAdd ? "Cancel" : "Add Integration"}
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div style={{ ...T.card, marginBottom: "20px" }}>
          <h3 style={{ ...T.sectionTitle, marginBottom: "16px" }}>New API Integration</h3>
          <IntegrationForm onSave={handleAdd} onCancel={() => setShowAdd(false)} saving={adding} />
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px", color: colors.text.muted }}>Loading...</div>
      ) : integrations.length === 0 ? (
        <div style={{ ...T.card, textAlign: "center", padding: "48px" }}>
          <Globe size={40} color={colors.text.muted} style={{ marginBottom: "12px" }} />
          <p style={{ color: colors.text.secondary, fontSize: "14px", marginBottom: "4px" }}>No API integrations configured yet.</p>
          <p style={{ color: colors.text.muted, fontSize: "12px" }}>Add an integration to enable live API queries in chat responses.</p>
        </div>
      ) : (
        integrations.map(intg => (
          <IntegrationCard key={intg.id} intg={intg} onRefresh={loadIntegrations} />
        ))
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
