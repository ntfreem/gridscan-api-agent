/**
 * Credentials page — AI provider keys and integration credential management.
 * Supports creation, testing, revoking, and scope management.
 */
import { useState, useEffect, useCallback } from "react";
import { useSession } from "../context/SessionContext";
import {
  Key, Plus, Trash2, TestTube, Shield, ChevronDown, ChevronRight,
  Loader2, CheckCircle, XCircle, RotateCcw, Eye, EyeOff, Copy,
} from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur, rowEnter, rowLeave } from "../theme";
import { toast } from "sonner";

const PROVIDER_OPTIONS = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI (GPT)" },
  { value: "zendesk", label: "Zendesk API Token" },
  { value: "generic", label: "Generic API Key" },
];

function CredentialCard({ cred, api, onRefresh }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const r = await api.testCredential(cred.id);
      setTestResult({ ok: true, msg: r.message || r.detail || "Connection successful" });
      toast.success("Connection test passed");
    } catch (err) {
      setTestResult({ ok: false, msg: err.detail || "Test failed" });
      toast.error(err.detail || "Connection test failed");
    } finally { setTesting(false); }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      await api.revokeCredential(cred.id);
      toast.success("Credential revoked"); onRefresh();
    } catch (err) { toast.error(err.detail || "Revoke failed"); }
    finally { setRevoking(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteCredential(cred.id);
      toast.success("Credential deleted"); onRefresh();
    } catch (err) { toast.error(err.detail || "Delete failed"); }
    finally { setDeleting(false); }
  };

  const isRevoked = cred.state === "revoked";

  return (
    <div data-testid={`credential-${cred.id}`} style={{
      ...T.card, padding: "16px 20px", marginBottom: "8px",
      opacity: isRevoked ? 0.6 : 1,
      borderColor: testResult ? (testResult.ok ? "rgba(52,211,153,0.3)" : "rgba(244,63,94,0.3)") : colors.border.default,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}>
        <Key size={16} color={colors.brand.light} />
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
            {cred.name}
          </p>
          <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "2px 0 0", textTransform: "uppercase" }}>
            {cred.provider || cred.kind || "credential"} {isRevoked && "• REVOKED"}
          </p>
        </div>
        {!isRevoked && (
          <button onClick={e => { e.stopPropagation(); handleTest(); }} disabled={testing} data-testid={`test-cred-${cred.id}`}
            style={{ ...T.btnGhost, fontSize: "11px" }}>
            {testing ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <TestTube size={12} />}
            Test
          </button>
        )}
        {expanded ? <ChevronDown size={14} color={colors.text.muted} /> : <ChevronRight size={14} color={colors.text.muted} />}
      </div>

      {testResult && (
        <div style={{
          marginTop: "8px", padding: "8px 12px", borderRadius: radius.sm,
          backgroundColor: testResult.ok ? "rgba(52,211,153,0.08)" : "rgba(244,63,94,0.08)",
          border: `1px solid ${testResult.ok ? "rgba(52,211,153,0.2)" : "rgba(244,63,94,0.2)"}`,
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          {testResult.ok ? <CheckCircle size={14} color={colors.brand.success} /> : <XCircle size={14} color={colors.brand.error} />}
          <span style={{ fontFamily: fonts.body, fontSize: "12px", color: testResult.ok ? colors.brand.success : colors.brand.error }}>
            {testResult.msg}
          </span>
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${colors.border.muted}` }}>
          <p style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.muted, margin: "0 0 4px" }}>
            ID: {cred.id}
          </p>
          {cred.created_at && (
            <p style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.muted, margin: "0 0 4px" }}>
              Created: {new Date(cred.created_at).toLocaleDateString()}
            </p>
          )}
          {cred.scope && (
            <p style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.muted, margin: "0 0 8px" }}>
              Scope: {JSON.stringify(cred.scope)}
            </p>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            {!isRevoked && (
              <button onClick={handleRevoke} disabled={revoking}
                style={{ ...T.btnGhost, color: colors.brand.warning, borderColor: "rgba(251,191,36,0.3)", fontSize: "11px" }}>
                <RotateCcw size={11} /> {revoking ? "Revoking..." : "Revoke"}
              </button>
            )}
            <button onClick={handleDelete} disabled={deleting}
              style={{ ...T.btnGhost, color: colors.brand.error, borderColor: "rgba(244,63,94,0.3)", fontSize: "11px" }}>
              <Trash2 size={11} /> {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CredentialsPage() {
  const { selectedOrg, selectedEnterprise, api } = useSession();
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [creating, setCreating] = useState(false);
  const [scope, setScope] = useState("organisation");

  const ownerId = scope === "enterprise" ? selectedEnterprise?.id : selectedOrg?.id;
  const ownerType = scope === "enterprise" ? "enterprise" : "organisation";

  const fetchCreds = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const data = await api.credentials(ownerType, ownerId);
      setCredentials(data.credentials || data || []);
    } catch { setCredentials([]); }
    finally { setLoading(false); }
  }, [ownerId, ownerType, api]);

  useEffect(() => { fetchCreds(); }, [fetchCreds]);

  const handleCreate = async () => {
    if (!name.trim() || !apiKey.trim() || !ownerId) return;
    setCreating(true);
    try {
      await api.createCredential(ownerType, ownerId, { name: name.trim(), provider, api_key: apiKey.trim() });
      toast.success(`Credential "${name.trim()}" created`);
      setName(""); setApiKey(""); setShowCreate(false);
      fetchCreds();
    } catch (err) { toast.error(err.detail || "Failed to create credential"); }
    finally { setCreating(false); }
  };

  if (!selectedOrg && !selectedEnterprise) {
    return (
      <div style={{ ...T.page, textAlign: "center", paddingTop: "80px" }}>
        <Key size={32} color={colors.border.default} style={{ margin: "0 auto 12px" }} />
        <p style={{ fontFamily: fonts.heading, fontSize: "18px", fontWeight: "600", color: colors.text.primary }}>Select an enterprise or organisation</p>
      </div>
    );
  }

  return (
    <div style={T.page} data-testid="credentials-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <p style={T.overline}>AI & Integration Keys</p>
          <h1 style={{ ...T.h1, marginBottom: 0 }}>Credentials</h1>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select value={scope} onChange={e => setScope(e.target.value)} data-testid="cred-scope-select"
            style={{ ...T.input, width: "auto", padding: "8px 12px", fontSize: "12px" }}>
            <option value="organisation">Organisation</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <button onClick={() => setShowCreate(true)} data-testid="create-credential-btn" style={T.btnPrimary}>
            <Plus size={14} /> New Credential
          </button>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        }} onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div data-testid="create-credential-modal" style={{
            width: "440px", backgroundColor: colors.bg.panel, borderRadius: "16px",
            border: `1px solid ${colors.border.default}`, padding: "28px",
          }}>
            <h2 style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: "0 0 16px" }}>
              New Credential
            </h2>
            <label style={T.label}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} data-testid="cred-name"
              placeholder="e.g. My Claude Key" style={{ ...T.input, marginBottom: "12px" }} onFocus={onFocus} onBlur={onBlur} />
            <label style={T.label}>Provider</label>
            <select value={provider} onChange={e => setProvider(e.target.value)} data-testid="cred-provider"
              style={{ ...T.input, marginBottom: "12px" }}>
              {PROVIDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <label style={T.label}>API Key</label>
            <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" data-testid="cred-api-key"
              placeholder="sk-..." style={{ ...T.input, marginBottom: "16px" }} onFocus={onFocus} onBlur={onBlur} />
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowCreate(false)} style={T.btnGhost}>Cancel</button>
              <button onClick={handleCreate} disabled={creating || !name.trim() || !apiKey.trim()} data-testid="confirm-create-cred"
                style={{ ...T.btnPrimary, opacity: creating || !name.trim() || !apiKey.trim() ? 0.6 : 1 }}>
                {creating ? "Creating..." : "Create Credential"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <Loader2 size={20} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : credentials.length === 0 ? (
        <div style={{ ...T.card, textAlign: "center", padding: "48px 24px" }}>
          <Key size={32} color={colors.border.default} style={{ margin: "0 auto 12px" }} />
          <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "600", color: colors.text.primary, margin: "0 0 6px" }}>
            No credentials yet
          </p>
          <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary }}>
            Add AI provider keys to enable your bots.
          </p>
        </div>
      ) : (
        credentials.map(c => <CredentialCard key={c.id} cred={c} api={api} onRefresh={fetchCreds} />)
      )}
    </div>
  );
}
