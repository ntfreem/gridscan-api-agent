import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Copy, Check, Code2, Globe, Monitor, Paintbrush, MessageCircle, Layout, Maximize, ChevronDown, ExternalLink, Link2, RefreshCw, MessageSquareText, ToggleLeft, ToggleRight } from "lucide-react";
import { colors, fonts, T, onFocus, onBlur } from "../theme";
import api from "../utils/api";

function CodeBlock({ code, label, testId }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <p style={T.monoLabel}>{label}</p>
        <button onClick={copy} data-testid={testId}
          style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "5px 10px",
            backgroundColor: copied ? "rgba(52,211,153,0.08)" : colors.bg.panel,
            color: copied ? colors.brand.success : colors.text.secondary,
            border: `1px solid ${copied ? "rgba(52,211,153,0.3)" : colors.border.default}`,
            borderRadius: "8px", fontSize: "11px", fontFamily: fonts.body, cursor: "pointer",
            transition: "all 0.15s ease",
          }}>
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{
        backgroundColor: colors.bg.base, border: `1px solid ${colors.border.subtle}`, borderRadius: "10px",
        padding: "14px 16px", color: colors.text.secondary, fontFamily: fonts.mono,
        fontSize: "11.5px", lineHeight: "1.7", whiteSpace: "pre-wrap", wordBreak: "break-all",
        margin: 0, overflowX: "auto", maxHeight: "260px", overflowY: "auto",
      }}>
        {code}
      </pre>
    </div>
  );
}

const METHOD_TABS = [
  { id: "popup", label: "Popup Widget", icon: MessageCircle, desc: "Floating chat bubble with expandable panel" },
  { id: "inline", label: "Inline Embed", icon: Layout, desc: "Embeds directly into a container div" },
  { id: "fullpage", label: "Full Page", icon: Maximize, desc: "Dedicated full-viewport chat page" },
];

const DEFAULT_THEME = {
  accent: "", bg: "", surface: "", panel: "", text: "",
  textSecondary: "", border: "", userBubble: "", botBubble: "", inputBg: "", font: "", radius: "",
};

const THEME_PRESETS = [
  { label: "Default Dark", theme: {} },
  { label: "Violet Cyber", theme: { accent: "#7C3AED", accentLight: "#00D4FF", bg: "#0B0A1A", surface: "#1A1040", panel: "#251A4D", border: "rgba(124,58,237,0.2)", userBubble: "#7C3AED" } },
  { label: "Ocean Blue", theme: { accent: "#0EA5E9", accentLight: "#38BDF8", bg: "#0C1222", surface: "#132036", panel: "#1A2942", border: "rgba(14,165,233,0.2)", userBubble: "#0EA5E9" } },
  { label: "Emerald", theme: { accent: "#10B981", accentLight: "#34D399", bg: "#0A1410", surface: "#0F1F18", panel: "#142B22", border: "rgba(16,185,129,0.2)", userBubble: "#10B981" } },
  { label: "Rose", theme: { accent: "#F43F5E", accentLight: "#FB7185", bg: "#1A0A10", surface: "#251018", panel: "#321622", border: "rgba(244,63,94,0.2)", userBubble: "#F43F5E" } },
];

function ThemeColorInput({ label, value, onChange, placeholder }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{
        width: "20px", height: "20px", borderRadius: "6px", flexShrink: 0,
        border: `1px solid ${colors.border.default}`,
        backgroundColor: value || placeholder || "#333",
      }} />
      <div style={{ flex: 1 }}>
        <label style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "2px" }}>
          {label}
        </label>
        <input
          value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder || "inherit"}
          style={{
            width: "100%", padding: "4px 8px", borderRadius: "6px", fontSize: "11px",
            fontFamily: fonts.mono, backgroundColor: colors.bg.base,
            border: `1px solid ${colors.border.faint}`, color: colors.text.primary,
            outline: "none", boxSizing: "border-box",
          }}
          onFocus={onFocus} onBlur={onBlur}
        />
      </div>
    </div>
  );
}

