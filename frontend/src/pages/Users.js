import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { colors, fonts, radius, T, onFocus, onBlur } from "@/theme";
import { toast } from "sonner";
import api from "@/utils/api";
import v2 from "@/utils/v2api";
import {
  Plus, Trash2, Shield, UserPlus, RefreshCw, Mail, CheckCircle,
  Clock, X, Eye, Lock, ChevronDown, Search, Users as UsersIcon, Edit2, Building2, Layers,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function Users() {
  const { user: currentUser, token, selectedWorkspace, workspaces } = useAuth();
  const [users, setUsers] = useState([]);
  const [wsMemberMap, setWsMemberMap] = useState({});
  const [allWsMemberships, setAllWsMemberships] = useState({});  // userId -> [{ws_id, ws_name, role}]
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showResetPw, setShowResetPw] = useState(null);
  const [editUser, setEditUser] = useState(null);  // user being edited
  const [search, setSearch] = useState("");

  // Orgs + Bots for assignment
  const [orgs, setOrgs] = useState([]);
  const [bots, setBots] = useState([]);

  const loadUsers = async () => {
    const currentToken = localStorage.getItem("bf_token");
    if (!currentToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/users`, { 
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      if (res.ok) setUsers(await res.json());
    } catch {}
    // Load workspace members for the selected workspace
    if (selectedWorkspace) {
      try {
        const wsRes = await v2.getWorkspaceMembers(selectedWorkspace.id);
        const members = wsRes.data?.members || [];
        const map = {};
        members.forEach(m => { map[m.user_id] = m; });
        setWsMemberMap(map);
      } catch {}
    }
    // Load memberships across ALL workspaces (admin view)
    if (workspaces.length > 0) {
      const allMemberships = {};
      for (const ws of workspaces) {
        try {
          const wsRes = await v2.getWorkspaceMembers(ws.id);
          const members = wsRes.data?.members || [];
          members.forEach(m => {
            if (!allMemberships[m.user_id]) allMemberships[m.user_id] = [];
            allMemberships[m.user_id].push({ ws_id: ws.id, ws_name: ws.name, role: m.role });
          });
        } catch {}
      }
      setAllWsMemberships(allMemberships);
    }
    setLoading(false);
  };

  const loadOrgsAndBots = async () => {
    try {
      const orgRes = await v2.listOrgs();
      setOrgs(orgRes.data?.organisations || []);
      const orgList = orgRes.data?.organisations || [];
      const allBots = [];
      for (const o of orgList) {
        try {
          const botRes = await v2.listBots(o.id);
          for (const b of (botRes.data?.bots || [])) allBots.push({ ...b, org_name: o.name });
        } catch {}
      }
      setBots(allBots);
    } catch {}
  };

  useEffect(() => { 
    loadUsers(); 
    loadOrgsAndBots(); 
  }, []);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.email?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q)
      || u.first_name?.toLowerCase().includes(q) || u.last_name?.toLowerCase().includes(q);
  });

  const deleteUser = async (u) => {
    if (!window.confirm(`Remove ${u.email}?`)) return;
    try {
      const res = await fetch(`${API}/api/admin/users/${u.id}`, { 
        method: "DELETE", 
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) { toast.success("User removed"); loadUsers(); }
      else toast.error((await res.json()).detail || "Failed");
    } catch { toast.error("Failed to delete user"); }
  };

  const toggleRole = async (u) => {
    if (!selectedWorkspace) {
      toast.error("No workspace selected");
      return;
    }
    const wsMember = wsMemberMap[u.id];
    const isWsAdmin = wsMember && (wsMember.role === "admin" || wsMember.role === "owner");
    const newRole = isWsAdmin ? "member" : "admin";
    const label = newRole === "admin" ? "workspace admin" : "regular member";
    if (!window.confirm(`Set ${u.email} as ${label} in ${selectedWorkspace.name}?`)) return;
    try {
      const res = await fetch(`${API}/api/admin/users/${u.id}/role`, {
        method: "PATCH", 
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole, workspace_id: selectedWorkspace.id }),
      });
      if (res.ok) { toast.success(`${u.email} set as ${label}`); loadUsers(); }
      else toast.error((await res.json()).detail || "Failed");
    } catch { toast.error("Failed to update role"); }
  };

  return (
    <div style={{ padding: "0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontFamily: fonts.heading, fontSize: "24px", fontWeight: "700", color: colors.text.primary, margin: "0 0 4px" }}>Team</h1>
          <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: 0 }}>
            Manage team members, assign organisations and bots, and send invite links.
          </p>
        </div>
        <button onClick={() => setShowInvite(true)} data-testid="invite-user-btn" style={{
          ...T.btnPrimary, gap: "8px",
        }}>
          <UserPlus size={15} /> Invite User
        </button>
      </div>

      {/* Search bar */}
      <div style={{ position: "relative", maxWidth: "360px", marginBottom: "20px" }}>
        <Search size={15} color={colors.text.muted} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or username..."
          style={{ ...T.input, width: "100%", paddingLeft: "36px" }} data-testid="user-search" />
      </div>

      {/* Users table */}
      <div style={{ borderRadius: "14px", border: `1px solid ${colors.border.default}`, overflow: "hidden", backgroundColor: colors.bg.panel }}>
        {/* Table header */}
        <div style={{
          display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 120px",
          padding: "12px 20px", backgroundColor: colors.bg.base,
          borderBottom: `1px solid ${colors.border.default}`,
        }}>
          {["User", "Organisations", "Bots", "Status", "Actions"].map(h => (
            <p key={h} style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>{h}</p>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <RefreshCw size={20} color={colors.text.muted} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p style={{ padding: "40px", textAlign: "center", fontFamily: fonts.body, fontSize: "13px", color: colors.text.muted }}>
            {search ? "No users match your search." : "No team members yet. Invite someone to get started."}
          </p>
        ) : filtered.map(u => (
          <div key={u.id} data-testid={`user-row-${u.id}`} style={{
            display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 120px",
            padding: "14px 20px", alignItems: "center",
            borderBottom: `1px solid ${colors.border.default}`,
            transition: "background-color 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.bg.base}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
          >
            {/* User info */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "10px",
                backgroundColor: (u.role === "superadmin" || u.platform_role === "superadmin") ? "rgba(139,92,246,0.12)"
                  : wsMemberMap[u.id]?.role === "owner" ? "rgba(245,158,11,0.12)"
                  : wsMemberMap[u.id]?.role === "admin" ? "rgba(96,165,250,0.12)"
                  : "rgba(96,165,250,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                fontFamily: fonts.heading, fontSize: "13px", fontWeight: "700",
                color: (u.role === "superadmin" || u.platform_role === "superadmin") ? "#8B5CF6"
                  : wsMemberMap[u.id]?.role === "owner" ? "#F59E0B"
                  : wsMemberMap[u.id]?.role === "admin" ? "#60A5FA"
                  : colors.text.muted,
              }}>
                {(u.first_name || u.username || u.email || "?")[0].toUpperCase()}
              </div>
              <div style={{ overflow: "hidden" }}>
                <p style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "600", color: colors.text.primary, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "—"}
                </p>
                <p style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.secondary, margin: "2px 0 0" }}>
                  {u.email}
                  {u.username && <span style={{ marginLeft: "6px", color: colors.text.muted }}>@{u.username}</span>}
                </p>
              </div>
            </div>

            {/* Orgs */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {(u.assigned_orgs || []).length > 0 ? u.assigned_orgs.map(o => (
                <span key={o.id} style={{
                  padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontFamily: fonts.mono,
                  backgroundColor: "rgba(139,92,246,0.08)", color: "#8B5CF6", border: "1px solid rgba(139,92,246,0.2)",
                }}>{o.name}</span>
              )) : <span style={{ fontSize: "11px", color: colors.text.muted, fontFamily: fonts.body }}>—</span>}
            </div>

            {/* Bots */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {(u.assigned_bots || []).length > 0 ? u.assigned_bots.map(b => (
                <span key={b.id} style={{
                  padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontFamily: fonts.mono,
                  backgroundColor: "rgba(96,165,250,0.08)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.2)",
                }}>{b.name}</span>
              )) : <span style={{ fontSize: "11px", color: colors.text.muted, fontFamily: fonts.body }}>—</span>}
            </div>

            {/* Status */}
            <div>
              {u.is_verified ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontFamily: fonts.body, color: "#34D399" }}>
                  <CheckCircle size={12} /> Verified
                </span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontFamily: fonts.body, color: "#FBBF24" }}>
                  <Clock size={12} /> Pending
                </span>
              )}
              {(u.role === "superadmin" || u.platform_role === "superadmin") && (
                <span style={{ display: "block", marginTop: "2px", fontSize: "10px", fontFamily: fonts.mono, color: "#8B5CF6" }}>Platform Admin</span>
              )}
              {(() => {
                const wm = wsMemberMap[u.id];
                if (!wm) return null;
                const c = wm.role === "owner" ? "#F59E0B" : wm.role === "admin" ? "#60A5FA" : colors.text.muted;
                const label = wm.role === "owner" ? "Owner" : wm.role === "admin" ? "Ws Admin" : "Member";
                return <span style={{ display: "block", marginTop: "2px", fontSize: "10px", fontFamily: fonts.mono, color: c }}>{label}</span>;
              })()}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "6px" }}>
              {u.id !== currentUser?.id && u.platform_role !== "superadmin" && u.role !== "superadmin" && wsMemberMap[u.id]?.role !== "owner" && (
                <button onClick={() => setEditUser(u)} title="Edit Workspace Roles" data-testid={`edit-user-${u.id}`} style={{
                  padding: "6px", borderRadius: "6px", border: `1px solid ${colors.border.default}`,
                  backgroundColor: colors.bg.base, cursor: "pointer", color: colors.text.secondary,
                }}><Edit2 size={13} /></button>
              )}
              <button onClick={() => setShowResetPw(u)} title="Reset Password" data-testid={`reset-pw-${u.id}`} style={{
                padding: "6px", borderRadius: "6px", border: `1px solid ${colors.border.default}`,
                backgroundColor: colors.bg.base, cursor: "pointer", color: colors.text.secondary,
              }}><Lock size={13} /></button>
              {u.id !== currentUser?.id && u.platform_role !== "superadmin" && u.role !== "superadmin" && (
                <button onClick={() => deleteUser(u)} title="Remove" data-testid={`delete-user-${u.id}`} style={{
                  padding: "6px", borderRadius: "6px", border: "1px solid rgba(244,63,94,0.2)",
                  backgroundColor: "rgba(244,63,94,0.06)", cursor: "pointer", color: "#F43F5E",
                }}><Trash2 size={13} /></button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Invite Modal */}
      {showInvite && <InviteModal orgs={orgs} bots={bots} token={token} onClose={() => setShowInvite(false)} onDone={() => { setShowInvite(false); loadUsers(); }} />}

      {/* Reset Password Modal */}
      {showResetPw && <ResetPasswordModal user={showResetPw} token={token} onClose={() => setShowResetPw(null)} />}

      {/* Edit User Workspace Roles Modal */}
      {editUser && <EditUserModal user={editUser} workspaces={workspaces} allWsMemberships={allWsMemberships} token={token}
        onClose={() => setEditUser(null)} onDone={() => { setEditUser(null); loadUsers(); }} />}
    </div>
  );
}

/* ── Invite Modal ── */
function InviteModal({ orgs, bots, token, onClose, onDone }) {
  const { workspaces } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("admin"); // workspace role: admin or member
  const [selectedWsId, setSelectedWsId] = useState(workspaces[0]?.id || "");
  const [selectedOrgs, setSelectedOrgs] = useState([]);
  const [selectedBots, setSelectedBots] = useState([]);
  const [sending, setSending] = useState(false);

  const toggleOrg = (id) => setSelectedOrgs(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleBot = (id) => setSelectedBots(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleSubmit = async () => {
    if (!email.trim()) { toast.error("Email is required"); return; }
    setSending(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/users/invite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          role: "user",
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          username: username.trim().toLowerCase() || undefined,
          org_ids: selectedOrgs,
          bot_ids: selectedBots,
          workspace_id: selectedWsId || undefined,
          workspace_role: role,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Invite sent");
        onDone();
      } else toast.error(data.detail || "Failed to send invite");
    } catch { toast.error("Failed to send invite"); }
    finally { setSending(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div data-testid="invite-modal" style={{
        width: "520px", maxHeight: "90vh", overflowY: "auto",
        backgroundColor: colors.bg.panel, borderRadius: "16px",
        border: `1px solid ${colors.border.default}`, padding: "28px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ fontFamily: fonts.heading, fontSize: "18px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>Invite Team Member</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "4px" }}><X size={18} /></button>
        </div>

        {/* Name row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          <div>
            <label style={T.label}>First Name</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" style={{ ...T.input, width: "100%" }} data-testid="invite-first-name" onFocus={onFocus} onBlur={onBlur} />
          </div>
          <div>
            <label style={T.label}>Last Name</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" style={{ ...T.input, width: "100%" }} data-testid="invite-last-name" onFocus={onFocus} onBlur={onBlur} />
          </div>
        </div>

        {/* Email */}
        <div style={{ marginBottom: "14px" }}>
          <label style={T.label}>Email *</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@company.com" style={{ ...T.input, width: "100%" }} data-testid="invite-email" onFocus={onFocus} onBlur={onBlur} />
        </div>

        {/* Username */}
        <div style={{ marginBottom: "14px" }}>
          <label style={T.label}>Username</label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="johndoe" style={{ ...T.input, width: "100%" }} data-testid="invite-username" onFocus={onFocus} onBlur={onBlur} />
          <p style={{ fontFamily: fonts.body, fontSize: "10px", color: colors.text.muted, margin: "4px 0 0" }}>
            Pre-filled when they accept the invite. They can change it.
          </p>
        </div>

        {/* Workspace */}
        <div style={{ marginBottom: "14px" }}>
          <label style={T.label}>Assign to Workspace</label>
          <select
            value={selectedWsId}
            onChange={e => { setSelectedWsId(e.target.value); setSelectedOrgs([]); setSelectedBots([]); }}
            style={{ ...T.input, width: "100%", cursor: "pointer" }}
            data-testid="invite-workspace"
          >
            <option value="">No workspace (creates their own)</option>
            {workspaces.map(ws => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>
        </div>

        {/* Workspace Role */}
        {selectedWsId && (
          <div style={{ marginBottom: "18px" }}>
            <label style={T.label}>Workspace Role</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {[{ v: "admin", l: "Admin", desc: "Can manage orgs and users" }, { v: "member", l: "Member", desc: "Access assigned orgs only" }].map(r => (
                <button key={r.v} onClick={() => setRole(r.v)} style={{
                  flex: 1, padding: "10px", borderRadius: "8px", cursor: "pointer", textAlign: "center",
                  border: `1px solid ${role === r.v ? colors.brand.light + "50" : colors.border.default}`,
                  backgroundColor: role === r.v ? colors.brand.light + "0a" : colors.bg.base,
                  fontFamily: fonts.body, fontSize: "12px", fontWeight: "600",
                  color: role === r.v ? colors.brand.light : colors.text.secondary,
                }}>
                  {r.l}
                  <div style={{ fontSize: "9px", fontWeight: "400", marginTop: "2px", opacity: 0.7 }}>{r.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Assign to Organisations */}
        <div style={{ marginBottom: "18px" }}>
          <label style={T.label}>Assign to Organisations</label>
          {(() => {
            const wsOrgs = selectedWsId ? orgs.filter(o => o.workspace_id === selectedWsId) : orgs;
            return wsOrgs.length === 0 ? (
              <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted }}>
                {selectedWsId ? "No organisations in this workspace." : "No organisations found."}
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {wsOrgs.map(o => (
                  <button key={o.id} onClick={() => toggleOrg(o.id)} data-testid={`org-toggle-${o.id}`} style={{
                    display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px",
                    borderRadius: "8px", cursor: "pointer", transition: "all 0.15s",
                    border: `1px solid ${selectedOrgs.includes(o.id) ? "rgba(139,92,246,0.4)" : colors.border.default}`,
                    backgroundColor: selectedOrgs.includes(o.id) ? "rgba(139,92,246,0.08)" : colors.bg.base,
                    fontFamily: fonts.body, fontSize: "12px",
                    color: selectedOrgs.includes(o.id) ? "#8B5CF6" : colors.text.secondary,
                  }}>
                    {selectedOrgs.includes(o.id) && <CheckCircle size={12} />}
                    {o.name}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Assign to Bots */}
        <div style={{ marginBottom: "24px" }}>
          <label style={T.label}>Assign to Bots</label>
          {bots.length === 0 ? (
            <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted }}>No bots found.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {bots.map(b => (
                <button key={b.id} onClick={() => toggleBot(b.id)} data-testid={`bot-toggle-${b.id}`} style={{
                  display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px",
                  borderRadius: "8px", cursor: "pointer", transition: "all 0.15s",
                  border: `1px solid ${selectedBots.includes(b.id) ? "rgba(96,165,250,0.4)" : colors.border.default}`,
                  backgroundColor: selectedBots.includes(b.id) ? "rgba(96,165,250,0.08)" : colors.bg.base,
                  fontFamily: fonts.body, fontSize: "12px",
                  color: selectedBots.includes(b.id) ? "#60A5FA" : colors.text.secondary,
                }}>
                  {selectedBots.includes(b.id) && <CheckCircle size={12} />}
                  {b.name}
                  {b.org_name && <span style={{ fontSize: "10px", color: colors.text.muted }}>({b.org_name})</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <button onClick={handleSubmit} disabled={sending || !email.trim()} data-testid="send-invite-btn" style={{
          ...T.btnPrimary, width: "100%", justifyContent: "center",
          opacity: (sending || !email.trim()) ? 0.6 : 1,
        }}>
          <Mail size={14} /> {sending ? "Sending..." : "Send Invite Link"}
        </button>
      </div>
    </div>
  );
}

/* ── Reset Password Modal ── */
function ResetPasswordModal({ user, token, onClose }) {
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleReset = async () => {
    if (newPw.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setSaving(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/users/${user.id}/reset-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: newPw }),
      });
      const data = await res.json();
      if (res.ok) { toast.success(data.message || "Password reset"); onClose(); }
      else toast.error(data.detail || "Failed");
    } catch { toast.error("Failed to reset password"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div data-testid="reset-pw-modal" style={{
        width: "420px", backgroundColor: colors.bg.panel, borderRadius: "16px",
        border: `1px solid ${colors.border.default}`, padding: "28px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h2 style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>Reset Password</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "4px" }}><X size={18} /></button>
        </div>

        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: "0 0 16px" }}>
          Set a new password for <strong style={{ color: colors.text.primary }}>{user.email}</strong>
        </p>

        <label style={T.label}>New Password</label>
        <div style={{ position: "relative", marginBottom: "16px" }}>
          <input
            type={showPw ? "text" : "password"}
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            placeholder="Minimum 6 characters"
            style={{ ...T.input, width: "100%", paddingRight: "40px" }}
            data-testid="reset-pw-input"
            onFocus={onFocus} onBlur={onBlur}
          />
          <button onClick={() => setShowPw(!showPw)} style={{
            position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "4px",
          }}><Eye size={16} /></button>
        </div>

        <button onClick={handleReset} disabled={saving || newPw.length < 6} data-testid="confirm-reset-pw-btn" style={{
          ...T.btnPrimary, width: "100%", justifyContent: "center",
          opacity: (saving || newPw.length < 6) ? 0.6 : 1,
        }}>
          <Lock size={14} /> {saving ? "Resetting..." : "Reset Password"}
        </button>
      </div>
    </div>
  );
}


/* ── Edit User Workspace Roles Modal ── */
function EditUserModal({ user, workspaces, allWsMemberships, token, onClose, onDone }) {
  const [saving, setSaving] = useState({});
  const [orgData, setOrgData] = useState({});  // ws_id -> [{org_id, org_name, is_member, org_role, is_owner}]
  const [loadingOrgs, setLoadingOrgs] = useState({});
  const userMemberships = allWsMemberships[user.id] || [];
  const membershipMap = {};
  userMemberships.forEach(m => { membershipMap[m.ws_id] = m; });
  const [expandedWs, setExpandedWs] = useState(null);

  const loadOrgsForWs = async (wsId) => {
    if (orgData[wsId]) { setExpandedWs(expandedWs === wsId ? null : wsId); return; }
    setLoadingOrgs(prev => ({ ...prev, [wsId]: true }));
    try {
      const res = await v2.getUserOrgMemberships(wsId, user.id);
      setOrgData(prev => ({ ...prev, [wsId]: res.data.org_memberships || [] }));
      setExpandedWs(wsId);
    } catch { toast.error("Failed to load orgs"); }
    finally { setLoadingOrgs(prev => ({ ...prev, [wsId]: false })); }
  };

  const toggleWsRole = async (ws, currentRole) => {
    const newRole = currentRole === "admin" ? "member" : "admin";
    const label = newRole === "admin" ? "workspace admin" : "regular member";
    setSaving(prev => ({ ...prev, [ws.id]: true }));
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole, workspace_id: ws.id }),
      });
      if (res.ok) { toast.success(`${user.email} set as ${label} in ${ws.name}`); onDone(); }
      else { const data = await res.json(); toast.error(data.detail || "Failed to update role"); }
    } catch { toast.error("Failed to update role"); }
    finally { setSaving(prev => ({ ...prev, [ws.id]: false })); }
  };

  const toggleOrgMembership = async (wsId, orgId, orgName, isMember) => {
    const action = isMember ? "remove" : "add";
    setSaving(prev => ({ ...prev, [`org-${orgId}`]: true }));
    try {
      await v2.updateOrgMembership(wsId, { user_id: user.id, org_id: orgId, action, org_role: "member" });
      toast.success(isMember ? `Removed from ${orgName}` : `Added to ${orgName}`);
      // Refresh org data
      const res = await v2.getUserOrgMemberships(wsId, user.id);
      setOrgData(prev => ({ ...prev, [wsId]: res.data.org_memberships || [] }));
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to update org membership"); }
    finally { setSaving(prev => ({ ...prev, [`org-${orgId}`]: false })); }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div data-testid="edit-user-modal" style={{
        width: "560px", maxHeight: "85vh", overflow: "auto",
        backgroundColor: colors.bg.panel, borderRadius: "16px",
        border: `1px solid ${colors.border.default}`, padding: "28px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
            Edit User Roles
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "4px" }}>
            <X size={18} />
          </button>
        </div>

        {/* User info */}
        <div style={{
          padding: "14px 16px", backgroundColor: colors.bg.surface, borderRadius: radius.md,
          border: `1px solid ${colors.border.default}`, marginBottom: "20px",
        }}>
          <div style={{ fontFamily: fonts.body, fontSize: "14px", fontWeight: "600", color: colors.text.primary }}>
            {user.first_name || user.username || user.email.split("@")[0]} {user.last_name || ""}
          </div>
          <div style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.muted, marginTop: "2px" }}>{user.email}</div>
        </div>

        {/* Workspace roles + org assignments */}
        <h3 style={{ fontFamily: fonts.heading, fontSize: "12px", fontWeight: "600", color: colors.text.secondary, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Workspace & Organisation Access
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {workspaces.map(ws => {
            const membership = membershipMap[ws.id];
            const isOwner = membership?.role === "owner";
            const isAdmin = membership?.role === "admin";
            const isSaving = saving[ws.id];
            const isExpanded = expandedWs === ws.id;
            const wsOrgs = orgData[ws.id] || [];

            return (
              <div key={ws.id} data-testid={`ws-role-row-${ws.id}`}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", backgroundColor: colors.bg.surface,
                  border: `1px solid ${isAdmin ? "rgba(96,165,250,0.3)" : isOwner ? "rgba(245,158,11,0.3)" : colors.border.default}`,
                  borderRadius: isExpanded ? `${radius.md} ${radius.md} 0 0` : radius.md,
                  cursor: "pointer",
                }} onClick={() => loadOrgsForWs(ws.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Layers size={14} color={isAdmin ? "#60A5FA" : isOwner ? "#F59E0B" : colors.text.muted} />
                    <div>
                      <div style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "500", color: colors.text.primary }}>{ws.name}</div>
                      <div style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted, marginTop: "1px" }}>
                        {ws.org_count || 0} org{(ws.org_count || 0) !== 1 ? "s" : ""} · Click to {isExpanded ? "collapse" : "expand"} orgs
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }} onClick={e => e.stopPropagation()}>
                    {isOwner ? (
                      <span style={{
                        padding: "3px 10px", borderRadius: radius.full, fontSize: "10px",
                        fontWeight: "600", fontFamily: fonts.mono, textTransform: "uppercase",
                        backgroundColor: "rgba(245,158,11,0.1)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.2)",
                      }}>Owner</span>
                    ) : (
                      <button
                        data-testid={`toggle-ws-role-${ws.id}`}
                        onClick={() => toggleWsRole(ws, isAdmin ? "admin" : "none")}
                        disabled={isSaving}
                        style={{
                          padding: "5px 14px", borderRadius: radius.full, fontSize: "11px",
                          fontWeight: "600", fontFamily: fonts.body, cursor: isSaving ? "wait" : "pointer",
                          border: isAdmin ? "1px solid rgba(96,165,250,0.4)" : `1px solid ${colors.border.default}`,
                          backgroundColor: isAdmin ? "rgba(96,165,250,0.08)" : "transparent",
                          color: isAdmin ? "#60A5FA" : colors.text.secondary,
                          transition: "all 0.15s", opacity: isSaving ? 0.5 : 1,
                        }}
                      >
                        <Shield size={10} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                        {isSaving ? "..." : isAdmin ? "Admin" : "Make Admin"}
                      </button>
                    )}
                    <ChevronDown size={14} color={colors.text.muted}
                      style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                  </div>
                </div>

                {/* Org assignments */}
                {isExpanded && (
                  <div style={{
                    border: `1px solid ${colors.border.default}`, borderTop: "none",
                    borderRadius: `0 0 ${radius.md} ${radius.md}`,
                    backgroundColor: colors.bg.base, padding: "8px 12px",
                  }}>
                    {loadingOrgs[ws.id] ? (
                      <div style={{ padding: "8px", fontSize: "11px", color: colors.text.muted }}>Loading organisations...</div>
                    ) : wsOrgs.length === 0 ? (
                      <div style={{ padding: "8px", fontSize: "11px", color: colors.text.muted }}>No organisations in this workspace</div>
                    ) : wsOrgs.map(org => (
                      <div key={org.org_id} data-testid={`org-row-${org.org_id}`} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "8px 10px", borderRadius: "6px",
                        backgroundColor: org.is_member ? "rgba(96,165,250,0.04)" : "transparent",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Building2 size={12} color={org.is_member ? "#60A5FA" : colors.text.muted} />
                          <span style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.primary }}>{org.org_name}</span>
                          {org.is_owner && <span style={{ fontSize: "9px", fontFamily: fonts.mono, color: "#F59E0B" }}>OWNER</span>}
                          {org.is_member && !org.is_owner && org.org_role === "admin" && <span style={{ fontSize: "9px", fontFamily: fonts.mono, color: "#60A5FA" }}>ADMIN</span>}
                        </div>
                        {!org.is_owner && (
                          <button
                            data-testid={`toggle-org-${org.org_id}`}
                            onClick={() => toggleOrgMembership(ws.id, org.org_id, org.org_name, org.is_member)}
                            disabled={saving[`org-${org.org_id}`]}
                            style={{
                              padding: "3px 10px", borderRadius: radius.full, fontSize: "10px",
                              fontWeight: "500", fontFamily: fonts.body, cursor: "pointer",
                              border: org.is_member ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(34,197,94,0.3)",
                              backgroundColor: org.is_member ? "rgba(239,68,68,0.06)" : "rgba(34,197,94,0.06)",
                              color: org.is_member ? "#EF4444" : "#22C55E",
                              opacity: saving[`org-${org.org_id}`] ? 0.5 : 1,
                            }}
                          >
                            {saving[`org-${org.org_id}`] ? "..." : org.is_member ? "Remove" : "Add"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {workspaces.length === 0 && (
            <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted }}>No workspaces found.</p>
          )}
        </div>

        {/* Close */}
        <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} data-testid="close-edit-user" style={{
            ...T.btnPrimary, backgroundColor: colors.bg.surface, color: colors.text.primary,
            border: `1px solid ${colors.border.default}`,
          }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
