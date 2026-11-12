import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Send, Plus, ExternalLink, Copy, Check } from "lucide-react";
import BridgeBotLogo from "../components/BridgeBotLogo";
import { useSearchParams } from "react-router-dom";
import { colors, fonts } from "../theme";
import { streamChat } from "../utils/streamChat";
import MarkdownMessage from "../components/MarkdownMessage";

const API = `/api`;

function BubbleCopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const go = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }, [text]);
  return (
    <button onClick={go} data-testid="bubble-copy-btn" title={copied ? "Copied" : "Copy message"}
      style={{
        opacity: 0, transition: "opacity 0.15s", background: "none", border: "none", cursor: "pointer",
        padding: "3px", color: copied ? "#34D399" : "rgba(148,163,184,0.45)", flexShrink: 0,
        marginTop: "6px", marginLeft: "6px", borderRadius: "4px",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      className="bb-pcopy"
    >
      {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2} />}
    </button>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [botConfig, setBotConfig] = useState({ name: "BridgeBot Assistant" });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const streamRef = useRef(null);
  const [searchParams] = useSearchParams();
  const instanceId = searchParams.get("instance");

  useEffect(() => {
    const cfgParams = instanceId ? `?instance_id=${instanceId}` : "";
    axios.get(`${API}/admin/bot-config${cfgParams}`).then(r => { if (r.data?.name) setBotConfig(r.data); }).catch(() => {});
    const savedSession = localStorage.getItem(`bf_chat_${instanceId || "default"}`);
    if (savedSession) {
      setSessionId(savedSession);
      axios.get(`${API}/chat/history/${savedSession}`).then(r => setMessages(r.data.messages || [])).catch(() => {});
    }
  }, [instanceId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading, isStreaming]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading || isStreaming) return;
    const text = input.trim();
    setInput("");
    const userMsg = { role: "user", content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
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
          localStorage.setItem(`bf_chat_${instanceId || "default"}`, sid);
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
        setTimeout(() => inputRef.current?.focus(), 50);
      },
      onError: (errMsg) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.isStreaming) {
            const updated = [...prev];
            updated[updated.length - 1] = { ...last, content: errMsg || "I encountered an error. Please try again.", isStreaming: false, isError: true };
            return updated;
          }
          return [...prev, { role: "assistant", content: errMsg || "I encountered an error. Please try again.", timestamp: new Date().toISOString(), isError: true }];
        });
        setIsStreaming(false);
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      },
    });
  }, [input, isLoading, isStreaming, sessionId, instanceId]);

  const startNewChat = () => { localStorage.removeItem(`bf_chat_${instanceId || "default"}`); setSessionId(null); setMessages([]); if (streamRef.current) streamRef.current.abort(); };
  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: colors.bg.base, display: "flex", flexDirection: "column" }}>
      <style>{`.bb-prow:hover .bb-pcopy { opacity: 1 !important; } .bb-pcopy:hover { color: ${colors.brand.cyan} !important; }`}</style>
      {/* Header */}
      <div style={{
        backgroundColor: "rgba(5,11,20,0.85)", backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${colors.border.default}`, padding: "14px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "34px", height: "34px", background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.light})`,
            borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 12px rgba(59, 130, 246, 0.4)`,
          }}>
            <BridgeBotLogo size={18} />
          </div>
          <div>
            <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: 0, letterSpacing: "-0.3px" }}>
              {botConfig.name || "BridgeBot Assistant"}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: colors.brand.success, boxShadow: `0 0 6px ${colors.brand.success}` }} />
              <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.brand.success, textTransform: "uppercase", letterSpacing: "0.1em" }}>Online</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <a href="/admin" style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px",
            backgroundColor: "transparent", border: `1px solid ${colors.border.default}`,
            color: colors.text.secondary, borderRadius: "10px", fontSize: "12px", fontFamily: fonts.body,
            textDecoration: "none", transition: "border-color 0.2s",
          }}>
            <ExternalLink size={12} /> Admin
          </a>
          <button onClick={startNewChat} data-testid="new-chat-btn"
            style={{
              display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px",
              backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
              color: colors.text.primary, borderRadius: "10px", fontSize: "12px", fontFamily: fonts.body,
              cursor: "pointer", transition: "border-color 0.2s",
            }}>
            <Plus size={12} /> New Chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 24px", maxWidth: "760px", margin: "0 auto", width: "100%" }}>
        {messages.length === 0 && !isLoading && (
          <div style={{ textAlign: "center", paddingTop: "100px", animation: "fade-in 0.4s ease" }}>
            <div style={{
              width: "60px", height: "60px", background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.light})`,
              borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px", boxShadow: `0 0 30px rgba(59, 130, 246, 0.3)`,
            }}>
              <BridgeBotLogo size={28} />
            </div>
            <h2 style={{ fontFamily: fonts.heading, fontSize: "28px", fontWeight: "700", color: colors.text.primary, margin: "0 0 10px", letterSpacing: "-0.5px" }}>
              How can I help you?
            </h2>
            <p style={{ fontFamily: fonts.body, fontSize: "15px", color: colors.text.secondary, margin: 0, lineHeight: "1.6" }}>
              Ask me anything — I'm powered by your knowledge base and always learning.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={`${msg.role}-${msg.timestamp || i}`} className="message-enter bb-prow"
            style={{ display: "flex", alignItems: "flex-start", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: "16px" }}>
            {msg.role === "assistant" && (
              <div style={{
                width: "28px", height: "28px", background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.light})`,
                borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center",
                marginRight: "10px", flexShrink: 0, marginTop: "4px",
              }}>
                <BridgeBotLogo size={14} />
              </div>
            )}
            <div style={{
              maxWidth: "72%", padding: "12px 16px", borderRadius: "12px",
              backgroundColor: msg.role === "user" ? colors.brand.blue : (msg.isError ? "rgba(244,63,94,0.08)" : colors.bg.panel),
              border: msg.role === "user" ? `1px solid rgba(96, 165, 250, 0.2)` : `1px solid ${msg.isError ? "rgba(244,63,94,0.2)" : colors.border.default}`,
              color: msg.isError ? colors.brand.error : colors.text.primary,
              fontFamily: fonts.body, fontSize: "14px", lineHeight: "1.7",
            }}>
              {msg.role === "user" ? (
                <p style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</p>
              ) : (
                <div style={{ margin: 0, wordBreak: "break-word" }}>
                  <MarkdownMessage content={msg.content} />
                  {msg.isStreaming && <span style={{ display: "inline-block", width: "2px", height: "14px", backgroundColor: colors.brand.cyan, marginLeft: "2px", verticalAlign: "text-bottom", animation: "cursor-blink 0.8s infinite" }} />}
                </div>
              )}
              <p style={{ margin: "6px 0 0", fontSize: "10px", color: msg.role === "user" ? "rgba(255,255,255,0.4)" : colors.text.muted, fontFamily: fonts.mono }}>
                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
              </p>
            </div>
            {msg.role === "assistant" && !msg.isStreaming && msg.content && (
              <BubbleCopyBtn text={msg.content} />
            )}
          </div>
        ))}

        {isLoading && !isStreaming && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "16px" }} data-testid="typing-indicator">
            <div style={{ width: "28px", height: "28px", background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.light})`, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "10px", flexShrink: 0 }}>
              <BridgeBotLogo size={14} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ padding: "14px 18px", backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`, borderRadius: "12px", display: "flex", gap: "5px", alignItems: "center" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: colors.brand.cyan, animation: "typing-dot 1.4s infinite ease-in-out", animationDelay: `${i * 0.16}s` }} />
                ))}
              </div>
              <span style={{ fontSize: "10px", color: colors.text.muted, fontFamily: fonts.mono, letterSpacing: "0.04em", paddingLeft: "4px" }}>
                {botConfig.name || "Bot"} is typing…
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ borderTop: `1px solid ${colors.border.default}`, padding: "20px 24px", backgroundColor: colors.bg.base }}>
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
            <textarea
              ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder="Type your message... (Enter to send)" data-testid="chat-input" rows={1}
              style={{
                flex: 1, backgroundColor: colors.bg.surface, border: `1px solid ${colors.border.default}`,
                borderRadius: "10px", padding: "12px 16px", color: colors.text.primary,
                fontFamily: fonts.body, fontSize: "14px", outline: "none",
                resize: "none", lineHeight: "1.5", maxHeight: "120px", overflowY: "auto",
                transition: "border-color 0.3s ease, box-shadow 0.3s ease",
              }}
              onFocus={e => { e.target.style.borderColor = colors.brand.cyan; e.target.style.boxShadow = `0 0 8px rgba(96,165,250,0.15)`; }}
              onBlur={e => { e.target.style.borderColor = "rgba(59,130,246,0.3)"; e.target.style.boxShadow = "none"; }}
            />
            <button onClick={sendMessage} disabled={isLoading || isStreaming || !input.trim()} data-testid="send-message-btn"
              style={{
                width: "44px", height: "44px",
                backgroundColor: !isLoading && input.trim() ? colors.brand.blue : colors.bg.panel,
                border: !isLoading && input.trim() ? `1px solid rgba(96,165,250,0.5)` : `1px solid ${colors.border.default}`,
                borderRadius: "10px", cursor: !isLoading && input.trim() ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s ease", flexShrink: 0,
                boxShadow: !isLoading && input.trim() ? `0 0 10px rgba(59,130,246,0.3)` : "none",
              }}>
              <Send size={16} color={!isLoading && input.trim() ? "#FFFFFF" : colors.text.muted} />
            </button>
          </div>
          <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, marginTop: "8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
