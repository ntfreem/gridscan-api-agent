import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, BookOpen, MessageSquare, Settings,
  BarChart2, Zap, Code2, ExternalLink, LogOut, ChevronDown, Shield, Users, HelpCircle,
  SlidersHorizontal, Globe, Activity, Send, Headphones, Sparkles, Rocket, Menu, X,
  Building2, Bot, Link2, Network, Layers, Play, Key,
} from "lucide-react";
import BridgeBotLogo from "./BridgeBotLogo";
import { useState } from "react";
import { colors, fonts, radius } from "@/theme";

// ── Section label ──
function SectionLabel({ icon: Icon, label }) {
  return (
    <p style={{
      fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted,
      textTransform: "uppercase", letterSpacing: "0.15em",
      margin: "14px 14px 6px", display: "flex", alignItems: "center", gap: "6px",
    }}>
      {Icon && <Icon size={9} />} {label}
    </p>
  );
}

// ── Nav item ──
function SideNavLink({ to, icon: Icon, label, end, onClick }) {
  return (
    <NavLink
      to={to} end={end}
      data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
      onClick={onClick}
      style={({ isActive }) => ({
        display: "flex", alignItems: "center", gap: "10px",
        padding: "8px 14px", marginBottom: "1px", borderRadius: radius.md,
        textDecoration: "none",
        fontFamily: fonts.body, fontSize: "13px", fontWeight: isActive ? "600" : "400",
        color: isActive ? colors.brand.light : colors.text.secondary,
        backgroundColor: isActive ? "rgba(59, 130, 246, 0.1)" : "transparent",
        transition: "all 0.15s ease",
      })}
    >
      <Icon size={15} />
      {label}
    </NavLink>
  );
}

// ── Compact dropdown ──
function CompactSelector({ label, value, items, onSelect, open, setOpen, testId, icon: Icon }) {
  return (
    <div style={{ position: "relative", marginBottom: "8px" }}>
      <button
        data-testid={testId}
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", backgroundColor: colors.bg.panel,
          border: `1px solid ${colors.border.default}`, borderRadius: radius.md,
          cursor: "pointer", transition: "border-color 0.2s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
          {Icon && <Icon size={14} color={colors.brand.light} style={{ flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <span style={{
              fontFamily: fonts.mono, fontSize: "8px", color: colors.text.muted,
              textTransform: "uppercase", letterSpacing: "0.12em", display: "block",
            }}>{label}</span>
            <span style={{
              fontFamily: fonts.body, fontSize: "12px", fontWeight: "500",
              color: value ? colors.text.primary : colors.text.muted,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block",
            }}>
              {value || `Select ${label.toLowerCase()}`}
            </span>
          </div>
        </div>
        <ChevronDown size={12} color={colors.text.muted}
          style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0,
          backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
          borderRadius: radius.md, zIndex: 100, overflow: "hidden",
          boxShadow: "0 10px 28px rgba(0,0,0,0.45)", maxHeight: "180px", overflowY: "auto",
        }}>
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => { onSelect(item); setOpen(false); }}
              style={{
                width: "100%", padding: "9px 14px",
                backgroundColor: "transparent", border: "none", textAlign: "left",
                cursor: "pointer", borderBottom: `1px solid ${colors.border.muted}`,
                fontFamily: fonts.body, fontSize: "12px", fontWeight: "500",
                color: colors.text.primary, transition: "background-color 0.1s",
              }}
              onMouseEnter={e => e.target.style.backgroundColor = colors.bg.hover}
              onMouseLeave={e => e.target.style.backgroundColor = "transparent"}
            >
              <span style={{ display: "block" }}>{item.name}</span>
              {item.connection_count !== undefined && (
                <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted }}>
                  {item.connection_count || 0} connection{item.connection_count !== 1 ? "s" : ""}
                </span>
              )}
              {item.bot_count !== undefined && (
                <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted }}>
                  {item.bot_count || 0} bot{item.bot_count !== 1 ? "s" : ""} · {item.member_count || 0} member{item.member_count !== 1 ? "s" : ""}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function detectEnvironment() {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (host === "bitbotpro.io" || host === "www.bitbotpro.io" || host === "bridgebot.tech" || host === "www.bridgebot.tech") {
    return { label: "PRODUCTION", color: "#F43F5E", bg: "rgba(244,63,94,0.12)", border: "rgba(244,63,94,0.4)" };
  }
  if (host.includes("preview.emergentagent.com") || host.includes("localhost") || host.includes("127.0.0.1")) {
    return { label: "PREVIEW · SANDBOX", color: "#FBBF24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.4)" };
  }
  return null;
}

