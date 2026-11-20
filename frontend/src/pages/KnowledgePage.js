/**
 * Knowledge management — sources, document uploads, website importing, crawling.
 * Grouped documents by domain for URL/crawl sources with expandable sections.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession } from "../context/SessionContext";
import {
  BookOpen, Plus, Trash2, Upload, Globe, FileText, ChevronDown, ChevronRight,
  Loader2, CheckCircle, XCircle, RefreshCw, Eye, Download, AlertTriangle,
  ExternalLink, FolderOpen,
} from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur, rowEnter, rowLeave } from "../theme";
import { toast } from "sonner";

function SourceCard({ source, api, onRefresh, onSelect, selected }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete source "${source.name}"?`)) return;
    setDeleting(true);
    try {
      await api.deleteSource(source.id);
      toast.success("Source deleted"); onRefresh();
    } catch (err) { toast.error(err.detail || "Failed to delete"); }
    finally { setDeleting(false); }
  };

  const docCount = source.document_count ?? source.documents?.length ?? "?";
  const isUrl = source.kind === "url" || source.kind === "website" || source.kind === "crawl";

  return (
    <div data-testid={`source-${source.id}`}
      style={{
        ...T.card, padding: "14px 18px", marginBottom: "6px",
        cursor: "pointer", transition: "all 0.15s",
        borderColor: selected ? colors.brand.light : colors.border.default,
        backgroundColor: selected ? "rgba(59,130,246,0.04)" : colors.bg.surface,
      }}
      onClick={() => onSelect(source)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {isUrl ? <Globe size={15} color="#60A5FA" /> : <FileText size={15} color="#34D399" />}
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
            {source.name}
          </p>
          <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "2px 0 0" }}>
            {source.kind || "file"} • {docCount} document{docCount !== 1 ? "s" : ""}
            {source.state && source.state !== "active" && ` • ${source.state}`}
          </p>
        </div>
        <button onClick={e => { e.stopPropagation(); handleDelete(); }} disabled={deleting}
          style={{ ...T.btnGhost, padding: "4px 6px", color: colors.text.muted }}>
          {deleting ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={12} />}
        </button>
      </div>
    </div>
  );
}

function DocumentRow({ doc, api, onRefresh }) {
  const [reprocessing, setReprocessing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      await api.reprocessDocument(doc.id);
      toast.success("Reprocessing started"); onRefresh();
    } catch (err) { toast.error(err.detail || "Reprocess failed"); }
    finally { setReprocessing(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteDocument(doc.id);
      toast.success("Document deleted"); onRefresh();
    } catch (err) { toast.error(err.detail || "Delete failed"); }
    finally { setDeleting(false); }
  };

  const statusColor = doc.state === "ready" ? colors.brand.success :
    doc.state === "processing" ? colors.brand.warning :
    doc.state === "error" ? colors.brand.error : colors.text.muted;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "8px 12px", borderRadius: radius.sm,
      transition: "background-color 0.1s",
    }} onMouseEnter={rowEnter} onMouseLeave={rowLeave}>
      <FileText size={13} color={colors.text.muted} />
      <span style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.primary, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {doc.name}
      </span>
      <span style={{
        fontFamily: fonts.mono, fontSize: "9px", fontWeight: "600",
        padding: "2px 7px", borderRadius: radius.full,
        color: statusColor, backgroundColor: `${statusColor}14`,
        textTransform: "uppercase",
      }}>{doc.state || "ready"}</span>
      <button onClick={handleReprocess} disabled={reprocessing} title="Reprocess"
        style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex" }}>
        {reprocessing ? <Loader2 size={12} color={colors.text.muted} style={{ animation: "spin 1s linear infinite" }} /> :
          <RefreshCw size={12} color={colors.text.muted} />}
      </button>
      <button onClick={handleDelete} disabled={deleting} title="Delete"
        style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex" }}>
        {deleting ? <Loader2 size={12} color={colors.text.muted} style={{ animation: "spin 1s linear infinite" }} /> :
          <Trash2 size={12} color={colors.text.muted} />}
      </button>
    </div>
  );
}

function DomainGroup({ domain, docs, api, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const readyCount = docs.filter(d => d.state === "ready").length;
  const processingCount = docs.filter(d => d.state === "processing").length;
  const errorCount = docs.filter(d => d.state === "error").length;

  return (
    <div style={{ marginBottom: "4px" }}>
      <div data-testid={`domain-group-${domain}`}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "8px 12px", borderRadius: radius.sm,
          cursor: "pointer", transition: "background-color 0.1s",
          backgroundColor: expanded ? colors.bg.hover : "transparent",
        }}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.backgroundColor = colors.bg.hover; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        {expanded ? <ChevronDown size={12} color={colors.brand.light} /> : <ChevronRight size={12} color={colors.text.muted} />}
        <Globe size={12} color="#60A5FA" />
        <span style={{
          fontFamily: fonts.body, fontSize: "12px", fontWeight: "500",
          color: colors.text.primary, flex: 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {domain}
        </span>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {readyCount > 0 && (
            <span style={{
              fontFamily: fonts.mono, fontSize: "9px", fontWeight: "600",
              padding: "1px 6px", borderRadius: radius.full,
              color: colors.brand.success, backgroundColor: "rgba(52,211,153,0.1)",
            }}>{readyCount}</span>
          )}
          {processingCount > 0 && (
            <span style={{
              fontFamily: fonts.mono, fontSize: "9px", fontWeight: "600",
              padding: "1px 6px", borderRadius: radius.full,
              color: colors.brand.warning, backgroundColor: "rgba(251,191,36,0.1)",
            }}>{processingCount}</span>
          )}
          {errorCount > 0 && (
            <span style={{
              fontFamily: fonts.mono, fontSize: "9px", fontWeight: "600",
              padding: "1px 6px", borderRadius: radius.full,
              color: colors.brand.error, backgroundColor: "rgba(244,63,94,0.1)",
            }}>{errorCount}</span>
          )}
          <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted }}>
            {docs.length} page{docs.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      {expanded && (
        <div style={{ paddingLeft: "32px" }}>
          {docs.map(d => <DocumentRow key={d.id} doc={d} api={api} onRefresh={onRefresh} />)}
        </div>
      )}
    </div>
  );
}

function DocumentsPanel({ selectedSource, documents, docsLoading, api, fetchDocs, uploading, handleFileUpload, fileRef }) {
  // Group documents by domain for URL/crawl sources
  const isUrlSource = selectedSource?.kind === "url" || selectedSource?.kind === "website" || selectedSource?.kind === "crawl";

  const groupedByDomain = useMemo(() => {
    if (!isUrlSource || !documents.length) return null;
    const groups = {};
    documents.forEach(doc => {
      let domain = "Other";
      try {
        const urlStr = doc.url || doc.name || "";
        if (urlStr.startsWith("http")) {
          domain = new URL(urlStr).hostname;
        } else if (urlStr.includes("/")) {
          // Try to extract domain-like pattern
          const parts = urlStr.split("/");
          if (parts[0].includes(".")) domain = parts[0];
        }
      } catch {}
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(doc);
    });
    // Sort domains alphabetically
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [documents, isUrlSource]);

  if (!selectedSource) {
    return (
      <div style={T.card}>
        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.muted, textAlign: "center", padding: "32px" }}>
          Select a source to view its documents.
        </p>
      </div>
    );
  }

  return (
    <div style={T.card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <div>
          <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
            {selectedSource.name}
          </p>
          <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "2px 0 0" }}>
            {selectedSource.kind || "file"} source • {documents.length} document{documents.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {(selectedSource.kind === "file" || !selectedSource.kind) && (
            <label data-testid="upload-document-btn"
              style={{ ...T.btnPrimary, cursor: "pointer", fontSize: "12px", padding: "8px 14px", opacity: uploading ? 0.6 : 1 }}>
              {uploading ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={12} />}
              {uploading ? "Uploading..." : "Upload"}
              <input ref={fileRef} type="file" onChange={handleFileUpload} style={{ display: "none" }} disabled={uploading}
                accept=".pdf,.txt,.md,.doc,.docx,.csv,.json,.html,.xml" />
            </label>
          )}
        </div>
      </div>

      {docsLoading ? (
        <div style={{ textAlign: "center", padding: "20px" }}>
          <Loader2 size={16} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : documents.length === 0 ? (
        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.muted, textAlign: "center", padding: "20px" }}>
          No documents in this source. {selectedSource.kind === "file" ? "Upload files to add knowledge." : "Documents will appear after processing."}
        </p>
      ) : isUrlSource && groupedByDomain ? (
        // Grouped view for URL sources
        <div data-testid="grouped-documents">
          <div style={{
            display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px",
            padding: "6px 10px", borderRadius: radius.sm,
            backgroundColor: "rgba(59,130,246,0.04)",
          }}>
            <FolderOpen size={11} color={colors.brand.light} />
            <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.brand.light, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              {groupedByDomain.length} domain{groupedByDomain.length !== 1 ? "s" : ""} • {documents.length} pages
            </span>
          </div>
          {groupedByDomain.map(([domain, docs]) => (
            <DomainGroup key={domain} domain={domain} docs={docs} api={api} onRefresh={() => fetchDocs(selectedSource)} />
          ))}
        </div>
      ) : (
        // Flat list for file sources
        <div style={{ display: "grid", gap: "2px" }}>
          {documents.map(d => <DocumentRow key={d.id} doc={d} api={api} onRefresh={() => fetchDocs(selectedSource)} />)}
        </div>
      )}
    </div>
  );
}

export default function KnowledgePage() {
  const { selectedOrg, selectedEnterprise, api } = useSession();
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
  const [scope, setScope] = useState("organisation");

  const ownerId = scope === "enterprise" ? selectedEnterprise?.id : selectedOrg?.id;
  const ownerType = scope === "enterprise" ? "enterprise" : "organisation";

  const fetchSources = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const data = await api.sources(ownerType, ownerId);
      setSources(data.sources || data || []);
    } catch { setSources([]); }
    finally { setLoading(false); }
  }, [ownerId, ownerType, api]);

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
    if (!sourceName.trim() || !ownerId) return;
    setCreating(true);
    try {
      const body = { name: sourceName.trim(), kind: createKind };
      if (createKind === "url" || createKind === "website") body.url = sourceUrl;
      if (createKind === "crawl") { body.url = sourceUrl; body.crawl_depth = crawlDepth; }
      await api.createSource(ownerType, ownerId, body);
      toast.success(`Source "${sourceName.trim()}" created`);
      setSourceName(""); setSourceUrl(""); setShowCreate(false);
      fetchSources();
    } catch (err) { toast.error(err.detail || "Failed to create source"); }
    finally { setCreating(false); }
  };

  const handleFileUpload = async (e) => {
    if (!selectedSource || !e.target.files?.length) return;
    const file = e.target.files[0];
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) { toast.error("File too large (max 10 MB)"); return; }
    setUploading(true);
    try {
      await api.uploadDocument(selectedSource.id, file.name, file);
      toast.success(`"${file.name}" uploaded`);
      fetchDocs(selectedSource);
    } catch (err) { toast.error(err.detail || "Upload failed"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  if (!selectedOrg && !selectedEnterprise) {
    return (
      <div style={{ ...T.page, textAlign: "center", paddingTop: "80px" }}>
        <BookOpen size={32} color={colors.border.default} style={{ margin: "0 auto 12px" }} />
        <p style={{ fontFamily: fonts.heading, fontSize: "18px", fontWeight: "600", color: colors.text.primary }}>Select an enterprise or organisation</p>
      </div>
    );
  }

  return (
    <div style={T.page} data-testid="knowledge-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <p style={T.overline}>Knowledge Management</p>
          <h1 style={{ ...T.h1, marginBottom: 0 }}>Knowledge</h1>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select value={scope} onChange={e => setScope(e.target.value)} data-testid="knowledge-scope-select"
            style={{ ...T.input, width: "auto", padding: "8px 12px", fontSize: "12px" }}>
            <option value="organisation">Organisation</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <button onClick={() => setShowCreate(true)} data-testid="create-source-btn" style={T.btnPrimary}>
            <Plus size={14} /> New Source
          </button>
        </div>
      </div>

      {/* Create source modal */}
      {showCreate && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        }} onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div data-testid="create-source-modal" style={{
            width: "460px", backgroundColor: colors.bg.panel, borderRadius: "16px",
            border: `1px solid ${colors.border.default}`, padding: "28px",
          }}>
            <h2 style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: "0 0 16px" }}>
              New Knowledge Source
            </h2>
            <label style={T.label}>Name</label>
            <input value={sourceName} onChange={e => setSourceName(e.target.value)} data-testid="source-name"
              placeholder="e.g. Product Documentation" style={{ ...T.input, marginBottom: "12px" }} onFocus={onFocus} onBlur={onBlur} />
            <label style={T.label}>Type</label>
            <select value={createKind} onChange={e => setCreateKind(e.target.value)} data-testid="source-kind"
              style={{ ...T.input, marginBottom: "12px" }}>
              <option value="file">File Upload</option>
              <option value="url">Single URL</option>
              <option value="website">Website (single page)</option>
              <option value="crawl">Website Crawl (multi-page)</option>
            </select>
            {(createKind === "url" || createKind === "website" || createKind === "crawl") && (
              <>
                <label style={T.label}>URL</label>
                <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} data-testid="source-url"
                  placeholder="https://docs.example.com" style={{ ...T.input, marginBottom: "12px" }} onFocus={onFocus} onBlur={onBlur} />
              </>
            )}
            {createKind === "crawl" && (
              <>
                <label style={T.label}>Crawl Depth</label>
                <input value={crawlDepth} onChange={e => setCrawlDepth(Number(e.target.value))} type="number" min="1" max="5"
                  data-testid="source-crawl-depth"
                  style={{ ...T.input, marginBottom: "12px", width: "80px" }} onFocus={onFocus} onBlur={onBlur} />
                <p style={T.hint}>How many levels deep to crawl from the starting URL (1-5).</p>
              </>
            )}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
              <button onClick={() => setShowCreate(false)} style={T.btnGhost}>Cancel</button>
              <button onClick={handleCreateSource} disabled={creating || !sourceName.trim()} data-testid="confirm-create-source"
                style={{ ...T.btnPrimary, opacity: creating || !sourceName.trim() ? 0.6 : 1 }}>
                {creating ? "Creating..." : "Create Source"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "16px", alignItems: "start" }}>
        {/* Sources list */}
        <div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <Loader2 size={20} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : sources.length === 0 ? (
            <div style={{ ...T.card, textAlign: "center", padding: "32px 20px" }}>
              <BookOpen size={24} color={colors.border.default} style={{ margin: "0 auto 10px" }} />
              <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary }}>No sources yet. Create one to add knowledge.</p>
            </div>
          ) : (
            sources.map(s => (
              <SourceCard key={s.id} source={s} api={api} onRefresh={fetchSources}
                onSelect={setSelectedSource} selected={selectedSource?.id === s.id} />
            ))
          )}
        </div>

        {/* Documents panel — enhanced with grouped view */}
        <DocumentsPanel
          selectedSource={selectedSource}
          documents={documents}
          docsLoading={docsLoading}
          api={api}
          fetchDocs={fetchDocs}
          uploading={uploading}
          handleFileUpload={handleFileUpload}
          fileRef={fileRef}
        />
      </div>
    </div>
  );
}
