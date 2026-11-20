/**
 * Members & Invitations page — team management with roles.
 */
import { useState, useEffect, useCallback } from "react";
import { useSession } from "../context/SessionContext";
import {
  Users, Plus, Trash2, Loader2, Search, Mail, Shield, UserCheck,
  ChevronDown, Crown, Eye,
} from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur, rowEnter, rowLeave } from "../theme";
import { toast } from "sonner";

const ROLE_LABELS = { superadmin: "Super Admin", admin: "Admin", member: "Member", viewer: "Viewer" };
const ROLE_COLORS = { superadmin: "#A78BFA", admin: "#60A5FA", member: "#34D399", viewer: "#94A3B8" };

export default function MembersPage() {
  const { selectedEnterprise, selectedOrg, api } = useSession();
  const [tab, setTab] = useState("members");
  const [scope, setScope] = useState("organisation");
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [searching, setSearching] = useState(false);

  const ownerId = scope === "enterprise" ? selectedEnterprise?.id : selectedOrg?.id;
  const ownerType = scope === "enterprise" ? "enterprise" : "organisation";

  const fetchMembers = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const data = await api.members(ownerType, ownerId);
      setMembers(data.members || data || []);
    } catch { setMembers([]); }
    finally { setLoading(false); }
  }, [ownerId, ownerType, api]);

  const fetchInvitations = useCallback(async () => {
    if (!selectedEnterprise?.id) return;
    try {
      const data = await api.invitations(selectedEnterprise.id);
      setInvitations(data.invitations || data || []);
    } catch { setInvitations([]); }
  }, [selectedEnterprise, api]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);
  useEffect(() => { if (tab === "invitations") fetchInvitations(); }, [tab, fetchInvitations]);

  const handleInvite = async () => {
    if (!invEmail.trim() || !selectedEnterprise?.id) return;
    setInviting(true);
    try {
      await api.invite(selectedEnterprise.id, { email: invEmail.trim(), role: invRole });
      toast.success(`Invitation sent to ${invEmail.trim()}`);
      setInvEmail(""); setShowInvite(false);
      fetchInvitations();
    } catch (err) { toast.error(err.detail || "Invitation failed"); }
    finally { setInviting(false); }
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      await api.patchMember(ownerType, ownerId, memberId, newRole);
      toast.success("Role updated");
      fetchMembers();
    } catch (err) { toast.error(err.detail || "Failed to update role"); }
  };

  const handleRemove = async (memberId) => {
    if (!window.confirm("Remove this member?")) return;
    try {
      await api.removeMember(ownerType, ownerId, memberId);
      toast.success("Member removed");
      fetchMembers();
    } catch (err) { toast.error(err.detail || "Failed to remove"); }
  };

  const handleRevokeInvitation = async (invId) => {
    try {
      await api.revokeInvitation(invId);
      toast.success("Invitation revoked");
      fetchInvitations();
    } catch (err) { toast.error(err.detail || "Failed to revoke"); }
  };

  const handleSearch = async (q) => {
    setSearchQ(q);
    if (q.length < 2) { setCandidates([]); return; }
    setSearching(true);
    try {
      const data = await api.memberCandidates(ownerType, ownerId, q);
      setCandidates(data.candidates || data || []);
    } catch { setCandidates([]); }
    finally { setSearching(false); }
  };

  const handleAddMember = async (userId, role = "member") => {
    if (!ownerId) return;
    try {
      await api.addMember(ownerType, ownerId, userId, role);
      toast.success("Member added");
      setCandidates([]); setSearchQ("");
      fetchMembers();
    } catch (err) { toast.error(err.detail || "Failed to add member"); }
  };

  if (!selectedEnterprise) {
    return (
      <div style={{ ...T.page, textAlign: "center", paddingTop: "80px" }}>
        <Users size={32} color={colors.border.default} style={{ margin: "0 auto 12px" }} />
        <p style={{ fontFamily: fonts.heading, fontSize: "18px", fontWeight: "600", color: colors.text.primary }}>Select an enterprise first</p>
      </div>
    );
  }

  return (
    <div style={T.page} data-testid="members-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <p style={T.overline}>Team</p>
          <h1 style={{ ...T.h1, marginBottom: 0 }}>Members</h1>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select value={scope} onChange={e => setScope(e.target.value)} style={{ ...T.input, width: "auto", padding: "8px 12px", fontSize: "12px" }}>
            <option value="organisation">Organisation</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <button onClick={() => setShowInvite(true)} data-testid="invite-btn" style={T.btnPrimary}>
            <Mail size={14} /> Invite
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px" }}>
        {["members", "invitations"].map(t => (
          <button key={t} onClick={() => setTab(t)} data-testid={`tab-${t}`}
            style={{
              padding: "8px 16px", borderRadius: radius.md, border: "none", cursor: "pointer",
              fontFamily: fonts.body, fontSize: "13px", fontWeight: tab === t ? "600" : "400",
              color: tab === t ? colors.brand.light : colors.text.secondary,
              backgroundColor: tab === t ? "rgba(59,130,246,0.1)" : "transparent",
              transition: "all 0.15s",
            }}>
            {t === "members" ? "Members" : "Invitations"}
          </button>
        ))}
      </div>

      {/* Add member search */}
      {tab === "members" && (
        <div style={{ marginBottom: "16px", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Search size={14} color={colors.text.muted} />
            <input value={searchQ} onChange={e => handleSearch(e.target.value)} placeholder="Search users to add..."
              data-testid="member-search" style={{ ...T.input, flex: 1 }} onFocus={onFocus} onBlur={onBlur} />
          </div>
          {candidates.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: "22px", right: 0, zIndex: 50,
              backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
              borderRadius: radius.md, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", maxHeight: "200px", overflowY: "auto",
            }}>
              {candidates.map(c => (
                <button key={c.id} onClick={() => handleAddMember(c.id)}
                  style={{
                    width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px",
                    background: "none", border: "none", borderBottom: `1px solid ${colors.border.muted}`,
                    cursor: "pointer", textAlign: "left", transition: "background-color 0.1s",
                  }}
                  onMouseEnter={rowEnter} onMouseLeave={rowLeave}>
                  <UserCheck size={14} color={colors.brand.light} />
                  <div>
                    <p style={{ fontFamily: fonts.body, fontSize: "12px", fontWeight: "500", color: colors.text.primary, margin: 0 }}>{c.name || c.email}</p>
                    {c.email && <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: 0 }}>{c.email}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
          <div data-testid="invite-modal" style={{ width: "420px", backgroundColor: colors.bg.panel, borderRadius: "16px", border: `1px solid ${colors.border.default}`, padding: "28px" }}>
            <h2 style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: "0 0 16px" }}>Invite Member</h2>
            <label style={T.label}>Email</label>
            <input value={invEmail} onChange={e => setInvEmail(e.target.value)} data-testid="invite-email" type="email"
              placeholder="colleague@company.com" style={{ ...T.input, marginBottom: "12px" }} onFocus={onFocus} onBlur={onBlur} />
            <label style={T.label}>Role</label>
            <select value={invRole} onChange={e => setInvRole(e.target.value)} style={{ ...T.input, marginBottom: "16px" }}>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowInvite(false)} style={T.btnGhost}>Cancel</button>
              <button onClick={handleInvite} disabled={inviting || !invEmail.trim()} data-testid="confirm-invite"
                style={{ ...T.btnPrimary, opacity: inviting || !invEmail.trim() ? 0.6 : 1 }}>
                {inviting ? "Sending..." : "Send Invitation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {tab === "members" && (
        loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}><Loader2 size={20} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} /></div>
        ) : members.length === 0 ? (
          <div style={{ ...T.card, textAlign: "center", padding: "48px 24px" }}>
            <Users size={32} color={colors.border.default} style={{ margin: "0 auto 12px" }} />
            <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "600", color: colors.text.primary, margin: "0 0 6px" }}>No members</p>
            <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary }}>Invite team members to get started.</p>
          </div>
        ) : (
          <div style={T.card}>
            {members.map((m, i) => (
              <div key={m.id || i} style={{
                display: "flex", alignItems: "center", gap: "12px", padding: "10px 0",
                borderBottom: i < members.length - 1 ? `1px solid ${colors.border.muted}` : "none",
              }}>
                <div style={{
                  width: "32px", height: "32px", borderRadius: radius.full,
                  backgroundColor: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontFamily: fonts.heading, fontSize: "12px", fontWeight: "700", color: colors.brand.light }}>
                    {(m.name || m.email || "?")[0].toUpperCase()}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "500", color: colors.text.primary, margin: 0 }}>{m.name || m.email}</p>
                  {m.email && <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "1px 0 0" }}>{m.email}</p>}
                </div>
                <select value={m.role || "member"} onChange={e => handleRoleChange(m.id, e.target.value)}
                  style={{ ...T.input, width: "auto", padding: "4px 8px", fontSize: "11px", color: ROLE_COLORS[m.role] || colors.text.secondary }}>
                  {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button onClick={() => handleRemove(m.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
                  <Trash2 size={13} color={colors.text.muted} />
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "invitations" && (
        invitations.length === 0 ? (
          <div style={{ ...T.card, textAlign: "center", padding: "48px 24px" }}>
            <Mail size={32} color={colors.border.default} style={{ margin: "0 auto 12px" }} />
            <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary }}>No pending invitations.</p>
          </div>
        ) : (
          <div style={T.card}>
            {invitations.map((inv, i) => (
              <div key={inv.id || i} style={{
                display: "flex", alignItems: "center", gap: "12px", padding: "10px 0",
                borderBottom: i < invitations.length - 1 ? `1px solid ${colors.border.muted}` : "none",
              }}>
                <Mail size={14} color={colors.text.muted} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.primary, margin: 0 }}>{inv.email}</p>
                  <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "1px 0 0" }}>
                    {inv.role || "member"} • {inv.state || "pending"}
                  </p>
                </div>
                <button onClick={() => handleRevokeInvitation(inv.id)}
                  style={{ ...T.btnGhost, fontSize: "11px", color: colors.brand.error, borderColor: "rgba(244,63,94,0.3)" }}>
                  <Trash2 size={11} /> Revoke
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
