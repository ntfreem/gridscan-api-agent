/**
 * Remaining placeholder pages.
 */
import { colors, fonts, T } from "../theme";
import { Users } from "lucide-react";

export function NotFoundPage() {
  return (
    <div style={{ ...T.page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: "100vh" }}>
      <h1 style={{ fontFamily: fonts.heading, fontSize: "64px", fontWeight: "700", color: colors.brand.light, margin: 0 }}>404</h1>
      <p style={{ fontFamily: fonts.body, fontSize: "16px", color: colors.text.secondary, margin: "8px 0 0" }}>Page not found</p>
    </div>
  );
}

export function InvitationsPage() {
  return (
    <div style={{ ...T.page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", paddingTop: "60px" }}>
      <div style={{
        width: "56px", height: "56px", borderRadius: "14px",
        backgroundColor: "rgba(59,130,246,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px",
      }}>
        <Users size={24} color={colors.brand.light} />
      </div>
      <h1 style={{ fontFamily: fonts.heading, fontSize: "22px", fontWeight: "700", color: colors.text.primary, margin: "0 0 8px" }}>
        Accept Invitation
      </h1>
      <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.text.secondary, maxWidth: "400px" }}>
        Use the invitation link from your email to join an enterprise.
      </p>
    </div>
  );
}
