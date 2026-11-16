import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { colors, fonts, radius, T, onFocus, onBlur } from "@/theme";
import { toast } from "sonner";
import { User, Lock, Save, Loader2, Check, Eye, EyeOff } from "lucide-react";

export default function Profile() {
  const { user, token, refreshUser } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      setUsername(user.username || "");
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/profile`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, username }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Profile updated");
        if (refreshUser) refreshUser();
      } else toast.error(data.detail || "Failed to update");
    } catch { toast.error("Failed to update profile"); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (newPw.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    if (newPw !== confirmPw) { toast.error("Passwords don't match"); return; }
    setChangingPw(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/change-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Password changed");
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
      } else toast.error(data.detail || "Failed to change password");
    } catch { toast.error("Failed to change password"); }
    finally { setChangingPw(false); }
  };

  if (!user) return null;

  const initials = `${(user.first_name || user.email || "?")[0]}${(user.last_name || "")[0] || ""}`.toUpperCase();

  return (
    <div data-testid="profile-page" style={{ padding: "32px 40px", maxWidth: "640px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
        <div style={{
          width: "56px", height: "56px", borderRadius: "50%",
          background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.light})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: fonts.heading, fontSize: "20px", fontWeight: "700", color: "#fff",
          boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
        }}>
          {initials}
        </div>
        <div>
          <h1 style={{ fontFamily: fonts.heading, fontSize: "24px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
            Profile
          </h1>
          <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.muted, margin: "2px 0 0" }}>
            {user.email}
          </p>
        </div>
      </div>

      {/* Profile Info */}
      <div data-testid="profile-info-section" style={{
        padding: "24px", borderRadius: radius.lg,
        backgroundColor: colors.bg.surface, border: `1px solid ${colors.border.default}`,
        marginBottom: "24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
          <User size={16} color={colors.brand.light} />
          <h2 style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
            Personal Information
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
          <div>
            <label style={T.label}>First Name</label>
            <input data-testid="profile-first-name" value={firstName} onChange={e => setFirstName(e.target.value)}
              placeholder="First name" style={{ ...T.input, width: "100%" }} onFocus={onFocus} onBlur={onBlur} />
          </div>
          <div>
            <label style={T.label}>Last Name</label>
            <input data-testid="profile-last-name" value={lastName} onChange={e => setLastName(e.target.value)}
              placeholder="Last name" style={{ ...T.input, width: "100%" }} onFocus={onFocus} onBlur={onBlur} />
          </div>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={T.label}>Username</label>
          <input data-testid="profile-username" value={username} onChange={e => setUsername(e.target.value)}
            placeholder="username" style={{ ...T.input, width: "100%" }} onFocus={onFocus} onBlur={onBlur} />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={T.label}>Email</label>
          <input value={user.email} disabled style={{
            ...T.input, width: "100%", opacity: 0.5, cursor: "not-allowed",
          }} />
          <p style={{ fontFamily: fonts.body, fontSize: "10px", color: colors.text.muted, margin: "4px 0 0" }}>
            Email cannot be changed.
          </p>
        </div>

        <button data-testid="save-profile-btn" onClick={handleSaveProfile} disabled={saving} style={{
          ...T.btnPrimary, opacity: saving ? 0.6 : 1,
        }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Change Password */}
      <div data-testid="change-password-section" style={{
        padding: "24px", borderRadius: radius.lg,
        backgroundColor: colors.bg.surface, border: `1px solid ${colors.border.default}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
          <Lock size={16} color={colors.brand.light} />
          <h2 style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
            Change Password
          </h2>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={T.label}>Current Password</label>
          <div style={{ position: "relative" }}>
            <input data-testid="current-password" type={showCurrentPw ? "text" : "password"}
              value={currentPw} onChange={e => setCurrentPw(e.target.value)}
              placeholder="Enter current password" style={{ ...T.input, width: "100%", paddingRight: "40px" }}
              onFocus={onFocus} onBlur={onBlur} />
            <button onClick={() => setShowCurrentPw(!showCurrentPw)} style={{
              position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "4px",
            }}>
              {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={T.label}>New Password</label>
          <div style={{ position: "relative" }}>
            <input data-testid="new-password" type={showNewPw ? "text" : "password"}
              value={newPw} onChange={e => setNewPw(e.target.value)}
              placeholder="At least 6 characters" style={{ ...T.input, width: "100%", paddingRight: "40px" }}
              onFocus={onFocus} onBlur={onBlur} />
            <button onClick={() => setShowNewPw(!showNewPw)} style={{
              position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "4px",
            }}>
              {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: "18px" }}>
          <label style={T.label}>Confirm New Password</label>
          <input data-testid="confirm-password" type="password"
            value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
            placeholder="Re-enter new password" style={{ ...T.input, width: "100%" }}
            onFocus={onFocus} onBlur={onBlur} />
          {newPw && confirmPw && newPw !== confirmPw && (
            <p style={{ fontFamily: fonts.body, fontSize: "10px", color: "#F43F5E", margin: "4px 0 0" }}>
              Passwords don't match
            </p>
          )}
          {newPw && confirmPw && newPw === confirmPw && (
            <p style={{ fontFamily: fonts.body, fontSize: "10px", color: "#22C55E", margin: "4px 0 0", display: "flex", alignItems: "center", gap: "4px" }}>
              <Check size={10} /> Passwords match
            </p>
          )}
        </div>

        <button data-testid="change-password-btn" onClick={handleChangePassword}
          disabled={changingPw || !currentPw || !newPw || newPw !== confirmPw}
          style={{
            ...T.btnPrimary, opacity: (changingPw || !currentPw || !newPw || newPw !== confirmPw) ? 0.6 : 1,
          }}>
          {changingPw ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
          {changingPw ? "Changing..." : "Change Password"}
        </button>
      </div>
    </div>
  );
}
