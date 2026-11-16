import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { colors, fonts, radius, T, onFocus, onBlur } from "@/theme";
import { toast } from "sonner";
import v2 from "@/utils/v2api";
import {
  Layers, Plus, Trash2, Users, Building2, Bot, ChevronDown, ChevronRight,
  Loader2, Search, Shield, Crown, X, Edit2, Check, Package,
} from "lucide-react";

function RoleBadge({ role }) {
  const isOwner = role === "owner";
  const isAdmin = role === "admin";
  const bg = isOwner ? "rgba(251,191,36,0.08)" : isAdmin ? "rgba(96,165,250,0.08)" : "rgba(148,163,184,0.08)";
  const fg = isOwner ? "#FBBF24" : isAdmin ? colors.brand.light : colors.text.muted;
  const border = isOwner ? "rgba(251,191,36,0.2)" : isAdmin ? "rgba(96,165,250,0.2)" : "rgba(148,163,184,0.15)";
  return (
    <span style={{
      padding: "2px 8px", borderRadius: radius.full,
      fontSize: "9px", fontWeight: "600", fontFamily: fonts.mono,
      textTransform: "uppercase", letterSpacing: "0.08em",
      backgroundColor: bg, color: fg, border: `1px solid ${border}`,
    }}>{role}</span>
  );
}

function PlanBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      padding: "3px 10px", borderRadius: radius.full,
      fontSize: "9px", fontWeight: "600", fontFamily: fonts.mono,
      textTransform: "uppercase", letterSpacing: "0.08em",
      backgroundColor: "rgba(34,197,94,0.08)", color: "#22C55E",
      border: "1px solid rgba(34,197,94,0.2)",
    }}>
      <Package size={9} /> 5 orgs · unlimited bots
    </span>
  );
}

function Stat({ icon: Icon, value, label, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
      <Icon size={11} color={color || colors.text.muted} />
      <span style={{ fontFamily: fonts.mono, fontSize: "11px", fontWeight: "600", color: colors.text.primary }}>{value}</span>
      <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>{label}</span>
    </div>
  );
}

