import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../utils/api";
import { toast } from "sonner";
import { ArrowLeft, Search, FileText, Globe, Layers, Copy, Check, AlertTriangle } from "lucide-react";
import { colors, fonts, T } from "../theme";

function CharStats({ content }) {
  const stats = useMemo(() => {
    if (!content) return null;
    const chars = content.length;
    const words = content.split(/\s+/).filter(Boolean).length;
    const lines = content.split("\n").length;
    const nulls = (content.match(/\x00/g) || []).length;
    const replacements = (content.match(/\ufffd/g) || []).length;
    return { chars, words, lines, nulls, replacements };
  }, [content]);
  if (!stats) return null;

  const hasIssues = stats.nulls > 0 || stats.replacements > 0;
  return (
    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
      <Stat label="Characters" value={stats.chars.toLocaleString()} />
      <Stat label="Words" value={stats.words.toLocaleString()} />
      <Stat label="Lines" value={stats.lines.toLocaleString()} />
      {hasIssues && (
        <div style={{
          display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px",
          borderRadius: "8px", backgroundColor: "rgba(244,63,94,0.1)",
          border: "1px solid rgba(244,63,94,0.3)",
        }}>
          <AlertTriangle size={12} color={colors.brand.error} />
          <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.brand.error }}>
            {stats.nulls > 0 && `${stats.nulls} null bytes`}
            {stats.nulls > 0 && stats.replacements > 0 && " + "}
            {stats.replacements > 0 && `${stats.replacements} replacement chars`}
            {" "}-- content may be corrupted
          </span>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
      <span style={{ fontFamily: fonts.mono, fontSize: "13px", fontWeight: "600", color: colors.text.primary }}>{value}</span>
      <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

function HighlightedContent({ content, searchTerm }) {
  if (!searchTerm || !content) {
    return <pre style={preStyle}>{content}</pre>;
  }

  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = content.split(regex);
  const matches = content.match(regex) || [];

  return (
    <pre style={preStyle}>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} style={{ backgroundColor: "rgba(96,165,250,0.3)", color: colors.text.primary, borderRadius: "2px", padding: "0 1px" }}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
      {matches.length > 0 && (
        <div style={{
          position: "sticky", bottom: "8px", float: "right",
          padding: "4px 10px", borderRadius: "6px",
          backgroundColor: colors.bg.surface, border: `1px solid ${colors.border.default}`,
          fontFamily: fonts.mono, fontSize: "11px", color: colors.text.secondary,
        }}>
          {matches.length} match{matches.length !== 1 ? "es" : ""}
        </div>
      )}
    </pre>
  );
}

const preStyle = {
  fontFamily: fonts.mono,
  fontSize: "13px",
  lineHeight: "1.65",
  color: colors.text.primary,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  margin: 0,
  padding: "20px",
  backgroundColor: colors.bg.base,
  borderRadius: "10px",
  border: `1px solid ${colors.border.subtle}`,
  maxHeight: "calc(100vh - 320px)",
  overflowY: "auto",
};

export default function KnowledgeContentViewer() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sourceId = params.get("id");
  const groupId = params.get("group");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [activePart, setActivePart] = useState(0);

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      try {
        if (groupId) {
          const r = await api.get(`/knowledge/sources/group/${encodeURIComponent(groupId)}/content`);
          setData({ ...r.data, isGroup: true });
        } else if (sourceId) {
          const r = await api.get(`/knowledge/sources/${sourceId}/content`);
          setData({ ...r.data, isGroup: false, parts: [{ id: r.data.id, title: r.data.title, content: r.data.content, char_count: (r.data.content || "").length }] });
        }
      } catch (e) {
        toast.error(e.response?.data?.detail || "Failed to load content");
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [sourceId, groupId]);

  const currentContent = data?.parts?.[activePart]?.content || "";
  const fullContent = data?.parts?.map(p => p.content).join("\n\n---\n\n") || "";

  const handleCopy = () => {
    navigator.clipboard.writeText(fullContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ ...T.page, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ fontFamily: fonts.body, color: colors.text.secondary }}>Loading content...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ ...T.page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "16px" }}>
        <div style={{ fontFamily: fonts.body, color: colors.text.secondary }}>Content not found</div>
        <button onClick={() => navigate("/admin/knowledge")} style={T.btnGhost}>
          <ArrowLeft size={14} /> Back to Knowledge Base
        </button>
      </div>
    );
  }

  return (
    <div style={T.page}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
        <button
          onClick={() => navigate("/admin/knowledge")}
          data-testid="back-to-kb-btn"
          style={{
            background: "none", border: `1px solid ${colors.border.default}`, borderRadius: "8px",
            cursor: "pointer", color: colors.text.secondary, padding: "6px 10px",
            display: "flex", alignItems: "center", gap: "5px", fontFamily: fonts.body, fontSize: "12px",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = colors.brand.cyan; e.currentTarget.style.color = colors.brand.cyan; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border.default; e.currentTarget.style.color = colors.text.secondary; }}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {data.type === "url" ? <Globe size={14} color={colors.brand.success} /> : <FileText size={14} color={colors.text.secondary} />}
          <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase" }}>{data.type}</span>
        </div>
      </div>

      <h1 style={{ ...T.h1, fontSize: "22px", marginBottom: "4px" }}>{data.title}</h1>
      {data.url && (
        <a href={data.url} target="_blank" rel="noopener noreferrer" style={{
          fontFamily: fonts.mono, fontSize: "11px", color: colors.brand.light,
          textDecoration: "none", display: "block", marginBottom: "16px",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {data.url}
        </a>
      )}

      {/* Stats bar */}
      <div style={{
        ...T.card, padding: "14px 20px", marginBottom: "16px",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px",
      }}>
        <CharStats content={fullContent} />
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {data.parts?.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Layers size={12} color={colors.brand.light} />
              <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.brand.light }}>{data.parts.length} parts</span>
            </div>
          )}
          <button onClick={handleCopy} data-testid="copy-content-btn" style={{
            ...T.btnGhost, padding: "5px 12px", fontSize: "11px",
            display: "flex", alignItems: "center", gap: "5px",
          }}>
            {copied ? <Check size={12} color={colors.brand.success} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy All"}
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "16px" }}>
        <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: colors.text.muted }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search within content..."
          data-testid="content-search-input"
          style={{ ...T.input, paddingLeft: "34px" }}
        />
      </div>

      {/* Part tabs for multi-part sources */}
      {data.parts?.length > 1 && (
        <div style={{
          display: "flex", gap: "2px", marginBottom: "12px",
          overflowX: "auto", paddingBottom: "4px",
        }}>
          {data.parts.map((part, i) => (
            <button
              key={part.id}
              onClick={() => setActivePart(i)}
              data-testid={`part-tab-${i}`}
              style={{
                padding: "6px 14px", borderRadius: "6px", fontSize: "11px", fontFamily: fonts.mono,
                border: `1px solid ${activePart === i ? colors.brand.cyan : colors.border.default}`,
                backgroundColor: activePart === i ? "rgba(96,165,250,0.08)" : "transparent",
                color: activePart === i ? colors.brand.cyan : colors.text.secondary,
                cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s",
              }}
            >
              Part {i + 1}
              <span style={{ marginLeft: "6px", fontSize: "9px", opacity: 0.6 }}>
                {(part.char_count / 1000).toFixed(1)}k
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Content display */}
      <HighlightedContent content={currentContent} searchTerm={search} />

      {/* Character limits info */}
      <div style={{
        ...T.card, marginTop: "20px", padding: "16px 20px",
        backgroundColor: "rgba(96,165,250,0.04)", borderColor: "rgba(96,165,250,0.15)",
      }}>
        <p style={{ fontFamily: fonts.heading, fontSize: "12px", fontWeight: "600", color: colors.brand.light, margin: "0 0 8px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          How the bot uses this content
        </p>
        <div style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 4px 0" }}>
            <strong style={{ color: colors.text.primary }}>Chunk size:</strong> Large pages are split into ~8,000 character chunks for storage.
          </p>
          <p style={{ margin: "0 0 4px 0" }}>
            <strong style={{ color: colors.text.primary }}>Search:</strong> When a user asks a question, the top 5 most relevant chunks are retrieved via text search.
          </p>
          <p style={{ margin: "0 0 4px 0" }}>
            <strong style={{ color: colors.text.primary }}>Context window:</strong> Up to 60,000 characters of KB content are injected into each prompt.
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: colors.text.primary }}>Per-source limit:</strong> Non-chunked sources are capped at 2,500 characters per query. Multi-part (chunked) sources include full content.
          </p>
        </div>
      </div>
    </div>
  );
}
