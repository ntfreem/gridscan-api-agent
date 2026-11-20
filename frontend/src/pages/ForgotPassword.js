/**
 * ForgotPassword page — Original Emergent design with Spec 012 API.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { createClient } from "../app12/api/client";
import { makeApi } from "../app12/api/endpoints";
import BridgeBotLogo from "../components/BridgeBotLogo";
import { colors, fonts, T, onFocus, onBlur } from "../theme";

const api = makeApi(createClient({}));

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.detail || "Something went wrong. Please try again.");
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

        {sent ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "14px", backgroundColor: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Mail size={24} color={colors.brand.light} />
            </div>
            <h1 style={{ fontFamily: fonts.heading, fontSize: "24px", fontWeight: "700", color: colors.text.primary, margin: "0 0 10px" }}>Check your email</h1>
            <p style={{ fontSize: "14px", color: colors.text.secondary, lineHeight: "1.6", marginBottom: "24px" }}>
              If an account exists for <strong style={{ color: colors.text.primary }}>{email}</strong>, we've sent a password reset link.
            </p>
            <Link to="/login" style={{ color: colors.brand.light, fontSize: "14px", textDecoration: "none", fontWeight: "500", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 style={{ fontFamily: fonts.heading, fontSize: "26px", fontWeight: "700", color: colors.text.primary, margin: "0 0 8px", textAlign: "center" }}>
              Reset your password
            </h1>
            <p style={{ fontSize: "14px", color: colors.text.secondary, marginBottom: "28px", textAlign: "center" }}>
              Enter your email and we'll send you a reset link.
            </p>
            {error && <div style={T.err}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <label style={T.label}>Email</label>
              <input data-testid="forgot-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" style={{ ...T.input, marginBottom: "20px" }} onFocus={onFocus} onBlur={onBlur} required />
              <button data-testid="forgot-submit" type="submit" style={{ ...T.btnPrimary, width: "100%", justifyContent: "center", padding: "13px", fontSize: "14px", opacity: loading ? 0.7 : 1 }} disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
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
