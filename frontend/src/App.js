import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import Dashboard from "@/pages/Dashboard";
import KnowledgeBase from "@/pages/KnowledgeBase";
import Conversations from "@/pages/Conversations";
import BotSettings from "@/pages/BotSettings";
import Analytics from "@/pages/Analytics";
import DiscordSettings from "@/pages/DiscordSettings";
import DiscordAppSetup from "@/pages/DiscordAppSetup";
import DiscordInvited from "@/pages/DiscordInvited";
import EmbedCode from "@/pages/EmbedCode";
import ChatPage from "@/pages/ChatPage";
import ChatWidget from "@/pages/ChatWidget";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import VerifyEmail from "@/pages/VerifyEmail";
import InstanceSelect from "@/pages/InstanceSelect";
import Users from "@/pages/Users";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Docs from "@/pages/Docs";
import ApiIntegrations from "@/pages/ApiIntegrations";
import ApiKeyAnalytics from "@/pages/ApiKeyAnalytics";
import TelegramSettings from "@/pages/TelegramSettings";
import InviteAccept from "@/pages/InviteAccept";
import ZendeskSettings from "@/pages/ZendeskSettings";
import ChangelogPage from "@/pages/ChangelogPage";
import SetupGuide from "@/pages/SetupGuide";
import KnowledgeContentViewer from "@/pages/KnowledgeContentViewer";
import LandingPage from "@/pages/LandingPage";

// v2 pages
import BotList from "@/pages/BotList";
import BotOverview from "@/pages/BotOverview";
import ConnectedAccounts from "@/pages/ConnectedAccounts";
import IntegrationsPage from "@/pages/IntegrationsPage";
import ProviderApps from "@/pages/ProviderApps";
import Workspaces from "@/pages/Workspaces";
import SuggestionsInbox from "@/pages/SuggestionsInbox";
import Organisations from "@/pages/Organisations";
import WorkspaceSettings from "@/pages/WorkspaceSettings";

import "@/App.css";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
}

function AdminOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return user.role === "superadmin" ? children : <Navigate to="/admin" replace />;
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return !user ? children : <Navigate to="/admin" replace />;
}

function AppRoutes() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <Routes>
      {/* Public auth pages */}
      <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
      <Route path="/verify" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/select-instance" element={<ProtectedRoute><InstanceSelect /></ProtectedRoute>} />
      <Route path="/discord/invited" element={<DiscordInvited />} />
      <Route path="/invite/:token" element={<InviteAccept />} />

      {/* Admin area */}
      <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        {/* Organisation-level */}
        <Route index element={<Dashboard />} />
        <Route path="organisations" element={<Organisations />} />
        <Route path="bots" element={<BotList />} />
        <Route path="accounts/:provider" element={<ConnectedAccounts />} />
        <Route path="team" element={<AdminOnlyRoute><Users /></AdminOnlyRoute>} />

        {/* Workspace Settings */}
        <Route path="workspace/settings" element={<WorkspaceSettings />} />
        <Route path="workspace/members" element={<WorkspaceSettings />} />
        <Route path="workspace/billing" element={<WorkspaceSettings />} />
        <Route path="workspace/discord-apps" element={<WorkspaceSettings />} />

        {/* Bot-scoped routes */}
        <Route path="bots/:botId" element={<BotOverview />} />
        <Route path="bots/:botId/behaviour" element={<BotSettings />} />
        <Route path="bots/:botId/knowledge" element={<KnowledgeBase />} />
        <Route path="bots/:botId/integrations" element={<IntegrationsPage />} />
        <Route path="bots/:botId/conversations" element={<Conversations />} />
        <Route path="bots/:botId/playground" element={<EmbedCode />} />
        <Route path="bots/:botId/suggestions" element={<SuggestionsInbox />} />

        {/* Platform Admin */}
        <Route path="platform/provider-apps" element={<AdminOnlyRoute><ProviderApps /></AdminOnlyRoute>} />
        <Route path="platform/workspaces" element={<AdminOnlyRoute><Organisations /></AdminOnlyRoute>} />
        <Route path="platform/analytics" element={<AdminOnlyRoute><Analytics /></AdminOnlyRoute>} />
        <Route path="platform/api-keys" element={<AdminOnlyRoute><ApiKeyAnalytics /></AdminOnlyRoute>} />

        {/* Legacy routes — redirect to new paths */}
        <Route path="knowledge" element={<KnowledgeBase />} />
        <Route path="knowledge/view" element={<KnowledgeContentViewer />} />
        <Route path="conversations" element={<Conversations />} />
        <Route path="settings" element={<BotSettings />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="discord" element={<DiscordSettings />} />
        <Route path="discord-app-setup" element={<AdminOnlyRoute><DiscordAppSetup /></AdminOnlyRoute>} />
        <Route path="embed" element={<EmbedCode />} />
        <Route path="api-integrations" element={<ApiIntegrations />} />
        <Route path="api-key-analytics" element={<ApiKeyAnalytics />} />
        <Route path="telegram" element={<TelegramSettings />} />
        <Route path="zendesk" element={<ZendeskSettings />} />
        <Route path="changelog" element={<ChangelogPage />} />
        <Route path="setup-guide" element={<SetupGuide />} />
        <Route path="users" element={<AdminOnlyRoute><Users /></AdminOnlyRoute>} />
      </Route>

      {/* Public pages */}
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/widget" element={<ChatWidget />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/" element={<LandingPage />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;
