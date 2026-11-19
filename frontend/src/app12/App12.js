/**
 * Spec 012 admin app (Phase 5). Mounted at /app/* (and /oauth/:provider/result)
 * beside the legacy pages, which are removed in Phase 6 (spec §14). The URL is
 * the selection state (spec §12); there is no selected-instance cascade and no
 * X-Instance-ID header.
 */
import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { SessionProvider, useSession } from "./session";
import { Shell } from "./components/Shell";
import { Loading } from "./components/common";
import { AccountPage, ForgotPasswordPage, InvitationPage, LoginPage, ResetPasswordPage } from "./pages/Auth";
import { BotPage, EnterprisePage, EnterprisesPage, OrganisationPage } from "./pages/Hierarchy";
import { InstancePage } from "./pages/Instance";
import { IntegrationPage } from "./pages/Integration";
import { DiscordAppPage, PlatformPage } from "./pages/Platform";
import { OAuthResultPage } from "./pages/OAuthResult";
import "./app12.css";

function Protected({ children }) {
  const { user, loading } = useSession();
  const loc = useLocation();
  if (loading) return <Loading label="Checking your session…" />;
  if (!user) return <Navigate to="/app/login" replace state={{ from: loc.pathname }} />;
  return <Shell>{children}</Shell>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />
      <Route path="invitations" element={<InvitationPage />} />
      <Route index element={<Protected><EnterprisesPage /></Protected>} />
      <Route path="account" element={<Protected><AccountPage /></Protected>} />
      <Route path="enterprises/:id" element={<Protected><EnterprisePage /></Protected>} />
      <Route path="organisations/:id" element={<Protected><OrganisationPage /></Protected>} />
      <Route path="bots/:id" element={<Protected><BotPage /></Protected>} />
      <Route path="instances/:id" element={<Protected><InstancePage /></Protected>} />
      <Route path="integrations/:id" element={<Protected><IntegrationPage /></Protected>} />
      <Route path="platform" element={<Protected><PlatformPage /></Protected>} />
      <Route path="platform/enterprises/:id/discord" element={<Protected><DiscordAppPage /></Protected>} />
      <Route path="*" element={<Protected><p role="alert">Page not found.</p></Protected>} />
    </Routes>
  );
}

export default function App12({ client }) {
  return (
    <SessionProvider client={client}>
      <div className="app12">
        <AppRoutes />
      </div>
    </SessionProvider>
  );
}

export { OAuthResultPage };
