import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Globe, MessageSquare, Send, Headphones, Code2,
  BookOpen, FileText, Github, Search, Upload,
  Zap, BarChart2, Shield, Activity, CheckCircle2, ChevronDown,
  Palette, MessageCircle, Play, Copy,
  Users, Settings, Filter, TrendingUp, Clock, Menu, X,
  Eye, PenTool, Cpu, Layers, ArrowUpRight
} from "lucide-react";
import BridgeBotLogo from "../components/BridgeBotLogo";

/* ─── fade-in on scroll ─── */
function useFadeIn(threshold = 0.12) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Respect prefers-reduced-motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVis(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVis(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, vis];
}

function FadeIn({ children, delay = 0, style }) {
  const [ref, vis] = useFadeIn();
  return (
    <div
      ref={ref}
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.7s cubic-bezier(.16,1,.3,1) ${delay}s, transform 0.7s cubic-bezier(.16,1,.3,1) ${delay}s`,
        willChange: "opacity, transform",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─── palette — neon blue + cyan accents ─── */
const C = {
  bg:      "#0B1020",
  surface: "#111B2E",
  surface2:"#172238",
  border:  "#1E3050",
  text:    "#EDF3FF",
  text2:   "#A7B7D0",
  muted:   "#6B7C96",
  blue:    "#3B82F6",
  blueHov: "#2563EB",
  elec:    "#6BAAFF",
  cyan:    "#3CDBD3",
  neonBlue:"rgba(59,130,246,0.45)",
  neonCyan:"rgba(60,219,211,0.35)",
  green:   "#10B981",
  warn:    "#F59E0B",
};

/* ─── reusable tiny components ─── */
function SectionTag({ children }) {
  return (
    <span
      style={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "11px",
        color: C.cyan,
        textTransform: "uppercase",
        letterSpacing: "0.18em",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      <span style={{ width: 16, height: 1, background: C.cyan, display: "inline-block", boxShadow: `0 0 6px ${C.neonCyan}` }} />
      {children}
    </span>
  );
}

function SectionHeading({ children, style }) {
  return (
    <h2
      style={{
        fontFamily: "Outfit, sans-serif",
        fontSize: "clamp(28px, 4vw, 44px)",
        fontWeight: 700,
        color: C.text,
        letterSpacing: "-0.4px",
        lineHeight: 1.15,
        margin: "12px 0 0",
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

function SectionSub({ children, style }) {
  return (
    <p
      style={{
        fontFamily: "IBM Plex Sans, sans-serif",
        fontSize: "16px",
        color: C.text2,
        lineHeight: 1.65,
        maxWidth: 600,
        margin: "16px 0 0",
        ...style,
      }}
    >
      {children}
    </p>
  );
}

function PrimaryBtn({ children, to, href, style, testId, onClick }) {
  const s = {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "13px 28px", borderRadius: 10,
    background: `linear-gradient(135deg, ${C.blue}, ${C.elec})`,
    color: "#fff", fontFamily: "IBM Plex Sans, sans-serif",
    fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer",
    textDecoration: "none",
    boxShadow: `0 0 20px ${C.neonBlue}, 0 0 40px rgba(59,130,246,0.15)`,
    transition: "transform 0.2s, box-shadow 0.2s",
    ...style,
  };
  if (to) return <Link to={to} style={s} data-testid={testId}>{children}</Link>;
  if (href) return <a href={href} style={s} data-testid={testId}>{children}</a>;
  return <button style={s} data-testid={testId} onClick={onClick}>{children}</button>;
}

function GhostBtn({ children, to, href, style, testId }) {
  const s = {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "12px 24px", borderRadius: 10,
    background: "transparent",
    color: C.elec, fontFamily: "IBM Plex Sans, sans-serif",
    fontSize: 14, fontWeight: 500,
    border: `1px solid ${C.border}`,
    cursor: "pointer", textDecoration: "none",
    transition: "border-color 0.2s, color 0.2s, box-shadow 0.2s",
    ...style,
  };
  if (to) return <Link to={to} style={s} data-testid={testId}>{children}</Link>;
  if (href) return <a href={href} style={s} data-testid={testId}>{children}</a>;
  return <button style={s} data-testid={testId}>{children}</button>;
}

function FeatureCard({ icon: Icon, title, desc, accent }) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: "28px 24px",
        transition: "border-color 0.25s, transform 0.25s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = accent || C.blue; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 0 20px ${accent || C.blue}30`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div
        style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${accent || C.blue}15`,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Icon size={20} color={accent || C.blue} />
      </div>
      <h4 style={{ fontFamily: "Outfit, sans-serif", fontSize: 17, fontWeight: 600, color: C.text, margin: "0 0 8px" }}>{title}</h4>
      <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 14, color: C.text2, lineHeight: 1.6, margin: 0 }}>{desc}</p>
    </div>
  );
}

/* ──────────────────── NAVBAR ──────────────────── */
function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const linkStyle = {
    fontFamily: "IBM Plex Sans, sans-serif", fontSize: 13, fontWeight: 500,
    color: C.text2, textDecoration: "none", transition: "color 0.2s",
  };

  const navLinks = [
    { label: "Features", href: "#channels" },
    { label: "Knowledge", href: "#knowledge" },
    { label: "Live APIs", href: "#live-api" },
    { label: "Dashboard", href: "#dashboard" },
    { label: "FAQ", href: "#faq" },
    { label: "Docs", to: "/docs" },
  ];

  return (
    <nav
      data-testid="landing-navbar"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? "rgba(11,16,32,0.88)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? `1px solid ${C.border}70` : "1px solid transparent",
        transition: "background 0.3s, border-color 0.3s, backdrop-filter 0.3s",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        {/* Logo */}
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }} data-testid="landing-logo">
          <BridgeBotLogo size={48} />
          <span style={{ fontFamily: "Outfit, sans-serif", fontSize: 22, fontWeight: 700, color: C.elec }}>
            BitBot <span style={{ color: "#fff" }}>Pro</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div style={{ display: "flex", alignItems: "center", gap: 28 }} className="landing-nav-links">
          {navLinks.map(l => (
            l.to
              ? <Link key={l.label} to={l.to} style={linkStyle} data-testid={`nav-${l.label.toLowerCase().replace(/\s+/g, "-")}`}>{l.label}</Link>
              : <a key={l.label} href={l.href} style={linkStyle} data-testid={`nav-${l.label.toLowerCase().replace(/\s+/g, "-")}`}>{l.label}</a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }} className="landing-nav-ctas">
          <Link to="/login" style={{ ...linkStyle, color: C.elec }} data-testid="nav-signin">Sign In</Link>
          <PrimaryBtn to="/register" testId="nav-signup" style={{ padding: "9px 20px", fontSize: 13 }}>
            Get Started <ArrowRight size={14} />
          </PrimaryBtn>
        </div>

        {/* Mobile hamburger */}
        <button
          className="landing-nav-hamburger"
          onClick={() => setOpen(!open)}
          style={{ display: "none", background: "none", border: "none", cursor: "pointer", padding: 4 }}
          data-testid="nav-hamburger"
        >
          {open ? <X size={22} color={C.text} /> : <Menu size={22} color={C.text} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div
          className="landing-nav-mobile"
          style={{
            background: C.surface, borderTop: `1px solid ${C.border}`,
            padding: "16px 24px 20px",
          }}
        >
          {navLinks.map(l => (
            l.to
              ? <Link key={l.label} to={l.to} onClick={() => setOpen(false)} style={{ ...linkStyle, display: "block", padding: "10px 0" }}>{l.label}</Link>
              : <a key={l.label} href={l.href} onClick={() => setOpen(false)} style={{ ...linkStyle, display: "block", padding: "10px 0" }}>{l.label}</a>
          ))}
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <Link to="/login" onClick={() => setOpen(false)} style={{ ...linkStyle, color: C.elec }}>Sign In</Link>
            <PrimaryBtn to="/register" testId="nav-signup-mobile" style={{ padding: "9px 18px", fontSize: 13 }}>
              Get Started
            </PrimaryBtn>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ──────────────────── HERO ──────────────────── */
function HeroSection() {
  return (
    <section
      data-testid="hero-section"
      style={{
        position: "relative",
        overflow: "hidden",
        paddingTop: 120,
        paddingBottom: 80,
        background: C.bg,
      }}
    >
      {/* Neon glow accents */}
      <div style={{ position: "absolute", top: -100, right: -100, width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${C.blue}22 0%, ${C.blue}08 40%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -60, left: -60, width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${C.cyan}18 0%, ${C.cyan}06 40%, transparent 70%)`, pointerEvents: "none" }} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 48, alignItems: "center" }} className="hero-grid">
          {/* Left: Copy */}
          <div style={{ maxWidth: 640 }}>
            <SectionTag>AI-Powered Knowledge Assistants</SectionTag>
            <h1
              style={{
                fontFamily: "Outfit, sans-serif",
                fontSize: "clamp(36px, 5vw, 56px)",
                fontWeight: 700,
                color: C.text,
                lineHeight: 1.1,
                letterSpacing: "-0.5px",
                margin: "16px 0 0",
              }}
            >
              Your knowledge. Live data.{" "}
              <span style={{ background: `linear-gradient(135deg, ${C.elec}, ${C.cyan})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: `drop-shadow(0 0 18px ${C.neonCyan})` }}>
                AI answers everywhere.
              </span>
            </h1>
            <p style={{
              fontFamily: "IBM Plex Sans, sans-serif", fontSize: "clamp(16px, 2vw, 18px)",
              color: C.text2, lineHeight: 1.7, margin: "20px 0 0", maxWidth: 540,
            }}>
              Build AI assistants powered by your documents, websites, GitHub repositories, and connected APIs.
              Deploy them to your website, Discord, Telegram, and Zendesk — all from one platform.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 32 }}>
              <PrimaryBtn to="/register" testId="hero-signup-btn">
                Start Building Free <ArrowRight size={16} />
              </PrimaryBtn>
              <GhostBtn to="/chat" testId="hero-demo-btn">
                <Play size={14} /> Try Live Demo
              </GhostBtn>
            </div>

            {/* Channel badges */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 36, alignItems: "center" }}>
              <span style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 12, color: C.muted }}>Deploys to</span>
              {[
                { icon: Globe, label: "Web" },
                { icon: MessageCircle, label: "Discord" },
                { icon: Send, label: "Telegram" },
                { icon: Headphones, label: "Zendesk" },
                { icon: Code2, label: "REST API" },
              ].map(ch => (
                <span key={ch.label} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontFamily: "IBM Plex Sans, sans-serif", fontSize: 12, color: C.text2,
                  background: `${C.surface}`, border: `1px solid ${C.border}`,
                  padding: "5px 10px", borderRadius: 6,
                }}>
                  <ch.icon size={13} color={C.elec} /> {ch.label}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Live chat demo */}
          <div className="hero-preview" style={{ position: "relative" }}>
            <div style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 30px ${C.neonBlue}, 0 0 60px rgba(59,130,246,0.1)`,
              height: 420,
            }}>
              <iframe
                src="/widget?mode=inline"
                title="BitBot Pro Live Demo"
                data-testid="hero-live-demo"
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  display: "block",
                }}
              />
            </div>
            <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 11, color: C.muted, textAlign: "center", marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, display: "inline-block", boxShadow: `0 0 6px ${C.green}` }} />
              Live demo — try asking a question
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── CHANNELS ──────────────────── */
function ChannelsSection() {
  const channels = [
    {
      icon: Globe, name: "Website Widget", color: C.blue,
      desc: "A branded chat widget embedded on your site. Custom colors, logo, positioning, and welcome messages. Deploy with a single script tag.",
    },
    {
      icon: MessageCircle, name: "Discord", color: "#5865F2",
      desc: "AI responses and command handling for your community servers. Rich markdown formatting and code block support.",
    },
    {
      icon: Send, name: "Telegram", color: "#26A5E4",
      desc: "Direct messages, mentions, and commands. AI-driven contextual follow-up buttons for natural conversations.",
    },
    {
      icon: Headphones, name: "Zendesk", color: "#03363D",
      desc: "Two modes: public auto-replies on tickets, or private response suggestions for your support agents. Toggle each independently.",
    },
    {
      icon: Code2, name: "REST API", color: C.cyan,
      desc: "Query your bot programmatically from any application. Full API key management and usage analytics.",
    },
  ];

  return (
    <section id="channels" data-testid="channels-section" style={{ padding: "80px 0 90px", background: C.bg }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <SectionTag>Multi-Channel Deployment</SectionTag>
          <SectionHeading style={{ margin: "12px auto 0" }}>Meet your users where conversations happen.</SectionHeading>
          <SectionSub style={{ margin: "16px auto 0", textAlign: "center" }}>
            One platform, five conversation channels. Configure each from a single admin dashboard.
          </SectionSub>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}>
          {channels.map(ch => (
            <div
              key={ch.name}
              data-testid={`channel-${ch.name.toLowerCase().replace(/\s+/g, "-")}`}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: "28px 22px",
                transition: "border-color 0.25s, transform 0.25s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = ch.color; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 0 24px ${ch.color}30`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: `${ch.color}18`,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 18,
              }}>
                <ch.icon size={21} color={ch.color} />
              </div>
              <h4 style={{ fontFamily: "Outfit, sans-serif", fontSize: 16, fontWeight: 600, color: C.text, margin: "0 0 8px" }}>
                {ch.name}
              </h4>
              <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 13, color: C.text2, lineHeight: 1.6, margin: 0 }}>
                {ch.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── KNOWLEDGE BASE ──────────────────── */
function KnowledgeSection() {
  const sources = [
    { icon: FileText, label: "Text & PDFs", desc: "Upload documents directly to build your bot's knowledge." },
    { icon: Globe, label: "Website Content", desc: "Crawl and scrape pages with sub-page support and Brotli decoding." },
    { icon: Github, label: "GitHub Repos", desc: "Auto-ingest documentation from any public or private repository." },
  ];

  return (
    <section id="knowledge" data-testid="knowledge-section" style={{ padding: "90px 0", background: C.bg }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 56, alignItems: "center" }} className="knowledge-grid">
          {/* Left: Copy */}
          <div>
            <SectionTag>Knowledge Base</SectionTag>
            <SectionHeading>Turn your existing content into useful answers.</SectionHeading>
            <SectionSub>
              Feed your bot documents, websites, and GitHub repos. Semantic search retrieves the most relevant context for every question.
            </SectionSub>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 32 }}>
              {sources.map(s => (
                <div key={s.label} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                    background: `${C.blue}12`, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <s.icon size={18} color={C.elec} />
                  </div>
                  <div>
                    <h4 style={{ fontFamily: "Outfit, sans-serif", fontSize: 15, fontWeight: 600, color: C.text, margin: "0 0 4px" }}>{s.label}</h4>
                    <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 13, color: C.text2, lineHeight: 1.5, margin: 0 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
              {["Semantic Retrieval", "Knowledge Gate", "Bulk Re-scraping", "Import / Export"].map(t => (
                <span key={t} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontFamily: "IBM Plex Sans, sans-serif", fontSize: 12, color: C.text2,
                  background: C.surface, border: `1px solid ${C.border}`,
                  padding: "5px 12px", borderRadius: 6,
                }}>
                  <CheckCircle2 size={12} color={C.green} /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Visual */}
          <div className="knowledge-visual">
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
              padding: 24, boxShadow: `0 12px 40px rgba(0,0,0,0.3)`,
            }}>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: C.muted, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Knowledge Sources
              </div>
              {/* Source rows */}
              {[
                { icon: FileText, name: "product-guide.pdf", type: "PDF", chunks: 142 },
                { icon: Globe, name: "docs.example.com", type: "URL", chunks: 87 },
                { icon: Github, name: "org/api-docs", type: "GitHub", chunks: 234 },
              ].map(row => (
                <div key={row.name} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", background: C.surface2, borderRadius: 8,
                  marginBottom: 8, border: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <row.icon size={15} color={C.elec} />
                    <span style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 13, color: C.text }}>{row.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: C.cyan, background: `${C.cyan}12`, padding: "2px 7px", borderRadius: 4 }}>{row.type}</span>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: C.muted }}>{row.chunks} chunks</span>
                  </div>
                </div>
              ))}

              {/* Arrow down */}
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <ChevronDown size={20} color={C.elec} />
              </div>

              {/* Answer preview */}
              <div style={{
                background: C.bg, border: `1px solid ${C.blue}30`, borderRadius: 10,
                padding: "14px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Search size={13} color={C.elec} />
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: C.elec }}>Semantic Match</span>
                </div>
                <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 13, color: C.text, margin: 0, lineHeight: 1.5 }}>
                  "Rate limiting is enforced per API key. Each key allows 100 requests per minute..."
                </p>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: C.muted, marginTop: 6 }}>
                  Source: product-guide.pdf &middot; Chunk #47
                </div>
              </div>
            </div>
            <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 11, color: C.muted, textAlign: "center", marginTop: 10 }}>
              Illustrative — knowledge ingestion and retrieval flow
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── LIVE API DATA ──────────────────── */
function LiveApiSection() {
  return (
    <section id="live-api" data-testid="live-api-section" style={{ padding: "90px 0", background: C.surface }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 56, alignItems: "center" }} className="api-grid">
          {/* Visual */}
          <div className="api-visual" style={{ order: 1 }}>
            <div style={{
              background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14,
              overflow: "hidden", boxShadow: `0 12px 40px rgba(0,0,0,0.4)`,
            }}>
              {/* Header bar */}
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Connected APIs
                </span>
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: C.green, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green }} /> 3 Active
                </span>
              </div>

              {/* API rows */}
              {[
                { name: "Gridscan Blockchain", method: "GET", endpoint: "/v1/network/status", latency: "42ms", status: "healthy" },
                { name: "Internal CRM", method: "POST", endpoint: "/api/customer/lookup", latency: "128ms", status: "healthy" },
                { name: "Weather Service", method: "GET", endpoint: "/current?city={q}", latency: "89ms", status: "healthy" },
              ].map(api => (
                <div key={api.name} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 20px", borderBottom: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: `${C.cyan}12`, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Zap size={15} color={C.cyan} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 13, fontWeight: 500, color: C.text }}>{api.name}</div>
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ color: C.cyan }}>{api.method}</span> {api.endpoint}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: C.muted }}>{api.latency}</span>
                    <span style={{
                      fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: C.green,
                      background: `${C.green}15`, padding: "3px 8px", borderRadius: 4,
                      textTransform: "uppercase",
                    }}>{api.status}</span>
                  </div>
                </div>
              ))}

              {/* Combined answer */}
              <div style={{ padding: 20 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
                  <Cpu size={13} color={C.elec} />
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: C.elec }}>AI Response</span>
                </div>
                <div style={{
                  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: "14px 16px",
                }}>
                  <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 13, color: C.text, margin: 0, lineHeight: 1.6 }}>
                    The ETH network is currently processing 14.2 TPS with a base fee of 23 Gwei.
                    Based on our documentation, gas fees are calculated as...
                  </p>
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, background: `${C.blue}15`, color: C.elec, padding: "2px 7px", borderRadius: 4 }}>KB: Gas docs</span>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, background: `${C.cyan}12`, color: C.cyan, padding: "2px 7px", borderRadius: 4 }}>API: Gridscan (live)</span>
                  </div>
                </div>
              </div>
            </div>
            <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 11, color: C.muted, textAlign: "center", marginTop: 10 }}>
              Illustrative — knowledge + live API data combined in one response
            </p>
          </div>

          {/* Copy */}
          <div style={{ order: 0 }}>
            <SectionTag>Live API Integration</SectionTag>
            <SectionHeading>Go beyond stored knowledge. Answer with live data.</SectionHeading>
            <SectionSub>
              Connect external REST APIs so your assistant can use current data alongside your knowledge base when answering questions.
            </SectionSub>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 32 }} className="api-features-grid">
              <FeatureCard icon={Globe} title="Multiple APIs" desc="Connect any number of external REST endpoints to your bot." accent={C.cyan} />
              <FeatureCard icon={Settings} title="Endpoint CRUD" desc="Full management of methods, URLs, headers, and parameters." accent={C.blue} />
              <FeatureCard icon={Activity} title="Health Checks" desc="Automated diagnostics verify each endpoint's availability." accent={C.green} />
              <FeatureCard icon={BarChart2} title="Usage Analytics" desc="Track inbound and outbound API calls with detailed stats." accent={C.warn} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── ZENDESK ──────────────────── */
