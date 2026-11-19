/**
 * BitBotPro frontend (Spec 012 release candidate, Phase 6B).
 *
 * The admin application is `src/app12` at /app/* (spec §12). The legacy pages, the
 * localStorage session and the legacy tenant-header API layer were removed in Phase 6B
 * (spec §14, specs/012-clean-hierarchy/legacy-inventory.md). Old paths redirect to
 * their Spec 012 replacements so bookmarks and e-mailed links still land somewhere
 * sensible; the retired React chat widget (W2) shows a notice instead of a blank page.
 */
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Docs from "@/pages/Docs";
import LandingPage from "@/pages/LandingPage";
import App12, { OAuthResultPage } from "@/app12/App12";
import "@/App.css";

/** Redirect that keeps the URL fragment (reset links carry `#token=…`, never sent to a server). */
export function KeepHashRedirect({ to }) {
  const { hash } = useLocation();
  return <Navigate to={`${to}${hash || ""}`} replace />;
}

/** W2 (approved, P5-H): the API-hosted widget is the only chat widget. */
export function RetiredChatNotice() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
                   background: "#030712", color: "#e2e8f0", fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <div role="status" style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>This chat window has moved</h1>
        <p style={{ fontSize: 14, color: "#cbd5e1" }}>
          The website owner needs to update their BitBotPro chat embed code. Please contact them, or try again later.
        </p>
      </div>
    </main>
  );
}

export function NotFoundPage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
                   background: "#030712", color: "#e2e8f0", fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Page not found</h1>
        <a href="/" style={{ color: "#67e8f9" }}>Go to the home page</a>
      </div>
    </main>
  );
}

export function AppRoutes() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <Routes>
      {/* Spec 012 admin app (Phase 5) */}
      <Route path="/app/*" element={<App12 />} />
      <Route path="/oauth/:provider/result" element={<OAuthResultPage />} />

      {/* Public pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/chat" element={<RetiredChatNotice />} />
      <Route path="/widget" element={<RetiredChatNotice />} />

      {/* Legacy paths → Spec 012 replacements */}
      <Route path="/login" element={<Navigate to="/app/login" replace />} />
      <Route path="/register" element={<Navigate to="/app/login" replace />} />
      <Route path="/verify" element={<Navigate to="/app/login" replace />} />
      <Route path="/forgot-password" element={<Navigate to="/app/forgot-password" replace />} />
      <Route path="/reset-password" element={<KeepHashRedirect to="/app/reset-password" />} />
      <Route path="/invite/:token" element={<Navigate to="/app/login" replace />} />
      <Route path="/select-instance" element={<Navigate to="/app" replace />} />
      <Route path="/discord/invited" element={<Navigate to="/app" replace />} />
      <Route path="/admin/*" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;
