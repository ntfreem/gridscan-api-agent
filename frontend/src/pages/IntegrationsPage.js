import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Network, Plus, Loader2, Zap, Send, Headphones, Link2, Power, PowerOff,
  CheckCircle, AlertCircle, ExternalLink, Copy, Mail, RefreshCw, Globe,
  MessageSquare, AtSign, Hash, Radio, Shield, WifiOff, ChevronRight, Settings,
} from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur } from "@/theme";
import { toast } from "sonner";
import v2 from "@/utils/v2api";

const PROVIDER_META = {
  discord: { label: "Discord", icon: Zap, color: "#5865F2", desc: "Connect your bot to Discord servers and channels" },
  telegram: { label: "Telegram", icon: Send, color: "#26A5E4", desc: "Reply to messages in Telegram groups and DMs" },
  zendesk: { label: "Zendesk", icon: Headphones, color: "#17A589", desc: "Auto-reply to tickets or assist agents with AI" },
};

const RESPONSE_MODES = [
  { value: "auto_reply", label: "Auto-Reply", desc: "Bot replies to customers automatically" },
  { value: "agent_assist", label: "Agent Assist", desc: "Suggests replies for agents to review" },
  { value: "internal_note", label: "Internal Note", desc: "Adds AI suggestion as a private note" },
];

function ModeBadge({ mode }) {
  const modeMap = {
    auto_reply: { label: "Auto-Reply", bg: "rgba(52,211,153,0.08)", color: "#34D399", border: "rgba(52,211,153,0.2)" },
    agent_assist: { label: "Agent Assist", bg: "rgba(96,165,250,0.08)", color: "#60A5FA", border: "rgba(96,165,250,0.2)" },
    internal_note: { label: "Internal Note", bg: "rgba(251,191,36,0.08)", color: "#FBBF24", border: "rgba(251,191,36,0.2)" },
  };
  const m = modeMap[mode] || modeMap.agent_assist;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: radius.full,
      fontSize: "10px", fontWeight: "600", fontFamily: fonts.mono, letterSpacing: "0.02em",
      backgroundColor: m.bg, color: m.color, border: `1px solid ${m.border}`,
    }}>
      {m.label}
    </span>
  );
}

