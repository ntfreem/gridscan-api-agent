import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import { toast } from "sonner";
import {
  Send, CheckCircle, AlertCircle, RefreshCw, Radio, AtSign,
  MessageSquare, Eye, EyeOff, Trash2, Save, Power, Loader2,
} from "lucide-react";
import { colors, fonts, T, onFocus, onBlur } from "../theme";

const LISTEN_MODES = [
  { key: "all", icon: Radio, label: "All Messages", desc: "Responds to every message in groups and DMs" },
  { key: "mention_or_command", icon: AtSign, label: "Mention / Command", desc: "Responds when @mentioned, /ask command, or in DMs" },
  { key: "dm_only", icon: MessageSquare, label: "DMs Only", desc: "Only responds in private 1-on-1 conversations" },
];

const modeBtn = (active) => ({
  flex: 1, padding: "12px 14px",
  border: `1px solid ${active ? "#0088cc" : colors.border.default}`,
  borderRadius: "10px",
  backgroundColor: active ? "rgba(0,136,204,0.08)" : colors.bg.base,
  color: active ? colors.text.primary : colors.text.secondary,
  cursor: "pointer", fontFamily: fonts.body, fontSize: "12px",
  fontWeight: active ? "600" : "400",
  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px",
  transition: "all 0.2s",
});

const card = {
  backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
  borderRadius: "12px", padding: "20px", marginBottom: "16px",
};

