import { useSearchParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import BridgeBotLogo from "../components/BridgeBotLogo";
import { colors, fonts } from "../theme";

import { API_BASE } from "../utils/apiBase";

export default function DiscordInvited() {
  const [params] = useSearchParams();
  const guild = params.get("guild") || "your Discord server";
  const bot = params.get("bot") || "BitBot Pro";
  const hasError = params.get("error") === "1";
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Silently check if a session exists — use raw axios so 401 doesn't bounce to login
    const token = localStorage.getItem("bf_token");
    if (!token) return;
    axios.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      withCredentials: true,
    }).then(r => {
      if (r.data?.role === "superadmin") setIsAdmin(true);
    }).catch(() => {});
  }, []);

  if (hasError) {
    return (
      <div data-testid="discord-invited-error" style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ ...badgeStyle, background: `linear-gradient(135deg, ${colors.brand.error}, #DC2626)`, boxShadow: `0 8px 24px ${colors.brand.error}33` }}>
            <AlertCircle size={36} color="#FFFFFF" strokeWidth={2.5} />
          </div>
          <h1 style={headingStyle}>Something went wrong</h1>
          <p style={subtitleStyle}>
            The bot could not be added to your Discord server. This is usually a temporary issue.
            You can try the invite link again, or ask the admin who sent it to you to retry.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="discord-invited-page" style={pageStyle}>
      <div style={cardStyle}>
        <div style={badgeStyle}>
          <CheckCircle size={36} color="#FFFFFF" strokeWidth={2.5} />
        </div>

        <h1 style={headingStyle}>You{`'`}re all set!</h1>

        <p style={subtitleStyle}>
          <strong style={{ color: colors.text.primary }}>{bot}</strong> has been successfully added to
          <strong style={{ color: colors.text.primary }}> {guild}</strong>.
        </p>

        <div style={{
          padding: "16px 18px",
          backgroundColor: colors.bg.base,
          border: `1px solid ${colors.border.subtle}`,
          borderRadius: "12px",
          textAlign: "left",
          marginBottom: "20px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <BridgeBotLogo size={38} />
            <div>
              <p style={{ margin: "0 0 6px", fontFamily: fonts.heading, fontSize: "13px", fontWeight: "600", color: colors.text.primary }}>
                What happens next?
              </p>
              <p style={{ margin: 0, fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, lineHeight: "1.6" }}>
                The BitBot Pro admin will configure {bot}{`'`}s knowledge base, persona, and channel
                permissions on their end. The bot will start responding in your server once setup
                is complete. You don{`'`}t need to do anything else — you can close this page.
              </p>
            </div>
          </div>
        </div>

        {isAdmin && (
          <Link
            to="/admin/discord"
            data-testid="invited-admin-link"
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "10px 18px",
              backgroundColor: colors.brand.light, color: "#0B1120",
              borderRadius: "10px", textDecoration: "none",
              fontFamily: fonts.body, fontSize: "13px", fontWeight: "600",
              marginTop: "4px",
            }}
          >
            Open admin panel <ArrowRight size={14} />
          </Link>
        )}

        <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, margin: "20px 0 0", lineHeight: "1.5" }}>
          Need to remove the bot? Open your Discord server settings → Integrations → {bot} → Remove.
        </p>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: `radial-gradient(at top, ${colors.bg.surface} 0%, ${colors.bg.base} 60%)`,
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "32px 20px",
};

const cardStyle = {
  maxWidth: "520px", width: "100%",
  backgroundColor: colors.bg.surface,
  border: `1px solid ${colors.border.default}`,
  borderRadius: "20px",
  padding: "44px 36px",
  textAlign: "center",
  boxShadow: "0 24px 48px rgba(15,23,42,0.18)",
};

const badgeStyle = {
  width: "72px", height: "72px",
  borderRadius: "50%",
  background: `linear-gradient(135deg, ${colors.brand.success}, ${colors.brand.cyan})`,
  display: "flex", alignItems: "center", justifyContent: "center",
  margin: "0 auto 22px",
  boxShadow: `0 8px 24px ${colors.brand.success}33`,
};

const headingStyle = {
  fontFamily: fonts.heading,
  fontSize: "26px", fontWeight: "700",
  color: colors.text.primary,
  margin: "0 0 10px",
  letterSpacing: "-0.3px",
};

const subtitleStyle = {
  fontFamily: fonts.body,
  fontSize: "15px",
  color: colors.text.secondary,
  margin: "0 0 24px",
  lineHeight: "1.6",
};