/* ── Discord Detail View (matches screenshot layout) ── */
function DiscordDetail({ connection, account, botName, onToggle, onBack, onCreateConnection, accounts, orgId, botId, saving, onRefresh }) {
  const conn = connection;
  const isConnected = !!conn;
  const [addMode, setAddMode] = useState("auto_reply");
  const [addDest, setAddDest] = useState("");
  const [listenMode, setListenMode] = useState(conn?.destination?.listen_mode || "all_channels");

  // Build invite link from account's client_id
  const clientId = account?.credentials_display?.client_id;
  const inviteUrl = clientId
    ? `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot+applications.commands&permissions=2147483648`
    : null;

  const handleCreate = () => {
    if (!accounts.find(a => a.provider === "discord")) {
      toast.error("No Discord account connected. Set one up in Discord App Setup first.");
      return;
    }
    const discordAccount = accounts.find(a => a.provider === "discord");
    onCreateConnection({
      account_id: discordAccount.id,
      name: `Discord — ${botName || "Bot"}`,
      response_mode: addMode,
      destination: { listen_mode: listenMode, guild_id: addDest || undefined },
    });
  };

  const handleUpdateListenMode = async (mode) => {
    setListenMode(mode);
    if (conn) {
      try {
        await v2.updateConnection(orgId, botId, conn.id, {
          destination: { ...conn.destination, listen_mode: mode },
        });
        toast.success(`Listen mode set to ${mode.replace("_", " ")}`);
        onRefresh();
      } catch {
        toast.error("Failed to update listen mode");
      }
    }
  };

  return (
    <div data-testid="discord-detail-view">
      <p style={T.overline}>Integration</p>
      <h1 style={{ ...T.h1, margin: "0 0 20px", fontSize: "28px" }}>Discord Bot</h1>

      {/* Banner — link to Discord App Setup */}
      <div data-testid="discord-app-setup-banner" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px", borderRadius: "12px", marginBottom: "20px",
        backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Settings size={16} color={colors.text.muted} />
          <span style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary }}>
            <strong style={{ color: colors.text.primary }}>Discord App Setup</strong> · Manage global app credentials and view setup guide
          </span>
        </div>
        <a href="/admin/accounts/discord" style={{
          display: "flex", alignItems: "center", gap: "4px",
          fontFamily: fonts.body, fontSize: "12px", fontWeight: "600", color: colors.brand.light, textDecoration: "none",
        }}>
          Open <ChevronRight size={14} />
        </a>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px" }}>
        {/* ── Left column ── */}
        <div>
          {/* Connect to Discord */}
          <div style={{
            padding: "20px", borderRadius: "14px", marginBottom: "16px",
            border: `1px solid ${isConnected ? "rgba(52,211,153,0.2)" : colors.border.default}`,
            backgroundColor: isConnected ? "rgba(52,211,153,0.03)" : colors.bg.panel,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <Globe size={18} color={colors.text.secondary} />
              <div>
                <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
                  Connect to Discord
                </p>
                <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, margin: "2px 0 0" }}>
                  Invite the bot to your Discord server
                </p>
              </div>
            </div>

            {isConnected ? (
              <>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px", borderRadius: "10px", marginBottom: "14px",
                  backgroundColor: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <CheckCircle size={18} color="#34D399" />
                    <div>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#34D399", fontFamily: fonts.body }}>
                        Connected to "{conn.name.replace(/^Discord — /, "")}"
                      </p>
                      {conn.destination?.guild_id && (
                        <p style={{ margin: "2px 0 0", fontSize: "11px", color: colors.text.muted, fontFamily: fonts.mono }}>
                          Guild ID: {conn.destination.guild_id}
                        </p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => onToggle(conn)} data-testid="discord-disconnect-btn"
                    style={{
                      display: "flex", alignItems: "center", gap: "5px",
                      padding: "7px 14px", borderRadius: "8px", cursor: "pointer",
                      border: "1px solid rgba(244,63,94,0.2)", backgroundColor: "rgba(244,63,94,0.06)",
                      color: "#F43F5E", fontSize: "12px", fontFamily: fonts.body,
                    }}>
                    <WifiOff size={12} /> Disconnect
                  </button>
                </div>
              </>
            ) : (
              <div style={{ marginBottom: "14px" }}>
                <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, margin: "0 0 12px" }}>
                  No Discord connection yet. Connect this bot to a Discord server to start responding.
                </p>
                {!accounts.find(a => a.provider === "discord") && (
                  <div style={{
                    padding: "10px 14px", borderRadius: "8px", marginBottom: "12px",
                    backgroundColor: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)",
                  }}>
                    <p style={{ fontFamily: fonts.body, fontSize: "12px", color: "#FBBF24", margin: 0 }}>
                      <AlertCircle size={12} style={{ display: "inline", verticalAlign: "-2px", marginRight: "6px" }} />
                      Set up a Discord account first in <a href="/admin/accounts/discord" style={{ color: colors.brand.light }}>Discord App Setup</a>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Invite to Another Server */}
            {inviteUrl && (
              <a href={inviteUrl} target="_blank" rel="noopener noreferrer" data-testid="discord-invite-btn"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  width: "100%", padding: "12px 20px", borderRadius: "10px",
                  background: "linear-gradient(135deg, #4752C4, #5865F2)", color: "#fff",
                  fontFamily: fonts.body, fontSize: "14px", fontWeight: "700",
                  textDecoration: "none", marginBottom: "16px",
                  transition: "opacity 0.2s", border: "none", cursor: "pointer",
                }}>
                <Link2 size={16} /> {isConnected ? "Invite to Another Server" : "Invite Bot to Server"}
              </a>
            )}

            {/* Share invite link */}
            {inviteUrl && (
              <div style={{
                padding: "16px", borderRadius: "10px",
                backgroundColor: colors.bg.base, border: `1px solid ${colors.border.default}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Link2 size={14} color={colors.text.secondary} />
                    <span style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: "600", color: colors.text.primary }}>
                      Share invite link
                    </span>
                  </div>
                  <span style={{ fontFamily: fonts.body, fontSize: "10px", color: colors.text.muted }}>For another server admin</span>
                </div>
                <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, margin: "0 0 10px", lineHeight: "1.5" }}>
                  Send this link to anyone with Manage Server permission on a Discord server. They click it, authorize the bot, and it lands in your admin panel ready to configure.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input value={inviteUrl} readOnly
                    style={{ ...T.input, flex: 1, fontSize: "11px", fontFamily: fonts.mono, color: colors.text.muted }}
                    data-testid="discord-invite-url" />
                  <button onClick={() => { navigator.clipboard.writeText(inviteUrl); toast.success("Copied invite link"); }}
                    data-testid="discord-copy-invite"
                    style={{
                      display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px", borderRadius: "8px",
                      border: `1px solid ${colors.border.default}`, backgroundColor: colors.bg.panel,
                      color: colors.text.secondary, fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
                    }}>
                    <Copy size={12} /> Copy
                  </button>
                </div>
                <p style={{ fontFamily: fonts.body, fontSize: "10px", color: colors.text.muted, margin: "8px 0 0" }}>
                  The new server auto-links to <strong style={{ color: colors.text.secondary }}>this</strong> bot instance. To rotate, visit <a href="/admin/accounts/discord" style={{ color: colors.brand.light, textDecoration: "none" }}>Discord App Setup</a>.
                </p>
              </div>
            )}
          </div>

          {/* Create connection (when not connected) */}
          {!isConnected && accounts.find(a => a.provider === "discord") && (
            <div style={{
              padding: "16px", borderRadius: "12px", marginBottom: "16px",
              backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
            }}>
              <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 12px" }}>
                Response Mode
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "14px" }}>
                {RESPONSE_MODES.slice(0, 2).map(mode => (
                  <button key={mode.value} onClick={() => setAddMode(mode.value)}
                    style={{
                      padding: "10px", borderRadius: "8px", cursor: "pointer", textAlign: "center",
                      border: `1px solid ${addMode === mode.value ? "#5865F2" + "50" : colors.border.default}`,
                      backgroundColor: addMode === mode.value ? "#5865F2" + "0a" : colors.bg.base,
                      color: addMode === mode.value ? "#5865F2" : colors.text.secondary,
                      fontFamily: fonts.body, fontSize: "12px", fontWeight: "600",
                    }}>
                    {mode.label}
                    <span style={{ display: "block", fontSize: "10px", fontWeight: "400", color: colors.text.muted, marginTop: "2px" }}>
                      {mode.desc}
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={handleCreate} disabled={saving} data-testid="discord-connect-btn"
                style={{ ...T.btnPrimary, width: "100%", justifyContent: "center", opacity: saving ? 0.5 : 1 }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                Connect Discord Bot
              </button>
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div>
          {/* Bot Status */}
          <div style={{
            padding: "20px", borderRadius: "14px", marginBottom: "16px",
            backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
          }} data-testid="discord-bot-status-card">
            <p style={{ fontFamily: fonts.mono, fontSize: "10px", letterSpacing: "0.1em", color: colors.text.muted, margin: "0 0 10px", textTransform: "uppercase" }}>
              Bot Status
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <div style={{
                width: "10px", height: "10px", borderRadius: "50%",
                backgroundColor: isConnected && conn?.enabled ? "#34D399" : colors.text.muted,
                boxShadow: isConnected && conn?.enabled ? "0 0 8px rgba(52,211,153,0.5)" : "none",
              }} />
              <span style={{ fontFamily: fonts.heading, fontSize: "20px", fontWeight: "700", color: colors.text.primary }}>
                {isConnected && conn?.enabled ? "Online" : "Offline"}
              </span>
            </div>
            <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: "0 0 14px" }}>
              {botName || "Bot"}
            </p>
            <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, margin: "0 0 10px" }}>
              Bot name is set in <strong style={{ color: colors.text.secondary }}>Bot Settings</strong>. Sync it to Discord here.
            </p>
            <button data-testid="sync-name-btn" style={{
              display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px",
              borderRadius: "8px", border: `1px solid ${colors.border.default}`, backgroundColor: colors.bg.base,
              color: colors.text.secondary, fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
            }}>
              <RefreshCw size={12} /> Sync Name to Discord
            </button>
          </div>

          {/* Configuration */}
          <div style={{
            padding: "20px", borderRadius: "14px", marginBottom: "16px",
            backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
          }} data-testid="discord-config-card">
            <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: "0 0 14px" }}>
              Configuration
            </p>
            <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, margin: "0 0 10px" }}>Bot Active</p>
            {isConnected ? (
              <button onClick={() => onToggle(conn)} data-testid="discord-active-toggle"
                style={{
                  display: "flex", alignItems: "center", gap: "6px", padding: "8px 18px",
                  borderRadius: "10px", border: "none", cursor: "pointer",
                  backgroundColor: conn.enabled ? "rgba(52,211,153,0.1)" : "rgba(244,63,94,0.1)",
                  color: conn.enabled ? "#34D399" : "#F43F5E",
                  fontFamily: fonts.body, fontSize: "13px", fontWeight: "600",
                }}>
                {conn.enabled ? <><CheckCircle size={16} /> Active</> : <><PowerOff size={16} /> Inactive</>}
              </button>
            ) : (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 18px",
                borderRadius: "10px", backgroundColor: "rgba(148,163,184,0.08)",
                color: colors.text.muted, fontFamily: fonts.body, fontSize: "13px", fontWeight: "600",
              }}>
                <PowerOff size={16} /> Not Connected
              </span>
            )}
          </div>

          {/* Listen Mode */}
          <div style={{
            padding: "20px", borderRadius: "14px",
            backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
          }} data-testid="discord-listen-mode-card">
            <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: "0 0 14px" }}>
              Listen Mode
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              {[
                { value: "mention_only", label: "Mention Only", icon: AtSign, desc: "Responds when @tagged or in DMs" },
                { value: "all_channels", label: "All Channels", icon: Radio, desc: "Responds to every human message" },
                { value: "specific_channels", label: "Specific Channels", icon: Hash, desc: "Pick which channels to monitor" },
              ].map(mode => (
                <button key={mode.value} onClick={() => handleUpdateListenMode(mode.value)}
                  data-testid={`listen-mode-${mode.value}`}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                    padding: "14px 8px", borderRadius: "10px", cursor: "pointer", textAlign: "center",
                    border: `1px solid ${listenMode === mode.value ? "#5865F2" + "50" : colors.border.default}`,
                    backgroundColor: listenMode === mode.value ? "#5865F2" + "0a" : colors.bg.base,
                  }}>
                  <mode.icon size={18} color={listenMode === mode.value ? "#5865F2" : colors.text.muted} />
                  <span style={{
                    fontFamily: fonts.body, fontSize: "11px", fontWeight: "700",
                    color: listenMode === mode.value ? "#5865F2" : colors.text.primary,
                  }}>{mode.label}</span>
                  <span style={{ fontFamily: fonts.body, fontSize: "9px", color: colors.text.muted, lineHeight: "1.3" }}>
                    {mode.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Telegram Detail View ── */
function TelegramDetail({ connection, account, onToggle, onCreateConnection, accounts, orgId, botId, botName, saving, onRefresh }) {
  const conn = connection;
  const isConnected = !!conn;
  const [addMode, setAddMode] = useState("auto_reply");

  const handleCreate = () => {
    const tgAccount = accounts.find(a => a.provider === "telegram");
    if (!tgAccount) { toast.error("No Telegram account connected. Set one up first."); return; }
    onCreateConnection({
      account_id: tgAccount.id,
      name: `Telegram — ${botName || "Bot"}`,
      response_mode: addMode,
      destination: {},
    });
  };

  return (
    <div data-testid="telegram-detail-view">
      <p style={T.overline}>Integration</p>
      <h1 style={{ ...T.h1, margin: "0 0 20px", fontSize: "28px" }}>Telegram Bot</h1>

      {/* Connection Status */}
      <div style={{
        padding: "20px", borderRadius: "14px", marginBottom: "16px",
        border: `1px solid ${isConnected ? "rgba(52,211,153,0.2)" : colors.border.default}`,
        backgroundColor: isConnected ? "rgba(52,211,153,0.03)" : colors.bg.panel,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <Send size={18} color="#26A5E4" />
          <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
            Connection
          </p>
        </div>
        {isConnected ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px", borderRadius: "10px",
            backgroundColor: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <CheckCircle size={16} color="#34D399" />
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#34D399", fontFamily: fonts.body }}>
                  Bot connected
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: colors.text.muted, fontFamily: fonts.mono }}>
                  via {conn.account_name} · {conn.enabled ? "active" : "paused"}
                </p>
              </div>
            </div>
            <button onClick={() => onToggle(conn)}
              style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "8px",
                border: `1px solid ${conn.enabled ? "rgba(244,63,94,0.2)" : "rgba(52,211,153,0.2)"}`,
                backgroundColor: conn.enabled ? "rgba(244,63,94,0.06)" : "rgba(52,211,153,0.06)",
                color: conn.enabled ? "#F43F5E" : "#34D399",
                fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
              }}>
              {conn.enabled ? <><PowerOff size={12} /> Disable</> : <><Power size={12} /> Enable</>}
            </button>
          </div>
        ) : (
          <div>
            {!accounts.find(a => a.provider === "telegram") && (
              <div style={{
                padding: "10px 14px", borderRadius: "8px", marginBottom: "12px",
                backgroundColor: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)",
              }}>
                <p style={{ fontFamily: fonts.body, fontSize: "12px", color: "#FBBF24", margin: 0 }}>
                  <AlertCircle size={12} style={{ display: "inline", verticalAlign: "-2px", marginRight: "6px" }} />
                  No Telegram account connected yet. Ask your admin to add one.
                </p>
              </div>
            )}
            {accounts.find(a => a.provider === "telegram") && (
              <>
                <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, margin: "0 0 12px" }}>
                  Select a response mode and connect this bot to Telegram.
                </p>
                <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                  {RESPONSE_MODES.slice(0, 2).map(mode => (
                    <button key={mode.value} onClick={() => setAddMode(mode.value)}
                      style={{
                        flex: 1, padding: "10px", borderRadius: "8px", cursor: "pointer", textAlign: "center",
                        border: `1px solid ${addMode === mode.value ? "#26A5E4" + "50" : colors.border.default}`,
                        backgroundColor: addMode === mode.value ? "#26A5E4" + "0a" : colors.bg.base,
                        fontFamily: fonts.body, fontSize: "12px", fontWeight: "600",
                        color: addMode === mode.value ? "#26A5E4" : colors.text.secondary,
                      }}>
                      {mode.label}
                    </button>
                  ))}
                </div>
                <button onClick={handleCreate} disabled={saving}
                  style={{ ...T.btnPrimary, width: "100%", justifyContent: "center" }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Connect Telegram Bot
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Response Mode (when connected) */}
      {isConnected && (
        <div style={{
          padding: "20px", borderRadius: "14px",
          backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
        }}>
          <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 4px" }}>
            Response Mode
          </p>
          <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, margin: "0 0 12px" }}>
            How the bot handles incoming Telegram messages
          </p>
          <ModeBadge mode={conn.response_mode} />
        </div>
      )}
    </div>
  );
}

/* ── Zendesk Detail View ── */
function ZendeskDetail({ connection, account, onToggle, onCreateConnection, accounts, orgId, botId, botName, saving, onRefresh }) {
  const conn = connection;
  const isConnected = !!conn;
  const [addMode, setAddMode] = useState("agent_assist");
  const creds = account?.credentials_masked || {};

  const handleCreate = () => {
    const zdAccount = accounts.find(a => a.provider === "zendesk");
    if (!zdAccount) { toast.error("No Zendesk account connected. Set one up first."); return; }
    onCreateConnection({
      account_id: zdAccount.id,
      name: `Zendesk — ${botName || "Bot"}`,
      response_mode: addMode,
      destination: {},
    });
  };

  return (
    <div data-testid="zendesk-detail-view">
      <p style={T.overline}>Integration</p>
      <h1 style={{ ...T.h1, margin: "0 0 20px", fontSize: "28px" }}>Zendesk</h1>

      {/* Connection */}
      <div style={{
        padding: "20px", borderRadius: "14px", marginBottom: "16px",
        border: `1px solid ${isConnected ? "rgba(52,211,153,0.2)" : colors.border.default}`,
        backgroundColor: isConnected ? "rgba(52,211,153,0.03)" : colors.bg.panel,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <Headphones size={18} color="#17A589" />
          <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
            Connection
          </p>
        </div>
        {isConnected ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px", borderRadius: "10px",
            backgroundColor: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <CheckCircle size={16} color="#34D399" />
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#34D399", fontFamily: fonts.body }}>
                  Connected{creds.subdomain ? ` to ${creds.subdomain}.zendesk.com` : ""}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: colors.text.muted, fontFamily: fonts.mono }}>
                  via {conn.account_name} · {conn.enabled ? "active" : "paused"}
                </p>
              </div>
            </div>
            <button onClick={() => onToggle(conn)}
              style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "8px",
                border: `1px solid ${conn.enabled ? "rgba(244,63,94,0.2)" : "rgba(52,211,153,0.2)"}`,
                backgroundColor: conn.enabled ? "rgba(244,63,94,0.06)" : "rgba(52,211,153,0.06)",
                color: conn.enabled ? "#F43F5E" : "#34D399",
                fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
              }}>
              {conn.enabled ? <><PowerOff size={12} /> Disable</> : <><Power size={12} /> Enable</>}
            </button>
          </div>
        ) : (
          <div>
            {!accounts.find(a => a.provider === "zendesk") && (
              <div style={{
                padding: "10px 14px", borderRadius: "8px", marginBottom: "12px",
                backgroundColor: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)",
              }}>
                <p style={{ fontFamily: fonts.body, fontSize: "12px", color: "#FBBF24", margin: 0 }}>
                  <AlertCircle size={12} style={{ display: "inline", verticalAlign: "-2px", marginRight: "6px" }} />
                  No Zendesk account connected yet. Ask your admin to add one.
                </p>
              </div>
            )}
            {accounts.find(a => a.provider === "zendesk") && (
              <>
                <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, margin: "0 0 12px" }}>
                  Select a response mode and connect this bot to Zendesk.
                </p>
                <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                  {RESPONSE_MODES.map(mode => (
                    <button key={mode.value} onClick={() => setAddMode(mode.value)}
                      style={{
                        flex: 1, padding: "10px", borderRadius: "8px", cursor: "pointer", textAlign: "center",
                        border: `1px solid ${addMode === mode.value ? "#17A589" + "50" : colors.border.default}`,
                        backgroundColor: addMode === mode.value ? "#17A589" + "0a" : colors.bg.base,
                        fontFamily: fonts.body, fontSize: "12px", fontWeight: "600",
                        color: addMode === mode.value ? "#17A589" : colors.text.secondary,
                      }}>
                      {mode.label}
                    </button>
                  ))}
                </div>
                <button onClick={handleCreate} disabled={saving}
                  style={{ ...T.btnPrimary, width: "100%", justifyContent: "center" }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Headphones size={14} />}
                  Connect Zendesk Bot
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Response Mode (when connected) */}
      {isConnected && (
        <div style={{
          padding: "20px", borderRadius: "14px",
          backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
        }}>
          <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 4px" }}>
            Response Mode
          </p>
          <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, margin: "0 0 12px" }}>
            How the bot handles incoming Zendesk tickets
          </p>
          <ModeBadge mode={conn.response_mode} />
        </div>
      )}
    </div>
  );
}

/* ── Main Integrations Page ── */
export default function IntegrationsPage() {
  const { selectedOrg, selectedBot } = useAuth();
  const orgId = selectedOrg?.id;
  const botId = selectedBot?.id;

  const [connections, setConnections] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeProvider, setActiveProvider] = useState(null);

  const fetchData = async () => {
    if (!orgId || !botId) return;
    setLoading(true);
    try {
      const [connRes, accRes] = await Promise.all([
        v2.listConnections(orgId, botId),
        v2.listAccounts(orgId),
      ]);
      setConnections(connRes.data.connections || []);
      setAccounts((accRes.data.accounts || []).filter(a => a.status === "connected"));
    } catch {
      toast.error("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [orgId, botId]);

  const handleToggle = async (conn) => {
    try {
      const res = await v2.toggleConnection(orgId, botId, conn.id);
      setConnections(prev => prev.map(c => c.id === conn.id ? { ...c, enabled: res.data.enabled } : c));
      toast.success(res.data.enabled ? "Connection enabled" : "Connection disabled");
    } catch {
      toast.error("Failed to toggle connection");
    }
  };

  const handleCreateConnection = async (data) => {
    setSaving(true);
    try {
      await v2.createConnection(orgId, botId, data);
      toast.success("Connection created");
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create connection");
    } finally {
      setSaving(false);
    }
  };

  // Build lookup: provider → first connection
  const connByProvider = {};
  for (const c of connections) {
    if (!connByProvider[c.provider]) connByProvider[c.provider] = c;
  }
  const accByProvider = {};
  for (const a of accounts) {
    if (!accByProvider[a.provider]) accByProvider[a.provider] = a;
  }

  if (!selectedBot) return (
    <div style={T.page}>
      <p style={{ ...T.sectionSub, textAlign: "center", marginTop: "60px" }}>Select a bot to manage integrations.</p>
    </div>
  );

  // Provider detail view
  if (activeProvider) {
    const conn = connByProvider[activeProvider];
    const acc = accByProvider[activeProvider];
    const commonProps = {
      connection: conn, account: acc, onToggle: handleToggle,
      onCreateConnection: handleCreateConnection, accounts, orgId, botId,
      botName: selectedBot?.name, saving, onRefresh: fetchData,
    };

    return (
      <div style={T.page} data-testid="integrations-page">
        <button onClick={() => setActiveProvider(null)} style={{ ...T.btnGhost, marginBottom: "16px", fontSize: "12px" }}
          data-testid="back-to-integrations">
          ← Back to Integrations
        </button>
        {activeProvider === "discord" && <DiscordDetail {...commonProps} />}
        {activeProvider === "telegram" && <TelegramDetail {...commonProps} />}
        {activeProvider === "zendesk" && <ZendeskDetail {...commonProps} />}
      </div>
    );
  }

  // Main page — 3 provider cards
  return (
    <div style={T.page} data-testid="integrations-page">
      <p style={T.overline}>Connections</p>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ ...T.h1, margin: "0 0 6px" }}>Integrations</h1>
        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: 0 }}>
          Connect this bot to messaging platforms. Each bot has one connection per provider.
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
          <Loader2 size={24} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {Object.entries(PROVIDER_META).map(([key, meta]) => {
            const conn = connByProvider[key];
            const isActive = conn?.enabled;
            const Icon = meta.icon;
            return (
              <button key={key} onClick={() => setActiveProvider(key)}
                data-testid={`provider-card-${key}`}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px",
                  padding: "20px", borderRadius: "14px", cursor: "pointer", textAlign: "left", width: "100%",
                  border: `1px solid ${conn ? meta.color + "40" : colors.border.default}`,
                  backgroundColor: conn ? meta.color + "08" : colors.bg.panel,
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = meta.color; e.currentTarget.style.boxShadow = `0 0 0 1px ${meta.color}30`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = conn ? meta.color + "40" : colors.border.default; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <div style={{
                    width: "42px", height: "42px", borderRadius: "12px",
                    backgroundColor: meta.color + "18",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={20} color={meta.color} />
                  </div>
                  {conn ? (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "20px",
                      backgroundColor: isActive ? "rgba(52,211,153,0.1)" : "rgba(251,146,60,0.1)",
                      border: `1px solid ${isActive ? "rgba(52,211,153,0.2)" : "rgba(251,146,60,0.2)"}`,
                    }}>
                      {isActive ? <CheckCircle size={12} color="#34D399" /> : <PowerOff size={12} color="#FB923C" />}
                      <span style={{
                        fontSize: "11px", fontWeight: "600", fontFamily: fonts.mono,
                        color: isActive ? "#34D399" : "#FB923C",
                      }}>{isActive ? "Active" : "Paused"}</span>
                    </div>
                  ) : (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "20px",
                      backgroundColor: colors.bg.surface, border: `1px solid ${colors.border.default}`,
                    }}>
                      <Plus size={12} color={colors.text.muted} />
                      <span style={{ fontSize: "11px", fontWeight: "500", color: colors.text.muted, fontFamily: fonts.mono }}>Connect</span>
                    </div>
                  )}
                </div>
                <div>
                  <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: "0 0 3px" }}>
                    {meta.label}
                  </p>
                  <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, margin: 0, lineHeight: "1.4" }}>
                    {meta.desc}
                  </p>
                </div>
                {conn && (
                  <div style={{
                    width: "100%", padding: "8px 12px", borderRadius: "8px",
                    backgroundColor: colors.bg.base, border: `1px solid ${colors.border.default}`, marginTop: "-4px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <ModeBadge mode={conn.response_mode} />
                      <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>
                        via {conn.account_name}
                      </span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
