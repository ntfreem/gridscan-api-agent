/**
 * Placeholder pages for Phase 1 — these will be fully built in Phases 2 & 3.
 * Each page follows the original Emergent design language.
 */
import { colors, fonts, T } from "../theme";
import { useSession } from "../context/SessionContext";
import { BookOpen, Key, Users, BarChart2, Shield, Zap, User, Settings, Network, Headphones } from "lucide-react";

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

export function KnowledgePage() {
  return <PlaceholderPage icon={BookOpen} title="Knowledge" subtitle="Knowledge source management coming in Phase 2." testId="knowledge-page" />;
}

export function CredentialsPage() {
  return <PlaceholderPage icon={Key} title="Credentials" subtitle="AI and integration credential management coming in Phase 2." testId="credentials-page" />;
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

export function AccountPage() {
  const { user } = useSession();
  return (
    <div style={T.page} data-testid="account-page">
      <p style={T.overline}>Account</p>
      <h1 style={T.h1}>My Account</h1>
      <div style={T.card}>
        <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.text.primary, marginBottom: "8px" }}>
          <strong>Name:</strong> {user?.name || "—"}
        </p>
        <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.text.primary, marginBottom: "8px" }}>
          <strong>Email:</strong> {user?.email || "—"}
        </p>
        <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.text.secondary }}>
          Full account management (change password, delete account) coming in Phase 2.
        </p>
      </div>
    </div>
  );
}

export function BotSettingsPage() {
  return <PlaceholderPage icon={Settings} title="Bot Settings" subtitle="Bot configuration and AI behaviour settings coming in Phase 2." testId="bot-settings-page" />;
}

export function BotKnowledgePage() {
  return <PlaceholderPage icon={BookOpen} title="Bot Knowledge" subtitle="Bot knowledge base management coming in Phase 2." testId="bot-knowledge-page" />;
}

export function BotInstancesPage() {
  return <PlaceholderPage icon={Network} title="Bot Instances" subtitle="Channel instances management coming in Phase 2." testId="bot-instances-page" />;
}

export function BotIntegrationsPage() {
  return <PlaceholderPage icon={Headphones} title="Integrations" subtitle="Zendesk and external integration management coming in Phase 3." testId="bot-integrations-page" />;
}

export function InstancePage() {
  return <PlaceholderPage icon={Network} title="Instance" subtitle="Instance configuration coming in Phase 3." testId="instance-page" />;
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
  return <PlaceholderPage icon={Users} title="Accept Invitation" subtitle="Invitation acceptance flow coming in Phase 2." testId="invitations-page" />;
}
