import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Copy, Check, Code2, Globe, Monitor, Paintbrush, MessageCircle, Layout, Maximize, ChevronDown, ExternalLink, Link2 } from "lucide-react";
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
  { id: "popup", label: "Popup Widget", icon: MessageCircle, desc: "Floating chat bubble — opens an expandable chat panel on click" },
  { id: "inline", label: "Inline Embed", icon: Layout, desc: "Embeds directly into a container div on your page" },
  { id: "fullpage", label: "Full Page", icon: Maximize, desc: "Dedicated chat page that fills the entire viewport" },
];

export default function EmbedCode() {
  const { selectedInstance } = useAuth();
  const instanceId = selectedInstance?.id || "";
  const [activeMethod, setActiveMethod] = useState("popup");
  const [cssUrl, setCssUrl] = useState("");
  const [savedCssUrl, setSavedCssUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const origin = window.location.origin;
  const widgetUrl = `${origin}/widget?instance=${instanceId}&mode=${activeMethod}`;

  // Load embed config
  useEffect(() => {
    if (!instanceId) return;
    api.get(`/embed/config/${instanceId}`).then(r => {
      const url = r.data?.custom_css_url || "";
      setCssUrl(url);
      setSavedCssUrl(url);
    }).catch(() => {});
  }, [instanceId]);

  const saveEmbedConfig = useCallback(async () => {
    if (!instanceId) return;
    setSaving(true);
    try {
      await api.put("/admin/embed-config", { custom_css_url: cssUrl.trim() });
      setSavedCssUrl(cssUrl.trim());
      toast.success("Embed configuration saved");
    } catch {
      toast.error("Failed to save configuration");
    } finally { setSaving(false); }
  }, [instanceId, cssUrl]);

  // Generate code snippets based on active method
  const getSnippets = () => {
    const cssParam = savedCssUrl ? `&css=${encodeURIComponent(savedCssUrl)}` : "";

    if (activeMethod === "popup") {
      const scriptSrc = `${origin}/api/embed.js?instance=${instanceId}&mode=popup`;
      return {
        primary: {
          label: "Script Tag (Recommended)",
          code: `<!-- BridgeBot Popup Widget -->\n<script src="${scriptSrc}"></script>`,
        },
        alt: {
          label: "Manual iframe",
          code: `<!-- BridgeBot Popup Widget (Manual) -->\n<iframe\n  src="${origin}/widget?instance=${instanceId}&mode=popup${cssParam}"\n  style="position:fixed;bottom:20px;right:20px;width:380px;\n    height:580px;border:none;z-index:9999;\n    border-radius:12px;\n    box-shadow:0 8px 40px rgba(0,0,0,0.25)"\n  title="Chat"\n></iframe>`,
        },
        react: {
          label: "React Component",
          code: `import { useEffect } from 'react';\n\nexport function BridgeBotPopup() {\n  useEffect(() => {\n    const s = document.createElement('script');\n    s.src = '${scriptSrc}';\n    s.async = true;\n    document.body.appendChild(s);\n    return () => s.remove();\n  }, []);\n  return null;\n}`,
        },
      };
    }

    if (activeMethod === "inline") {
      const scriptSrc = `${origin}/api/embed.js?instance=${instanceId}&mode=inline`;
      return {
        primary: {
          label: "HTML + Script (Recommended)",
          code: `<!-- BridgeBot Inline Chat -->\n<div id="bridgebot-container"\n  style="width:100%;height:600px;border-radius:12px;\n    overflow:hidden;border:1px solid #e2e8f0">\n</div>\n<script src="${scriptSrc}"></script>`,
        },
        alt: {
          label: "Direct iframe",
          code: `<!-- BridgeBot Inline Chat -->\n<iframe\n  src="${origin}/widget?instance=${instanceId}&mode=inline${cssParam}"\n  style="width:100%;height:600px;border:none;\n    border-radius:12px"\n  title="Chat"\n></iframe>`,
        },
        react: {
          label: "React Component",
          code: `export function BridgeBotInline({ height = '600px' }) {\n  return (\n    <iframe\n      src="${origin}/widget?instance=${instanceId}&mode=inline${cssParam}"\n      title="Chat"\n      style={{\n        width: '100%', height, border: 'none',\n        borderRadius: '12px'\n      }}\n    />\n  );\n}`,
        },
      };
    }

    // fullpage
    return {
      primary: {
        label: "Redirect / Link",
        code: `<!-- Link to BridgeBot full page chat -->\n<a href="${origin}/widget?instance=${instanceId}&mode=fullpage${cssParam}"\n  target="_blank" rel="noopener">\n  Open Chat\n</a>`,
      },
      alt: {
        label: "Full Page iframe",
        code: `<!-- BridgeBot Full Page -->\n<iframe\n  src="${origin}/widget?instance=${instanceId}&mode=fullpage${cssParam}"\n  style="position:fixed;top:0;left:0;width:100%;\n    height:100%;border:none;z-index:99999"\n  title="Chat"\n></iframe>`,
      },
      react: {
        label: "React Route",
        code: `// Add to your React Router\nimport { Navigate } from 'react-router-dom';\n\n// Option A: Redirect\n<Route path="/chat"\n  element={\n    <Navigate to="${origin}/widget?instance=${instanceId}&mode=fullpage${cssParam}" />\n  }\n/>\n\n// Option B: Embedded\nexport function ChatPage() {\n  return (\n    <iframe\n      src="${origin}/widget?instance=${instanceId}&mode=fullpage${cssParam}"\n      title="Chat"\n      style={{ width:'100%', height:'100vh', border:'none' }}\n    />\n  );\n}`,
      },
    };
  };

  const snippets = getSnippets();

  // Styles
  const tabStyle = (isActive) => ({
    padding: "10px 16px",
    background: isActive ? "rgba(59,130,246,0.12)" : "transparent",
    border: `1px solid ${isActive ? "rgba(59,130,246,0.3)" : colors.border.subtle}`,
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "flex", alignItems: "center", gap: "10px",
    flex: 1, minWidth: 0,
  });

  return (
    <div style={T.page} data-testid="embed-code-page">
      <p style={T.overline}>Integration</p>
      <h1 style={T.h1}>Embed Your Chatbot</h1>

      {/* Method Selector Tabs */}
      <div data-testid="method-tabs" style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        {METHOD_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeMethod === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveMethod(tab.id)}
              data-testid={`method-tab-${tab.id}`}
              style={tabStyle(isActive)}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "8px",
                background: isActive ? "rgba(59,130,246,0.2)" : colors.bg.panel,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Icon size={15} color={isActive ? colors.brand.blue : colors.text.secondary} />
              </div>
              <div style={{ textAlign: "left", minWidth: 0 }}>
                <p style={{
                  fontFamily: fonts.heading, fontSize: "13px", fontWeight: "600",
                  color: isActive ? colors.text.primary : colors.text.secondary,
                  margin: 0, whiteSpace: "nowrap",
                }}>{tab.label}</p>
                <p style={{
                  fontFamily: fonts.body, fontSize: "11px",
                  color: colors.text.muted, margin: 0,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{tab.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Left Column — Code + CSS */}
        <div>
          {/* Embed Snippets */}
          <div style={T.card} data-testid="embed-snippets-card">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <Code2 size={16} color={colors.brand.blue} />
              <p style={T.sectionTitle}>Integration Code</p>
            </div>
            <p style={T.sectionSub}>
              {activeMethod === "popup" && "Add a floating chat bubble to any page. The widget slides open on click."}
              {activeMethod === "inline" && "Embed the chatbot directly inside a container on your page."}
              {activeMethod === "fullpage" && "Dedicate an entire page to the chat experience."}
            </p>

            <CodeBlock code={snippets.primary.code} label={snippets.primary.label} testId="copy-primary-btn" />
            <CodeBlock code={snippets.alt.code} label={snippets.alt.label} testId="copy-alt-btn" />
            <CodeBlock code={snippets.react.code} label={snippets.react.label} testId="copy-react-btn" />
          </div>

          {/* Custom CSS Configuration */}
          <div style={{ ...T.card, marginTop: "20px" }} data-testid="css-config-card">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <Paintbrush size={16} color={colors.brand.blue} />
              <p style={T.sectionTitle}>Custom Stylesheet</p>
            </div>
            <p style={T.sectionSub}>
              Import your own CSS to make the widget look native to your website. Override any CSS variable to match your brand.
            </p>

            <label style={T.label}>Stylesheet URL</label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <Link2 size={14} color={colors.text.muted}
                  style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                <input
                  value={cssUrl} onChange={e => setCssUrl(e.target.value)}
                  placeholder="https://your-site.com/bridgebot-theme.css"
                  data-testid="css-url-input"
                  style={{ ...T.input, paddingLeft: "34px" }}
                  onFocus={onFocus} onBlur={onBlur}
                />
              </div>
              <button onClick={saveEmbedConfig} disabled={saving} data-testid="save-css-btn"
                style={{
                  ...T.btnPrimary, padding: "10px 16px", opacity: saving ? 0.6 : 1,
                  whiteSpace: "nowrap", fontSize: "12px",
                }}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
            {savedCssUrl && (
              <p style={{ ...T.hint, color: colors.brand.success }}>
                Active stylesheet: {savedCssUrl}
              </p>
            )}

            {/* Collapsible CSS Variables Reference */}
            <button onClick={() => setShowAdvanced(!showAdvanced)} data-testid="toggle-css-vars"
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                background: "none", border: "none", cursor: "pointer",
                color: colors.text.secondary, fontFamily: fonts.body, fontSize: "12px",
                padding: "8px 0", marginTop: "8px",
              }}>
              <ChevronDown size={14} style={{
                transform: showAdvanced ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }} />
              CSS Variables Reference
            </button>
            {showAdvanced && (
              <div data-testid="css-vars-ref" style={{
                backgroundColor: colors.bg.base, border: `1px solid ${colors.border.subtle}`,
                borderRadius: "10px", padding: "14px 16px", marginTop: "8px",
              }}>
                <pre style={{
                  fontFamily: fonts.mono, fontSize: "11px", lineHeight: "1.8",
                  color: colors.text.secondary, margin: 0, whiteSpace: "pre-wrap",
                }}>{`:root {
  /* Backgrounds */
  --bb-bg: #0B1120;           /* Main background */
  --bb-surface: #111827;      /* Header background */
  --bb-panel: #1E293B;        /* Cards & panels */
  --bb-input-bg: #111827;     /* Input field bg */

  /* Text */
  --bb-text: #F1F5F9;         /* Primary text */
  --bb-text-secondary: #94A3B8;
  --bb-text-muted: #64748B;

  /* Accent / Brand */
  --bb-accent: #3B82F6;       /* Buttons, avatar, links */
  --bb-accent-light: #60A5FA; /* Hover states */

  /* Chat Bubbles */
  --bb-user-bubble: #3B82F6;
  --bb-user-bubble-text: #FFFFFF;
  --bb-bot-bubble: #1E293B;
  --bb-bot-bubble-text: #F1F5F9;

  /* Borders & Radius */
  --bb-border: rgba(148, 163, 184, 0.15);
  --bb-radius: 12px;

  /* Fonts */
  --bb-font: 'Your Font', sans-serif;
  --bb-font-mono: monospace;
}`}</pre>
              </div>
            )}
          </div>
        </div>

        {/* Right Column — Preview + Direct URLs */}
        <div>
          {/* Live Preview */}
          <div style={{ ...T.card, marginBottom: "20px" }} data-testid="widget-preview-card">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <Monitor size={16} color={colors.brand.blue} />
              <p style={T.sectionTitle}>Live Preview — {METHOD_TABS.find(t => t.id === activeMethod)?.label}</p>
            </div>
            <div style={{
              backgroundColor: activeMethod === "inline" ? "#f8fafc" : colors.bg.base,
              border: `1px solid ${colors.border.subtle}`, borderRadius: "8px",
              overflow: "hidden",
              height: activeMethod === "fullpage" ? "480px" : "520px",
              position: "relative",
            }}>
              {activeMethod === "inline" && (
                <div style={{
                  padding: "20px", height: "100%",
                  background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
                }}>
                  <div style={{
                    width: "100%", maxWidth: "400px", background: "#fff",
                    borderRadius: "8px", padding: "16px 20px", marginBottom: "12px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}>
                    <div style={{ height: "8px", width: "60%", background: "#cbd5e1", borderRadius: "4px", marginBottom: "8px" }} />
                    <div style={{ height: "6px", width: "90%", background: "#e2e8f0", borderRadius: "4px", marginBottom: "4px" }} />
                    <div style={{ height: "6px", width: "75%", background: "#e2e8f0", borderRadius: "4px" }} />
                  </div>
                  <div style={{
                    width: "100%", flex: 1, borderRadius: "10px", overflow: "hidden",
                    border: "1px solid #e2e8f0",
                  }}>
                    <iframe src={`${origin}/widget?instance=${instanceId}&mode=inline`}
                      title="Inline Preview" data-testid="widget-preview-iframe"
                      style={{ width: "100%", height: "100%", border: "none" }} />
                  </div>
                </div>
              )}
              {activeMethod === "popup" && (
                <div style={{
                  height: "100%", position: "relative",
                  background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
                  padding: "20px",
                }}>
                  {/* Fake host page content */}
                  <div style={{
                    background: "#fff", borderRadius: "8px", padding: "16px 20px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: "12px",
                  }}>
                    <div style={{ height: "8px", width: "50%", background: "#cbd5e1", borderRadius: "4px", marginBottom: "8px" }} />
                    <div style={{ height: "6px", width: "85%", background: "#e2e8f0", borderRadius: "4px", marginBottom: "4px" }} />
                    <div style={{ height: "6px", width: "70%", background: "#e2e8f0", borderRadius: "4px" }} />
                  </div>
                  <div style={{
                    background: "#fff", borderRadius: "8px", padding: "16px 20px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}>
                    <div style={{ height: "6px", width: "65%", background: "#e2e8f0", borderRadius: "4px", marginBottom: "4px" }} />
                    <div style={{ height: "6px", width: "80%", background: "#e2e8f0", borderRadius: "4px" }} />
                  </div>
                  {/* Mini widget preview */}
                  <div style={{
                    position: "absolute", bottom: "12px", right: "12px",
                    width: "260px", height: "360px",
                    borderRadius: "10px", overflow: "hidden",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                  }}>
                    <iframe src={`${origin}/widget?instance=${instanceId}&mode=popup`}
                      title="Popup Preview" data-testid="widget-preview-iframe"
                      style={{ width: "100%", height: "100%", border: "none" }} />
                  </div>
                  {/* Fake trigger button */}
                  <div style={{
                    position: "absolute", bottom: "12px", right: "280px",
                    width: "40px", height: "40px", borderRadius: "50%",
                    background: colors.brand.blue, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    boxShadow: "0 4px 12px rgba(59,130,246,0.4)",
                  }}>
                    <MessageCircle size={18} color="#fff" />
                  </div>
                </div>
              )}
              {activeMethod === "fullpage" && (
                <iframe src={`${origin}/widget?instance=${instanceId}&mode=fullpage`}
                  title="Fullpage Preview" data-testid="widget-preview-iframe"
                  style={{ width: "100%", height: "100%", border: "none" }} />
              )}
            </div>
            <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, marginTop: "12px" }}>
              Live preview. Changes to bot settings and CSS apply after refresh.
            </p>
          </div>

          {/* Direct URLs */}
          <div style={T.card} data-testid="direct-urls-card">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <Globe size={16} color={colors.text.secondary} />
              <p style={T.sectionTitle}>Direct URLs</p>
            </div>
            {[
              { label: "Widget URL", url: `${origin}/widget?instance=${instanceId}&mode=${activeMethod}`, desc: `Direct link to the ${activeMethod} mode widget` },
              { label: "Embed Script", url: `${origin}/api/embed.js?instance=${instanceId}&mode=${activeMethod}`, desc: "JavaScript loader URL for script-based integration" },
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
