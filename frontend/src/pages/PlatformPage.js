/**
 * Platform Superadmin — enterprise management, platform credentials, users, audit.
 */
import { useState, useEffect, useCallback } from "react";
import { useSession } from "../context/SessionContext";
import { useNavigate } from "react-router-dom";
import {
  Shield, Building2, Key, Users, Search, Loader2, Plus, Trash2,
  CheckCircle, XCircle, Crown, FileText, Zap, ArrowRight,
} from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur, rowEnter, rowLeave } from "../theme";
import { toast } from "sonner";

function TabBtn({ active, label, onClick, testId }) {
  return (
    <button onClick={onClick} data-testid={testId} style={{
      padding: "8px 16px", borderRadius: radius.md, border: "none", cursor: "pointer",
      fontFamily: fonts.body, fontSize: "13px", fontWeight: active ? "600" : "400",
      color: active ? colors.brand.light : colors.text.secondary,
      backgroundColor: active ? "rgba(59,130,246,0.1)" : "transparent", transition: "all 0.15s",
    }}>{label}</button>
  );
}

function EnterprisesTab({ api }) {
  const navigate = useNavigate();
  const { enterprises, refreshEnterprises } = useSession();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.createEnterprise({ name: name.trim() });
      toast.success(`Enterprise "${name.trim()}" created`);
      setName(""); setShowCreate(false);
      refreshEnterprises();
    } catch (err) { toast.error(err.detail || "Failed"); }
    finally { setCreating(false); }
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
        <button onClick={() => setShowCreate(true)} data-testid="create-enterprise-btn" style={T.btnPrimary}>
          <Plus size={14} /> New Enterprise
        </button>
      </div>
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div style={{ width: "400px", backgroundColor: colors.bg.panel, borderRadius: "16px", border: `1px solid ${colors.border.default}`, padding: "28px" }}>
            <h2 style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: "0 0 16px" }}>New Enterprise</h2>
            <label style={T.label}>Enterprise Name</label>
            <input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="e.g. Acme Corp"
              style={{ ...T.input, marginBottom: "16px" }} onFocus={onFocus} onBlur={onBlur} onKeyDown={e => e.key === "Enter" && handleCreate()} />
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowCreate(false)} style={T.btnGhost}>Cancel</button>
              <button onClick={handleCreate} disabled={creating || !name.trim()} style={{ ...T.btnPrimary, opacity: creating || !name.trim() ? 0.6 : 1 }}>
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gap: "8px" }}>
        {enterprises.map(ent => (
          <div key={ent.id} style={{ ...T.card, display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", cursor: "pointer", transition: "all 0.2s" }}
            onClick={() => navigate(`/admin/platform/enterprises/${ent.id}/discord`)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = colors.brand.light; }} onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border.default; }}>
            <Building2 size={16} color={colors.brand.light} />
            <span style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: "600", color: colors.text.primary, flex: 1 }}>{ent.name}</span>
            <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>{ent.id?.substring(0, 8)}</span>
            <ArrowRight size={13} color={colors.text.muted} />
          </div>
        ))}
      </div>
    </>
  );
}

