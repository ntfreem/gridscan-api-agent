/**
 * API Scraper — separate API testing tool.
 * Allows users to send test requests to external API endpoints and see responses.
 * Useful for testing bot integrations, webhooks, and third-party API connectivity.
 */
import { useState, useCallback } from "react";
import { useSession } from "../context/SessionContext";
import {
  Zap, Play, Copy, Trash2, Plus, ChevronDown, ChevronRight,
  Loader2, CheckCircle, XCircle, Clock, Code2, Globe,
  ArrowRight, FileText, Settings,
} from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur } from "../theme";
import { toast } from "sonner";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const METHOD_COLORS = {
  GET: "#34D399",
  POST: "#3B82F6",
  PUT: "#FBBF24",
  PATCH: "#F97316",
  DELETE: "#F43F5E",
};

function HeaderRow({ header, onChange, onRemove }) {
  return (
    <div style={{ display: "flex", gap: "6px", marginBottom: "4px", alignItems: "center" }}>
      <input value={header.key} onChange={e => onChange({ ...header, key: e.target.value })}
        placeholder="Header name" style={{ ...T.input, flex: 1, fontSize: "12px", padding: "7px 10px" }}
        onFocus={onFocus} onBlur={onBlur} />
      <input value={header.value} onChange={e => onChange({ ...header, value: e.target.value })}
        placeholder="Value" style={{ ...T.input, flex: 2, fontSize: "12px", padding: "7px 10px" }}
        onFocus={onFocus} onBlur={onBlur} />
      <button onClick={onRemove} style={{ ...T.btnGhost, padding: "4px 6px", color: colors.text.muted }}>
        <Trash2 size={11} />
      </button>
    </div>
  );
}

