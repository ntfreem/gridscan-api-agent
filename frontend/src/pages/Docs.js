import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ChevronDown, BookOpen, Users, MessageSquare, Database, Globe, Shield, BarChart3, ArrowLeft, Send, Headphones, Search, X } from "lucide-react";
import BridgeBotLogo from "../components/BridgeBotLogo";
import { colors, fonts, radius } from "../theme";

const sections = [
  {
    id: "getting-started",
    icon: BookOpen,
    title: "Getting Started",
    content: [
      {
        title: "What is BitBot Pro?",
        body: `BitBot Pro runs AI support assistants for your organisation on the web, Telegram and Discord, and drafts or posts answers on Zendesk tickets.

**How it is organised**
- **Enterprise**: your company account (plan, policies, credentials, members)
- **Organisation**: a team or customer inside the Enterprise
- **Bot**: an assistant (behaviour, AI provider, knowledge, integrations)
- **Bot Instance**: one deployment of a bot on one channel: web chat, Telegram or Discord
- **Bot Integration**: Zendesk, connected to a bot

Settings flow down this hierarchy: a value set on the Enterprise applies everywhere below it unless a lower level overrides it, and policies set higher up can only be made stricter below.`
      },
      {
        title: "Quick start",
        body: `1. **Sign in** at /app with the account you were invited with
2. **Open your Organisation** and create a **Bot**
3. **Add an AI provider key** under Credentials (Anthropic or OpenAI) and select it on the bot
4. **Add knowledge**: create a knowledge source and upload documents
5. **Create an instance** for each channel (web, Telegram, Discord) and follow its setup tab
6. **Check usage** on the Usage tab of any level`
      },
      {
        title: "Accounts and invitations",
        body: `Accounts are created by invitation. An administrator invites you by e-mail; the link works once, only for the invited address, and expires after seven days. Enterprises are created by BitBot Pro platform administrators.`
      }
    ]
  },
  {
    id: "roles",
    icon: Users,
    title: "Roles and permissions",
    content: [
      {
        title: "Roles",
        body: `**Owner** (Enterprise only): everything, including lifecycle, permanent deletion and owners
**Admin**: manage members, credentials, bots, instances and integrations in their scope
**Editor**: change configuration and content
**Viewer**: read only

A role given on an Organisation or Bot applies to everything below it. Nobody can grant a role higher than their own. Objects you have no access to are simply not found.`
      }
    ]
  },
  {
    id: "knowledge-base",
    icon: Database,
    title: "Knowledge",
    content: [
      {
        title: "Knowledge sources",
        body: `Knowledge sources belong to an Enterprise or an Organisation. Upload text, Markdown, HTML, CSV, JSON, DOCX or text-based PDF documents; each document can be restricted to specific bots. Scanned PDFs (images) are not read: optical character recognition is not available yet.`
      },
      {
        title: "Knowledge modes",
        body: `**General**: the assistant may use its general knowledge.
**Knowledge preferred**: answers from your documents first.
**Strict knowledge only**: the assistant answers only when your approved documents support the answer, and otherwise refuses or hands over. This reduces unsupported answers; it cannot guarantee that no mistake is ever made, so review important answers.`
      }
    ]
  },
  {
    id: "web",
    icon: Globe,
    title: "Web chat",
    content: [
      {
        title: "Embedding the widget",
        body: `Create a web instance and copy the embed snippet from its **Install** tab. The widget is served by api.bitbotpro.io and supports popup, inline and full-page modes, theming, a welcome message and a logo. Restrict it to your own websites with **allowed origins**. The **Open preview** button starts a test conversation; preview messages count towards your usage like real ones.`
      }
    ]
  },
  {
    id: "telegram",
    icon: Send,
    title: "Telegram",
    content: [
      {
        title: "Connecting a Telegram bot",
        body: `Create the bot with @BotFather, add its token as an Organisation credential (it is checked and then stored encrypted), create a Telegram instance that uses it, and press **Connect**. Listen modes: mentions and commands, direct messages only, or every message.`
      }
    ]
  },
  {
    id: "discord",
    icon: MessageSquare,
    title: "Discord",
    content: [
      {
        title: "How Discord works in BitBot Pro",
        body: `Each Enterprise has **one Discord application**, set up and run by BitBot Pro platform administrators. Organisations use it to add their bot to their own Discord servers: create a Discord instance, press **Add to Discord server**, then choose the channels it answers in. Staff handoff (the bot steps back when your staff reply) and passive mode are available per instance. Organisation administrators cannot change the shared application, its avatar or its connection.`
      }
    ]
  },
  {
    id: "zendesk",
    icon: Headphones,
    title: "Zendesk",
    content: [
      {
        title: "Zendesk integration",
        body: `Add a Zendesk integration to a bot, connect it with OAuth or an API token, and configure the signed webhook (a signing secret is required). Reply modes: post validated answers publicly, add private suggestions for agents, or only store suggestions. The sidebar app lets agents request a draft reply. BitBot Pro never creates tickets. Zendesk analytics are not available yet.`
      }
    ]
  },
  {
    id: "security",
    icon: Shield,
    title: "Security and data",
    content: [
      {
        title: "Credentials and secrets",
        body: `Provider keys, bot tokens and webhook secrets are encrypted at rest and are write-only: after saving you only see a fingerprint. Permission to use a credential is separate from permission to manage it.`
      },
      {
        title: "Suspending, archiving and deleting",
        body: `Suspending an object stops it and everything below it immediately. Permanent deletion shows a preview of everything that will be removed, needs typed confirmation, and runs as a recorded job.`
      }
    ]
  },
  {
    id: "usage",
    icon: BarChart3,
    title: "Usage",
    content: [
      {
        title: "Usage reports",
        body: `Every level has a Usage tab with AI message counts per month and the applicable quotas. Preview conversations are counted and shown separately.`
      }
    ]
  },
];