function ZendeskSection() {
  const [mode, setMode] = useState("auto");

  return (
    <section id="zendesk" data-testid="zendesk-section" style={{ padding: "90px 0", background: C.bg }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <SectionTag>Zendesk Integration</SectionTag>
          <SectionHeading style={{ margin: "12px auto 0" }}>Support customers directly — or help your agents respond.</SectionHeading>
          <SectionSub style={{ margin: "16px auto 0", textAlign: "center" }}>
            Two independently toggleable modes let you choose how BitBot Pro participates in your Zendesk workflow.
          </SectionSub>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 40 }}>
          {[
            { id: "auto", label: "Auto-Reply Mode" },
            { id: "assist", label: "Agent-Assist Mode" },
          ].map(m => (
            <button
              key={m.id}
              data-testid={`zendesk-mode-${m.id}`}
              onClick={() => setMode(m.id)}
              style={{
                fontFamily: "IBM Plex Sans, sans-serif", fontSize: 14, fontWeight: 500,
                padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer",
                background: mode === m.id ? C.blue : C.surface,
                color: mode === m.id ? "#fff" : C.text2,
                transition: "all 0.2s",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Preview cards */}
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          {mode === "auto" ? (
            <div data-testid="zendesk-auto-preview" style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
              overflow: "hidden",
            }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                <Headphones size={15} color={C.elec} />
                <span style={{ fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: 600, color: C.text }}>Auto-Reply: Public AI Comment</span>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
                  <div style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 12, color: C.muted, marginBottom: 6 }}>Customer Ticket #4821</div>
                  <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 13, color: C.text, margin: 0 }}>
                    "How do I reset my API key? The dashboard doesn't seem to have the option."
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: `linear-gradient(135deg, ${C.blue}, ${C.elec})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <BridgeBotLogo size={22} />
                  </div>
                  <div style={{ background: C.bg, border: `1px solid ${C.blue}30`, borderRadius: 10, padding: "12px 16px", flex: 1 }}>
                    <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 13, color: C.text, margin: 0, lineHeight: 1.6 }}>
                      To reset your API key, navigate to Settings {">"} API Keys and click "Regenerate." The old key will be invalidated immediately.
                    </p>
                    <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: C.green, marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={11} /> Posted as public reply
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div data-testid="zendesk-assist-preview" style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
              overflow: "hidden",
            }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                <Eye size={15} color={C.cyan} />
                <span style={{ fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: 600, color: C.text }}>Agent-Assist: Private Sidebar Suggestion</span>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="zendesk-assist-grid">
                  {/* Ticket */}
                  <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
                    <div style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 12, color: C.muted, marginBottom: 6 }}>Ticket #4821</div>
                    <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 13, color: C.text, margin: 0, lineHeight: 1.5 }}>
                      "How do I reset my API key?"
                    </p>
                    <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: C.warn, marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={10} /> Awaiting agent
                    </div>
                  </div>
                  {/* Suggestion */}
                  <div style={{ background: C.bg, border: `1px solid ${C.cyan}30`, borderRadius: 10, padding: 16 }}>
                    <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: C.cyan, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      AI Suggestion
                    </div>
                    <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 13, color: C.text, margin: 0, lineHeight: 1.5 }}>
                      Navigate to Settings {">"} API Keys and click "Regenerate." The old key is invalidated immediately.
                    </p>
                    <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: C.muted, marginTop: 8 }}>
                      Visible only to agents
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── WIDGET CUSTOMIZATION ──────────────────── */
function WidgetSection() {
  const [widgetColor, setWidgetColor] = useState(C.blue);
  const colors_list = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];

  return (
    <section id="widget" data-testid="widget-section" style={{ padding: "90px 0", background: C.surface }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 56, alignItems: "center" }} className="widget-grid">
          <div>
            <SectionTag>Web Widget</SectionTag>
            <SectionHeading>Your assistant. Your brand.</SectionHeading>
            <SectionSub>
              Customize appearance, set welcome messages, and embed on any website with a single script tag.
            </SectionSub>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 28 }} className="widget-features-grid">
              {[
                { icon: Palette, label: "Custom Colors & Logo" },
                { icon: Layers, label: "Widget Positioning" },
                { icon: MessageSquare, label: "Welcome Messages" },
                { icon: PenTool, label: "Rich Markdown & Code" },
                { icon: Copy, label: "Copy Controls" },
                { icon: Code2, label: "Single-Script Embed" },
              ].map(f => (
                <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}>
                  <f.icon size={16} color={C.elec} />
                  <span style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 14, color: C.text2 }}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Widget preview */}
          <div className="widget-visual">
            <div style={{
              background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14,
              padding: 24,
            }}>
              {/* Color picker row */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Theme</span>
                {colors_list.map(c => (
                  <button
                    key={c}
                    data-testid={`widget-color-${c.replace("#", "")}`}
                    onClick={() => setWidgetColor(c)}
                    style={{
                      width: 24, height: 24, borderRadius: 6, background: c,
                      border: widgetColor === c ? "2px solid #fff" : `2px solid transparent`,
                      cursor: "pointer", transition: "border 0.2s",
                    }}
                  />
                ))}
              </div>

              {/* Mini widget mockup */}
              <div style={{
                background: "#0F172A", borderRadius: 12, padding: 20,
                border: `1px solid ${C.border}`, position: "relative", minHeight: 180,
              }}>
                <div style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 11, color: C.muted, marginBottom: 12 }}>yoursite.com</div>
                <div style={{
                  position: "absolute", bottom: 16, right: 16,
                  width: 200, borderRadius: 12, overflow: "hidden",
                  background: C.surface, border: `1px solid ${C.border}`,
                  boxShadow: `0 8px 30px rgba(0,0,0,0.4)`,
                }}>
                  <div style={{
                    padding: "10px 14px",
                    background: widgetColor,
                    display: "flex", alignItems: "center", gap: 8,
                    transition: "background 0.3s",
                  }}>
                    <BridgeBotLogo size={24} />
                    <span style={{ fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: 600, color: "#fff" }}>Assistant</span>
                  </div>
                  <div style={{ padding: "12px 14px" }}>
                    <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 11, color: C.text2, margin: 0 }}>
                      Hi! How can I help you today?
                    </p>
                  </div>
                </div>
              </div>

              {/* Embed code */}
              <div style={{
                marginTop: 16, background: C.surface2, borderRadius: 8,
                padding: "12px 16px", border: `1px solid ${C.border}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <code style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: C.cyan, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {'<script src="bitbotpro.app/embed.js"></script>'}
                </code>
                <Copy size={14} color={C.muted} style={{ cursor: "pointer", flexShrink: 0 }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── DASHBOARD & ANALYTICS ──────────────────── */
function DashboardSection() {
  return (
    <section id="dashboard" data-testid="dashboard-section" style={{ padding: "90px 0", background: C.bg }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <SectionTag>Administration</SectionTag>
          <SectionHeading style={{ margin: "12px auto 0" }}>Manage your bots. Understand your conversations.</SectionHeading>
          <SectionSub style={{ margin: "16px auto 0", textAlign: "center" }}>
            A centralized dashboard to administer bot instances, track usage across channels, and review every conversation.
          </SectionSub>
        </div>

        {/* Dashboard mockup */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
          overflow: "hidden", boxShadow: `0 16px 48px rgba(0,0,0,0.35)`,
        }}>
          {/* Topbar */}
          <div style={{
            padding: "12px 24px", borderBottom: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: `linear-gradient(135deg, ${C.blue}, ${C.elec})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BridgeBotLogo size={24} />
              </div>
              <span style={{ fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: 600, color: C.text }}>Dashboard</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["7 Days", "30 Days"].map(p => (
                <span key={p} style={{
                  fontFamily: "IBM Plex Sans, sans-serif", fontSize: 11, color: C.muted,
                  background: C.surface2, padding: "4px 10px", borderRadius: 5,
                  border: `1px solid ${C.border}`,
                }}>{p}</span>
              ))}
            </div>
          </div>

          {/* Stat cards row */}
          <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }} className="dashboard-stats-grid">
            {[
              { label: "Total Messages", value: "12,847", change: "+14%", icon: MessageSquare, color: C.blue },
              { label: "Active Channels", value: "5", change: "All connected", icon: Globe, color: C.green },
              { label: "Avg. Response", value: "1.2s", change: "-8%", icon: Clock, color: C.cyan },
              { label: "KB Articles", value: "463", change: "+23 this week", icon: BookOpen, color: C.warn },
            ].map(s => (
              <div key={s.label} style={{
                background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10,
                padding: "16px 18px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <s.icon size={16} color={s.color} />
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: C.green }}>{s.change}</span>
                </div>
                <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 22, fontWeight: 700, color: C.text }}>{s.value}</div>
                <div style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 11, color: C.muted, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Chart area */}
          <div style={{ padding: "0 24px 20px" }}>
            <div style={{
              background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10,
              padding: 20, height: 140, position: "relative", overflow: "hidden",
            }}>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: C.muted, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                7-Day Message Trend
              </div>
              {/* SVG chart */}
              <svg width="100%" height="90" viewBox="0 0 600 90" preserveAspectRatio="none" style={{ display: "block" }}>
                {/* Grid lines */}
                {[0, 30, 60, 90].map(y => (
                  <line key={y} x1="0" y1={y} x2="600" y2={y} stroke={C.border} strokeWidth="0.5" />
                ))}
                {/* Web line */}
                <polyline fill="none" stroke={C.blue} strokeWidth="2" points="0,70 100,55 200,45 300,50 400,35 500,25 600,20" />
                {/* Discord line */}
                <polyline fill="none" stroke="#5865F2" strokeWidth="2" points="0,80 100,75 200,65 300,60 400,55 500,50 600,45" strokeDasharray="4,4" />
                {/* Telegram line */}
                <polyline fill="none" stroke="#26A5E4" strokeWidth="2" points="0,85 100,80 200,78 300,70 400,65 500,55 600,40" strokeDasharray="6,3" />
              </svg>
              {/* Legend */}
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                {[
                  { color: C.blue, label: "Web" },
                  { color: "#5865F2", label: "Discord" },
                  { color: "#26A5E4", label: "Telegram" },
                ].map(l => (
                  <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "IBM Plex Sans, sans-serif", fontSize: 10, color: C.muted }}>
                    <span style={{ width: 10, height: 2, background: l.color, display: "inline-block", borderRadius: 1 }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 11, color: C.muted, textAlign: "center", marginTop: 10 }}>
          Illustrative — sample dashboard with demo data
        </p>

        {/* Feature highlights below */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 40 }}>
          {[
            { icon: Shield, label: "Isolated Bot Instances", desc: "Separate configs, knowledge bases, and integrations per instance." },
            { icon: Filter, label: "Conversation Filters", desc: "Filter by platform, date, and keyword across all channels." },
            { icon: TrendingUp, label: "Seven-Day Trends", desc: "Message volume trends broken down by every connected channel." },
            { icon: Users, label: "Role-Based Access", desc: "Superadmin and user roles control who manages what." },
          ].map(f => (
            <div key={f.label} style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: "20px 18px",
            }}>
              <f.icon size={18} color={C.elec} style={{ marginBottom: 10 }} />
              <h4 style={{ fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: 600, color: C.text, margin: "0 0 6px" }}>{f.label}</h4>
              <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 12, color: C.text2, lineHeight: 1.5, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── HOW IT WORKS ──────────────────── */
function HowItWorksSection() {
  const steps = [
    {
      num: "01",
      title: "Add your knowledge",
      desc: "Upload documents, connect websites, or link GitHub repositories. Your content becomes your bot's brain.",
      icon: Upload,
    },
    {
      num: "02",
      title: "Connect channels & data",
      desc: "Configure conversation channels and external APIs. Each channel can be enabled independently.",
      icon: Zap,
    },
    {
      num: "03",
      title: "Test and launch",
      desc: "Preview answers in the live demo, deploy your assistant, and review conversations as they happen.",
      icon: Play,
    },
  ];

  return (
    <section data-testid="how-it-works-section" style={{ padding: "90px 0", background: C.surface }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <SectionTag>Getting Started</SectionTag>
          <SectionHeading style={{ margin: "12px auto 0" }}>Up and running in three steps.</SectionHeading>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24,
          position: "relative",
        }} className="steps-grid">
          {/* Connector line */}
          <div className="steps-connector" style={{
            position: "absolute", top: 48, left: "17%", right: "17%", height: 1,
            background: `linear-gradient(90deg, transparent, ${C.blue}50, ${C.blue}50, transparent)`,
          }} />

          {steps.map(s => (
            <div key={s.num} style={{ textAlign: "center", position: "relative" }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14, margin: "0 auto 20px",
                background: `${C.blue}15`, border: `1px solid ${C.blue}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", zIndex: 1,
                boxShadow: `0 0 20px ${C.neonBlue}`,
              }}>
                <s.icon size={24} color={C.elec} />
              </div>
              <div style={{
                fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: C.blue,
                marginBottom: 8, letterSpacing: "0.15em",
              }}>
                STEP {s.num}
              </div>
              <h4 style={{ fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: 600, color: C.text, margin: "0 0 8px" }}>{s.title}</h4>
              <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 14, color: C.text2, lineHeight: 1.6, margin: 0, maxWidth: 280, marginLeft: "auto", marginRight: "auto" }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 48 }}>
          <PrimaryBtn to="/register" testId="how-signup-btn">
            Start Building <ArrowRight size={16} />
          </PrimaryBtn>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── FAQ ──────────────────── */
function FaqSection() {
  const [openIdx, setOpenIdx] = useState(null);

  const items = [
    {
      q: "What content can I use to train my bot?",
      a: "You can upload text documents and PDFs, scrape website content (including sub-pages), and connect GitHub repositories. All content is processed into semantic chunks for retrieval.",
    },
    {
      q: "Which channels does BitBot Pro support?",
      a: "BitBot Pro deploys to five channels: a customizable website chat widget, Discord servers, Telegram (DMs, mentions, and commands), Zendesk (auto-reply and agent-assist), and a REST API for custom applications.",
    },
    {
      q: "Can answers include live external API data?",
      a: "Yes. Connect any number of external REST APIs through the API Integrations panel. Your bot combines knowledge base context with live API responses to deliver answers with current data.",
    },
    {
      q: "Can I customize the website widget?",
      a: "The widget supports custom colors, your bot's logo, left or right positioning, configurable welcome messages, rich Markdown formatting, and code block rendering. Embed it with a single script tag.",
    },
    {
      q: "Can Zendesk assist agents without posting public replies?",
      a: "Yes. Agent-Assist mode generates AI suggestions visible only to your support agents in a sidebar, without posting anything publicly. You can enable Auto-Reply and Agent-Assist independently.",
    },
    {
      q: "Can I manage separate bot instances?",
      a: "Each bot instance has its own knowledge base, API connections, channel configurations, and conversation history. Superadmins can create and manage multiple isolated instances.",
    },
    {
      q: "Which AI providers are supported?",
      a: "BitBot Pro uses Claude and GPT models through the Emergent Universal Key. You can also bring your own OpenAI API key (BYOK) for direct OpenAI access.",
    },
  ];

  return (
    <section id="faq" data-testid="faq-section" style={{ padding: "90px 0", background: C.bg }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <SectionTag>FAQ</SectionTag>
          <SectionHeading style={{ margin: "12px auto 0" }}>Common questions</SectionHeading>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item, i) => (
            <div
              key={i}
              data-testid={`faq-item-${i}`}
              style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
                overflow: "hidden", transition: "border-color 0.2s",
                borderColor: openIdx === i ? `${C.blue}60` : C.border,
                boxShadow: openIdx === i ? `0 0 16px ${C.neonBlue}` : "none",
              }}
            >
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 20px", background: "none", border: "none", cursor: "pointer",
                  textAlign: "left",
                }}
                data-testid={`faq-toggle-${i}`}
              >
                <span style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 15, fontWeight: 500, color: C.text }}>
                  {item.q}
                </span>
                <ChevronDown
                  size={18} color={C.muted}
                  style={{
                    transition: "transform 0.2s", flexShrink: 0, marginLeft: 12,
                    transform: openIdx === i ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </button>
              {openIdx === i && (
                <div style={{ padding: "0 20px 16px" }}>
                  <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 14, color: C.text2, lineHeight: 1.7, margin: 0 }}>
                    {item.a}
                  </p>
                  <Link
                    to="/docs"
                    style={{
                      fontFamily: "IBM Plex Sans, sans-serif", fontSize: 12, color: C.elec,
                      textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                      marginTop: 10,
                    }}
                  >
                    Read the docs <ArrowRight size={12} />
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── FINAL CTA ──────────────────── */
function CtaSection() {
  return (
    <section data-testid="cta-section" style={{
      padding: "90px 0",
      background: C.surface,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Glow */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 700, height: 700, borderRadius: "50%", background: `radial-gradient(circle, ${C.blue}18 0%, ${C.cyan}06 40%, transparent 70%)`, pointerEvents: "none" }} />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px", textAlign: "center", position: "relative", zIndex: 1 }}>
        <SectionHeading style={{ margin: 0 }}>Bring your knowledge to every conversation.</SectionHeading>
        <SectionSub style={{ margin: "20px auto 0", textAlign: "center" }}>
          Knowledge-powered answers, live API data, and connected conversation channels — all from one platform.
        </SectionSub>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14, marginTop: 36 }}>
          <PrimaryBtn to="/register" testId="cta-signup-btn">
            Start Building Free <ArrowRight size={16} />
          </PrimaryBtn>
          <GhostBtn to="/chat" testId="cta-demo-btn">
            <Play size={14} /> Try Live Demo
          </GhostBtn>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── FOOTER ──────────────────── */
function Footer() {
  return (
    <footer data-testid="landing-footer" style={{
      padding: "40px 0 32px",
      background: C.bg,
      borderTop: `1px solid ${C.border}`,
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 32 }}>
          {/* Logo */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <BridgeBotLogo size={48} />
              <span style={{ fontFamily: "Outfit, sans-serif", fontSize: 22, fontWeight: 700, color: C.elec }}>
                BitBot <span style={{ color: "#fff" }}>Pro</span>
              </span>
            </div>
            <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: 12, color: C.muted, maxWidth: 260, lineHeight: 1.5 }}>
              AI assistants powered by your knowledge and live data.
            </p>
          </div>

          {/* Links */}
          <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
            <div>
              <h5 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.15em", margin: "0 0 12px" }}>Product</h5>
              {[
                { label: "Documentation", to: "/docs" },
                { label: "Changelog", to: "/admin/changelog" },
                { label: "Live Demo", to: "/chat" },
              ].map(l => (
                <Link key={l.label} to={l.to} style={{ display: "block", fontFamily: "IBM Plex Sans, sans-serif", fontSize: 13, color: C.text2, textDecoration: "none", marginBottom: 8 }}>
                  {l.label}
                </Link>
              ))}
            </div>
            <div>
              <h5 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.15em", margin: "0 0 12px" }}>Account</h5>
              {[
                { label: "Sign In", to: "/login" },
                { label: "Create Account", to: "/register" },
              ].map(l => (
                <Link key={l.label} to={l.to} style={{ display: "block", fontFamily: "IBM Plex Sans, sans-serif", fontSize: 13, color: C.text2, textDecoration: "none", marginBottom: 8 }}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div style={{
          marginTop: 32, paddingTop: 20,
          borderTop: `1px solid ${C.border}`,
          fontFamily: "IBM Plex Sans, sans-serif", fontSize: 12, color: C.muted,
          textAlign: "center",
        }}>
          Built with BitBot Pro
        </div>
      </div>
    </footer>
  );
}

/* ──────────────────── MAIN PAGE ──────────────────── */
export default function LandingPage() {
  return (
    <div style={{ background: C.bg, minHeight: "100vh" }} data-testid="landing-page">
      <Navbar />
      <HeroSection />
      <FadeIn><ChannelsSection /></FadeIn>
      <FadeIn><KnowledgeSection /></FadeIn>
      <FadeIn><LiveApiSection /></FadeIn>
      <FadeIn><ZendeskSection /></FadeIn>
      <FadeIn><WidgetSection /></FadeIn>
      <FadeIn><DashboardSection /></FadeIn>
      <FadeIn><HowItWorksSection /></FadeIn>
      <FadeIn><FaqSection /></FadeIn>
      <FadeIn><CtaSection /></FadeIn>
      <Footer />

      {/* Responsive CSS */}
      <style>{`
        /* Mobile nav */
        @media (max-width: 768px) {
          .landing-nav-links, .landing-nav-ctas { display: none !important; }
          .landing-nav-hamburger { display: flex !important; }
        }
        @media (min-width: 769px) {
          .landing-nav-mobile { display: none !important; }
        }

        /* Hero grid → 2 cols on desktop */
        @media (min-width: 900px) {
          .hero-grid { grid-template-columns: 1fr 1fr !important; }
        }

        /* Knowledge grid → 2 cols */
        @media (min-width: 900px) {
          .knowledge-grid { grid-template-columns: 1fr 1fr !important; }
        }

        /* API grid → 2 cols */
        @media (min-width: 900px) {
          .api-grid { grid-template-columns: 1fr 1fr !important; }
          .api-visual { order: 1 !important; }
        }

        /* Widget grid → 2 cols */
        @media (min-width: 900px) {
          .widget-grid { grid-template-columns: 1fr 1fr !important; }
        }

        /* Steps grid → single col on mobile */
        @media (max-width: 700px) {
          .steps-grid { grid-template-columns: 1fr !important; }
          .steps-connector { display: none !important; }
        }

        /* Dashboard stats → 2 cols on mobile */
        @media (max-width: 700px) {
          .dashboard-stats-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 420px) {
          .dashboard-stats-grid { grid-template-columns: 1fr !important; }
        }

        /* API features grid → single col on mobile */
        @media (max-width: 500px) {
          .api-features-grid { grid-template-columns: 1fr !important; }
          .widget-features-grid { grid-template-columns: 1fr !important; }
        }

        /* Zendesk assist grid → single col on mobile */
        @media (max-width: 600px) {
          .zendesk-assist-grid { grid-template-columns: 1fr !important; }
        }

        /* Smooth scrolling for anchor links */
        html { scroll-behavior: smooth; }

        /* Reduce motion for accessibility */
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
