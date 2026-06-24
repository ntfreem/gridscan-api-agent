import { useSearchParams } from "react-router-dom";
import { CheckCircle, Bot } from "lucide-react";
import { colors, fonts } from "../theme";

export default function DiscordInvited() {
  const [params] = useSearchParams();
  const guild = params.get("guild") || "your Discord server";
  const bot = params.get("bot") || "BridgeBot";

  return (
    <div
      data-testid="discord-invited-page"
      style={{
        minHeight: "100vh",
        background: `radial-gradient(at top, ${colors.bg.surface} 0%, ${colors.bg.base} 60%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "32px 20px",
      }}
    >
      <div style={{
        maxWidth: "520px", width: "100%",
        backgroundColor: colors.bg.surface,
        border: `1px solid ${colors.border.default}`,
        borderRadius: "20px",
        padding: "44px 36px",
        textAlign: "center",
        boxShadow: "0 24px 48px rgba(15,23,42,0.18)",
      }}>
        <div style={{
          width: "72px", height: "72px",
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${colors.brand.success}, ${colors.brand.cyan})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 22px",
          boxShadow: `0 8px 24px ${colors.brand.success}33`,
        }}>
          <CheckCircle size={36} color="#FFFFFF" strokeWidth={2.5} />
        </div>

        <h1 style={{
          fontFamily: fonts.heading,
          fontSize: "26px", fontWeight: "700",
          color: colors.text.primary,
          margin: "0 0 10px",
          letterSpacing: "-0.3px",
        }}>
          You{`'`}re all set!
        </h1>

        <p style={{
          fontFamily: fonts.body,
          fontSize: "15px",
          color: colors.text.secondary,
          margin: "0 0 24px",
          lineHeight: "1.6",
        }}>
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
            <Bot size={18} color={colors.brand.light} style={{ marginTop: "1px", flexShrink: 0 }} />
            <div>
              <p style={{
                margin: "0 0 6px",
                fontFamily: fonts.heading,
                fontSize: "13px", fontWeight: "600",
                color: colors.text.primary,
              }}>
                What happens next?
              </p>
              <p style={{
                margin: 0,
                fontFamily: fonts.body,
                fontSize: "12px",
                color: colors.text.secondary,
                lineHeight: "1.6",
              }}>
                The BridgeBot admin will configure {bot}{`'`}s knowledge base, persona, and channel
                permissions on their end. The bot will start responding in your server once setup
                is complete. You don{`'`}t need to do anything else — you can close this page.
              </p>
            </div>
          </div>
        </div>

        <p style={{
          fontFamily: fonts.body,
          fontSize: "11px",
          color: colors.text.muted,
          margin: "20px 0 0",
          lineHeight: "1.5",
        }}>
          Need to remove the bot? Open your Discord server settings → Integrations → {bot} → Remove.
        </p>
      </div>
    </div>
  );
}
