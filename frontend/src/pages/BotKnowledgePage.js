/**
 * BotKnowledge — knowledge sources assigned to a specific bot.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import {
  BookOpen, Plus, Trash2, Upload, Globe, FileText, Loader2, RefreshCw,
} from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur, rowEnter, rowLeave } from "../theme";
import { toast } from "sonner";

export default function BotKnowledgePage() {
  const { botId } = useParams();
  const { api } = useSession();
  const [bot, setBot] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createKind, setCreateKind] = useState("file");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [crawlDepth, setCrawlDepth] = useState(1);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const fetchSources = useCallback(async () => {
    if (!botId) return;
    setLoading(true);
    try {
      const [botData, data] = await Promise.all([
        api.bot(botId).catch(() => null),
        api.sources("bot", botId).catch(() => ({ sources: [] })),
      ]);
      if (botData) setBot(botData);
      setSources(data.sources || data || []);
    } catch { setSources([]); }
    finally { setLoading(false); }
  }, [botId, api]);

  const fetchDocs = useCallback(async (src) => {
    if (!src) { setDocuments([]); return; }
    setDocsLoading(true);
    try {
      const data = await api.documents(src.id);
      setDocuments(data.documents || data || []);
    } catch { setDocuments([]); }
    finally { setDocsLoading(false); }
  }, [api]);

  useEffect(() => { fetchSources(); }, [fetchSources]);
  useEffect(() => { fetchDocs(selectedSource); }, [selectedSource, fetchDocs]);

  const handleCreateSource = async () => {
    if (!sourceName.trim() || !botId) return;
    setCreating(true);
    try {
      const body = { name: sourceName.trim(), kind: createKind };
      if (createKind !== "file") body.url = sourceUrl;
      if (createKind === "crawl") body.crawl_depth = crawlDepth;
      await api.createSource("bot", botId, body);
      toast.success(`Source "${sourceName.trim()}" created`);
      setSourceName(""); setSourceUrl(""); setShowCreate(false);
      fetchSources();
    } catch (err) { toast.error(err.detail || "Failed to create source"); }
    finally { setCreating(false); }
  };

  const handleFileUpload = async (e) => {
    if (!selectedSource || !e.target.files?.length) return;
    const file = e.target.files[0];
    if (file.size > 10 * 1024 * 1024) { toast.error("File too large (max 10 MB)"); return; }
    setUploading(true);
    try {
      await api.uploadDocument(selectedSource.id, file.name, file);
      toast.success(`"${file.name}" uploaded`);
      fetchDocs(selectedSource);
    } catch (err) { toast.error(err.detail || "Upload failed"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const handleDeleteSource = async (sourceId) => {
    try {
      await api.deleteSource(sourceId);
      toast.success("Source deleted");
      if (selectedSource?.id === sourceId) setSelectedSource(null);
      fetchSources();
    } catch (err) { toast.error(err.detail || "Delete failed"); }
  };

  if (loading) {
    return (
      <div style={{ ...T.page, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "100px" }}>
        <Loader2 size={20} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={T.page} data-testid="bot-knowledge-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <p style={T.overline}>{bot?.name || "Bot"}</p>
          <h1 style={{ ...T.h1, marginBottom: 0 }}>Knowledge Base</h1>
        </div>
        <button onClick={() => setShowCreate(true)} data-testid="create-bot-source-btn" style={T.btnPrimary}>
          <Plus size={14} /> New Source
        </button>
      </div>

      {showCreate && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        }} onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div data-testid="create-bot-source-modal" style={{
            width: "460px", backgroundColor: colors.bg.panel, borderRadius: "16px",
            border: `1px solid ${colors.border.default}`, padding: "28px",
          }}>
            <h2 style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: "0 0 16px" }}>
              New Knowledge Source
            </h2>
            <label style={T.label}>Name</label>
            <input value={sourceName} onChange={e => setSourceName(e.target.value)}
              placeholder="e.g. Product FAQ" style={{ ...T.input, marginBottom: "12px" }} onFocus={onFocus} onBlur={onBlur} />
            <label style={T.label}>Type</label>
            <select value={createKind} onChange={e => setCreateKind(e.target.value)}
              style={{ ...T.input, marginBottom: "12px" }}>
              <option value="file">File Upload</option>
              <option value="url">Single URL</option>
              <option value="website">Website (single page)</option>
              <option value="crawl">Website Crawl (multi-page)</option>
            </select>
            {createKind !== "file" && (
              <>
                <label style={T.label}>URL</label>
                <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}
                  placeholder="https://docs.example.com" style={{ ...T.input, marginBottom: "12px" }} onFocus={onFocus} onBlur={onBlur} />
              </>
            )}
            {createKind === "crawl" && (
              <>
                <label style={T.label}>Crawl Depth (1-5)</label>
                <input value={crawlDepth} onChange={e => setCrawlDepth(Number(e.target.value))} type="number" min="1" max="5"
                  style={{ ...T.input, width: "80px", marginBottom: "12px" }} onFocus={onFocus} onBlur={onBlur} />
              </>
            )}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "8px" }}>
              <button onClick={() => setShowCreate(false)} style={T.btnGhost}>Cancel</button>
              <button onClick={handleCreateSource} disabled={creating || !sourceName.trim()}
                style={{ ...T.btnPrimary, opacity: creating || !sourceName.trim() ? 0.6 : 1 }}>
                {creating ? "Creating..." : "Create Source"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "16px", alignItems: "start" }}>
        <div>
          {sources.length === 0 ? (
            <div style={{ ...T.card, textAlign: "center", padding: "32px 20px" }}>
              <BookOpen size={24} color={colors.border.default} style={{ margin: "0 auto 10px" }} />
              <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary }}>No knowledge sources. Add one to teach your bot.</p>
            </div>
          ) : (
            sources.map(s => {
              const isUrl = s.kind === "url" || s.kind === "website" || s.kind === "crawl";
              return (
                <div key={s.id} style={{
                  ...T.card, padding: "12px 16px", marginBottom: "6px", cursor: "pointer", transition: "all 0.15s",
                  borderColor: selectedSource?.id === s.id ? colors.brand.light : colors.border.default,
                }} onClick={() => setSelectedSource(s)}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {isUrl ? <Globe size={14} color="#60A5FA" /> : <FileText size={14} color="#34D399" />}
                    <span style={{ flex: 1, fontFamily: fonts.heading, fontSize: "12px", fontWeight: "600", color: colors.text.primary }}>
                      {s.name}
                    </span>
                    <button onClick={e => { e.stopPropagation(); handleDeleteSource(s.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex" }}>
                      <Trash2 size={11} color={colors.text.muted} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={T.card}>
          {selectedSource ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
                  {selectedSource.name}
                </p>
                {(!selectedSource.kind || selectedSource.kind === "file") && (
                  <label style={{ ...T.btnPrimary, cursor: "pointer", fontSize: "12px", padding: "7px 12px" }}>
                    <Upload size={12} /> {uploading ? "Uploading..." : "Upload"}
                    <input ref={fileRef} type="file" onChange={handleFileUpload} style={{ display: "none" }} disabled={uploading}
                      accept=".pdf,.txt,.md,.doc,.docx,.csv,.json,.html,.xml" />
                  </label>
                )}
              </div>
              {docsLoading ? (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <Loader2 size={16} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : documents.length === 0 ? (
                <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.muted, textAlign: "center", padding: "20px" }}>
                  No documents yet.
                </p>
              ) : (
                <div style={{ display: "grid", gap: "2px" }}>
                  {documents.map(d => {
                    const statusColor = d.state === "ready" ? colors.brand.success :
                      d.state === "processing" ? colors.brand.warning : colors.text.muted;
                    return (
                      <div key={d.id} style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        padding: "7px 10px", borderRadius: radius.sm, transition: "background-color 0.1s",
                      }} onMouseEnter={rowEnter} onMouseLeave={rowLeave}>
                        <FileText size={12} color={colors.text.muted} />
                        <span style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.primary, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.name}
                        </span>
                        <span style={{
                          fontFamily: fonts.mono, fontSize: "9px", fontWeight: "600",
                          padding: "2px 6px", borderRadius: radius.full,
                          color: statusColor, backgroundColor: `${statusColor}14`, textTransform: "uppercase",
                        }}>{d.state || "ready"}</span>
                        <button onClick={() => api.deleteDocument(d.id).then(() => { toast.success("Deleted"); fetchDocs(selectedSource); }).catch(err => toast.error(err.detail || "Failed"))}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex" }}>
                          <Trash2 size={11} color={colors.text.muted} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.muted, textAlign: "center", padding: "32px" }}>
              Select a source to view documents.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