export default function TelegramSettings() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Form state
  const [botToken, setBotToken] = useState("");
  const [listenMode, setListenMode] = useState("mention_or_command");
  const [isActive, setIsActive] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [tokenChanged, setTokenChanged] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get("/admin/telegram-config");
      setConfig(res.data);
      setListenMode(res.data.listen_mode || "mention_or_command");
      setIsActive(res.data.is_active || false);
      setBotToken("");
      setTokenChanged(false);
    } catch {
      toast.error("Failed to load Telegram config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSaveToken = async () => {
    if (!botToken.trim()) {
      toast.error("Please enter a bot token");
      return;
    }
    setSaving(true);
    try {
      await api.put("/admin/telegram-config", { bot_token: botToken.trim() });
      toast.success("Telegram bot connected successfully!");
      setTokenChanged(false);
      await fetchConfig();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save token");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.put("/admin/telegram-config", {
        listen_mode: listenMode,
        is_active: isActive,
      });
      toast.success("Settings saved");
      await fetchConfig();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await api.post("/admin/telegram-config/test");
      toast.success(`Bot is alive! @${res.data.bot_username} (${res.data.bot_name})`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Token test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect Telegram bot from this instance? The webhook will be removed.")) return;
    setDisconnecting(true);
    try {
      await api.delete("/admin/telegram-config");
      toast.success("Telegram bot disconnected");
      await fetchConfig();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleToggleActive = async () => {
    const next = !isActive;
    setIsActive(next);
    try {
      await api.put("/admin/telegram-config", { is_active: next });
      toast.success(next ? "Telegram bot activated" : "Telegram bot paused");
      await fetchConfig();
    } catch (e) {
      setIsActive(!next);
      toast.error(e.response?.data?.detail || "Failed to toggle");
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <Loader2 size={24} color={colors.text.muted} style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  const connected = config?.connected;

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: "0 16px" }} data-testid="telegram-settings-page">
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "linear-gradient(135deg, #0088cc, #29b6f6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Send size={18} color="#fff" />
          </div>
          <h1 style={{ fontFamily: fonts.heading, fontSize: "22px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
            Telegram
          </h1>
          {connected && (
            <span style={{
              fontSize: "11px", fontFamily: fonts.mono, padding: "3px 10px",
              borderRadius: "20px", letterSpacing: "0.05em",
              backgroundColor: isActive ? "rgba(52,211,153,0.1)" : "rgba(251,191,36,0.1)",
              color: isActive ? "#34D399" : "#FBBF24",
              border: `1px solid ${isActive ? "rgba(52,211,153,0.2)" : "rgba(251,191,36,0.2)"}`,
            }}>
              {isActive ? "ACTIVE" : "PAUSED"}
            </span>
          )}
        </div>
        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: 0 }}>
          Connect a Telegram bot to respond to messages using your knowledge base and API integrations.
        </p>
      </div>

      {/* Connection Card */}
      <div style={card} data-testid="telegram-connection-card">
        <h3 style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 14px" }}>
          Bot Connection
        </h3>

        {connected && !tokenChanged ? (
          <div>
            <div style={{
              display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px",
              borderRadius: "10px", backgroundColor: "rgba(52,211,153,0.06)",
              border: "1px solid rgba(52,211,153,0.15)", marginBottom: "14px",
            }}>
              <CheckCircle size={16} color="#34D399" />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#34D399", fontFamily: fonts.body }}>
                  Connected as @{config.bot_username}
                </p>
                {config.bot_first_name && (
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: colors.text.muted, fontFamily: fonts.mono }}>
                    {config.bot_first_name} &middot; Token: {config.bot_token_masked}
                  </p>
                )}
              </div>
              <button onClick={handleTest} disabled={testing} data-testid="telegram-test-btn"
                style={{
                  display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px",
                  borderRadius: "8px", border: `1px solid ${colors.border.default}`,
                  backgroundColor: colors.bg.base, color: colors.text.secondary,
                  fontSize: "11px", fontFamily: fonts.body, cursor: "pointer",
                }}>
                <RefreshCw size={12} className={testing ? "spin" : ""} /> Test
              </button>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setTokenChanged(true)} data-testid="telegram-change-token-btn"
                style={{
                  padding: "8px 14px", borderRadius: "8px",
                  border: `1px solid ${colors.border.default}`,
                  backgroundColor: colors.bg.base, color: colors.text.secondary,
                  fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
                }}>
                Change Token
              </button>
              <button onClick={handleDisconnect} disabled={disconnecting} data-testid="telegram-disconnect-btn"
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "8px 14px", borderRadius: "8px",
                  border: "1px solid rgba(244,63,94,0.2)",
                  backgroundColor: "rgba(244,63,94,0.06)", color: "#F43F5E",
                  fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
                }}>
                <Trash2 size={12} /> Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{
              display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 14px",
              borderRadius: "10px", backgroundColor: "rgba(96,165,250,0.04)",
              border: "1px solid rgba(96,165,250,0.1)", marginBottom: "14px",
            }}>
              <AlertCircle size={16} color="#60A5FA" style={{ marginTop: "1px", flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: "12px", color: colors.text.secondary, fontFamily: fonts.body, lineHeight: 1.5 }}>
                Create a bot with <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer"
                  style={{ color: "#0088cc", textDecoration: "none", fontWeight: 600 }}>@BotFather</a> on Telegram,
                then paste the token below. Make sure to disable "Group Privacy" in BotFather settings if you want the bot to read all group messages.
              </p>
            </div>

            <label style={T.label}>Bot Token</label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  type={showToken ? "text" : "password"}
                  value={botToken} onChange={e => setBotToken(e.target.value)}
                  placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyz"
                  data-testid="telegram-token-input"
                  style={{ ...T.input, paddingRight: "40px" }}
                  onFocus={onFocus} onBlur={onBlur}
                />
                <button onClick={() => setShowToken(!showToken)} type="button"
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "4px" }}>
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button onClick={handleSaveToken} disabled={saving || !botToken.trim()} data-testid="telegram-save-token-btn"
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "8px 18px", borderRadius: "10px", border: "none",
                  background: "linear-gradient(135deg, #0088cc, #29b6f6)",
                  color: "#fff", fontSize: "13px", fontWeight: "600",
                  fontFamily: fonts.body, cursor: saving || !botToken.trim() ? "not-allowed" : "pointer",
                  opacity: saving || !botToken.trim() ? 0.5 : 1,
                  whiteSpace: "nowrap",
                }}>
                {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
                {saving ? "Connecting..." : "Connect"}
              </button>
            </div>
            {tokenChanged && connected && (
              <button onClick={() => { setTokenChanged(false); setBotToken(""); }}
                style={{ fontSize: "11px", color: colors.text.muted, background: "none", border: "none", cursor: "pointer", fontFamily: fonts.body, padding: "4px 0" }}>
                Cancel — keep current token
              </button>
            )}
          </div>
        )}
      </div>

      {/* Settings Card — only shown if connected */}
      {connected && (
        <>
          {/* Active Toggle */}
          <div style={card} data-testid="telegram-active-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 3px" }}>
                  Bot Status
                </h3>
                <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, margin: 0 }}>
                  {isActive ? "Bot is listening for messages" : "Bot is paused — messages will be ignored"}
                </p>
              </div>
              <button onClick={handleToggleActive} data-testid="telegram-toggle-active-btn"
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "8px 16px", borderRadius: "10px",
                  border: `1px solid ${isActive ? "rgba(52,211,153,0.3)" : colors.border.default}`,
                  backgroundColor: isActive ? "rgba(52,211,153,0.08)" : colors.bg.base,
                  color: isActive ? "#34D399" : colors.text.secondary,
                  fontSize: "12px", fontWeight: "600", fontFamily: fonts.body, cursor: "pointer",
                }}>
                <Power size={14} /> {isActive ? "Active" : "Paused"}
              </button>
            </div>
          </div>

          {/* Listen Mode */}
          <div style={card} data-testid="telegram-listen-mode-card">
            <h3 style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 4px" }}>
              Listen Mode
            </h3>
            <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, margin: "0 0 14px" }}>
              Choose when the bot should respond in Telegram groups. DMs are always answered.
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
              {LISTEN_MODES.map(m => (
                <button key={m.key} onClick={() => setListenMode(m.key)} data-testid={`telegram-mode-${m.key}`}
                  style={modeBtn(listenMode === m.key)}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <m.icon size={13} />
                    <span style={{ fontWeight: "600" }}>{m.label}</span>
                  </div>
                  <span style={{ fontSize: "11px", opacity: 0.7 }}>{m.desc}</span>
                </button>
              ))}
            </div>
            <button onClick={handleSaveSettings} disabled={saving} data-testid="telegram-save-settings-btn"
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "9px 20px", borderRadius: "10px", border: "none",
                background: "linear-gradient(135deg, #0088cc, #29b6f6)",
                color: "#fff", fontSize: "13px", fontWeight: "600",
                fontFamily: fonts.body, cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.5 : 1,
              }}>
              {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
              Save Settings
            </button>
          </div>

          {/* How It Works */}
          <div style={{ ...card, backgroundColor: "rgba(0,136,204,0.03)", borderColor: "rgba(0,136,204,0.12)" }}>
            <h3 style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: "0 0 10px" }}>
              How It Works
            </h3>
            <ul style={{ margin: 0, paddingLeft: "18px", fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, lineHeight: 1.8 }}>
              <li>Messages arrive via Telegram webhook to BridgeBot</li>
              <li>BridgeBot searches your Knowledge Base and executes API integrations</li>
              <li>An AI response is generated and sent back to the Telegram chat</li>
              <li>All conversations appear in your Conversations tab with platform: <code style={{ fontSize: "11px", padding: "1px 5px", backgroundColor: "rgba(96,165,250,0.1)", borderRadius: "3px", color: "#93C5FD" }}>telegram</code></li>
              <li>Use <code style={{ fontSize: "11px", padding: "1px 5px", backgroundColor: "rgba(96,165,250,0.1)", borderRadius: "3px", color: "#93C5FD" }}>/ask</code> command in groups when in "Mention / Command" mode</li>
            </ul>
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } } .spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}
