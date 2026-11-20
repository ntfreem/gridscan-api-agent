/**
 * Placeholder pages for Phase 3 features (not yet built).
 */
import { colors, fonts, T } from "../theme";
import { Users, BarChart2, Shield, Zap } from "lucide-react";

function PlaceholderPage({ icon: Icon, title, subtitle, testId }) {
  return (
    <div style={T.page} data-testid={testId}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", paddingTop: "60px" }}>
        <div style={{
          width: "56px", height: "56px", borderRadius: "14px",
          backgroundColor: "rgba(59,130,246,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px",
        }}>
          <Icon size={24} color={colors.brand.light} />
        </div>
        <h1 style={{ fontFamily: fonts.heading, fontSize: "22px", fontWeight: "700", color: colors.text.primary, margin: "0 0 8px" }}>
          {title}
        </h1>
        <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.text.secondary, maxWidth: "400px" }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

export function MembersPage() {
  return <PlaceholderPage icon={Users} title="Members" subtitle="Team and access management coming in Phase 3." testId="members-page" />;
}

export function AnalyticsPage() {
  return <PlaceholderPage icon={BarChart2} title="Analytics" subtitle="Usage and analytics coming in Phase 3." testId="analytics-page" />;
}

export function PlatformPage() {
  return <PlaceholderPage icon={Shield} title="Platform Admin" subtitle="Platform superadmin controls coming in Phase 3." testId="platform-page" />;
}

export function DiscordAppsPage() {
  return <PlaceholderPage icon={Zap} title="Discord Applications" subtitle="Discord application management coming in Phase 3." testId="discord-apps-page" />;
}

export function NotFoundPage() {
  return (
    <div style={{ ...T.page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: "100vh" }}>
      <h1 style={{ fontFamily: fonts.heading, fontSize: "64px", fontWeight: "700", color: colors.brand.light, margin: 0 }}>404</h1>
      <p style={{ fontFamily: fonts.body, fontSize: "16px", color: colors.text.secondary, margin: "8px 0 0" }}>Page not found</p>
    </div>
  );
}

export function InvitationsPage() {
  return <PlaceholderPage icon={Users} title="Accept Invitation" subtitle="Invitation acceptance flow coming in Phase 3." testId="invitations-page" />;
}
