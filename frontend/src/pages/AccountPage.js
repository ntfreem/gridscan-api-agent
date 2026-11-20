/**
 * Account page — change password, sign out everywhere, delete account.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import {
  User, Shield, LogOut, Trash2, Loader2, CheckCircle, AlertTriangle, Key,
} from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur } from "../theme";
import { toast } from "sonner";

export default function AccountPage() {
  const { user, api, logout } = useSession();
  const navigate = useNavigate();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const handleChangePw = async (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) { toast.error("Passwords do not match"); return; }
    if (newPw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setChangingPw(true);
    try {
      await api.changePassword(currentPw, newPw);
      toast.success("Password updated");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) { toast.error(err.detail || "Failed to change password"); }
    finally { setChangingPw(false); }
  };

  const handleLogoutAll = async () => {
    setLoggingOutAll(true);
    try {
      await api.logoutAll();
      toast.success("All sessions ended");
      logout();
      navigate("/login");
    } catch (err) { toast.error(err.detail || "Failed"); }
    finally { setLoggingOutAll(false); }
  };

  return (
    <div style={T.page} data-testid="account-page">
      <p style={T.overline}>Account</p>
      <h1 style={T.h1}>My Account</h1>

      {/* Profile info */}
      <div style={{ ...T.card, marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
          <User size={16} color={colors.brand.light} />
          <p style={T.sectionTitle}>Profile</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px", fontFamily: fonts.body, fontSize: "13px" }}>
          <span style={{ color: colors.text.muted }}>Name</span>
          <span style={{ color: colors.text.primary }}>{user?.name || "—"}</span>
          <span style={{ color: colors.text.muted }}>Email</span>
          <span style={{ color: colors.text.primary }}>{user?.email || "—"}</span>
          <span style={{ color: colors.text.muted }}>Role</span>
          <span style={{ color: colors.text.primary }}>{user?.platform_role || user?.role || "member"}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* Change Password */}
        <div style={T.card}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <Key size={16} color="#A78BFA" />
            <p style={T.sectionTitle}>Change Password</p>
          </div>
          <form onSubmit={handleChangePw}>
            <label style={T.label}>Current Password</label>
            <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} data-testid="current-password"
              style={{ ...T.input, marginBottom: "10px" }} onFocus={onFocus} onBlur={onBlur} required />
            <label style={T.label}>New Password</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} data-testid="new-password"
              placeholder="At least 8 characters" style={{ ...T.input, marginBottom: "10px" }} onFocus={onFocus} onBlur={onBlur} required />
            <label style={T.label}>Confirm New Password</label>
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} data-testid="confirm-password"
              style={{ ...T.input, marginBottom: "14px" }} onFocus={onFocus} onBlur={onBlur} required />
            <button type="submit" disabled={changingPw} data-testid="change-password-btn"
              style={{ ...T.btnPrimary, opacity: changingPw ? 0.6 : 1 }}>
              {changingPw ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle size={14} />}
              {changingPw ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>

        {/* Session & Security */}
        <div style={T.card}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <Shield size={16} color="#34D399" />
            <p style={T.sectionTitle}>Security</p>
          </div>
          <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, marginBottom: "14px" }}>
            Sign out from all devices and sessions. You will need to sign in again.
          </p>
          <button onClick={handleLogoutAll} disabled={loggingOutAll} data-testid="logout-all-btn"
            style={{ ...T.btnSecondary, marginBottom: "20px" }}>
            {loggingOutAll ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <LogOut size={14} />}
            {loggingOutAll ? "Ending sessions..." : "Sign Out Everywhere"}
          </button>
          <div style={{ borderTop: `1px solid ${colors.border.muted}`, paddingTop: "14px" }}>
            <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.brand.error, marginBottom: "10px" }}>
              Danger Zone
            </p>
            <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, marginBottom: "10px" }}>
              Account deletion is permanent and cannot be undone.
            </p>
            <button style={{ ...T.btnGhost, color: colors.brand.error, borderColor: "rgba(244,63,94,0.3)" }}
              onClick={() => toast.info("Contact your administrator to delete your account")}>
              <Trash2 size={12} /> Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
