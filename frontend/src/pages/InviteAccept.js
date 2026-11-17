import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../utils/api";
import { toast } from "sonner";
import { Loader2, CheckCircle, AlertCircle, UserPlus, ArrowRight, Layers } from "lucide-react";
import { colors, fonts, T, onFocus, onBlur } from "../theme";

import { userPasswordError } from "../utils/passwordPolicy";

import PasswordRequirements from "../components/PasswordRequirements";

export default function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/invite/${token}`);
        setInvite(res.data);
        if (res.data.first_name) setFirstName(res.data.first_name);
        if (res.data.last_name) setLastName(res.data.last_name);
        if (res.data.username) setUsername(res.data.username);
      } catch (e) {
        setError(e.response?.data?.detail || "Invalid or expired invitation");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    const pwError = userPasswordError(password, invite?.email || "");
    if (pwError) {
      toast.error(pwError);
      return;
    }
    if (!username.trim()) {
      toast.error("Username is required");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/invite/${token}/accept`, {
        username: username.trim(),
        password,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
      });
      setAccepted(true);
      toast.success("Account created!");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  };

  const cardStyle = {
    maxWidth: "420px", width: "100%", margin: "0 auto",
    backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
    borderRadius: "16px", padding: "36px 32px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
  };

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: colors.bg.base,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }} data-testid="invite-accept-page">
      {loading ? (
        <div style={{ textAlign: "center" }}>
          <Loader2 size={28} color={colors.text.muted} style={{ animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : error ? (
        <div style={cardStyle} data-testid="invite-error-card">
          <div style={{ textAlign: "center" }}>
            <AlertCircle size={40} color="#F43F5E" style={{ marginBottom: "16px" }} />
            <h2 style={{ fontFamily: fonts.heading, fontSize: "20px", color: colors.text.primary, margin: "0 0 8px" }}>
              Invitation Invalid
            </h2>
            <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.text.secondary, margin: "0 0 24px", lineHeight: 1.6 }}>
              {error}
            </p>
            <Link to="/login" style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              color: colors.brand.cyan, textDecoration: "none", fontFamily: fonts.body, fontSize: "13px",
            }}>
              Go to Login <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      ) : accepted ? (
        <div style={cardStyle} data-testid="invite-success-card">
          <div style={{ textAlign: "center" }}>
            <CheckCircle size={40} color="#34D399" style={{ marginBottom: "16px" }} />
            <h2 style={{ fontFamily: fonts.heading, fontSize: "20px", color: colors.text.primary, margin: "0 0 8px" }}>
              Welcome to BitBot Pro!
            </h2>
            <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.text.secondary, margin: "0 0 24px", lineHeight: 1.6 }}>
              Your account has been created. You can now log in with your credentials.
            </p>
            <button onClick={() => navigate("/login")} data-testid="invite-go-to-login-btn"
              style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "10px 28px", borderRadius: "10px", border: "none",
                background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.cyan})`,
                color: "#fff", fontSize: "14px", fontWeight: "600",
                fontFamily: fonts.body, cursor: "pointer",
              }}>
              Go to Login <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div style={cardStyle} data-testid="invite-form-card">
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "14px",
              background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.cyan})`,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              marginBottom: "16px",
            }}>
              <UserPlus size={22} color="#fff" />
            </div>
            <h2 style={{ fontFamily: fonts.heading, fontSize: "20px", color: colors.text.primary, margin: "0 0 6px" }}>
              Join BitBot Pro
            </h2>
            <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.muted, margin: 0 }}>
              <strong>{invite.invited_by_email}</strong> invited you as{" "}
              {invite.role === "superadmin" ? "an Admin" : "a Team Member"}
            </p>
            {invite.workspace_name && (
              <div data-testid="invite-workspace-info" style={{
                marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "6px 14px", borderRadius: "8px",
                backgroundColor: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
              }}>
                <Layers size={12} color={colors.brand.light} />
                <span style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.brand.light, fontWeight: "500" }}>
                  {invite.workspace_name}
                </span>
                <span style={{
                  fontFamily: fonts.mono, fontSize: "9px", textTransform: "uppercase",
                  color: colors.text.muted, letterSpacing: "0.08em",
                }}>
                  {invite.workspace_role || "member"}
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <label style={T.label}>Email</label>
            <input readOnly value={invite.email} data-testid="invite-email-field"
              style={{ ...T.input, marginBottom: "14px", color: colors.text.muted, backgroundColor: colors.bg.surface }} />

            {/* Name row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
              <div>
                <label style={T.label}>First Name</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)}
                  placeholder="John" autoComplete="given-name" data-testid="invite-first-name-input"
                  style={{ ...T.input, width: "100%" }} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={T.label}>Last Name</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)}
                  placeholder="Doe" autoComplete="family-name" data-testid="invite-last-name-input"
                  style={{ ...T.input, width: "100%" }} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            <label style={T.label}>Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)}
              placeholder="Choose a username" autoComplete="username" data-testid="invite-username-input"
              style={{ ...T.input, marginBottom: "14px" }} onFocus={onFocus} onBlur={onBlur} />

            <label style={T.label}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="At least 12 characters" autoComplete="new-password" data-testid="invite-password-input"
              style={{ ...T.input, marginBottom: "4px" }} onFocus={onFocus} onBlur={onBlur} />
            <PasswordRequirements password={password} email={invite?.email || ""} />

            <label style={T.label}>Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password" autoComplete="new-password" data-testid="invite-confirm-password-input"
              style={{ ...T.input, marginBottom: "20px" }} onFocus={onFocus} onBlur={onBlur} />

            <button type="submit" disabled={submitting} data-testid="invite-submit-btn"
              style={{
                width: "100%", padding: "12px", borderRadius: "10px", border: "none",
                background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.cyan})`,
                color: "#fff", fontSize: "14px", fontWeight: "600",
                fontFamily: fonts.body, cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.5 : 1, transition: "opacity 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}>
              {submitting ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle size={16} />}
              {submitting ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "20px", fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted }}>
            Already have an account? <Link to="/login" style={{ color: colors.brand.cyan, textDecoration: "none" }}>Log in</Link>
          </p>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