function PlatformUsersTab({ api }) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = async (q) => {
    setQuery(q);
    if (q.length < 2) { setUsers([]); return; }
    setLoading(true);
    try {
      const data = await api.platformUsers(q);
      setUsers(data.users || data || []);
    } catch { setUsers([]); }
    finally { setLoading(false); }
  };

  const toggleSuperadmin = async (userId, grant) => {
    try {
      await api.setSuperadmin(userId, grant);
      toast.success(grant ? "Superadmin granted" : "Superadmin revoked");
      search(query);
    } catch (err) { toast.error(err.detail || "Failed"); }
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <Search size={14} color={colors.text.muted} />
        <input value={query} onChange={e => search(e.target.value)} placeholder="Search users by email..." data-testid="platform-user-search"
          style={{ ...T.input, flex: 1 }} onFocus={onFocus} onBlur={onBlur} />
      </div>
      {loading && <div style={{ textAlign: "center", padding: "20px" }}><Loader2 size={16} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} /></div>}
      {users.length > 0 && (
        <div style={T.card}>
          {users.map((u, i) => (
            <div key={u.id || i} style={{
              display: "flex", alignItems: "center", gap: "12px", padding: "10px 0",
              borderBottom: i < users.length - 1 ? `1px solid ${colors.border.muted}` : "none",
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "500", color: colors.text.primary, margin: 0 }}>{u.name || u.email}</p>
                <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "1px 0 0" }}>{u.email} • {u.platform_role || "user"}</p>
              </div>
              {u.platform_role === "superadmin" ? (
                <button onClick={() => toggleSuperadmin(u.id, false)} style={{ ...T.btnGhost, color: colors.brand.warning, borderColor: "rgba(251,191,36,0.3)", fontSize: "11px" }}>
                  <Crown size={11} /> Revoke SA
                </button>
              ) : (
                <button onClick={() => toggleSuperadmin(u.id, true)} style={{ ...T.btnGhost, fontSize: "11px" }}>
                  <Crown size={11} /> Grant SA
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function AuditTab({ api }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.platformAudit(100).then(d => setLogs(d.events || d || [])).catch(() => setLogs([])).finally(() => setLoading(false));
  }, [api]);

  if (loading) return <div style={{ textAlign: "center", padding: "40px" }}><Loader2 size={16} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} /></div>;

  return logs.length === 0 ? (
    <div style={{ ...T.card, textAlign: "center", padding: "32px" }}>
      <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.muted }}>No audit events.</p>
    </div>
  ) : (
    <div style={T.card}>
      <div style={{ maxHeight: "500px", overflowY: "auto" }}>
        {logs.map((ev, i) => (
          <div key={ev.id || i} style={{
            padding: "8px 0", borderBottom: i < logs.length - 1 ? `1px solid ${colors.border.muted}` : "none",
            fontFamily: fonts.body, fontSize: "12px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, flexShrink: 0 }}>
                {ev.created_at ? new Date(ev.created_at).toLocaleString() : "—"}
              </span>
              <span style={{ color: colors.text.primary, fontWeight: "500" }}>{ev.action || ev.event_type || ev.type}</span>
            </div>
            {(ev.actor_email || ev.detail) && (
              <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "2px 0 0 0" }}>
                {ev.actor_email && `by ${ev.actor_email}`} {ev.detail && `— ${ev.detail}`}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkersTab({ api }) {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.platformWorkers().then(d => setWorkers(d.workers || d || [])).catch(() => setWorkers([])).finally(() => setLoading(false));
  }, [api]);

  if (loading) return <div style={{ textAlign: "center", padding: "40px" }}><Loader2 size={16} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} /></div>;

  return workers.length === 0 ? (
    <div style={{ ...T.card, textAlign: "center", padding: "32px" }}>
      <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.muted }}>No active workers.</p>
    </div>
  ) : (
    <div style={T.card}>
      {workers.map((w, i) => (
        <div key={w.id || i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: i < workers.length - 1 ? `1px solid ${colors.border.muted}` : "none" }}>
          <span style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.primary, flex: 1 }}>{w.name || w.id}</span>
          <span style={{
            fontFamily: fonts.mono, fontSize: "10px", fontWeight: "600", padding: "2px 8px", borderRadius: radius.full,
            color: w.status === "running" ? colors.brand.success : colors.text.muted,
            backgroundColor: w.status === "running" ? "rgba(52,211,153,0.08)" : "rgba(148,163,184,0.08)",
          }}>{w.status || "idle"}</span>
        </div>
      ))}
    </div>
  );
}

export default function PlatformPage() {
  const { isSuperAdmin, api } = useSession();
  const [tab, setTab] = useState("enterprises");

  if (!isSuperAdmin) {
    return (
      <div style={{ ...T.page, textAlign: "center", paddingTop: "80px" }}>
        <Shield size={36} color={colors.border.default} style={{ margin: "0 auto 12px" }} />
        <p style={{ fontFamily: fonts.heading, fontSize: "18px", fontWeight: "600", color: colors.text.primary }}>Platform Admin access required</p>
        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary }}>You need superadmin permissions to access this page.</p>
      </div>
    );
  }

  return (
    <div style={T.page} data-testid="platform-page">
      <p style={T.overline}>Superadmin</p>
      <h1 style={T.h1}>Platform Administration</h1>

      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", flexWrap: "wrap" }}>
        {[
          { key: "enterprises", label: "Enterprises" },
          { key: "users", label: "Users" },
          { key: "audit", label: "Audit Log" },
          { key: "workers", label: "Workers" },
        ].map(t => <TabBtn key={t.key} active={tab === t.key} label={t.label} onClick={() => setTab(t.key)} testId={`platform-tab-${t.key}`} />)}
      </div>

      {tab === "enterprises" && <EnterprisesTab api={api} />}
      {tab === "users" && <PlatformUsersTab api={api} />}
      {tab === "audit" && <AuditTab api={api} />}
      {tab === "workers" && <WorkersTab api={api} />}
    </div>
  );
}
