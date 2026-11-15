import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Send, RotateCcw, Copy, Check } from "lucide-react";
import BridgeBotLogo from "../components/BridgeBotLogo";
import { useSearchParams } from "react-router-dom";
import { streamChat } from "../utils/streamChat";
import MarkdownMessage from "../components/MarkdownMessage";

const API = `/api`;

function BubbleCopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const go = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }, [text]);
  return (
    <button onClick={go} data-testid="bubble-copy-btn" className="bb-bubble-copy" title={copied ? "Copied" : "Copy message"}>
      {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={2} />}
    </button>
  );
}

export default function ChatWidget() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [botConfig, setBotConfig] = useState({ name: "Assistant" });
  const [logoUrl, setLogoUrl] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const streamRef = useRef(null);
  const [searchParams] = useSearchParams();
  const instanceId = searchParams.get("instance");
  const mode = searchParams.get("mode") || "popup";
  const welcomeParam = searchParams.get("welcome") || "";

  // Theme URL params for external embedding
  const themeAccent = searchParams.get("accent");
  const themeAccentLight = searchParams.get("accentLight");
  const themeBg = searchParams.get("bg");
  const themeSurface = searchParams.get("surface");
  const themePanel = searchParams.get("panel");
  const themeText = searchParams.get("text");
  const themeTextSecondary = searchParams.get("textSecondary");
  const themeBorder = searchParams.get("border");
  const themeUserBubble = searchParams.get("userBubble");
  const themeBotBubble = searchParams.get("botBubble");
  const themeInputBg = searchParams.get("inputBg");
  const themeFont = searchParams.get("font");
  const themeRadius = searchParams.get("radius");

  // Apply URL theme params on mount
  useEffect(() => {
    const root = document.documentElement;
    const map = {
      "--bb-accent": themeAccent,
      "--bb-accent-light": themeAccentLight || themeAccent,
      "--bb-bg": themeBg,
      "--bb-surface": themeSurface,
      "--bb-panel": themePanel,
      "--bb-text": themeText,
      "--bb-text-secondary": themeTextSecondary,
      "--bb-border": themeBorder,
      "--bb-user-bubble": themeUserBubble || themeAccent,
      "--bb-bot-bubble": themeBotBubble || themePanel,
      "--bb-input-bg": themeInputBg || themeSurface,
      "--bb-font": themeFont,
      "--bb-radius": themeRadius,
    };
    Object.entries(map).forEach(([k, v]) => { if (v) root.style.setProperty(k, v); });
  }, [themeAccent, themeAccentLight, themeBg, themeSurface, themePanel, themeText, themeTextSecondary, themeBorder, themeUserBubble, themeBotBubble, themeInputBg, themeFont, themeRadius]);

  // Load embed config (custom CSS + welcome message) for this instance
  useEffect(() => {
    if (instanceId) {
      axios.get(`${API}/embed/config/${instanceId}`).then(r => {
        const cfg = r.data || {};
        // Inject custom stylesheet if configured
        if (cfg.custom_css_url) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = cfg.custom_css_url;
          link.setAttribute("data-bitbotpro-css", "true");
          document.head.appendChild(link);
        }
        // Apply theme CSS variables
        if (cfg.theme) {
          const root = document.documentElement;
          Object.entries(cfg.theme).forEach(([k, v]) => {
            if (v) root.style.setProperty(k, v);
          });
        }
        // Set welcome message: URL param takes priority, then config, then nothing
        const welcome = welcomeParam || cfg.welcome_message || "";
        if (welcome && messages.length === 0) {
          setMessages([{ role: "assistant", content: welcome, timestamp: new Date().toISOString() }]);
        }
      }).catch(() => {
        // If config fetch fails, still apply URL-param welcome message
        if (welcomeParam && messages.length === 0) {
          setMessages([{ role: "assistant", content: welcomeParam, timestamp: new Date().toISOString() }]);
        }
      });
    } else if (welcomeParam && messages.length === 0) {
      setMessages([{ role: "assistant", content: welcomeParam, timestamp: new Date().toISOString() }]);
    }
    return () => {
      // Cleanup injected CSS on unmount
      const link = document.querySelector('link[data-bitbotpro-css]');
      if (link) link.remove();
    };
  }, [instanceId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const iid = instanceId || "default";
    axios.get(`${API}/bot-info/${iid}`).then(r => { if (r.data?.name) setBotConfig(r.data); }).catch(() => {});
    const img = new Image();
    img.onload = () => setLogoUrl(`${API}/bot-logo/${iid}`);
    img.onerror = () => setLogoUrl(null);
    img.src = `${API}/bot-logo/${iid}`;

    const saved = sessionStorage.getItem(`widget_session_${instanceId || "default"}`);
    if (saved) {
      setSessionId(saved);
      axios.get(`${API}/chat/history/${saved}`).then(r => setMessages(r.data.messages || [])).catch(() => {});
    }
  }, [instanceId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading, isStreaming]);
  useEffect(() => { if (mode !== "inline") setTimeout(() => inputRef.current?.focus(), 100); }, [mode]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading || isStreaming) return;
    const text = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text, timestamp: new Date().toISOString() }]);
    setIsLoading(true);

    let sessionReceived = false;
    let firstTokenReceived = false;
    streamRef.current = streamChat({
      message: text,
      sessionId,
      instanceId,
      onSession: (sid) => {
        sessionReceived = true;
        if (!sessionId) {
          setSessionId(sid);
          sessionStorage.setItem(`widget_session_${instanceId || "default"}`, sid);
        }
      },
      onToken: (token) => {
        if (!firstTokenReceived) {
          firstTokenReceived = true;
          setIsLoading(false);
          setIsStreaming(true);
        }
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.isStreaming) {
            const updated = [...prev];
            updated[updated.length - 1] = { ...last, content: last.content + token };
            return updated;
          }
          return [...prev, { role: "assistant", content: token, timestamp: new Date().toISOString(), isStreaming: true }];
        });
      },
      onDone: (fullResponse) => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: fullResponse, isStreaming: false };
          }
          return updated;
        });
        setIsStreaming(false);
        setIsLoading(false);
      },
      onError: (errMsg) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.isStreaming) {
            const updated = [...prev];
            updated[updated.length - 1] = { ...last, content: errMsg || "Sorry, an error occurred.", isStreaming: false, isError: true };
            return updated;
          }
          return [...prev, { role: "assistant", content: errMsg || "Sorry, an error occurred.", timestamp: new Date().toISOString(), isError: true }];
        });
        setIsStreaming(false);
        setIsLoading(false);
      },
    });
  }, [input, isLoading, isStreaming, sessionId, instanceId]);

  const reset = () => { sessionStorage.removeItem(`widget_session_${instanceId || "default"}`); setSessionId(null); setMessages([]); if (streamRef.current) streamRef.current.abort(); };
  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const isFullpage = mode === "fullpage";
  const isInline = mode === "inline";

  return (
    <>
      <style>{`
        :root {
          --bb-bg: #0B1120;
          --bb-surface: #111827;
          --bb-panel: #1E293B;
          --bb-text: #F1F5F9;
          --bb-text-secondary: #94A3B8;
          --bb-text-muted: #64748B;
          --bb-accent: #3B82F6;
          --bb-accent-light: #60A5FA;
          --bb-border: rgba(148, 163, 184, 0.15);
          --bb-user-bubble: #3B82F6;
          --bb-user-bubble-text: #FFFFFF;
          --bb-bot-bubble: #1E293B;
          --bb-bot-bubble-text: #F1F5F9;
          --bb-input-bg: #111827;
          --bb-font: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          --bb-font-mono: 'JetBrains Mono', monospace;
          --bb-radius: 12px;
          --bb-success: #34D399;
          --bb-error: #F43F5E;
        }
        .bb-widget * { box-sizing: border-box; margin: 0; padding: 0; }
        .bb-widget {
          width: 100%;
          height: ${isFullpage ? '100vh' : isInline ? '100%' : '100vh'};
          background: var(--bb-bg);
          display: flex;
          flex-direction: column;
          font-family: var(--bb-font);
          overflow: hidden;
          ${isFullpage ? 'max-width: 700px; margin: 0 auto;' : ''}
        }
        .bb-header {
          background: var(--bb-surface);
          border-bottom: 1px solid var(--bb-border);
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .bb-avatar {
          width: 30px; height: 30px;
          background: var(--bb-accent);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .bb-bot-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--bb-text);
          letter-spacing: -0.3px;
        }
        .bb-status {
          display: flex; align-items: center; gap: 4px;
        }
        .bb-status-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: var(--bb-success);
          box-shadow: 0 0 6px var(--bb-success);
        }
        .bb-status-text {
          font-family: var(--bb-font-mono);
          font-size: 9px; color: var(--bb-success);
          text-transform: uppercase; letter-spacing: 0.1em;
        }
        .bb-messages {
          flex: 1; overflow-y: auto; padding: 14px;
        }
        .bb-messages::-webkit-scrollbar { width: 4px; }
        .bb-messages::-webkit-scrollbar-track { background: transparent; }
        .bb-messages::-webkit-scrollbar-thumb { background: var(--bb-border); border-radius: 4px; }
        .bb-empty {
          text-align: center; padding-top: 40px;
        }
        .bb-empty-icon {
          width: 44px; height: 44px;
          background: var(--bb-accent);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 14px;
        }
        .bb-empty-title {
          font-size: 18px; font-weight: 700;
          color: var(--bb-text);
          margin-bottom: 6px; letter-spacing: -0.3px;
        }
        .bb-empty-sub {
          font-size: 13px; color: var(--bb-text-secondary);
        }
        .bb-msg-row {
          display: flex; margin-bottom: 10px; align-items: flex-start;
        }
        .bb-msg-row.user { justify-content: flex-end; }
        .bb-msg-row.bot { justify-content: flex-start; }
        .bb-bubble-copy {
          opacity: 0; transition: opacity 0.15s;
          background: none; border: none; cursor: pointer; padding: 3px;
          color: var(--bb-text-secondary, rgba(148,163,184,0.5));
          flex-shrink: 0; margin-top: 6px; margin-left: 4px; border-radius: 4px;
          display: flex; align-items: center; justify-content: center;
        }
        .bb-bubble-copy:hover { color: var(--bb-accent-light, #60A5FA); }
        .bb-msg-row:hover .bb-bubble-copy { opacity: 1; }
        .bb-msg-avatar {
          width: 22px; height: 22px;
          background: var(--bb-accent);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          margin-right: 7px; flex-shrink: 0; margin-top: 3px;
        }
        .bb-bubble {
          max-width: 85%; padding: 9px 12px;
          border-radius: var(--bb-radius);
          font-size: 13px; line-height: 1.6;
          word-break: break-word; overflow-wrap: anywhere;
          min-width: 0;
        }
        .bb-bubble.user {
          background: var(--bb-user-bubble);
          color: var(--bb-user-bubble-text);
          border: 1px solid rgba(96,165,250,0.2);
        }
        .bb-bubble.bot {
          background: var(--bb-bot-bubble);
          color: var(--bb-bot-bubble-text);
          border: 1px solid var(--bb-border);
        }
        .bb-bubble .bb-md { overflow-x: hidden; max-width: 100%; }
        .bb-bubble .bb-md table { table-layout: fixed; }
        .bb-bubble .bb-md pre { max-width: 100%; }
        .bb-bubble.error {
          background: rgba(244,63,94,0.08);
          color: var(--bb-error);
          border-color: rgba(244,63,94,0.2);
        }
        .bb-typing {
          display: flex; gap: 4px; padding: 10px 14px;
          background: var(--bb-bot-bubble);
          border: 1px solid var(--bb-border);
          border-radius: var(--bb-radius);
        }
        .bb-typing-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--bb-accent-light);
          animation: bb-dot 1.4s infinite ease-in-out;
        }
        .bb-typing-dot:nth-child(2) { animation-delay: 0.16s; }
        .bb-typing-dot:nth-child(3) { animation-delay: 0.32s; }
        @keyframes bb-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes bb-cursor-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .bb-stream-cursor {
          display: inline-block; width: 2px; height: 13px;
          background: var(--bb-accent-light);
          margin-left: 2px; vertical-align: text-bottom;
          animation: bb-cursor-blink 0.8s infinite;
        }
        .bb-input-area {
          border-top: 1px solid var(--bb-border);
          padding: 10px 12px;
          background: var(--bb-bg);
          flex-shrink: 0;
        }
        .bb-input-row {
          display: flex; gap: 8px;
        }
        .bb-input {
          flex: 1;
          background: var(--bb-input-bg);
          border: 1px solid var(--bb-border);
          border-radius: var(--bb-radius);
          padding: 9px 12px;
          color: var(--bb-text);
          font-family: var(--bb-font);
          font-size: 13px;
          outline: none;
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .bb-input:focus {
          border-color: var(--bb-accent-light);
          box-shadow: 0 0 6px rgba(96,165,250,0.15);
        }
        .bb-send {
          width: 36px; height: 36px;
          border-radius: var(--bb-radius);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }
        .bb-send.active {
          background: var(--bb-accent);
          border: 1px solid rgba(96,165,250,0.5);
          cursor: pointer;
        }
        .bb-send.disabled {
          background: var(--bb-panel);
          border: 1px solid var(--bb-border);
          cursor: not-allowed;
        }
        .bb-footer {
          font-family: var(--bb-font-mono);
          font-size: 9px; color: var(--bb-text-muted);
          margin: 6px 0 0; text-transform: uppercase;
          letter-spacing: 0.1em; text-align: center;
        }
        .bb-reset {
          background: none; border: none; cursor: pointer;
          color: var(--bb-text-secondary); padding: 4px;
          display: flex; align-items: center;
        }
      `}</style>

      <div className="bb-widget" data-testid="bridgebot-widget">
        {/* Header */}
        <div className="bb-header" data-testid="widget-header">
          <div className="bb-avatar">
            {logoUrl
              ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              : <BridgeBotLogo size={22} />}
          </div>
          <div style={{ flex: 1 }}>
            <p className="bb-bot-name">{botConfig.name || "Assistant"}</p>
            <div className="bb-status">
              <div className="bb-status-dot" />
              <span className="bb-status-text">Online</span>
            </div>
          </div>
          <button onClick={reset} className="bb-reset" data-testid="widget-reset-btn">
            <RotateCcw size={13} />
          </button>
        </div>

        {/* Messages */}
        <div className="bb-messages" data-testid="widget-messages">
          {messages.length === 0 && !isLoading && (
            <div className="bb-empty">
              <div className="bb-empty-icon">
                {logoUrl
                  ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                  : <BridgeBotLogo size={28} />}
              </div>
              <p className="bb-empty-title">Hi there!</p>
              <p className="bb-empty-sub">Type a message to get started.</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={`${msg.role}-${msg.timestamp || i}`} className={`bb-msg-row ${msg.role === "user" ? "user" : "bot"}`}>
              {msg.role === "assistant" && (
                <div className="bb-msg-avatar">
                  {logoUrl
                    ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                    : <BridgeBotLogo size={16} />}
                </div>
              )}
              <div className={`bb-bubble ${msg.role === "user" ? "user" : "bot"} ${msg.isError ? "error" : ""}`}>
                <div style={{ margin: 0 }}>
                  {msg.role === "user" ? msg.content : <MarkdownMessage content={msg.content} compact />}
                  {msg.isStreaming && <span className="bb-stream-cursor" />}
                </div>
              </div>
              {msg.role === "assistant" && !msg.isStreaming && msg.content && (
                <BubbleCopyBtn text={msg.content} />
              )}
            </div>
          ))}

          {isLoading && !isStreaming && (
            <div className="bb-msg-row bot" data-testid="widget-typing-indicator">
              <div className="bb-msg-avatar">
                {logoUrl
                  ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                  : <BridgeBotLogo size={16} />}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <div className="bb-typing">
                  <div className="bb-typing-dot" />
                  <div className="bb-typing-dot" />
                  <div className="bb-typing-dot" />
                </div>
                <span style={{ fontSize: "9px", color: "var(--bb-text-muted)", fontFamily: "var(--bb-font-mono)", letterSpacing: "0.04em", paddingLeft: "2px" }}>
                  {botConfig.name || "Bot"} is typing…
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bb-input-area" data-testid="widget-input-area">
          <div className="bb-input-row">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type a message..."
              className="bb-input"
              data-testid="widget-input"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || isStreaming || !input.trim()}
              className={`bb-send ${!isLoading && !isStreaming && input.trim() ? "active" : "disabled"}`}
              data-testid="widget-send-btn"
            >
              <Send size={13} color={!isLoading && !isStreaming && input.trim() ? "#FFFFFF" : "#64748B"} />
            </button>
          </div>
          <p className="bb-footer">Powered by BitBot Pro</p>
        </div>
      </div>
    </>
  );
}