function ResponseDisplay({ response }) {
  if (!response) return null;

  const statusColor = response.status >= 200 && response.status < 300 ? colors.brand.success :
    response.status >= 400 ? colors.brand.error : colors.brand.warning;

  let formattedBody = response.body;
  try {
    if (typeof response.body === "string") {
      formattedBody = JSON.stringify(JSON.parse(response.body), null, 2);
    } else if (typeof response.body === "object") {
      formattedBody = JSON.stringify(response.body, null, 2);
    }
  } catch {}

  return (
    <div data-testid="api-response" style={{ marginTop: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
        <span style={{
          fontFamily: fonts.mono, fontSize: "13px", fontWeight: "700",
          color: statusColor,
        }}>
          {response.status} {response.statusText}
        </span>
        <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>
          <Clock size={10} style={{ verticalAlign: "middle", marginRight: "3px" }} />
          {response.duration}ms
        </span>
        <span style={{
          fontFamily: fonts.mono, fontSize: "9px", padding: "2px 7px",
          borderRadius: radius.full, backgroundColor: `${statusColor}14`, color: statusColor,
        }}>
          {response.size}
        </span>
      </div>

      {/* Response headers */}
      {response.headers && Object.keys(response.headers).length > 0 && (
        <details style={{ marginBottom: "8px" }}>
          <summary style={{
            fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted,
            cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em",
            padding: "4px 0",
          }}>
            Response Headers ({Object.keys(response.headers).length})
          </summary>
          <div style={{
            backgroundColor: colors.bg.panel, borderRadius: radius.sm,
            padding: "8px 10px", border: `1px solid ${colors.border.muted}`,
            marginTop: "4px",
          }}>
            {Object.entries(response.headers).map(([k, v]) => (
              <div key={k} style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.secondary, padding: "1px 0" }}>
                <span style={{ color: colors.brand.light }}>{k}</span>: {v}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Response body */}
      <div style={{ position: "relative" }}>
        <pre style={{
          backgroundColor: colors.bg.panel, padding: "14px 16px", borderRadius: radius.md,
          fontFamily: fonts.mono, fontSize: "12px", color: colors.text.primary,
          overflow: "auto", maxHeight: "400px", border: `1px solid ${colors.border.default}`,
          lineHeight: "1.5", whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {formattedBody || "(empty response)"}
        </pre>
        <button onClick={() => { navigator.clipboard.writeText(formattedBody || ""); toast.success("Response copied"); }}
          data-testid="copy-response-btn"
          style={{ position: "absolute", top: "8px", right: "8px", ...T.btnGhost, padding: "4px 8px", fontSize: "10px" }}>
          <Copy size={10} /> Copy
        </button>
      </div>
    </div>
  );
}

function HistoryItem({ item, onClick }) {
  const methodColor = METHOD_COLORS[item.method] || colors.text.muted;
  const statusColor = item.status >= 200 && item.status < 300 ? colors.brand.success :
    item.status >= 400 ? colors.brand.error : colors.brand.warning;

  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: "8px",
      padding: "8px 10px", borderRadius: radius.sm,
      cursor: "pointer", transition: "background-color 0.1s",
      borderBottom: `1px solid ${colors.border.muted}`,
    }} onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.bg.hover}
       onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
      <span style={{
        fontFamily: fonts.mono, fontSize: "9px", fontWeight: "700",
        color: methodColor, minWidth: "36px",
      }}>{item.method}</span>
      <span style={{
        fontFamily: fonts.mono, fontSize: "11px", color: colors.text.primary,
        flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{item.url}</span>
      <span style={{
        fontFamily: fonts.mono, fontSize: "10px", fontWeight: "600", color: statusColor,
      }}>{item.status}</span>
      <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted }}>
        {item.duration}ms
      </span>
    </div>
  );
}

export default function ApiScraperPage() {
  const { selectedBot, api } = useSession();
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState([{ key: "Content-Type", value: "application/json" }]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(true);

  const addHeader = () => setHeaders(h => [...h, { key: "", value: "" }]);
  const updateHeader = (i, hdr) => setHeaders(h => h.map((x, j) => j === i ? hdr : x));
  const removeHeader = (i) => setHeaders(h => h.filter((_, j) => j !== i));

  const handleSend = useCallback(async () => {
    if (!url.trim()) { toast.error("Enter a URL"); return; }
    setSending(true);
    setResponse(null);
    const startTime = Date.now();
    try {
      const reqHeaders = {};
      headers.forEach(h => { if (h.key.trim()) reqHeaders[h.key.trim()] = h.value; });

      const fetchOpts = {
        method,
        headers: reqHeaders,
      };
      if (method !== "GET" && method !== "DELETE" && body.trim()) {
        fetchOpts.body = body;
      }

      const res = await fetch(url.trim(), fetchOpts);
      const duration = Date.now() - startTime;
      const resHeaders = {};
      res.headers.forEach((v, k) => { resHeaders[k] = v; });
      let resBody;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("json")) {
        resBody = await res.json();
      } else {
        resBody = await res.text();
      }

      const bodyStr = typeof resBody === "string" ? resBody : JSON.stringify(resBody);
      const size = bodyStr.length > 1024 ? `${(bodyStr.length / 1024).toFixed(1)} KB` : `${bodyStr.length} B`;

      const result = {
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
        body: resBody,
        duration,
        size,
      };
      setResponse(result);
      setHistory(h => [{ method, url: url.trim(), status: res.status, duration, timestamp: new Date() }, ...h].slice(0, 50));
    } catch (err) {
      const duration = Date.now() - startTime;
      setResponse({
        status: 0,
        statusText: "Network Error",
        headers: {},
        body: `Request failed: ${err.message}\n\nNote: Cross-origin requests may be blocked by CORS. Consider testing from your backend or using a CORS proxy.`,
        duration,
        size: "0 B",
      });
    }
    finally { setSending(false); }
  }, [method, url, headers, body]);

  const loadFromHistory = (item) => {
    setMethod(item.method);
    setUrl(item.url);
  };

  return (
    <div style={T.page} data-testid="api-scraper-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <p style={T.overline}>Developer Tools</p>
          <h1 style={{ ...T.h1, marginBottom: 0 }}>API Scraper</h1>
          <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, marginTop: "4px" }}>
            Test API endpoints, inspect responses, and debug integrations.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: showHistory ? "1fr 260px" : "1fr", gap: "16px", alignItems: "start" }}>
        {/* Main request panel */}
        <div>
          {/* URL bar */}
          <div style={{ ...T.card, padding: "14px 16px", marginBottom: "12px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <select value={method} onChange={e => setMethod(e.target.value)} data-testid="api-method"
                style={{
                  ...T.input, width: "110px", padding: "10px 10px",
                  fontFamily: fonts.mono, fontSize: "13px", fontWeight: "700",
                  color: METHOD_COLORS[method] || colors.text.primary,
                }}>
                {HTTP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input value={url} onChange={e => setUrl(e.target.value)} data-testid="api-url"
                placeholder="https://api.example.com/endpoint"
                style={{ ...T.input, flex: 1, fontFamily: fonts.mono, fontSize: "13px" }}
                onFocus={onFocus} onBlur={onBlur}
                onKeyDown={e => e.key === "Enter" && handleSend()} />
              <button onClick={handleSend} disabled={sending} data-testid="send-request-btn"
                style={{ ...T.btnPrimary, padding: "10px 20px", minWidth: "100px" }}>
                {sending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={14} />}
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>

          {/* Headers section */}
          <div style={{ ...T.card, padding: "14px 16px", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>
                Headers
              </p>
              <button onClick={addHeader} data-testid="add-header-btn"
                style={{ ...T.btnGhost, padding: "3px 8px", fontSize: "10px" }}>
                <Plus size={10} /> Add
              </button>
            </div>
            {headers.map((h, i) => (
              <HeaderRow key={i} header={h} onChange={hdr => updateHeader(i, hdr)} onRemove={() => removeHeader(i)} />
            ))}
          </div>

          {/* Body section */}
          {method !== "GET" && (
            <div style={{ ...T.card, padding: "14px 16px", marginBottom: "12px" }}>
              <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 8px" }}>
                Request Body
              </p>
              <textarea value={body} onChange={e => setBody(e.target.value)} data-testid="api-body"
                rows={6} placeholder='{"key": "value"}'
                style={{ ...T.textarea, fontFamily: fonts.mono, fontSize: "12px" }}
                onFocus={onFocus} onBlur={onBlur} />
            </div>
          )}

          {/* Response */}
          {(response || sending) && (
            <div style={{ ...T.card, padding: "14px 16px" }}>
              <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>
                Response
              </p>
              {sending ? (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <Loader2 size={16} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : (
                <ResponseDisplay response={response} />
              )}
            </div>
          )}
        </div>

        {/* History sidebar */}
        {showHistory && (
          <div style={T.card} data-testid="request-history">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>
                <Clock size={10} style={{ verticalAlign: "middle", marginRight: "4px" }} /> History
              </p>
              {history.length > 0 && (
                <button onClick={() => setHistory([])} data-testid="clear-history-btn"
                  style={{ ...T.btnGhost, padding: "2px 6px", fontSize: "9px" }}>
                  Clear
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, textAlign: "center", padding: "16px 0" }}>
                No requests yet.
              </p>
            ) : (
              <div style={{ maxHeight: "500px", overflowY: "auto" }}>
                {history.map((item, i) => (
                  <HistoryItem key={i} item={item} onClick={() => loadFromHistory(item)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
