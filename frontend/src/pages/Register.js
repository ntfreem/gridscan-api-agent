import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { ArrowRight } from "lucide-react";
import BridgeBotLogo from "../components/BridgeBotLogo";
import { colors, fonts, radius, T, onFocus, onBlur } from "../theme";

import { API_BASE } from "../utils/apiBase";

import { userPasswordError } from "../utils/passwordPolicy";

import PasswordRequirements from "../components/PasswordRequirements";

const BASE = API_BASE;

export const INVITE_ONLY_MESSAGE =
  "BitBot Pro accounts are by invitation only. Ask your workspace administrator to invite you, then use the link in the invitation email.";

export default function Register() {
  // "invite_only" in production (spec 008, P8): no public sign-up form.
  const [mode, setMode] = useState(null);
  useEffect(() => {
    axios.get(`${BASE}/auth/registration-mode`)
      .then(r => setMode(r.data?.mode === "open" ? "open" : "invite_only"))
      .catch(() => setMode("invite_only"));   // fail closed: never show a form that cannot work
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    const pwError = userPasswordError(password, email);
    if (pwError) { setError(pwError); return; }
    if (!username.trim()) { setError("Username is required"); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${BASE}/auth/register`, { email, password, username: username.trim() });
      // Uniform answer (spec 008, S1): it never says whether the address already had an account.
      setSuccess(res.data?.message || "If this email can be registered, a verification code has been sent.");
      setTimeout(() => navigate(`/verify?email=${encodeURIComponent(email)}`), 1800);
    } catch (err) { setError(err.response?.data?.detail || "Registration failed."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: colors.bg.base,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px", fontFamily: fonts.body,
    }}>
      <div style={{ position: "fixed", top: "-20%", left: "-10%", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{
        width: "100%", maxWidth: "420px", backgroundColor: colors.bg.surface,
        border: `1px solid ${colors.border.default}`, borderRadius: radius.xl,
        padding: "40px 36px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", position: "relative", zIndex: 1,
      }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px", justifyContent: "center", textDecoration: "none" }}>
          <BridgeBotLogo size={44} />
          <span style={{ fontFamily: fonts.heading, fontSize: "22px", fontWeight: "700", color: colors.text.primary }}>BitBot <span style={{ color: colors.brand.light }}>Pro</span></span>
        </Link>

        <h1 style={{ fontFamily: fonts.heading, fontSize: "24px", fontWeight: "700", color: colors.text.primary, textAlign: "center", margin: "0 0 6px" }}>Create account</h1>
        <p style={{ fontSize: "14px", color: colors.text.secondary, textAlign: "center", marginBottom: "28px" }}>Join BitBot Pro and start building</p>

        {mode !== "open" ? (
          <div data-testid="register-invite-only" style={{ fontSize: "14px", color: colors.text.secondary, textAlign: "center", lineHeight: 1.6 }}>
            {mode === null ? "Loading…" : INVITE_ONLY_MESSAGE}
            <p style={{ marginTop: "20px" }}><Link to="/login" style={{ color: colors.brand.light }}>Back to sign in</Link></p>
          </div>
        ) : (<>
        {error && <div style={T.err} data-testid="register-error">{error}</div>}
        {success && <div style={T.success} data-testid="register-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <label style={T.label}>Email</label>
          <input data-testid="register-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" style={{ ...T.input, marginBottom: "14px" }} onFocus={onFocus} onBlur={onBlur} required />
          <label style={T.label}>Username</label>
          <input data-testid="register-username" type="text" value={username} onChange={e => setUsername(e.target.value)}
            placeholder="Choose a unique username" style={{ ...T.input, marginBottom: "14px" }} onFocus={onFocus} onBlur={onBlur} required />
          <label style={T.label}>Password</label>
          <input data-testid="register-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="At least 12 characters" style={{ ...T.input, marginBottom: "4px" }} onFocus={onFocus} onBlur={onBlur} required />
          <PasswordRequirements password={password} email={email} />
          <label style={T.label}>Confirm Password</label>
          <input data-testid="register-confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder="Repeat password" style={{ ...T.input, marginBottom: "20px" }} onFocus={onFocus} onBlur={onBlur} required />
          <button data-testid="register-submit" type="submit" style={{ ...T.btnPrimary, width: "100%", justifyContent: "center", padding: "12px", opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? "Creating account..." : <>Create Account <ArrowRight size={15} /></>}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "13px", color: colors.text.secondary }}>
          Already have an account? <Link to="/login" style={{ color: colors.brand.light, textDecoration: "none", fontWeight: "600" }}>Sign in</Link>
        </p>
        </>)}
      </div>
    </div>
  );
}
