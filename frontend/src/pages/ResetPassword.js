/**
 * ResetPassword page — reads token from URL fragment, Spec 012 API.
 */
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { createClient } from "../app12/api/client";
import { makeApi } from "../app12/api/endpoints";
import BridgeBotLogo from "../components/BridgeBotLogo";
import { colors, fonts, T, onFocus, onBlur } from "../theme";

const api = makeApi(createClient({}));

export default function ResetPassword() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/token=([^&]+)/);
    if (match) {
      setToken(decodeURIComponent(match[1]));
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError(""); setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.detail || "Reset failed. The link may have expired.");
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

        {done ? (
          <div style={{ textAlign: "center" }}>
            <CheckCircle size={40} color={colors.brand.success} style={{ margin: "0 auto 16px" }} />
            <h1 style={{ fontFamily: fonts.heading, fontSize: "24px", fontWeight: "700", color: colors.text.primary, margin: "0 0 10px" }}>Password Reset</h1>
            <p style={{ fontSize: "14px", color: colors.text.secondary, marginBottom: "24px" }}>
              Your password has been updated. You can now sign in.
            </p>
            <button onClick={() => navigate("/login")} style={{ ...T.btnPrimary, margin: "0 auto", justifyContent: "center", padding: "12px 28px" }}>
              Sign In
            </button>
          </div>
        ) : (
          <>
            <h1 style={{ fontFamily: fonts.heading, fontSize: "26px", fontWeight: "700", color: colors.text.primary, margin: "0 0 8px", textAlign: "center" }}>
              Set new password
            </h1>
            <p style={{ fontSize: "14px", color: colors.text.secondary, marginBottom: "28px", textAlign: "center" }}>
              Enter your new password below.
            </p>
            {error && <div style={T.err}>{error}</div>}
            {!token && (
              <div style={{ ...T.err, marginBottom: "16px" }}>
                No reset token found. Please use the link from your email.
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <label style={T.label}>New Password</label>
              <input data-testid="reset-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters" style={{ ...T.input, marginBottom: "16px" }} onFocus={onFocus} onBlur={onBlur} required />
              <label style={T.label}>Confirm Password</label>
              <input data-testid="reset-confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Confirm new password" style={{ ...T.input, marginBottom: "20px" }} onFocus={onFocus} onBlur={onBlur} required />
              <button data-testid="reset-submit" type="submit"
                style={{ ...T.btnPrimary, width: "100%", justifyContent: "center", padding: "13px", fontSize: "14px", opacity: (loading || !token) ? 0.7 : 1 }}
                disabled={loading || !token}>
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
            <p style={{ textAlign: "center", marginTop: "24px" }}>
              <Link to="/login" style={{ color: colors.text.muted, fontSize: "13px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <ArrowLeft size={13} /> Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
