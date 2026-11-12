import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ChevronDown, BookOpen, Users, MessageSquare, Database, Zap, Settings, Globe, Shield, BarChart3, Code, HelpCircle, ArrowLeft, UserCheck, GitBranch, Send, Headphones, Plug, Search, X } from "lucide-react";
import BridgeBotLogo from "../components/BridgeBotLogo";
import { colors, fonts, radius } from "../theme";

const sections = [
  {
    id: "getting-started",
    icon: BookOpen,
    title: "Getting Started",
    content: [
      {
        title: "What is BridgeBot?",
        body: `BridgeBot is a multi-tenant AI chatbot platform that lets you create intelligent support agents powered by your own knowledge base and external API integrations. Deploy bots across multiple channels — web widget, Discord, Telegram, and Zendesk.

**Key capabilities:**
- Create multiple bot instances for different products or teams
- Train your bot using FAQs, URLs, documents, and GitHub repos with priority levels
- Deploy on web (chat page + embeddable widget), Discord, Telegram, and Zendesk
- Connect external APIs — the bot can fetch live data (blockchain, weather, etc.) alongside KB answers
- Smart human takeover — bot steps aside when staff intervenes (Discord)
- Full platform analytics with per-channel message breakdowns
- Multi-user access with role-based permissions
- Customizable widget theming, bot logos, and welcome messages`
      },
      {
        title: "Quick Start (5 minutes)",
        body: `1. **Log in** with your admin credentials
2. **Select or create** a workspace (instance)
3. **Add knowledge** — go to Knowledge Base and add FAQs, scrape URLs, upload documents, or import from GitHub
4. **Set priority** — mark your most important FAQs as High priority
5. **Test your bot** — click "Open Chat Demo" in the sidebar
6. **Deploy** — embed the widget on your site, connect to Discord, Telegram, or Zendesk

That's it! Your bot immediately starts answering questions based on your knowledge base. It understands user intent semantically — users don't need to phrase questions exactly like your FAQs.`
      },
      {
        title: "Account Types",
        body: `**Admin (superadmin)**
- Full access to all workspaces
- Can create/delete instances, manage users, delete users
- Access to analytics, all channel settings, embed codes
- Can configure integrations and API connections

**User**
- Access only to assigned workspaces
- Can manage knowledge base, view conversations
- Cannot create instances or manage other users`
      }
    ]
  },
  {
    id: "knowledge-base",
    icon: Database,
    title: "Knowledge Base",
    content: [
      {
        title: "How It Works",
        body: `Your bot's intelligence comes from the knowledge base you build. Every FAQ, URL, document, and GitHub repo you add is fed to the AI when answering questions.

**The bot will:**
- Use ALL your active knowledge sources for every question
- Match user intent semantically — users can ask in their own words
- Combine KB answers with live API data when integrations are configured
- Respect the Knowledge Gate slider to control how freely it answers

**Priority System:**
- **High** — given preference in answers, shown first to the AI
- **Medium** — standard priority
- **Normal** — lowest priority, used as supplementary context

Every new source you add immediately makes the bot smarter. No retraining needed.`
      },
      {
        title: "Adding FAQs",
        body: `FAQs are the most effective knowledge source. Write them as question-answer pairs.

**Tips for great FAQs:**
- Write the title as a real customer question
- Include detailed answers — the AI uses the full content
- Set High priority for your most important FAQs
- Be specific: include links, prices, exact steps when relevant
- Add variations of common questions as separate FAQs

**Example:**
- Title: "How long does a transfer take?"
- Content: "Transfers require 400 confirmations and typically take 30-60 minutes."
- Priority: High`
      },
      {
        title: "Scraping URLs",
        body: `Scrape any webpage to extract its content as knowledge.

**Steps:**
1. Go to Knowledge Base → URL Scraper tab
2. Enter the URL and optionally add a custom title
3. Set priority level and category
4. Optionally enable **Sub-Page Crawling** to discover and scrape linked pages (depth 1-3, up to 50 pages)
5. Click "Scrape & Save"

**Sub-Page Crawling:** When enabled, BridgeBot discovers same-domain sub-pages and imports them all. Progress is shown in real-time via a streaming progress bar.

**Re-scraping:** Use the refresh icon on any URL source to re-scrape its content. Use "Refresh All URLs" to bulk re-scrape all URL sources with a progress indicator.

**Content Viewer:** Click any source title to open the Content Viewer, which shows the exact stored text with search, character stats, and corruption detection.`
      },
      {
        title: "Uploading Documents",
        body: `Upload .txt or .pdf files to add their content to your knowledge base.

**Steps:**
1. Go to Knowledge Base → Upload Document tab
2. Enter a descriptive title
3. Select your file (.txt or .pdf)
4. Set priority level
5. Click "Upload Document"

**Limits:** Content is extracted up to ~6,000 characters per document. Large files are automatically chunked into 8K-character parts for better retrieval.`
      },
      {
        title: "GitHub Repository Import",
        body: `Import documentation directly from GitHub repositories.

**Steps:**
1. Go to Knowledge Base → GitHub Crawler tab
2. Enter the repository URL (e.g., https://github.com/org/repo)
3. Optionally enter a GitHub token for private repos
4. Click "Scan Repository" to discover documentation files
5. Use file filters (by extension: .md, .rst, .txt; by max size) to narrow results
6. Select the files you want and click "Import Selected"

**Supported files:** README, .md, .rst, .txt, CHANGELOG, CONTRIBUTING, files in docs/ and wiki/ directories. Category badges are auto-assigned (Overview, Docs, Changelog, Examples, etc.).

Import progress streams in real-time. Code blocks in Markdown are preserved.`
      },
      {
        title: "KB Export, Import & Share",
        body: `**Export:** Click "Export KB" to download your entire knowledge base as a portable JSON file.

**Import:** Click "Import KB" to load sources from an exported JSON. Choose between:
- **Merge** — skips duplicates, adds only new sources
- **Overwrite** — archives existing sources, imports fresh

**Share Across Bots:** Select sources and click "Share Selected" to copy them to another bot instance. Useful when multiple bots share common knowledge. Source grouping is maintained in the target instance.`
      },
      {
        title: "Knowledge Gate",
        body: `The Knowledge Gate controls how strictly the bot sticks to your KB.

**Slider range (0–100%):**
- **0–20% (Strict)** — KB only, refuses all external questions
- **21–40% (Mostly Strict)** — KB only, acknowledges gaps politely
- **41–60% (Balanced)** — KB first, general knowledge with disclaimer
- **61–80% (Mostly Open)** — KB preferred, general knowledge freely
- **81–100% (Fully Open)** — uses everything, KB as trusted reference

**Presets:** Quick buttons for Conservative (10%), Balanced (50%), and Open (85%).

Find the Knowledge Gate slider in Bot Settings.`
      }
    ]
  },
  {
    id: "api-integrations",
    icon: Plug,
    title: "API Integrations",
    content: [
      {
        title: "What Are API Integrations?",
        body: `Connect external REST APIs so your bot can fetch live data alongside KB answers. When a user asks a question, the bot can intelligently decide to call an API and merge the result into its response.

**Example use cases:**
- Blockchain data (Gridscan, Etherscan)
- Weather and location data
- Product inventory or pricing
- CRM or ticketing system lookups

The bot uses AI to route questions — it decides which API endpoint to call, what parameters to use, and how to present the result.`
      },
      {
        title: "Adding an Integration",
        body: `1. Go to **API Integrations** in the sidebar
2. Click "Add Integration"
3. Enter the API name, base URL, and optional description
4. Add authentication (API key, Bearer token, or custom headers)
5. Click "Save"

**Endpoint Discovery:** If the API has an OpenAPI/Swagger spec, BridgeBot can auto-discover endpoints. Click "Discover Endpoints" and provide the spec URL. Otherwise, add endpoints manually with path, method, parameters, and description.`
      },
      {
        title: "How the Bot Uses APIs",
        body: `When a user asks a question:
1. The AI router analyzes the question against all available endpoints
2. If an API call would help answer the question, the bot selects the best endpoint
3. The API is called with appropriate parameters
4. The response is merged with KB context into a unified AI answer

The bot will NOT call APIs when the KB alone can answer. It also won't hallucinate API calls — if no endpoint matches, it falls back to KB-only answers.

**Outbound Analytics:** All API calls are logged with latency, success/failure, and response size. View per-integration stats in the Usage Analytics page.`
      }
    ]
  },
  {
    id: "discord",
    icon: Zap,
    title: "Discord Integration",
    content: [
      {
        title: "Setting Up Discord",
        body: `**Prerequisites:**
- A Discord account and server with admin permissions
- A Discord Application (created in the Developer Portal)

**Setup Steps:**

**Step 1: Create a Discord Application**
Go to https://discord.com/developers/applications and create a new application.

**Step 2: Enable Privileged Intents**
In your app's Bot settings, enable:
- "Message Content Intent"
- "Server Members Intent" (required for Human Takeover)

**Step 3: Configure Credentials**
In BridgeBot → Discord settings, expand "Discord App Credentials". Enter:
- **Client ID** — from General Information
- **Client Secret** — from General Information
- **Redirect URI** — your domain + /api/discord/callback
- **Bot Token** — from Bot → Reset Token

**Step 4: Invite & Start**
Click "Invite Bot to Server", select your Discord server, configure listen mode, and click "Start Bot".`
      },
      {
        title: "Listen Modes",
        body: `**Mention Only** — Bot responds only when @mentioned or in DMs. Best for busy servers.

**All Channels** — Bot responds to every message. Best for dedicated support servers.

**Specific Channels** — Bot only responds in channels you select. Click "Fetch Channels" to load your server's channels.

All listen mode changes take effect immediately.`
      },
      {
        title: "Human Takeover",
        body: `When a team member with the designated **Staff Role** replies in a channel:
1. The bot automatically goes silent **in that specific channel only**
2. The bot continues responding in **all other channels**
3. After the configured **cooldown period** (default: 15 minutes), the bot re-engages
4. Staff can type **!bot resume** to hand back immediately

**Configuration:** Staff Role Name, Cooldown (1-120 minutes), Follow-up Message.`
      }
    ]
  },
  {
    id: "telegram",
    icon: Send,
    title: "Telegram Integration",
    content: [
      {
        title: "Setting Up Telegram",
        body: `Connect a Telegram bot to respond to messages using your knowledge base and API integrations.

**Steps:**
1. Create a bot with **@BotFather** on Telegram (send /newbot and follow the prompts)
2. Copy the bot token
3. In BridgeBot → Telegram settings, paste the token and click "Connect"
4. BridgeBot automatically registers a webhook with Telegram
5. Set your preferred listen mode and activate the bot

**Important:** If you want the bot to read all group messages (not just commands), disable "Group Privacy" in BotFather settings for your bot.`
      },
      {
        title: "Listen Modes",
        body: `**All Messages** — Responds to every message in groups and DMs. Best for dedicated support groups.

**Mention / Command** — Responds only when:
- @mentioned in a group
- /ask command is used (e.g., /ask how do I stake?)
- Someone replies to one of the bot's messages
- In private DMs (always responds)

Best for busy groups where you don't want the bot to answer everything.

**DMs Only** — Only responds in private 1-on-1 conversations. Ignores all group messages.`
      },
      {
        title: "Smart Follow-Up Buttons",
        body: `When the bot replies to a Telegram message, it can include **inline keyboard buttons** with contextual follow-up suggestions.

**How it works:**
- The AI decides dynamically whether follow-up suggestions are appropriate
- Buttons appear below the response (1-3 suggestions)
- Tapping a button sends that question to the bot as a new message
- Suggestions only appear when they add genuine value (not for greetings or simple acknowledgements)

This feature works automatically — no configuration needed.`
      },
      {
        title: "Managing the Bot",
        body: `**Test Connection** — Click "Test" to verify your bot token is still valid.

**Pause/Resume** — Toggle the bot active/paused. When paused, the webhook remains registered but messages are ignored.

**Change Token** — Click "Change Token" to connect a different bot.

**Disconnect** — Removes the webhook and deletes the configuration.

All Telegram conversations appear in the Conversations tab with a "telegram" platform badge.`
      }
    ]
  },
  {
    id: "zendesk",
    icon: Headphones,
    title: "Zendesk Integration",
    content: [
      {
        title: "Setting Up Zendesk",
        body: `Connect Zendesk to auto-reply to support tickets and provide AI suggestions to agents.

**Prerequisites:**
- A Zendesk account with admin access
- An API token from Zendesk Admin Center

**Steps:**
1. In BridgeBot → Zendesk settings, enter your subdomain, admin email, and API token
2. Click "Connect" — BridgeBot validates your credentials against Zendesk
3. Copy the **Webhook URL** displayed on the settings page
4. In Zendesk Admin Center → Objects and Rules → Triggers, create a trigger:
   - Condition: "Ticket is Created"
   - Action: "Notify Target" → your webhook URL (send ticket_id as JSON)
5. Configure your response mode and activate`
      },
      {
        title: "Response Modes",
        body: `BridgeBot supports two independently toggleable modes:

**Auto-Reply** — When a new ticket arrives:
1. BridgeBot fetches the ticket content from Zendesk
2. Searches your KB and runs API integrations
3. Posts a public AI-generated reply on the ticket
4. Adds an internal audit note ("BridgeBot AI auto-reply posted")
5. Tags the ticket with \`ai_processed\` and \`bridgebot\`

**Agent Assist** — When a new ticket arrives:
1. Same AI processing pipeline
2. The suggestion is stored and available via the sidebar API
3. Agents can view the AI suggestion in a Zendesk sidebar app
4. Agents choose whether to use, edit, or ignore the suggestion

Both modes can be enabled simultaneously. Toggle them independently in the settings.`
      },
      {
        title: "Webhook Setup Details",
        body: `After connecting, BridgeBot generates a unique webhook URL for your instance.

**In Zendesk Admin Center:**
1. Go to Apps and Integrations → Webhooks → Create Webhook
2. Set the endpoint URL to your BridgeBot webhook URL
3. Request method: POST, Content type: JSON
4. Create a Trigger: Condition = "Ticket is Created", Action = notify this webhook

**Payload format:** The webhook should send JSON with at least a \`ticket_id\` field:
\`{"ticket_id": "{{ticket.id}}"}\`

**Deduplication:** BridgeBot tracks event IDs to prevent processing the same ticket twice.`
      },
      {
        title: "Processed Tickets",
        body: `The Zendesk settings page shows your most recently processed tickets with:
- Ticket ID and subject
- Action taken (auto_reply or agent_assist)
- AI suggestion preview
- Timestamp

All Zendesk conversations appear in the Conversations tab with a "zendesk" platform badge.`
      }
    ]
  },
  {
    id: "web-deployment",
    icon: Code,
    title: "Web Deployment",
    content: [
      {
        title: "Chat Page",
        body: `Each workspace has a standalone chat page at:

\`/chat?instance=YOUR_INSTANCE_ID\`

Share this URL with users for a full-page chat experience. No login required for end users.`
      },
      {
        title: "Embeddable Widget",
        body: `Add a chat widget to any website with a single script tag.

**Steps:**
1. Go to **Embed Code** in the sidebar
2. Choose your embed method: Popup Widget, Inline Embed, or Full Page
3. Customize colors using the built-in Theme Configurator
4. Copy the embed snippet and paste it before the closing \`</body>\` tag on your website

The popup widget appears as a floating chat bubble in the bottom-right corner with a smooth slide-up animation. On mobile (<480px), it expands to full screen.`
      },
      {
        title: "Theme Configurator",
        body: `Customize the widget's appearance to match your brand.

**Built-in presets:**
- Default Dark, Violet Cyber, Ocean Blue, Emerald, Rose

**Customizable colors:**
- Accent, Accent Light, Background, Surface, Panel, Border, User Bubble, Bot Bubble

The live preview iframe updates as you change colors. Theme settings are embedded as \`data-*\` attributes in the script tag, so no server-side configuration needed.`
      },
      {
        title: "Widget Customization",
        body: `**Welcome Message** — Set a custom greeting that appears when users open the widget. Supports Markdown formatting.

**Default Open** — Configure the widget to auto-expand on page load (useful for support-focused pages).

**Bot Logo** — Upload a custom avatar (PNG, JPEG, WebP, GIF; max 2MB) that appears in the widget header, message bubbles, and the floating trigger button. Also syncable to Discord.

Configure all of these in **Embed Code → Widget Behavior**.`
      }
    ]
  },
  {
    id: "user-management",
    icon: Users,
    title: "User Management",
    content: [
      {
        title: "Managing Users",
        body: `**View Users:** Go to Users in the sidebar to see all registered accounts with their status, role, and workspace assignments.

**Filter Users:** Use the tabs to filter by All, Assigned (have workspace access), or Unassigned.

**Assign to Workspaces:** Go to Instances → select an instance → assign users by email.

**Delete Users:** Click the trash icon next to any non-admin user.

**Note:** Admin accounts cannot be deleted for security.`
      },
      {
        title: "Password Reset",
        body: `If a user forgets their password:
1. Click "Forgot password?" on the login page
2. Enter the account email
3. A 6-digit reset code is sent
4. Enter the code and choose a new password
5. Click "Reset Password"

The reset code expires after 15 minutes.`
      },
      {
        title: "Registration",
        body: `New users register with email, username, and password (min 6 characters). A verification code is sent to their email. Users can log in with either email or username.`
      }
    ]
  },
  {
    id: "workspaces",
    icon: Settings,
    title: "Workspaces (Instances)",
    content: [
      {
        title: "What Are Workspaces?",
        body: `Workspaces (instances) are isolated bot environments. Each workspace has its own:
- Knowledge base with priority-ranked sources
- Bot personality, settings, and knowledge gate
- Conversations and chat history across all platforms
- Discord, Telegram, and Zendesk connections
- API integrations and endpoint configurations
- Analytics and usage tracking

**Use cases:**
- Separate bots for different products
- Different teams with different knowledge bases
- Staging vs. production environments`
      },
      {
        title: "Creating & Managing",
        body: `**Create:** Go to Instances → Create Instance. Enter a name and optional description.

**Switch:** Use the workspace dropdown in the top-left sidebar.

**Delete:** Click delete on an instance to remove it and ALL its data.

**Assign Users:** Click on an instance → enter a user's email to give them access.`
      }
    ]
  },
  {
    id: "analytics",
    icon: BarChart3,
    title: "Analytics",
    content: [
      {
        title: "Dashboard Overview",
        body: `The dashboard shows:
- **Conversations & Messages** — totals across all platforms
- **Knowledge Sources** — active sources in your KB
- **Training Examples** — approved conversation examples
- **Platform Breakdown** — per-platform conversation counts (Web, Discord, Telegram, API, Zendesk) as visual cards
- **7-Day Trend Chart** — daily message counts per platform as a grouped bar chart
- **Recent Conversations** — latest chat sessions with platform badges
- **Quick Actions** — shortcuts to add knowledge, test chat, or connect Telegram`
      },
      {
        title: "AI Usage & Reliability",
        body: `The Analytics page tracks AI API usage:
- **Total API Calls** — how many times the AI was queried
- **Success Rate** — percentage of successful responses
- **Failed Calls & Retries** — errors and automatic retries
- **Daily Breakdown** — 7-day chart of calls, errors, and retries`
      },
      {
        title: "Integration Usage Analytics",
        body: `Track outbound API calls to your external integrations (e.g., Gridscan):
- **Per-integration cards** — call count, avg latency, data transferred, success rate
- **Integration Calls Over Time** — daily bar chart
- **Top Endpoints** — most frequently called endpoints with latency data
- **Integration Errors** — error breakdown and recent failed calls
- **Activity Logs** — filterable by date with daily request breakdown and masked API keys`
      },
      {
        title: "Conversation Filters",
        body: `In the Conversations tab, filter by platform: **Web**, **Discord**, **Telegram**, **API**, **Zendesk**, or **Approved**. Click a filter to toggle it. Search conversations by message content using the search bar.

Auto-refresh polls every 10 seconds — a banner appears when new conversations arrive.`
      }
    ]
  },
  {
    id: "bot-settings",
    icon: Settings,
    title: "Bot Settings",
    content: [
      {
        title: "Configuring Your Bot",
        body: `**Bot Name** — Display name used in conversations. Can be synced to Discord.

**Persona** — Define your bot's personality. Example: "You are a friendly crypto support agent."

**Custom Instructions** — Additional rules. Example: "Always recommend opening a ticket for transaction issues."

**Tone Instructions** — Guide communication style. Example: "Be professional but approachable."

**Tone Examples** — Example conversations showing how the bot should respond. Used as reference for the AI.`
      },
      {
        title: "Bot Avatar / Logo",
        body: `Upload a custom avatar for your bot (PNG, JPEG, WebP, GIF; max 2MB).

The logo appears in:
- Web widget header and message bubbles
- Typing indicator avatar
- Embed trigger button (floating chat icon)
- Can be synced to Discord as the bot's avatar

Upload in Bot Settings → Bot Avatar section.`
      },
      {
        title: "Knowledge Gate",
        body: `Control how strictly the bot stays within your KB using a 0-100% slider.

- **Strict (0-20%)** — refuses anything not in KB
- **Balanced (40-60%)** — KB first, general knowledge with disclaimers
- **Open (80-100%)** — uses everything, KB as trusted reference

Quick presets: Conservative (10%), Balanced (50%), Open (85%).`
      }
    ]
  },
  {
    id: "architecture",
    icon: GitBranch,
    title: "Architecture & Flow",
    content: [
      {
        title: "Message Flow (end-to-end)",
        body: `How a user message travels through BridgeBot from any channel to the AI reply.

**Key stages:** routing → gate checks → KB search → API query → prompt assembly → LLM call → response delivery.`,
        diagram: `┌───────────────────────────────────────────────────────────────────────────┐
│  USERS                                                                    │
│                                                                           │
│   Discord     Web Chat     Widget      Telegram     Zendesk Ticket        │
│   (server)    (page)       (embed)     (bot DM/     (new ticket           │
│                                         group)       webhook)             │
└────┬───────────┬───────────┬────────────┬────────────┬────────────────────┘
     │           │           │            │            │
     ▼           ▼           ▼            ▼            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                     BRIDGEBOT BACKEND  (FastAPI)                          │
│                                                                          │
│  1. ROUTING — resolve instance_id from channel context                   │
│       Discord:   guild_id  → discord_config → instance_id                │
│       Web/Widget: instance_id in request body or URL param               │
│       Telegram:  instance_id in webhook URL path                         │
│       Zendesk:   instance_id in webhook URL path                         │
│                                                                          │
│  2. KNOWLEDGE SEARCH — find relevant KB chunks (top 12)                  │
│       Semantic vector search across all active sources                    │
│       Priority-weighted: High → Medium → Normal                          │
│                                                                          │
│  3. API QUERY — optionally call external APIs                            │
│       AI router decides if an API call would help                        │
│       Selects endpoint, fills parameters, executes call                  │
│       Merges API response with KB context                                │
│                                                                          │
│  4. PROMPT ASSEMBLY                                                      │
│       System = persona + Knowledge Gate + KB context + API data          │
│       User = the incoming message                                        │
│       + Platform-specific additions (Telegram: follow-up suggestions)    │
│                                                                          │
│  5. LLM CALL — Claude Sonnet (Emergent Key) or OpenAI (BYOK)            │
│                                                                          │
│  6. RESPONSE DELIVERY                                                    │
│       Discord:  channel.send()                                           │
│       Web:      SSE stream or JSON                                       │
│       Telegram: sendMessage + inline keyboard buttons                    │
│       Zendesk:  public comment (auto-reply) or stored suggestion         │
│       + Save to conversations collection                                 │
└───────────────────────────────────────────────────────────────────────────┘`
      },
      {
        title: "Data Stores",
        body: `Everything lives in a MongoDB database. Key collections:

**bot_instances** — every workspace/instance
**bot_config** — per-instance persona, tone, knowledge gate, custom instructions
**knowledge_sources** — FAQs, scraped URLs, documents, GitHub imports
**discord_config** — per-instance Discord guild mapping, listen mode, staff role
**telegram_config** — per-instance Telegram bot token, listen mode, webhook secret
**zendesk_config** — per-instance Zendesk subdomain, credentials, response mode toggles
**zendesk_suggestions** — AI-generated suggestions for agent-assist sidebar
**conversations** — chat history across all platforms, session-scoped
**api_integrations** — external API connections with encrypted credentials
**api_endpoints** — endpoint definitions per integration
**api_request_logs** — outbound API call tracking for analytics
**llm_usage** — token tracking, cost analytics, platform breakdown
**embed_configs** — per-instance widget theming, welcome messages, default-open
**users** — accounts, roles, assigned instances`
      },
      {
        title: "Key Architectural Decisions",
        body: `**1. One shared Discord client** — a single WebSocket connection serves every instance. Routing happens in-memory via guild_id → instance_id.

**2. Webhook-based channels** — Telegram and Zendesk use webhooks rather than persistent connections. Messages arrive via HTTP POST, are processed through the pipeline, and replies are sent back via each platform's API.

**3. Unified AI pipeline** — all channels (Discord, Web, Telegram, Zendesk) share the same KB search → API query → prompt assembly → LLM call pipeline. Platform-specific behavior is added as prompt modifiers (e.g., Telegram follow-up suggestions, Zendesk professional tone).

**4. Knowledge Gate** — a graduated 0-100% slider controls how strictly the bot sticks to KB. Replaces a binary strict/flexible toggle with five graduated levels.

**5. Modular route files** — channel integrations (Telegram, Zendesk, API diagnostics) are in separate route files to keep the codebase maintainable.`
      }
    ]
  }
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.light})`, borderRadius: radius.md, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BridgeBotLogo size={20} />
          </div>
          <span style={{ fontFamily: fonts.heading, fontSize: "20px", fontWeight: "700", color: colors.text.primary }}>
            Bridge<span style={{ color: colors.brand.light }}>Bot</span>
          </span>
          <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.muted, backgroundColor: colors.bg.panel, padding: "2px 8px", borderRadius: "6px", marginLeft: "4px" }}>
            Documentation
          </span>
        </div>
        <Link to="/login" style={{ display: "flex", alignItems: "center", gap: "6px", color: colors.brand.cyan, fontSize: "13px", fontFamily: fonts.body, textDecoration: "none" }}>
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
