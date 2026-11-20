/**
 * AdminLayout — Original Emergent sidebar design adapted for Spec 012 hierarchy.
 * Enterprise → Organisation → Bot navigation with the original glass-morphism styling.
 */
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useSession } from "@/context/SessionContext";
import {
  LayoutDashboard, BookOpen, MessageSquare, Settings,
  BarChart2, Zap, Code2, ExternalLink, LogOut, ChevronDown, Shield, Users,
  Globe, Send, Headphones, Sparkles, Menu, X,
  Building2, Bot, Network, Key, Plus, User, Briefcase,
} from "lucide-react";
import BridgeBotLogo from "./BridgeBotLogo";
import { useState, useRef, useEffect } from "react";
import { colors, fonts, radius, T, onFocus, onBlur } from "@/theme";
import { toast } from "sonner";

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
          {items.length === 0 && (
            <div style={{ padding: "12px 14px", fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, textAlign: "center" }}>
              None available
            </div>
          )}
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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserPopover({ user, isSuperAdmin, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initial = (user?.name || user?.email || "U")[0].toUpperCase();

  return (
    <div ref={ref} style={{ padding: "8px 12px", borderTop: `1px solid ${colors.border.default}`, position: "relative" }}>
      <button
        data-testid="user-menu-btn"
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: "10px",
          padding: "6px 8px", borderRadius: radius.md, border: "none",
          backgroundColor: open ? colors.bg.hover : "transparent",
          cursor: "pointer", transition: "background-color 0.15s",
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.backgroundColor = colors.bg.hover; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        <div style={{
          width: "28px", height: "28px", borderRadius: radius.full,
          backgroundColor: isSuperAdmin ? "rgba(96,165,250,0.15)" : "rgba(148,163,184,0.12)",
          border: `1.5px solid ${isSuperAdmin ? "rgba(96,165,250,0.35)" : colors.border.default}`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <span style={{
            fontFamily: fonts.heading, fontSize: "11px", fontWeight: "700",
            color: isSuperAdmin ? colors.brand.light : colors.text.secondary,
          }}>{initial}</span>
        </div>
        <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
          <p style={{
            fontFamily: fonts.body, fontSize: "12px", fontWeight: "500", color: colors.text.primary, margin: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{user?.name || user?.email}</p>
          <p style={{
            fontFamily: fonts.mono, fontSize: "8px",
            color: isSuperAdmin ? colors.brand.light : colors.text.muted,
            margin: "1px 0 0", textTransform: "uppercase", letterSpacing: "0.12em",
          }}>{isSuperAdmin ? "Superadmin" : "Member"}</p>
        </div>
        <ChevronDown size={11} color={colors.text.muted} style={{
          transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none", flexShrink: 0,
        }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "10px", right: "10px",
          backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
          borderRadius: radius.lg, overflow: "hidden",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.5)", zIndex: 120,
        }}>
          <NavLink to="/admin/account" onClick={() => setOpen(false)} style={{
            display: "flex", alignItems: "center", gap: "9px",
            padding: "10px 14px", textDecoration: "none",
            fontFamily: fonts.body, fontSize: "12px", fontWeight: "500",
            color: colors.text.secondary,
            borderBottom: `1px solid ${colors.border.muted}`, transition: "background-color 0.1s",
          }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.bg.hover}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <User size={13} /> Account
          </NavLink>
          <button
            data-testid="logout-btn"
            onClick={() => { setOpen(false); onLogout(); }}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: "9px",
              padding: "10px 14px", background: "none", border: "none", textAlign: "left",
              fontFamily: fonts.body, fontSize: "12px", fontWeight: "500",
              color: "#F87171", cursor: "pointer", transition: "background-color 0.1s",
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.06)"}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

function EnvironmentBanner() {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  let env = null;
  if (host === "bitbotpro.io" || host === "www.bitbotpro.io") {
    env = { label: "PRODUCTION", color: "#F43F5E", bg: "rgba(244,63,94,0.12)", border: "rgba(244,63,94,0.4)" };
  } else if (host.includes("preview.emergentagent.com") || host.includes("localhost") || host.includes("127.0.0.1")) {
    env = { label: "PREVIEW", color: "#FBBF24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.4)" };
  }
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
    </div>
  );
}

export default function AdminLayout() {
  const {
    user, logout, isSuperAdmin,
    enterprises, selectedEnterprise, selectEnterprise,
    organisations, selectedOrg, selectOrg,
    bots, selectedBot, selectBot,
  } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [entDropOpen, setEntDropOpen] = useState(false);
  const [orgDropOpen, setOrgDropOpen] = useState(false);
  const [botDropOpen, setBotDropOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobile = () => setMobileMenuOpen(false);
  const closeAllDropdowns = () => { setEntDropOpen(false); setOrgDropOpen(false); setBotDropOpen(false); };

  const botId = selectedBot?.id;

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
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
        </div>

        {/* Nav sections */}
        <nav style={{ flex: 1, padding: "6px 12px", overflowY: "auto" }}>
          {/* Enterprise selector */}
          <SectionLabel icon={Briefcase} label="Enterprise" />
          <div style={{ padding: "0 4px 6px" }}>
            <CompactSelector
              label="Enterprise"
              value={selectedEnterprise?.name}
              items={enterprises}
              onSelect={(ent) => { selectEnterprise(ent); navigate("/admin"); closeAllDropdowns(); }}
              open={entDropOpen}
              setOpen={(v) => { setEntDropOpen(v); setOrgDropOpen(false); setBotDropOpen(false); }}
              testId="enterprise-switcher"
              icon={Briefcase}
            />
          </div>

          {/* Organisation selector */}
          <SectionLabel icon={Building2} label="Organisation" />
          <div style={{ padding: "0 4px 6px" }}>
            <CompactSelector
              label="Organisation"
              value={selectedOrg?.name}
              items={organisations}
              onSelect={(org) => { selectOrg(org); navigate("/admin"); closeAllDropdowns(); }}
              open={orgDropOpen}
              setOpen={(v) => { setOrgDropOpen(v); setEntDropOpen(false); setBotDropOpen(false); }}
              testId="org-switcher"
              icon={Building2}
            />
          </div>

          <SideNavLink to="/admin" icon={LayoutDashboard} label="Overview" end onClick={closeMobile} />
          <SideNavLink to="/admin/bots" icon={Bot} label="Bots" onClick={closeMobile} />
          <SideNavLink to="/admin/knowledge" icon={BookOpen} label="Knowledge" onClick={closeMobile} />
          <SideNavLink to="/admin/credentials" icon={Key} label="Credentials" onClick={closeMobile} />

          <div style={{ height: "1px", backgroundColor: colors.border.subtle, margin: "10px 8px" }} />

          {/* Bot selector — shown when bots exist */}
          {bots.length > 0 && (
            <>
              <SectionLabel icon={Bot} label="Bot" />
              <div style={{ padding: "0 4px 6px" }}>
                <CompactSelector
                  label="AI Bot"
                  value={selectedBot?.name}
                  items={bots}
                  onSelect={(bot) => { selectBot(bot); navigate(`/admin/bots/${bot.id}`); closeAllDropdowns(); }}
                  open={botDropOpen}
                  setOpen={(v) => { setBotDropOpen(v); setOrgDropOpen(false); setEntDropOpen(false); }}
                  testId="bot-switcher"
                  icon={Bot}
                />
              </div>
              {selectedBot && (
                <>
                  <SideNavLink to={`/admin/bots/${botId}`} icon={LayoutDashboard} label="Bot Overview" end onClick={closeMobile} />
                  <SideNavLink to={`/admin/bots/${botId}/settings`} icon={Settings} label="Bot Settings" onClick={closeMobile} />
                  <SideNavLink to={`/admin/bots/${botId}/knowledge`} icon={BookOpen} label="Knowledge Base" onClick={closeMobile} />
                  <SideNavLink to={`/admin/bots/${botId}/instances`} icon={Network} label="Instances" onClick={closeMobile} />
                  <SideNavLink to={`/admin/bots/${botId}/integrations`} icon={Headphones} label="Integrations" onClick={closeMobile} />
                </>
              )}
              <div style={{ height: "1px", backgroundColor: colors.border.subtle, margin: "10px 8px" }} />
            </>
          )}

          {/* Admin section */}
          <SectionLabel icon={Settings} label="Admin" />
          <SideNavLink to="/admin/members" icon={Users} label="Members" onClick={closeMobile} />
          <SideNavLink to="/admin/analytics" icon={BarChart2} label="Analytics" onClick={closeMobile} />

          {/* Superadmin */}
          {isSuperAdmin && (
            <>
              <div style={{ height: "1px", backgroundColor: colors.border.subtle, margin: "10px 8px" }} />
              <SectionLabel icon={Shield} label="Platform" />
              <SideNavLink to="/admin/platform" icon={Shield} label="Platform Admin" onClick={closeMobile} />
              <SideNavLink to="/admin/platform/discord" icon={Zap} label="Discord Apps" onClick={closeMobile} />
            </>
          )}
        </nav>

        <UserPopover
          user={user}
          isSuperAdmin={isSuperAdmin}
          onLogout={() => { logout(); navigate("/login"); }}
        />
      </aside>

      <main className="admin-main" style={{ marginLeft: "250px", flex: 1, minHeight: "100vh", backgroundColor: colors.bg.base }}
        onClick={() => closeAllDropdowns()}>
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