export default function EmbedCode() {
  const { selectedInstance } = useAuth();
  const instanceId = selectedInstance?.id || "";
  const [activeMethod, setActiveMethod] = useState("popup");
  const [cssUrl, setCssUrl] = useState("");
  const [savedCssUrl, setSavedCssUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [theme, setTheme] = useState({ ...DEFAULT_THEME });
  const [previewKey, setPreviewKey] = useState(0);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [savedWelcomeMessage, setSavedWelcomeMessage] = useState("");
  const [defaultOpen, setDefaultOpen] = useState(false);
  const [savedDefaultOpen, setSavedDefaultOpen] = useState(false);

  const origin = window.location.origin;

  // Build theme query string from non-empty values
  const themeQuery = Object.entries(theme)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim())}`)
    .join("&");
  const welcomeQuery = welcomeMessage ? `&welcome=${encodeURIComponent(welcomeMessage)}` : "";
  const widgetUrl = `${origin}/widget?instance=${instanceId}&mode=${activeMethod}${themeQuery ? "&" + themeQuery : ""}${welcomeQuery}`;

  // Load embed config
  useEffect(() => {
    if (!instanceId) return;
    api.get(`/embed/config/${instanceId}`).then(r => {
      const url = r.data?.custom_css_url || "";
      setCssUrl(url);
      setSavedCssUrl(url);
      const wm = r.data?.welcome_message || "";
      setWelcomeMessage(wm);
      setSavedWelcomeMessage(wm);
      const dop = r.data?.default_open || false;
      setDefaultOpen(dop);
      setSavedDefaultOpen(dop);
    }).catch(() => {});
  }, [instanceId]);

  const saveEmbedConfig = useCallback(async () => {
    if (!instanceId) return;
    setSaving(true);
    try {
      await api.put("/admin/embed-config", {
        custom_css_url: cssUrl.trim(),
        welcome_message: welcomeMessage,
        default_open: defaultOpen,
      });
      setSavedCssUrl(cssUrl.trim());
      setSavedWelcomeMessage(welcomeMessage);
      setSavedDefaultOpen(defaultOpen);
      toast.success("Embed configuration saved");
    } catch {
      toast.error("Failed to save configuration");
    } finally { setSaving(false); }
  }, [instanceId, cssUrl, welcomeMessage, defaultOpen]);

  const updateTheme = (key, val) => setTheme(prev => ({ ...prev, [key]: val }));
  const applyPreset = (preset) => setTheme({ ...DEFAULT_THEME, ...preset.theme });
  const refreshPreview = () => setPreviewKey(k => k + 1);

  // Build data attributes string for snippet
  const dataAttrs = Object.entries(theme)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `\n    data-${k.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}="${v.trim()}"`)
    .join("");

  const getSnippets = () => {
    const cssParam = savedCssUrl ? `&css=${encodeURIComponent(savedCssUrl)}` : "";
    const scriptSrc = `${origin}/api/embed.js`;

    if (activeMethod === "popup") {
      return {
        primary: {
          label: "Script Tag (Recommended)",
          code: `<!-- BitBot Pro Popup Widget -->\n<script src="${scriptSrc}"\n    data-instance="${instanceId}"\n    data-mode="popup"${dataAttrs}>\n</script>`,
        },
        alt: {
          label: "Manual iframe",
          code: `<!-- BitBot Pro Popup (iframe) -->\n<iframe\n  src="${widgetUrl}${cssParam}"\n  style="position:fixed;bottom:20px;right:20px;width:380px;\n    height:580px;border:none;z-index:9999;\n    border-radius:16px;\n    box-shadow:0 12px 48px rgba(0,0,0,0.3)"\n  title="Chat"\n></iframe>`,
        },
        react: {
          label: "React Component",
          code: `import { useEffect } from 'react';\n\nexport function BitBotProPopup() {\n  useEffect(() => {\n    const s = document.createElement('script');\n    s.src = '${scriptSrc}';\n    s.dataset.instance = '${instanceId}';\n    s.dataset.mode = 'popup';${Object.entries(theme).filter(([, v]) => v?.trim()).map(([k, v]) => `\n    s.dataset.${k} = '${v.trim()}';`).join("")}\n    s.async = true;\n    document.body.appendChild(s);\n    return () => s.remove();\n  }, []);\n  return null;\n}`,
        },
      };
    }

    if (activeMethod === "inline") {
      return {
        primary: {
          label: "HTML + Script (Recommended)",
          code: `<!-- BitBot Pro Inline Chat -->\n<div id="bitbotpro-container"\n  style="width:100%;height:600px;border-radius:12px;\n    overflow:hidden;border:1px solid #e2e8f0">\n</div>\n<script src="${scriptSrc}"\n    data-instance="${instanceId}"\n    data-mode="inline"${dataAttrs}>\n</script>`,
        },
        alt: {
          label: "Direct iframe",
          code: `<!-- BitBot Pro Inline Chat -->\n<iframe\n  src="${widgetUrl}${cssParam}"\n  style="width:100%;height:600px;border:none;\n    border-radius:12px"\n  title="Chat"\n></iframe>`,
        },
        react: {
          label: "React Component",
          code: `export function BitBotProInline({ height = '600px' }) {\n  return (\n    <iframe\n      src="${widgetUrl}${cssParam}"\n      title="Chat"\n      style={{\n        width: '100%', height, border: 'none',\n        borderRadius: '12px'\n      }}\n    />\n  );\n}`,
        },
      };
    }

    return {
      primary: {
        label: "Redirect / Link",
        code: `<!-- Link to BitBot Pro -->\n<a href="${widgetUrl}${cssParam}"\n  target="_blank" rel="noopener">\n  Open Chat\n</a>`,
      },
      alt: {
        label: "Full Page iframe",
        code: `<!-- BitBot Pro Full Page -->\n<iframe\n  src="${widgetUrl}${cssParam}"\n  style="position:fixed;top:0;left:0;width:100%;\n    height:100%;border:none;z-index:99999"\n  title="Chat"\n></iframe>`,
      },
      react: {
        label: "React Route",
        code: `export function ChatPage() {\n  return (\n    <iframe\n      src="${widgetUrl}${cssParam}"\n      title="Chat"\n      style={{ width: '100%', height: '100vh', border: 'none' }}\n    />\n  );\n}`,
      },
    };
  };

  const snippets = getSnippets();

  const tabStyle = (isActive) => ({
    padding: "10px 16px",
    background: isActive ? "rgba(59,130,246,0.12)" : "transparent",
    border: `1px solid ${isActive ? "rgba(59,130,246,0.3)" : colors.border.subtle}`,
    borderRadius: "10px", cursor: "pointer", transition: "all 0.2s ease",
    display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0,
  });

  return (
    <div style={T.page} data-testid="embed-code-page">
      <p style={T.overline}>Integration</p>
      <h1 style={T.h1}>Embed Your Chatbot</h1>

      {/* Method Selector */}
      <div data-testid="method-tabs" style={{ display: "flex", gap: "12px", marginBottom: "24px", maxWidth: "1100px" }}>
        {METHOD_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeMethod === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveMethod(tab.id)}
              data-testid={`method-tab-${tab.id}`} style={tabStyle(isActive)}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "8px",
                background: isActive ? "rgba(59,130,246,0.2)" : colors.bg.panel,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Icon size={15} color={isActive ? colors.brand.blue : colors.text.secondary} />
              </div>
              <div style={{ textAlign: "left", minWidth: 0 }}>
                <p style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: "600", color: isActive ? colors.text.primary : colors.text.secondary, margin: 0 }}>{tab.label}</p>
                <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tab.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 420px) minmax(0, 1fr)", gap: "24px", maxWidth: "1100px" }}>
        {/* Left Column */}
        <div>
          {/* Widget Behavior */}
          <div style={{ ...T.card, marginBottom: "20px" }} data-testid="widget-behavior-card">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <MessageSquareText size={16} color={colors.brand.cyan} />
              <p style={T.sectionTitle}>Widget Behavior</p>
            </div>
            <p style={T.sectionSub}>
              Set a welcome message and control how the popup loads for visitors.
            </p>

            {/* Default Open Toggle */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", backgroundColor: colors.bg.base, border: `1px solid ${colors.border.subtle}`,
              borderRadius: "10px", marginBottom: "14px", marginTop: "12px",
            }}>
              <div>
                <p style={{ fontFamily: fonts.heading, fontSize: "12px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
                  Expand on Load
                </p>
                <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, margin: "2px 0 0" }}>
                  Popup opens automatically when the page loads
                </p>
              </div>
              <button
                onClick={() => setDefaultOpen(o => !o)}
                data-testid="default-open-toggle"
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: "4px",
                  color: defaultOpen ? colors.brand.success : colors.text.muted,
                  transition: "color 0.15s",
                }}
              >
                {defaultOpen ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
            </div>

            {/* Welcome Message */}
            <label style={T.label}>Welcome Message</label>
            <textarea
              value={welcomeMessage}
              onChange={e => setWelcomeMessage(e.target.value)}
              placeholder="Hello! 👋 Welcome! I'm your assistant. How can I help you today?"
              rows={5}
              data-testid="welcome-message-input"
              style={{
                ...T.input, minHeight: "100px", resize: "vertical", lineHeight: "1.5",
                fontFamily: fonts.body, fontSize: "12px",
              }}
              onFocus={onFocus} onBlur={onBlur}
            />
            <p style={{ ...T.hint, marginTop: "4px" }}>
              This message appears as the first bot message when the widget loads. Supports markdown. Leave blank for no greeting.
            </p>

            {/* Save button */}
            <button onClick={saveEmbedConfig} disabled={saving} data-testid="save-behavior-btn"
              style={{
                ...T.btnPrimary, padding: "8px 16px", fontSize: "12px", marginTop: "10px",
                opacity: saving ? 0.6 : 1, width: "100%",
              }}>
              {saving ? "Saving..." : "Save Configuration"}
            </button>
            {savedWelcomeMessage && (
              <p style={{ ...T.hint, color: colors.brand.success, marginTop: "6px" }}>
                Welcome message active ({savedWelcomeMessage.length} chars)
              </p>
            )}
          </div>

          {/* Theme Configurator */}
          <div style={{ ...T.card, marginBottom: "20px" }} data-testid="theme-configurator">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <Paintbrush size={16} color={colors.brand.cyan} />
              <p style={T.sectionTitle}>Theme Configurator</p>
            </div>
            <p style={T.sectionSub}>
              Customize the widget colors to match your site. Changes update the embed code and live preview instantly.
            </p>

            {/* Presets */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px", marginTop: "12px" }}>
              {THEME_PRESETS.map(preset => (
                <button key={preset.label} onClick={() => applyPreset(preset)}
                  data-testid={`theme-preset-${preset.label.toLowerCase().replace(/\s/g, "-")}`}
                  style={{
                    padding: "5px 12px", borderRadius: "8px", fontSize: "11px", fontFamily: fonts.body,
                    backgroundColor: colors.bg.base, border: `1px solid ${colors.border.default}`,
                    color: colors.text.secondary, cursor: "pointer", transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: "6px",
                  }}>
                  <div style={{
                    width: "10px", height: "10px", borderRadius: "50%",
                    backgroundColor: preset.theme.accent || colors.brand.blue,
                    border: "1px solid rgba(255,255,255,0.1)",
                  }} />
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Color Inputs Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <ThemeColorInput label="Accent" value={theme.accent} onChange={v => updateTheme("accent", v)} placeholder="#3B82F6" />
              <ThemeColorInput label="Accent Light" value={theme.accentLight} onChange={v => updateTheme("accentLight", v)} placeholder="#60A5FA" />
              <ThemeColorInput label="Background" value={theme.bg} onChange={v => updateTheme("bg", v)} placeholder="#0B1120" />
              <ThemeColorInput label="Surface" value={theme.surface} onChange={v => updateTheme("surface", v)} placeholder="#111827" />
              <ThemeColorInput label="Panel" value={theme.panel} onChange={v => updateTheme("panel", v)} placeholder="#1E293B" />
              <ThemeColorInput label="Border" value={theme.border} onChange={v => updateTheme("border", v)} placeholder="rgba(148,163,184,0.15)" />
              <ThemeColorInput label="User Bubble" value={theme.userBubble} onChange={v => updateTheme("userBubble", v)} placeholder="#3B82F6" />
              <ThemeColorInput label="Bot Bubble" value={theme.botBubble} onChange={v => updateTheme("botBubble", v)} placeholder="#1E293B" />
            </div>
          </div>

          {/* Embed Snippets */}
          <div style={T.card} data-testid="embed-snippets-card">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <Code2 size={16} color={colors.brand.blue} />
              <p style={T.sectionTitle}>Integration Code</p>
            </div>
            <p style={T.sectionSub}>
              {activeMethod === "popup" && "Paste the script tag. The launcher auto-injects with your theme colors."}
              {activeMethod === "inline" && "Add the container div and script tag where you want the chat."}
              {activeMethod === "fullpage" && "Link to or embed the full-page chat experience."}
            </p>

            <CodeBlock code={snippets.primary.code} label={snippets.primary.label} testId="copy-primary-btn" />
            <CodeBlock code={snippets.alt.code} label={snippets.alt.label} testId="copy-alt-btn" />
            <CodeBlock code={snippets.react.code} label={snippets.react.label} testId="copy-react-btn" />
          </div>

          {/* Custom CSS */}
          <div style={{ ...T.card, marginTop: "20px" }} data-testid="css-config-card">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <Code2 size={16} color={colors.text.secondary} />
              <p style={T.sectionTitle}>Custom Stylesheet (Advanced)</p>
            </div>
            <p style={T.sectionSub}>Override CSS variables with your own stylesheet for even deeper customization.</p>
            <label style={T.label}>Stylesheet URL</label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <Link2 size={14} color={colors.text.muted} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                <input value={cssUrl} onChange={e => setCssUrl(e.target.value)}
                  placeholder="https://your-site.com/bitbotpro-theme.css" data-testid="css-url-input"
                  style={{ ...T.input, paddingLeft: "34px" }} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <button onClick={saveEmbedConfig} disabled={saving} data-testid="save-css-btn"
                style={{ ...T.btnPrimary, padding: "10px 16px", opacity: saving ? 0.6 : 1, whiteSpace: "nowrap", fontSize: "12px" }}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
            {savedCssUrl && <p style={{ ...T.hint, color: colors.brand.success }}>Active: {savedCssUrl}</p>}

            <button onClick={() => setShowAdvanced(!showAdvanced)} data-testid="toggle-css-vars"
              style={{
                display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none",
                cursor: "pointer", color: colors.text.secondary, fontFamily: fonts.body, fontSize: "12px",
                padding: "8px 0", marginTop: "8px",
              }}>
              <ChevronDown size={14} style={{ transform: showAdvanced ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
              CSS Variables Reference
            </button>
            {showAdvanced && (
              <div data-testid="css-vars-ref" style={{ backgroundColor: colors.bg.base, border: `1px solid ${colors.border.subtle}`, borderRadius: "10px", padding: "14px 16px", marginTop: "8px" }}>
                <pre style={{ fontFamily: fonts.mono, fontSize: "11px", lineHeight: "1.8", color: colors.text.secondary, margin: 0, whiteSpace: "pre-wrap" }}>{`:root {
  --bb-bg: #0B1120;           /* Main background */
  --bb-surface: #111827;      /* Header background */
  --bb-panel: #1E293B;        /* Cards & panels */
  --bb-input-bg: #111827;     /* Input field */
  --bb-text: #F1F5F9;         /* Primary text */
  --bb-text-secondary: #94A3B8;
  --bb-accent: #3B82F6;       /* Buttons, avatar */
  --bb-accent-light: #60A5FA; /* Hover states */
  --bb-user-bubble: #3B82F6;
  --bb-bot-bubble: #1E293B;
  --bb-border: rgba(148,163,184,0.15);
  --bb-radius: 12px;
  --bb-font: 'Your Font', sans-serif;
}`}</pre>
              </div>
            )}
          </div>
        </div>

        {/* Right Column — Preview */}
        <div>
          <div style={{ ...T.card, marginBottom: "20px" }} data-testid="widget-preview-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Monitor size={16} color={colors.brand.blue} />
                <p style={T.sectionTitle}>Live Preview</p>
              </div>
              <button onClick={refreshPreview} data-testid="refresh-preview-btn"
                style={{
                  padding: "5px 10px", borderRadius: "8px", fontSize: "11px", fontFamily: fonts.body,
                  backgroundColor: "transparent", border: `1px solid ${colors.border.default}`,
                  color: colors.text.secondary, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "4px",
                }}>
                <RefreshCw size={11} /> Refresh
              </button>
            </div>
            <div style={{
              backgroundColor: activeMethod === "inline" ? "#f8fafc" : colors.bg.base,
              border: `1px solid ${colors.border.subtle}`, borderRadius: "8px",
              height: "520px", position: "relative",
              maxWidth: "100%", overflow: "hidden",
            }}>
              {activeMethod === "popup" && (
                <div style={{ height: "100%", position: "relative", background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)", padding: "20px" }}>
                  <div style={{ background: "#fff", borderRadius: "8px", padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: "12px" }}>
                    <div style={{ height: "8px", width: "50%", background: "#cbd5e1", borderRadius: "4px", marginBottom: "8px" }} />
                    <div style={{ height: "6px", width: "85%", background: "#e2e8f0", borderRadius: "4px", marginBottom: "4px" }} />
                    <div style={{ height: "6px", width: "70%", background: "#e2e8f0", borderRadius: "4px" }} />
                  </div>
                  <div style={{
                    position: "absolute", bottom: "12px", right: "12px",
                    width: "260px", height: "360px", borderRadius: "12px", overflow: "hidden",
                    boxShadow: "0 12px 48px rgba(0,0,0,0.3)",
                  }}>
                    <iframe key={previewKey} src={widgetUrl}
                      title="Popup Preview" data-testid="widget-preview-iframe"
                      style={{ width: "100%", height: "100%", border: "none" }} />
                  </div>
                  <div style={{
                    position: "absolute", bottom: "12px", right: "280px",
                    width: "44px", height: "44px", borderRadius: "50%",
                    background: theme.accent || colors.brand.blue,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: `0 4px 16px ${theme.accent || colors.brand.blue}40`,
                    animation: "bb-pulse-preview 2.5s ease-in-out infinite",
                  }}>
                    <MessageCircle size={18} color="#fff" />
                  </div>
                </div>
              )}
              {activeMethod === "inline" && (
                <div style={{ padding: "20px", height: "100%", background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: "100%", flex: 1, borderRadius: "10px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                    <iframe key={previewKey} src={widgetUrl}
                      title="Inline Preview" data-testid="widget-preview-iframe"
                      style={{ width: "100%", height: "100%", border: "none" }} />
                  </div>
                </div>
              )}
              {activeMethod === "fullpage" && (
                <iframe key={previewKey} src={widgetUrl}
                  title="Fullpage Preview" data-testid="widget-preview-iframe"
                  style={{ width: "100%", height: "100%", border: "none" }} />
              )}
            </div>
            <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, marginTop: "12px" }}>
              Theme changes reflect instantly in code snippets. Click Refresh to reload the preview iframe.
            </p>
          </div>

          {/* Direct URLs */}
          <div style={T.card} data-testid="direct-urls-card">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <Globe size={16} color={colors.text.secondary} />
              <p style={T.sectionTitle}>Direct URLs</p>
            </div>
            {[
              { label: "Widget URL", url: widgetUrl, desc: `Direct link to the ${activeMethod} mode widget with theme` },
              { label: "Embed Script", url: `${origin}/api/embed.js`, desc: "JavaScript loader URL — add data-* attributes for config" },
            ].map(({ label, url, desc }) => (
              <div key={label} style={{ marginBottom: "12px", padding: "12px 14px", backgroundColor: colors.bg.base, border: `1px solid ${colors.border.subtle}`, borderRadius: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "500", color: colors.text.primary, margin: "0 0 3px" }}>{label}</p>
                    <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.secondary, margin: 0 }}>{desc}</p>
                  </div>
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    data-testid={`link-${label.toLowerCase().replace(/\s+/g, '-')}`}
                    style={{
                      padding: "5px 10px", backgroundColor: colors.bg.panel,
                      border: `1px solid ${colors.border.default}`, color: colors.brand.cyan,
                      borderRadius: "8px", fontSize: "11px", fontFamily: fonts.body,
                      textDecoration: "none", flexShrink: 0, display: "flex", alignItems: "center", gap: "4px",
                    }}>
                    <ExternalLink size={11} /> Open
                  </a>
                </div>
                <code style={{ display: "block", marginTop: "6px", fontFamily: fonts.mono, fontSize: "10.5px", color: colors.text.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {url}
                </code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