// ── Workspace Card ──
function WorkspaceCard({ ws, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteName, setDeleteName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [roleEditing, setRoleEditing] = useState(null); // { userId, role }

  const toggleExpand = async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    setLoadingDetail(true);
    try {
      const [membersRes, orgsRes] = await Promise.all([
        v2.getWorkspaceMembers(ws.id),
        v2.getWorkspaceOrgs(ws.id),
      ]);
      setMembers(membersRes.data.members || []);
      setOrgs(orgsRes.data.orgs || orgsRes.data.organisations || []);
    } catch { toast.error("Failed to load workspace details"); }
    finally { setLoadingDetail(false); }
  };

  const handleDelete = async () => {
    if (deleteName !== ws.name) { toast.error("Name doesn't match"); return; }
    setDeleting(true);
    try {
      await v2.deleteWorkspace(ws.id);
      toast.success(`"${ws.name}" deleted`);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete");
    } finally { setDeleting(false); setConfirmDelete(false); setDeleteName(""); }
  };

  const handleRemoveMember = async (userId, email) => {
    if (!window.confirm(`Remove ${email} from ${ws.name}?`)) return;
    try {
      await v2.removeWorkspaceMember(ws.id, userId);
      toast.success(`${email} removed`);
      setMembers(prev => prev.filter(m => m.user_id !== userId));
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to remove"); }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await v2.updateWorkspaceMemberRole(ws.id, userId, { role: newRole });
      toast.success("Role updated");
      setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role: newRole } : m));
      setRoleEditing(null);
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to update role"); }
  };

  return (
    <div data-testid={`ws-card-${ws.id}`} style={{
      backgroundColor: colors.bg.surface, borderRadius: radius.lg,
      border: `1px solid ${expanded ? colors.border.active : colors.border.default}`,
      overflow: "hidden", transition: "border-color 0.2s",
    }}>
      {/* Header row */}
      <button
        data-testid={`ws-expand-${ws.id}`}
        onClick={toggleExpand}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: "12px",
          padding: "16px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        {expanded ? <ChevronDown size={14} color={colors.brand.light} /> : <ChevronRight size={14} color={colors.text.muted} />}
        <Layers size={16} color={expanded ? colors.brand.light : colors.text.secondary} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontFamily: fonts.body, fontSize: "14px", fontWeight: "600", color: colors.text.primary }}>{ws.name}</span>
            <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>{ws.slug}</span>
            <PlanBadge />
          </div>
        </div>
        <div style={{ display: "flex", gap: "16px", flexShrink: 0 }}>
          <Stat icon={Building2} value={ws.org_count || 0} label="orgs" color={colors.brand.light} />
          <Stat icon={Users} value={ws.member_count || 0} label="members" color="#FBBF24" />
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${colors.border.muted}`, padding: "0 20px 20px" }}>
          {loadingDetail ? (
            <div style={{ padding: "24px", display: "flex", alignItems: "center", gap: "8px", color: colors.text.muted, justifyContent: "center" }}>
              <Loader2 size={14} className="animate-spin" /> Loading...
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", paddingTop: "16px" }}>
              {/* Members */}
              <div>
                <h4 style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 12px" }}>
                  Members ({members.length})
                </h4>
                {members.length === 0 && <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted }}>No members</p>}
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {members.map(m => (
                    <div key={m.user_id} data-testid={`ws-member-${m.user_id}`} style={{
                      display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px",
                      borderRadius: radius.md, transition: "background 0.15s",
                    }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.bg.panel}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.primary, fontWeight: "500" }}>
                          {m.username || m.email}
                        </span>
                        {m.username && m.email && (
                          <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, marginLeft: "6px" }}>{m.email}</span>
                        )}
                      </div>

                      {/* Role badge / editor */}
                      {roleEditing?.userId === m.user_id ? (
                        <div style={{ display: "flex", gap: "4px" }}>
                          {["admin", "member"].map(r => (
                            <button key={r} onClick={() => handleRoleChange(m.user_id, r)} style={{
                              padding: "2px 8px", borderRadius: radius.full, border: "1px solid",
                              fontSize: "9px", fontWeight: "600", fontFamily: fonts.mono, cursor: "pointer",
                              textTransform: "uppercase", letterSpacing: "0.06em",
                              backgroundColor: r === m.role ? "rgba(96,165,250,0.15)" : "transparent",
                              borderColor: r === m.role ? colors.brand.light : colors.border.default,
                              color: r === m.role ? colors.brand.light : colors.text.muted,
                            }}>{r}</button>
                          ))}
                          <button onClick={() => setRoleEditing(null)} style={{
                            background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "0 2px",
                          }}><X size={12} /></button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <RoleBadge role={m.role} />
                          {m.role !== "owner" && (
                            <button data-testid={`ws-member-edit-role-${m.user_id}`}
                              onClick={() => setRoleEditing({ userId: m.user_id, role: m.role })}
                              style={{ background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "2px" }}
                              title="Change role"
                            ><Edit2 size={11} /></button>
                          )}
                        </div>
                      )}

                      {/* Remove button (not for owner) */}
                      {m.role !== "owner" && (
                        <button data-testid={`ws-member-remove-${m.user_id}`}
                          onClick={() => handleRemoveMember(m.user_id, m.email || m.username)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(244,63,94,0.5)", padding: "2px" }}
                          title="Remove from workspace"
                          onMouseEnter={e => e.currentTarget.style.color = "#F43F5E"}
                          onMouseLeave={e => e.currentTarget.style.color = "rgba(244,63,94,0.5)"}
                        ><Trash2 size={12} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Orgs */}
              <div>
                <h4 style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 12px" }}>
                  Organisations ({orgs.length})
                </h4>
                {orgs.length === 0 && <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted }}>No organisations</p>}
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {orgs.map(o => (
                    <div key={o.id} style={{
                      display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px",
                      borderRadius: radius.md,
                    }}>
                      <Building2 size={12} color={colors.brand.light} />
                      <span style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.primary, fontWeight: "500" }}>{o.name}</span>
                      {o.description && (
                        <span style={{ fontFamily: fonts.body, fontSize: "10px", color: colors.text.muted, marginLeft: "auto" }}>{o.description}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Workspace Plan */}
                <div style={{
                  marginTop: "20px", padding: "14px", borderRadius: radius.md,
                  backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
                }}>
                  <h4 style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 10px" }}>
                    Plan
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary }}>Organisations</span>
                      <span style={{ fontFamily: fonts.mono, fontSize: "12px", color: colors.text.primary, fontWeight: "600" }}>{ws.org_count || 0} / 5</span>
                    </div>
                    <div style={{ height: "4px", borderRadius: "2px", backgroundColor: colors.bg.surface, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(((ws.org_count || 0) / 5) * 100, 100)}%`, height: "100%", borderRadius: "2px", backgroundColor: (ws.org_count || 0) >= 5 ? "#F43F5E" : colors.brand.light, transition: "width 0.3s" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary }}>Bots per org</span>
                      <span style={{ fontFamily: fonts.mono, fontSize: "12px", color: "#22C55E", fontWeight: "600" }}>Unlimited</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Delete section */}
          <div style={{ borderTop: `1px solid ${colors.border.muted}`, marginTop: "16px", paddingTop: "16px" }}>
            {!confirmDelete ? (
              <button
                data-testid={`ws-delete-trigger-${ws.id}`}
                onClick={() => setConfirmDelete(true)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "8px 14px", borderRadius: radius.md,
                  border: "1px solid rgba(244,63,94,0.2)", backgroundColor: "transparent",
                  color: "rgba(244,63,94,0.6)", fontFamily: fonts.body, fontSize: "12px", fontWeight: "500",
                  cursor: "pointer", transition: "all 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(244,63,94,0.06)"; e.currentTarget.style.color = "#F43F5E"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "rgba(244,63,94,0.6)"; }}
              >
                <Trash2 size={12} /> Delete Workspace
              </button>
            ) : (
              <div data-testid={`ws-delete-confirm-${ws.id}`} style={{
                padding: "14px", borderRadius: radius.md, border: "1px solid rgba(244,63,94,0.25)",
                backgroundColor: "rgba(244,63,94,0.04)",
              }}>
                <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: "0 0 8px" }}>
                  Type <strong style={{ color: colors.text.primary }}>{ws.name}</strong> to confirm deletion.
                  Organisations must be removed first.
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    data-testid={`ws-delete-input-${ws.id}`}
                    value={deleteName}
                    onChange={e => setDeleteName(e.target.value)}
                    placeholder={ws.name}
                    style={{ ...T.input, flex: 1, fontSize: "12px", borderColor: "rgba(244,63,94,0.3)" }}
                    onFocus={e => { e.target.style.borderColor = "#F43F5E"; e.target.style.boxShadow = "0 0 0 3px rgba(244,63,94,0.15)"; }}
                    onBlur={e => { e.target.style.borderColor = "rgba(244,63,94,0.3)"; e.target.style.boxShadow = "none"; }}
                  />
                  <button
                    data-testid={`ws-delete-confirm-btn-${ws.id}`}
                    onClick={handleDelete}
                    disabled={deleting || deleteName !== ws.name}
                    style={{
                      padding: "8px 16px", borderRadius: radius.md, border: "none",
                      backgroundColor: deleteName === ws.name ? "#F43F5E" : "rgba(244,63,94,0.2)",
                      color: deleteName === ws.name ? "#fff" : "rgba(244,63,94,0.5)",
                      fontFamily: fonts.body, fontSize: "12px", fontWeight: "600", cursor: deleteName === ws.name ? "pointer" : "not-allowed",
                      display: "flex", alignItems: "center", gap: "4px", opacity: deleting ? 0.5 : 1,
                    }}
                  >
                    <Trash2 size={11} /> {deleting ? "..." : "Delete"}
                  </button>
                  <button
                    onClick={() => { setConfirmDelete(false); setDeleteName(""); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "4px" }}
                  ><X size={14} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create Workspace Inline ──