function DocSection({ section, isOpen, onToggle }) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <button onClick={onToggle} style={{
        width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px",
        backgroundColor: isOpen ? "rgba(96,165,250,0.06)" : "transparent",
        border: `1px solid ${isOpen ? "rgba(96,165,250,0.2)" : "transparent"}`,
        borderRadius: "10px", cursor: "pointer", transition: "all 0.2s",
      }}>
        <section.icon size={18} color={isOpen ? colors.brand.cyan : colors.text.muted} />
        <span style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: isOpen ? colors.text.primary : colors.text.secondary, flex: 1, textAlign: "left" }}>
          {section.title}
        </span>
        {isOpen ? <ChevronDown size={16} color={colors.text.muted} /> : <ChevronRight size={16} color={colors.text.muted} />}
      </button>
    </div>
  );
}

export default function Docs() {
  const initial = typeof window !== "undefined" && window.location.hash
    ? window.location.hash.replace("#", "")
    : "getting-started";
  const [openSection, setOpenSection] = useState(
    sections.some(s => s.id === initial) ? initial : "getting-started"
  );
  const [search, setSearch] = useState("");

  // Search across all sections
  const searchResults = search.trim().length >= 2
    ? sections.flatMap(s =>
        s.content
          .filter(c =>
            c.title.toLowerCase().includes(search.toLowerCase()) ||
            c.body.toLowerCase().includes(search.toLowerCase())
          )
          .map(c => ({ sectionId: s.id, sectionTitle: s.title, icon: s.icon, ...c }))
      )
    : [];
  const isSearching = search.trim().length >= 2;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: colors.bg.base, fontFamily: fonts.body }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${colors.border.default}`, padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
            <BridgeBotLogo size={40} />
            <span style={{ fontFamily: fonts.heading, fontSize: "20px", fontWeight: "700", color: colors.text.primary }}>
              BitBot <span style={{ color: colors.brand.light }}>Pro</span>
            </span>
          </Link>
          <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.muted, backgroundColor: colors.bg.panel, padding: "2px 8px", borderRadius: "6px" }}>
            Documentation
          </span>
        </div>
        <Link to="/app" style={{ display: "flex", alignItems: "center", gap: "6px", color: colors.brand.cyan, fontSize: "13px", fontFamily: fonts.body, textDecoration: "none" }}>
          <ArrowLeft size={14} /> Back to App
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", maxWidth: "1200px", margin: "0 auto", minHeight: "calc(100vh - 65px)" }}>
        {/* Sidebar nav */}
        <div style={{ borderRight: `1px solid ${colors.border.default}`, padding: "24px 16px" }}>
          {/* Search bar */}
          <div style={{ position: "relative", marginBottom: "16px", paddingLeft: "2px", paddingRight: "2px" }}>
            <Search size={14} color={colors.text.muted} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search docs..."
              data-testid="docs-search-input"
              style={{
                width: "100%", padding: "9px 32px 9px 32px", borderRadius: "8px",
                border: `1px solid ${colors.border.default}`, backgroundColor: colors.bg.base,
                color: colors.text.primary, fontFamily: fonts.body, fontSize: "12px",
                outline: "none", boxSizing: "border-box",
              }}
            />
            {search && (
              <button onClick={() => setSearch("")} data-testid="docs-search-clear"
                style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "2px", color: colors.text.muted }}>
                <X size={13} />
              </button>
            )}
          </div>
          <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px", paddingLeft: "18px" }}>
            {isSearching ? `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}` : "Sections"}
          </p>
          {sections.map(s => (
            <button key={s.id} onClick={() => setOpenSection(s.id)} data-testid={`nav-${s.id}`} style={{
              width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "10px 18px",
              backgroundColor: openSection === s.id ? "rgba(96,165,250,0.08)" : "transparent",
              border: "none", borderRadius: "8px", cursor: "pointer", marginBottom: "2px", transition: "all 0.15s",
              borderLeft: openSection === s.id ? `2px solid ${colors.brand.cyan}` : "2px solid transparent",
            }}>
              <s.icon size={15} color={openSection === s.id ? colors.brand.cyan : colors.text.muted} />
              <span style={{ fontFamily: fonts.body, fontSize: "13px", color: openSection === s.id ? colors.text.primary : colors.text.secondary, fontWeight: openSection === s.id ? "600" : "400" }}>
                {s.title}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: "32px 40px", maxWidth: "800px" }}>
          {isSearching ? (
            <>
              <div style={{ marginBottom: "32px" }}>
                <h1 style={{ fontFamily: fonts.heading, fontSize: "28px", fontWeight: "700", color: colors.text.primary, margin: "0 0 8px" }}>
                  Search Results
                </h1>
                <div style={{ width: "40px", height: "3px", backgroundColor: colors.brand.cyan, borderRadius: "2px" }} />
              </div>
              {searchResults.length === 0 ? (
                <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.text.muted, textAlign: "center", padding: "40px 0" }}>
                  No results found for "{search}"
                </p>
              ) : (
                searchResults.map((item, i) => (
                  <div key={i} data-testid="docs-search-result"
                    onClick={() => { setOpenSection(item.sectionId); setSearch(""); }}
                    style={{
                      marginBottom: "16px", padding: "16px 20px", borderRadius: "10px", cursor: "pointer",
                      backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
                      transition: "border-color 0.2s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = colors.brand.cyan}
                    onMouseLeave={e => e.currentTarget.style.borderColor = colors.border.default}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <item.icon size={13} color={colors.brand.cyan} />
                      <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase" }}>
                        {item.sectionTitle}
                      </span>
                    </div>
                    <h3 style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: "0 0 6px" }}>
                      {item.title}
                    </h3>
                    <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {item.body.slice(0, 200).replace(/\*\*/g, "")}...
                    </p>
                  </div>
                ))
              )}
            </>
          ) : (
            <>
          <div style={{ marginBottom: "32px" }}>
            <h1 style={{ fontFamily: fonts.heading, fontSize: "28px", fontWeight: "700", color: colors.text.primary, margin: "0 0 8px" }}>
              {sections.find(s => s.id === openSection)?.title}
            </h1>
            <div style={{ width: "40px", height: "3px", backgroundColor: colors.brand.cyan, borderRadius: "2px" }} />
          </div>
          {sections.find(s => s.id === openSection)?.content.map((item, i) => (
            <div key={i} style={{ marginBottom: "36px", paddingBottom: "36px", borderBottom: i < sections.find(s => s.id === openSection).content.length - 1 ? `1px solid ${colors.border.subtle}` : "none" }}>
              <h2 style={{ fontFamily: fonts.heading, fontSize: "18px", fontWeight: "600", color: colors.text.primary, margin: "0 0 14px" }}>{item.title}</h2>
              <div style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.text.secondary, lineHeight: "1.85", whiteSpace: "pre-line" }}>
                {item.body.split(/(\*\*[^*]+\*\*|\`[^`]+\`)/).map((part, j) => {
                  if (part.startsWith("**") && part.endsWith("**")) {
                    return <strong key={j} style={{ color: colors.text.primary, fontWeight: "600" }}>{part.slice(2, -2)}</strong>;
                  }
                  if (part.startsWith("`") && part.endsWith("`")) {
                    return <code key={j} style={{ backgroundColor: colors.bg.panel, padding: "2px 6px", borderRadius: "4px", fontFamily: fonts.mono, fontSize: "12px", color: colors.brand.cyan }}>{part.slice(1, -1)}</code>;
                  }
                  return part;
                })}
              </div>
              {item.diagram && (
                <pre
                  data-testid="doc-diagram"
                  style={{
                    marginTop: "18px",
                    padding: "18px",
                    backgroundColor: colors.bg.panel,
                    border: `1px solid ${colors.border.default}`,
                    borderRadius: "10px",
                    overflowX: "auto",
                    fontFamily: fonts.mono,
                    fontSize: "11px",
                    lineHeight: "1.4",
                    color: colors.text.primary,
                    whiteSpace: "pre",
                  }}
                >
                  {item.diagram}
                </pre>
              )}
            </div>
          ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
