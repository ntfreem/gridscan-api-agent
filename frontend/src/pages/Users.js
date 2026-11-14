import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { colors, fonts, T, onFocus, onBlur } from "@/theme";
import { toast } from "sonner";
import api from "@/utils/api";
import v2 from "@/utils/v2api";
import {
  Plus, Trash2, Shield, UserPlus, RefreshCw, Mail, CheckCircle,
  Clock, X, Eye, Lock, ChevronDown, Search, Users as UsersIcon,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function Users() {
  const { user: currentUser, token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showResetPw, setShowResetPw] = useState(null); // user obj
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
    const newRole = u.role === "superadmin" ? "user" : "superadmin";
    try {
      const res = await fetch(`${API}/api/admin/users/${u.id}/role`, {
        method: "PATCH", 
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) { toast.success(`Role updated to ${newRole}`); loadUsers(); }
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
                backgroundColor: u.role === "superadmin" ? "rgba(139,92,246,0.12)" : "rgba(96,165,250,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                fontFamily: fonts.heading, fontSize: "13px", fontWeight: "700",
                color: u.role === "superadmin" ? "#8B5CF6" : "#60A5FA",
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
              {u.role === "superadmin" && (
                <span style={{ display: "block", marginTop: "2px", fontSize: "10px", fontFamily: fonts.mono, color: "#8B5CF6" }}>Admin</span>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => toggleRole(u)} title={u.role === "superadmin" ? "Demote" : "Promote"} style={{
                padding: "6px", borderRadius: "6px", border: `1px solid ${colors.border.default}`,
                backgroundColor: colors.bg.base, cursor: "pointer", color: colors.text.secondary,
              }}><Shield size={13} /></button>
              <button onClick={() => setShowResetPw(u)} title="Reset Password" data-testid={`reset-pw-${u.id}`} style={{
                padding: "6px", borderRadius: "6px", border: `1px solid ${colors.border.default}`,
                backgroundColor: colors.bg.base, cursor: "pointer", color: colors.text.secondary,
              }}><Lock size={13} /></button>
              {u.id !== currentUser?.id && u.role !== "superadmin" && (
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
    </div>
  );
}

/* ── Invite Modal ── */
function InviteModal({ orgs, bots, token, onClose, onDone }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("user");
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
          role,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          username: username.trim().toLowerCase() || undefined,
          org_ids: selectedOrgs,
          bot_ids: selectedBots,
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

        {/* Role */}
        <div style={{ marginBottom: "18px" }}>
          <label style={T.label}>Role</label>
          <div style={{ display: "flex", gap: "8px" }}>
            {[{ v: "user", l: "Member" }, { v: "superadmin", l: "Admin" }].map(r => (
              <button key={r.v} onClick={() => setRole(r.v)} style={{
                flex: 1, padding: "10px", borderRadius: "8px", cursor: "pointer", textAlign: "center",
                border: `1px solid ${role === r.v ? colors.brand.light + "50" : colors.border.default}`,
                backgroundColor: role === r.v ? colors.brand.light + "0a" : colors.bg.base,
                fontFamily: fonts.body, fontSize: "12px", fontWeight: "600",
                color: role === r.v ? colors.brand.light : colors.text.secondary,
              }}>{r.l}</button>
            ))}
          </div>
        </div>

        {/* Assign to Organisations */}
        <div style={{ marginBottom: "18px" }}>
          <label style={T.label}>Assign to Organisations</label>
          {orgs.length === 0 ? (
            <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted }}>No organisations found.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {orgs.map(o => (
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
          )}
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
