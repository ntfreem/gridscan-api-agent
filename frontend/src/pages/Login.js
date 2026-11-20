/**
 * Login page — Original Emergent design language with Spec 012 session cookies.
 */
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { ArrowRight } from "lucide-react";
import BridgeBotLogo from "../components/BridgeBotLogo";
import { colors, fonts, radius, T, onFocus, onBlur } from "../theme";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useSession();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(email, password);
      navigate("/admin");
    } catch (err) {
      setError(err.detail || err.message || "Login failed. Check your credentials.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: colors.bg.base, padding: "40px 20px" }}>
      <div style={{ width: "100%", maxWidth: "400px", fontFamily: fonts.body }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "40px", justifyContent: "center", textDecoration: "none" }}>
          <BridgeBotLogo size={44} />
          <span style={{ fontFamily: fonts.heading, fontSize: "22px", fontWeight: "700", color: colors.text.primary }}>
            BitBot <span style={{ color: colors.brand.light }}>Pro</span>
          </span>
        </Link>

        <h1 data-testid="login-heading" style={{ fontFamily: fonts.heading, fontSize: "30px", fontWeight: "700", color: colors.text.primary, margin: "0 0 8px", letterSpacing: "-0.3px", textAlign: "center" }}>
          Welcome back
        </h1>
        <p style={{ fontSize: "15px", color: colors.text.secondary, marginBottom: "32px", lineHeight: "1.5", textAlign: "center" }}>
          Sign in to your AI workspace
        </p>

        {error && <div style={T.err} data-testid="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={T.label}>Email</label>
          <input data-testid="login-email" type="text" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" style={{ ...T.input, marginBottom: "16px" }} onFocus={onFocus} onBlur={onBlur} required />

          <label style={T.label}>Password</label>
          <input data-testid="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Enter your password" style={{ ...T.input, marginBottom: "6px" }} onFocus={onFocus} onBlur={onBlur} required />

          <div style={{ textAlign: "right", marginBottom: "24px" }}>
            <Link to="/forgot-password" data-testid="forgot-password-link"
              style={{ fontSize: "13px", color: colors.text.muted, textDecoration: "none" }}>
              Forgot password?
            </Link>
          </div>

          <button data-testid="login-submit" type="submit"
            style={{
              ...T.btnPrimary, width: "100%", justifyContent: "center",
              padding: "13px", fontSize: "14px",
              opacity: loading ? 0.7 : 1,
            }} disabled={loading}>
            {loading ? "Signing in..." : <>Sign In <ArrowRight size={16} /></>}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "28px", fontSize: "14px", color: colors.text.secondary }}>
          Invited to an enterprise?{" "}
          <Link to="/invitations" data-testid="register-link" style={{ color: colors.brand.light, textDecoration: "none", fontWeight: "500" }}>
            Accept Invitation
          </Link>
        </p>
      </div>
    </div>
  );
}