function EnvironmentBanner() {
  const env = detectEnvironment();
  if (!env) return null;
  return (
    <div data-testid="env-banner" style={{
      position: "fixed", top: 0, left: 0, right: 0, height: "26px",
      backgroundColor: env.bg, borderBottom: `1px solid ${env.border}`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
      zIndex: 1000, fontFamily: fonts.mono, fontSize: "10px", fontWeight: "700",
      color: env.color, letterSpacing: "0.15em", backdropFilter: "blur(8px)",
    }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: env.color, boxShadow: `0 0 8px ${env.color}` }} />
      ENV: {env.label}
      <span style={{ opacity: 0.5, fontWeight: "400" }}>·</span>
      <span style={{ opacity: 0.7, fontWeight: "400", textTransform: "lowercase", letterSpacing: "0.05em" }}>
        {typeof window !== "undefined" ? window.location.hostname : ""}
      </span>
    </div>
  );
}

export default function AdminLayout() {
  const {
    user, logout,
    orgs, selectedOrg, selectOrg,
    bots, selectedBot, selectBot,
    selectedInstance,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [orgDropOpen, setOrgDropOpen] = useState(false);
  const [botDropOpen, setBotDropOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobile = () => setMobileMenuOpen(false);
  const isSuperAdmin = user?.role === "superadmin";

  // Determine if we're in a bot-scoped route
  const botId = selectedBot?.id;
  const isBotRoute = location.pathname.includes("/admin/bots/");

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: colors.bg.base, paddingTop: "26px" }}>
      <EnvironmentBanner />

      {/* Mobile hamburger */}
      <button
        className="admin-mobile-toggle"
        data-testid="mobile-menu-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        style={{
          position: "fixed", top: "32px", left: "12px", zIndex: 25,
          width: "40px", height: "40px", borderRadius: "10px",
          backgroundColor: colors.bg.surface, border: `1px solid ${colors.border.default}`,
          display: "none", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}
      >
        {mobileMenuOpen ? <X size={18} color={colors.text.primary} /> : <Menu size={18} color={colors.text.primary} />}
      </button>

      {mobileMenuOpen && (
        <div className="admin-mobile-overlay" onClick={closeMobile}
          style={{ position: "fixed", inset: 0, top: "26px", zIndex: 9, backgroundColor: "rgba(0,0,0,0.5)", display: "none" }} />
      )}

      <aside className={`admin-sidebar ${mobileMenuOpen ? "admin-sidebar-open" : ""}`} style={{
        width: "250px", backgroundColor: colors.bg.surface,
        borderRight: `1px solid ${colors.border.default}`,
        display: "flex", flexDirection: "column",
        position: "fixed", top: "26px", left: 0, height: "calc(100vh - 26px)", zIndex: 10,
        transition: "transform 0.25s ease",
      }}>
        {/* Logo */}
        <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${colors.border.default}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <BridgeBotLogo size={44} />
            <div>
              <span style={{ fontFamily: fonts.heading, fontSize: "20px", fontWeight: "700", color: colors.text.primary, letterSpacing: "-0.3px" }}>
                BitBot <span style={{ color: colors.brand.light }}>Pro</span>
              </span>
              <p style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>
                AI Platform
              </p>
            </div>
          </div>

          {/* Org selector */}
          {orgs.length > 0 && (
            <CompactSelector
              label="Organisation"
              value={selectedOrg?.name}
              items={orgs}
              onSelect={(org) => { selectOrg(org); navigate("/admin"); }}
              open={orgDropOpen}
              setOpen={(v) => { setOrgDropOpen(v); setBotDropOpen(false); }}
              testId="org-switcher"
              icon={Building2}
            />
          )}

          {/* Bot selector */}
          {bots.length > 0 && (
            <CompactSelector
              label="AI Bot"
              value={selectedBot?.name}
              items={bots}
              onSelect={(bot) => { selectBot(bot); navigate(`/admin/bots/${bot.id}`); }}
              open={botDropOpen}
              setOpen={(v) => { setBotDropOpen(v); setOrgDropOpen(false); }}
              testId="bot-switcher"
              icon={Bot}
            />
          )}
        </div>

        {/* Nav sections */}
        <nav style={{ flex: 1, padding: "6px 12px", overflowY: "auto" }}>
          {/* Organisation */}
          <SectionLabel icon={Building2} label="Organisation" />
          <SideNavLink to="/admin" icon={LayoutDashboard} label="Overview" end onClick={closeMobile} />
          <SideNavLink to="/admin/bots" icon={Bot} label="Bots" onClick={closeMobile} />
          <SideNavLink to="/admin/accounts" icon={Link2} label="Connected Accounts" onClick={closeMobile} />
          <SideNavLink to="/admin/team" icon={Users} label="Team & Access" onClick={closeMobile} />

          {/* Divider */}
          <div style={{ height: "1px", backgroundColor: colors.border.subtle, margin: "10px 8px" }} />

          {/* Selected Bot */}
          {selectedBot && (
            <>
              <SectionLabel icon={Bot} label={selectedBot.name} />
              <SideNavLink to={`/admin/bots/${botId}`} icon={LayoutDashboard} label="Bot Overview" end onClick={closeMobile} />
              <SideNavLink to={`/admin/bots/${botId}/behaviour`} icon={Settings} label="Behaviour" onClick={closeMobile} />
              <SideNavLink to={`/admin/bots/${botId}/knowledge`} icon={BookOpen} label="Knowledge Base" onClick={closeMobile} />
              <SideNavLink to={`/admin/bots/${botId}/integrations`} icon={Network} label="Integrations" onClick={closeMobile} />
              <SideNavLink to={`/admin/bots/${botId}/conversations`} icon={MessageSquare} label="Conversations" onClick={closeMobile} />
              <SideNavLink to={`/admin/bots/${botId}/suggestions`} icon={Sparkles} label="Suggestions" onClick={closeMobile} />
              <SideNavLink to={`/admin/bots/${botId}/playground`} icon={Play} label="Playground" onClick={closeMobile} />

              <div style={{ height: "1px", backgroundColor: colors.border.subtle, margin: "10px 8px" }} />
            </>
          )}

          {/* Platform Admin */}
          {isSuperAdmin && (
            <>
              <SectionLabel icon={Shield} label="Platform Admin" />
              <SideNavLink to="/admin/platform/provider-apps" icon={SlidersHorizontal} label="Provider Apps" onClick={closeMobile} />
              <SideNavLink to="/admin/platform/workspaces" icon={Layers} label="Workspaces & Users" onClick={closeMobile} />
              <SideNavLink to="/admin/platform/analytics" icon={BarChart2} label="Analytics" onClick={closeMobile} />
              <SideNavLink to="/admin/platform/api-keys" icon={Key} label="API Key Usage" onClick={closeMobile} />
            </>
          )}
        </nav>

        {/* Bottom */}
        <div style={{ padding: "10px 14px", borderTop: `1px solid ${colors.border.default}` }}>
          <a
            href={`/chat${selectedInstance ? `?instance=${selectedInstance.id}` : ""}`}
            target="_blank" rel="noopener noreferrer"
            data-testid="nav-open-chat"
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              color: colors.brand.light, fontSize: "12px", fontFamily: fonts.body, fontWeight: "500",
              textDecoration: "none", marginBottom: "10px", transition: "color 0.2s",
            }}
          >
            <ExternalLink size={12} /> Open Chat Demo
          </a>
          <NavLink to="/admin/setup-guide" data-testid="setup-guide-btn" onClick={closeMobile}
            style={({ isActive }) => ({
              display: "flex", alignItems: "center", gap: "7px",
              color: isActive ? colors.brand.light : colors.text.secondary, fontSize: "12px",
              fontFamily: fonts.body, fontWeight: "500", textDecoration: "none", marginBottom: "10px",
            })}
          >
            <Rocket size={12} /> Setup Guide
          </NavLink>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{
                fontFamily: fonts.body, fontSize: "12px", fontWeight: "500", color: colors.text.primary, margin: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{user?.username || user?.email}</p>
              <p style={{
                fontFamily: fonts.mono, fontSize: "9px",
                color: isSuperAdmin ? colors.brand.light : colors.text.muted,
                margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.12em",
              }}>{isSuperAdmin ? "Admin" : "User"}</p>
            </div>
            <button data-testid="logout-btn" onClick={() => { logout(); navigate("/login"); }} title="Sign out"
              style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", borderRadius: radius.sm, display: "flex", alignItems: "center" }}>
              <LogOut size={15} color={colors.text.secondary} />
            </button>
          </div>
        </div>
      </aside>

      <main className="admin-main" style={{ marginLeft: "250px", flex: 1, minHeight: "100vh", backgroundColor: colors.bg.base }}
        onClick={() => { orgDropOpen && setOrgDropOpen(false); botDropOpen && setBotDropOpen(false); }}>
        <Outlet />
      </main>

      <style>{`
        @media (max-width: 768px) {
          .admin-mobile-toggle { display: flex !important; }
          .admin-mobile-overlay { display: block !important; }
          .admin-sidebar { transform: translateX(-100%); z-index: 20 !important; }
          .admin-sidebar-open { transform: translateX(0) !important; }
          .admin-main { margin-left: 0 !important; overflow-x: hidden; }
        }
      `}</style>
    </div>
  );
}
