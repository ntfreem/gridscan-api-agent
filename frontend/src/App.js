/**
 * BitBotPro Frontend — Original Emergent design with Spec 012 backend.
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider, useSession } from "@/context/SessionContext";
import AdminLayout from "@/components/AdminLayout";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import BotList from "@/pages/BotList";
import BotOverview from "@/pages/BotOverview";
import BotSettingsPage from "@/pages/BotSettingsPage";
import BotKnowledgePage from "@/pages/BotKnowledgePage";
import BotInstancesPage from "@/pages/BotInstancesPage";
import BotIntegrationsPage from "@/pages/BotIntegrationsPage";
import CredentialsPage from "@/pages/CredentialsPage";
import KnowledgePage from "@/pages/KnowledgePage";
import AccountPage from "@/pages/AccountPage";
import InstancePage from "@/pages/InstancePage";
import MembersPage from "@/pages/MembersPage";
import PlatformPage from "@/pages/PlatformPage";
import DiscordAppsPage from "@/pages/DiscordAppsPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import ApiScraperPage from "@/pages/ApiScraperPage";
import { NotFoundPage, InvitationsPage } from "@/pages/Placeholders";
import { Loader2 } from "lucide-react";
import { colors, fonts } from "@/theme";

function ProtectedRoute({ children }) {
  const { user, loading, sessionChecked } = useSession();
  if (loading || !sessionChecked) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: colors.bg.base }}>
        <Loader2 size={24} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading, sessionChecked } = useSession();
  if (loading || !sessionChecked) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: colors.bg.base }}>
        <Loader2 size={24} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }
  if (user) return <Navigate to="/admin" replace />;
  return children;
}

function OAuthResultPage() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status") || "unknown";
  const isOk = ["ok", "connected", "success"].includes(status);
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: colors.bg.base, padding: "40px 20px" }}>
      <div style={{ textAlign: "center", maxWidth: "400px" }}>
        <div style={{
          width: "56px", height: "56px", borderRadius: "14px",
          backgroundColor: isOk ? "rgba(52,211,153,0.1)" : "rgba(244,63,94,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
        }}>
          <span style={{ fontSize: "24px" }}>{isOk ? "✓" : "✗"}</span>
        </div>
        <h1 style={{ fontFamily: fonts.heading, fontSize: "22px", fontWeight: "700", color: colors.text.primary, margin: "0 0 8px" }}>
          {isOk ? "Connected" : "Connection Failed"}
        </h1>
        <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.text.secondary }}>
          Status: {status}. You can close this page.
        </p>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public auth */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/invitations" element={<InvitationsPage />} />

      {/* OAuth callback */}
      <Route path="/oauth/:provider/result" element={<OAuthResultPage />} />

      {/* Protected admin area */}
      <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="bots" element={<BotList />} />
        <Route path="bots/:botId" element={<BotOverview />} />
        <Route path="bots/:botId/settings" element={<BotSettingsPage />} />
        <Route path="bots/:botId/knowledge" element={<BotKnowledgePage />} />
        <Route path="bots/:botId/instances" element={<BotInstancesPage />} />
        <Route path="bots/:botId/integrations" element={<BotIntegrationsPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="credentials" element={<CredentialsPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="api-scraper" element={<ApiScraperPage />} />
        <Route path="platform" element={<PlatformPage />} />
        <Route path="platform/discord" element={<DiscordAppsPage />} />
        <Route path="platform/enterprises/:enterpriseId/discord" element={<DiscordAppsPage />} />
        <Route path="instances/:instanceId" element={<InstancePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Legacy redirects */}
      <Route path="/app/login" element={<Navigate to="/login" replace />} />
      <Route path="/app/*" element={<Navigate to="/admin" replace />} />

      {/* Root */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <AppRoutes />
        <Toaster />
      </SessionProvider>
    </BrowserRouter>
  );
}

export default App;