function CreateWorkspaceForm({ onCreated }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await v2.createWorkspace({ name: name.trim() });
      toast.success(`"${name.trim()}" created`);
      setName("");
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create");
    } finally { setSaving(false); }
  };

  return (
    <div data-testid="create-ws-form" style={{
      display: "flex", gap: "8px", padding: "14px 16px",
      backgroundColor: colors.bg.surface, borderRadius: radius.lg,
      border: `1px solid ${colors.border.default}`,
    }}>
      <input
        data-testid="create-ws-name"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleCreate()}
        placeholder="New workspace name..."
        style={{ ...T.input, flex: 1, fontSize: "13px" }}
        onFocus={onFocus} onBlur={onBlur}
      />
      <button
        data-testid="create-ws-btn"
        onClick={handleCreate}
        disabled={saving || !name.trim()}
        style={{
          padding: "8px 18px", borderRadius: radius.md, border: "none",
          background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.light})`,
          color: "#fff", fontFamily: fonts.body, fontSize: "13px", fontWeight: "600",
          cursor: !name.trim() || saving ? "not-allowed" : "pointer",
          opacity: !name.trim() || saving ? 0.5 : 1,
          display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s",
          boxShadow: "0 2px 8px rgba(59,130,246,0.25)",
        }}
      >
        <Plus size={14} /> {saving ? "Creating..." : "Create"}
      </button>
    </div>
  );
}

// ── Main Page ──
export default function EnterpriseWorkspaces() {
  const { refreshWorkspaces } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await v2.getMyWorkspaces();
      setWorkspaces(res.data.workspaces || []);
    } catch { toast.error("Failed to load workspaces"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    await load();
    await refreshWorkspaces();
  };

  const filtered = workspaces.filter(w =>
    !search || w.name?.toLowerCase().includes(search.toLowerCase()) || w.slug?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ padding: "60px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", color: colors.text.muted }}>
        <Loader2 size={18} className="animate-spin" /> Loading workspaces...
      </div>
    );
  }

  return (
    <div data-testid="enterprise-workspaces-page" style={{ padding: "32px 40px", maxWidth: "1100px" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "6px" }}>
          Enterprise
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontFamily: fonts.heading, fontSize: "28px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
            Workspaces
          </h1>
          <button
            data-testid="toggle-create-ws"
            onClick={() => setShowCreate(!showCreate)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 16px", borderRadius: radius.md, border: "none",
              background: showCreate ? colors.bg.surface : `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.light})`,
              color: showCreate ? colors.text.secondary : "#fff",
              fontFamily: fonts.body, fontSize: "13px", fontWeight: "600", cursor: "pointer",
              boxShadow: showCreate ? "none" : "0 2px 8px rgba(59,130,246,0.25)", transition: "all 0.2s",
            }}
          >
            {showCreate ? <X size={14} /> : <Plus size={14} />}
            {showCreate ? "Cancel" : "New Workspace"}
          </button>
        </div>
        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, marginTop: "6px" }}>
          Manage all workspaces, their members, organisations, and plans.
        </p>
      </div>

      {/* Summary stats */}
      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "24px" }}>
        <Stat icon={Layers} value={workspaces.length} label="workspaces" color={colors.brand.light} />
        <Stat icon={Building2} value={workspaces.reduce((s, w) => s + (w.org_count || 0), 0)} label="orgs" color="#A78BFA" />
        <Stat icon={Users} value={workspaces.reduce((s, w) => s + (w.member_count || 0), 0)} label="members" color="#FBBF24" />
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ marginBottom: "16px" }}>
          <CreateWorkspaceForm onCreated={() => { setShowCreate(false); handleRefresh(); }} />
        </div>
      )}

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "16px", maxWidth: "320px" }}>
        <Search size={14} color={colors.text.muted} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
        <input
          data-testid="ws-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search workspaces..."
          style={{ ...T.input, paddingLeft: "34px", fontSize: "12px" }}
          onFocus={onFocus} onBlur={onBlur}
        />
      </div>

      {/* Workspace list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filtered.length === 0 && (
          <p style={{ color: colors.text.muted, fontFamily: fonts.body, fontSize: "13px", textAlign: "center", padding: "40px" }}>
            {search ? "No workspaces match your search." : "No workspaces yet. Create one above."}
          </p>
        )}
        {filtered.map(ws => (
          <WorkspaceCard key={ws.id} ws={ws} onRefresh={handleRefresh} />
        ))}
      </div>
    </div>
  );
}
