import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { Users as UsersIcon, CheckCircle, XCircle, Shield, Clock, Trash2, ShieldCheck, ShieldOff, UserPlus, Mail, Loader2, X } from "lucide-react";
import { colors, fonts, T, onFocus, onBlur, rowEnter, rowLeave } from "../theme";

const badge = (color) => ({
  display: "inline-flex", alignItems: "center", gap: "4px",
  padding: "3px 8px", borderRadius: "10px", fontSize: "11px", fontFamily: fonts.mono,
  backgroundColor: color === "green" ? "rgba(52,211,153,0.08)" : color === "yellow" ? "rgba(245,158,11,0.08)" : "rgba(148,163,184,0.08)",
  color: color === "green" ? colors.brand.success : color === "yellow" ? colors.brand.warning : colors.text.secondary,
  border: `1px solid ${color === "green" ? "rgba(52,211,153,0.2)" : color === "yellow" ? "rgba(245,158,11,0.2)" : "rgba(148,163,184,0.15)"}`,
});

const instanceChip = {
  display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px", borderRadius: "10px",
  fontSize: "11px", fontFamily: fonts.body, backgroundColor: "rgba(59,130,246,0.1)",
  color: colors.brand.blue, border: "1px solid rgba(59,130,246,0.2)", marginRight: "4px", marginBottom: "2px",
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [deleting, setDeleting] = useState(null);
  const [togglingRole, setTogglingRole] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviteInstance, setInviteInstance] = useState("");
  const [instances, setInstances] = useState([]);
  const [sending, setSending] = useState(false);

  const fetchUsers = useCallback(async () => {
    try { const res = await api.get("/admin/users"); setUsers(res.data); }
    catch { toast.error("Failed to load users"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    api.get("/admin/instances").then(r => setInstances(r.data || [])).catch(() => {});
  }, []);

  const sendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) { toast.error("Enter an email address"); return; }
    setSending(true);
    try {
      const payload = { email: inviteEmail.trim(), role: inviteRole };
      if (inviteInstance) payload.instance_id = inviteInstance;
      const res = await api.post("/admin/users/invite", payload);
      toast.success(res.data.message);
      setShowInvite(false);
      setInviteEmail("");
      setInviteRole("user");
      setInviteInstance("");
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to send invite"); }
    finally { setSending(false); }
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`Delete user "${user.email}"?\n\nThis will permanently remove their account and unassign them from all instances. They will need to register again.`)) return;
    setDeleting(user.id);
    try {
      await api.delete(`/admin/users/${user.id}`);
      toast.success(`User ${user.email} deleted`);
      setUsers(prev => prev.filter(u => u.id !== user.id));
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to delete user"); }
    finally { setDeleting(null); }
  };

  const toggleRole = async (user) => {
    const newRole = user.role === "superadmin" ? "user" : "superadmin";
    const action = newRole === "superadmin" ? "Promote" : "Demote";
    if (!window.confirm(`${action} "${user.email}" to ${newRole === "superadmin" ? "Admin" : "User"}?`)) return;
    setTogglingRole(user.id);
    try {
      const res = await api.patch(`/admin/users/${user.id}/role`, { role: newRole });
      toast.success(res.data.message);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to change role"); }
    finally { setTogglingRole(null); }
  };

  const filtered = users.filter(u => {
    if (tab === "assigned") return u.assigned_instances?.length > 0;
    if (tab === "unassigned") return !u.assigned_instances?.length;
    return true;
  });

  const unassignedCount = users.filter(u => !u.assigned_instances?.length && u.role !== "superadmin").length;

  return (
    <div style={T.page}>
      <p style={T.overline}>Admin</p>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
        <h1 style={{ ...T.h1, margin: "0 0 32px" }}>Users</h1>
        {unassignedCount > 0 && (
          <span style={{
            padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontFamily: fonts.mono,
            backgroundColor: "rgba(245,158,11,0.12)", color: colors.brand.warning,
            border: "1px solid rgba(245,158,11,0.25)",
          }} data-testid="unassigned-count">
            {unassignedCount} unassigned
          </span>
        )}
        <button onClick={() => setShowInvite(true)} data-testid="invite-user-btn"
          style={{
            marginLeft: "auto", marginBottom: "32px", display: "flex", alignItems: "center", gap: "6px",
            padding: "8px 16px", borderRadius: "10px", border: "none",
            background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.cyan})`,
            color: "#fff", fontSize: "12px", fontWeight: "600",
            fontFamily: fonts.body, cursor: "pointer",
          }}>
          <UserPlus size={14} /> Invite User
        </button>
      </div>
      <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, marginBottom: "20px", marginTop: "-20px" }}>
        All registered users and their workspace assignments. Assign instances from the Instances page.
      </p>

      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", borderBottom: `1px solid ${colors.border.default}` }}>
        {[
          { key: "all", label: `All (${users.length})` },
          { key: "assigned", label: `Assigned (${users.filter(u => u.assigned_instances?.length > 0).length})` },
          { key: "unassigned", label: `Unassigned (${users.filter(u => !u.assigned_instances?.length).length})` },
        ].map(t => (
          <button key={t.key} style={{
            padding: "8px 16px", background: "none", border: "none", cursor: "pointer",
            fontFamily: fonts.body, fontSize: "13px", fontWeight: "500",
            color: tab === t.key ? colors.text.primary : colors.text.secondary,
            borderBottom: tab === t.key ? `2px solid ${colors.brand.cyan}` : "2px solid transparent",
            marginBottom: "-1px", transition: "color 0.15s",
          }} onClick={() => setTab(t.key)} data-testid={`tab-${t.key}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: colors.text.secondary, fontSize: "13px", fontFamily: fonts.mono }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: colors.text.secondary, fontSize: "14px" }}>
          <UsersIcon size={32} color={colors.text.muted} style={{ display: "block", margin: "0 auto 12px" }} />
          <p>No users in this category</p>
        </div>
      ) : (
        <div style={{ backgroundColor: colors.bg.surface, border: `1px solid ${colors.border.default}`, borderRadius: "10px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border.subtle}` }}>
                {["Email", "Username", "Role", "Status", "Assigned Instances", "Joined", "Actions"].map(h => (<th key={h} style={T.th}>{h}</th>))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr key={user.id} data-testid={`user-row-${user.id}`}
                  style={{ borderBottom: `1px solid ${colors.border.faint}`, transition: "background 0.2s" }}
                  onMouseEnter={rowEnter} onMouseLeave={rowLeave}>
                  <td style={{ ...T.td, fontWeight: "500" }}>{user.email}</td>
                  <td style={{ ...T.td, fontFamily: fonts.mono, fontSize: "12px", color: colors.text.secondary }}>{user.username || "\u2014"}</td>
                  <td style={T.td}>
                    {user.role === "superadmin" ? <span style={badge("green")}><Shield size={10} /> Admin</span> : <span style={badge("grey")}>User</span>}
                  </td>
                  <td style={T.td}>
                    {user.is_verified
                      ? <span style={badge("green")} data-testid={`verified-${user.id}`}><CheckCircle size={10} /> Verified</span>
                      : <span style={badge("yellow")} data-testid={`unverified-${user.id}`}><Clock size={10} /> Pending</span>}
                  </td>
                  <td style={T.td}>
                    {user.role === "superadmin"
                      ? <span style={{ color: colors.text.muted, fontSize: "12px", fontStyle: "italic" }}>All instances</span>
                      : user.assigned_instances?.length > 0
                        ? <div style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>{user.assigned_instances.map(inst => (<span key={inst.id} style={instanceChip}>{inst.name}</span>))}</div>
                        : <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: colors.brand.warning, fontSize: "12px" }}><XCircle size={12} /> Unassigned</span>}
                  </td>
                  <td style={{ ...T.td, color: colors.text.secondary, fontFamily: fonts.mono, fontSize: "11px" }}>
                    {user.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "\u2014"}
                  </td>
                  <td style={T.td}>
                    {user.id === currentUser?.id ? (
                      <span style={{ color: colors.text.muted, fontSize: "11px", fontStyle: "italic" }}>You</span>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button
                          onClick={() => toggleRole(user)}
                          disabled={togglingRole === user.id}
                          data-testid={`toggle-role-${user.id}`}
                          title={user.role === "superadmin" ? "Demote to User" : "Promote to Admin"}
                          style={{
                            background: "none", border: "none",
                            cursor: togglingRole === user.id ? "not-allowed" : "pointer",
                            color: colors.text.secondary, padding: "4px", transition: "color 0.2s ease",
                            opacity: togglingRole === user.id ? 0.4 : 1,
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = user.role === "superadmin" ? colors.brand.warning : colors.brand.cyan}
                          onMouseLeave={e => e.currentTarget.style.color = colors.text.secondary}
                        >
                          {user.role === "superadmin" ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                        </button>
                        {user.role !== "superadmin" && (
                          <button
                            onClick={() => deleteUser(user)}
                            disabled={deleting === user.id}
                            data-testid={`delete-user-${user.id}`}
                            title="Delete User"
                            style={{
                              background: "none", border: "none",
                              cursor: deleting === user.id ? "not-allowed" : "pointer",
                              color: colors.text.secondary, padding: "4px", transition: "color 0.2s ease",
                              opacity: deleting === user.id ? 0.4 : 1,
                            }}
                            onMouseEnter={e => { if (deleting !== user.id) e.currentTarget.style.color = colors.brand.error; }}
                            onMouseLeave={e => e.currentTarget.style.color = colors.text.secondary}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: "16px",
        }} onClick={() => setShowInvite(false)} data-testid="invite-modal-overlay">
          <div style={{
            maxWidth: "420px", width: "100%",
            backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
            borderRadius: "16px", padding: "28px",
            boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
          }} onClick={e => e.stopPropagation()} data-testid="invite-modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Mail size={18} color={colors.brand.cyan} />
                <h3 style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
                  Invite User
                </h3>
              </div>
              <button onClick={() => setShowInvite(false)} style={{
                background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "4px",
              }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={sendInvite}>
              <label style={{ ...T.label, marginBottom: "4px", display: "block" }}>Email Address</label>
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com" type="email" autoFocus data-testid="invite-email-input"
                style={{ ...T.input, marginBottom: "14px", width: "100%", boxSizing: "border-box" }}
                onFocus={onFocus} onBlur={onBlur} />

              <label style={{ ...T.label, marginBottom: "4px", display: "block" }}>Role</label>
              <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                {[
                  { value: "user", label: "Team Member" },
                  { value: "superadmin", label: "Admin" },
                ].map(opt => (
                  <button key={opt.value} type="button" data-testid={`invite-role-${opt.value}`}
                    onClick={() => setInviteRole(opt.value)}
                    style={{
                      flex: 1, padding: "8px 12px", borderRadius: "8px",
                      border: `1px solid ${inviteRole === opt.value ? colors.brand.cyan : colors.border.default}`,
                      backgroundColor: inviteRole === opt.value ? "rgba(59,130,246,0.08)" : colors.bg.base,
                      color: inviteRole === opt.value ? colors.brand.cyan : colors.text.secondary,
                      fontFamily: fonts.body, fontSize: "12px", fontWeight: "500",
                      cursor: "pointer", transition: "all 0.15s",
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>

              <label style={{ ...T.label, marginBottom: "4px", display: "block" }}>Assign to Instance (optional)</label>
              <select value={inviteInstance} onChange={e => setInviteInstance(e.target.value)}
                data-testid="invite-instance-select"
                style={{
                  ...T.input, marginBottom: "20px", width: "100%", boxSizing: "border-box",
                  appearance: "none", cursor: "pointer",
                }}>
                <option value="">No assignment (can be done later)</option>
                {instances.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>

              <button type="submit" disabled={sending} data-testid="invite-send-btn"
                style={{
                  width: "100%", padding: "10px", borderRadius: "10px", border: "none",
                  background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.cyan})`,
                  color: "#fff", fontSize: "13px", fontWeight: "600",
                  fontFamily: fonts.body, cursor: sending ? "not-allowed" : "pointer",
                  opacity: sending ? 0.5 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                }}>
                {sending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Mail size={14} />}
                {sending ? "Sending..." : "Send Invitation"}
              </button>
            </form>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
