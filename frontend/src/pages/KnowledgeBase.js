import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import v2 from "../utils/v2api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Plus, Trash2, Globe, FileText, HelpCircle, ToggleLeft, ToggleRight, Loader2, ChevronUp, ChevronDown, ChevronRight, ArrowUpCircle, Pencil, X, Save, Lock, Tag, Calendar, Layers, Filter, Eye, Network, RefreshCw, FolderOpen, FolderClosed, Download, Upload, Share2, Github, Check, Zap } from "lucide-react";
import { colors, fonts, T, onFocus, onBlur, rowEnter, rowLeave } from "../theme";
import ApiIntegrations from "./ApiIntegrations";

const typeIcon = { faq: HelpCircle, url: Globe, document: FileText, github: Github };
const typeColor = { faq: colors.brand.blue, url: colors.brand.success, document: colors.text.secondary, github: "rgba(139,92,246,0.9)" };

const PRIORITY_LEVELS = [
  { value: 0, label: "Normal", color: colors.text.secondary },
  { value: 1, label: "Medium", color: colors.brand.warning },
  { value: 2, label: "High", color: colors.brand.error },
];

function TypeBadge({ type }) {
  const Icon = typeIcon[type] || HelpCircle;
  const c = typeColor[type] || colors.brand.blue;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px", padding: "2px 8px", borderRadius: "10px",
      fontSize: "11px", fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.05em",
      backgroundColor: `${c}18`, color: c
    }}>
      <Icon size={10} />{type}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const level = PRIORITY_LEVELS.find(p => p.value === priority) || PRIORITY_LEVELS[0];
  return (
    <span data-testid="priority-badge" style={{
      display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "10px",
      fontSize: "11px", fontFamily: fonts.mono, letterSpacing: "0.03em",
      backgroundColor: `${level.color}18`, color: level.color
    }}>
      {priority >= 2 && <ArrowUpCircle size={10} />}
      {level.label}
    </span>
  );
}

function PrioritySelector({ value, onChange, style }) {
  return (
    <div style={{ display: "flex", gap: "6px", ...style }}>
      {PRIORITY_LEVELS.map(({ value: v, label, color }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          data-testid={`priority-${label.toLowerCase()}`}
          style={{
            padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontFamily: fonts.body,
            fontWeight: value === v ? "600" : "400", cursor: "pointer", transition: "all 0.2s",
            border: `1px solid ${value === v ? color : colors.border.default}`,
            backgroundColor: value === v ? `${color}12` : colors.bg.base,
            color: value === v ? color : colors.text.secondary,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function CategoryBadge({ category }) {
  if (!category) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "10px",
      fontSize: "10px", fontFamily: fonts.mono, letterSpacing: "0.03em",
      backgroundColor: "rgba(139,92,246,0.1)", color: "rgba(139,92,246,0.9)",
    }}>
      <Tag size={9} />{category}
    </span>
  );
}

function PartsBadge({ parts }) {
  if (!parts || parts <= 1) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "10px",
      fontSize: "10px", fontFamily: fonts.mono, letterSpacing: "0.03em",
      backgroundColor: "rgba(96,165,250,0.1)", color: colors.brand.light,
    }}>
      <Layers size={9} />{parts} parts
    </span>
  );
}

function ScrapeProgressBar({ progress, onCancel }) {
  if (!progress) return null;
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  return (
    <div data-testid="scrape-progress-bar" style={{
      padding: "16px 20px", backgroundColor: colors.bg.base, borderRadius: "10px",
      border: `1px solid ${colors.border.subtle}`, marginBottom: "16px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Loader2 size={14} color={colors.brand.cyan} className="animate-spin" />
          <span style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.primary, fontWeight: 500 }}>
            {progress.message || "Processing..."}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {progress.scraped > 0 && (
            <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.brand.success }}>
              {progress.scraped} done
            </span>
          )}
          {progress.failed > 0 && (
            <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.brand.error }}>
              {progress.failed} failed
            </span>
          )}
          <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.muted }}>
            {progress.current}/{progress.total}
          </span>
        </div>
      </div>
      {/* Progress bar track */}
      <div style={{
        height: "6px", borderRadius: "3px", backgroundColor: "rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: "3px", width: `${pct}%`,
          backgroundColor: progress.failed > 0 ? colors.brand.warning : colors.brand.cyan,
          transition: "width 0.3s ease",
        }} />
      </div>
      {progress.url && (
        <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, marginTop: "6px", marginBottom: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {progress.url}
        </p>
      )}
    </div>
  );
}

function formatDate(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

function EditModal({ source, onClose, onSaved }) {
  const [title, setTitle] = useState(source.title || "");
  const [content, setContent] = useState(source.content || "");
  const [url, setUrl] = useState(source.url || "");
  const [priority, setPriority] = useState(source.priority || 0);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      const payload = { title: title.trim(), content: content.trim(), priority };
      if (source.type === "url" && url.trim()) payload.url = url.trim();
      const res = await api.put(`/knowledge/sources/${source.id}`, payload);
      toast.success("Source updated");
      onSaved(res.data);
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to update"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        data-testid="edit-source-modal"
        style={{
          width: "100%", maxWidth: "600px", maxHeight: "85vh", overflowY: "auto",
          backgroundColor: colors.bg.surface, border: `1px solid ${colors.border.default}`,
          borderRadius: "14px", padding: "28px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Pencil size={16} color={colors.brand.cyan} />
            <h2 style={{ fontFamily: fonts.heading, fontSize: "17px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
              Edit Source
            </h2>
            <TypeBadge type={source.type} />
          </div>
          <button onClick={onClose} data-testid="edit-modal-close" style={{ background: "none", border: "none", cursor: "pointer", color: colors.text.secondary, padding: "4px" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "grid", gap: "16px" }}>
          <div>
            <label style={T.label}>Title *</label>
            <input
              style={T.input} value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Source title" data-testid="edit-title-input"
              onFocus={onFocus} onBlur={onBlur}
            />
          </div>

          {source.type === "url" && (
            <div>
              <label style={T.label}>URL</label>
              <input
                style={T.input} value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://..." data-testid="edit-url-input"
                onFocus={onFocus} onBlur={onBlur}
              />
            </div>
          )}

          <div>
            <label style={T.label}>Content</label>
            <textarea
              style={{ ...T.textarea, minHeight: "180px" }} value={content} onChange={e => setContent(e.target.value)}
              placeholder="Source content..." data-testid="edit-content-input"
              onFocus={onFocus} onBlur={onBlur}
            />
            <p style={T.hint}>{content.length.toLocaleString()} characters</p>
          </div>

          <div>
            <label style={T.label}>Priority</label>
            <PrioritySelector value={priority} onChange={setPriority} />
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "24px", justifyContent: "flex-end" }}>
          <button onClick={onClose} data-testid="edit-cancel-btn" style={T.btnGhost}>Cancel</button>
          <button onClick={handleSave} disabled={saving} data-testid="edit-save-btn"
            style={{ ...T.btnPrimary, opacity: saving ? 0.6 : 1 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KnowledgeBase() {
  const { selectedInstance, selectedOrg } = useAuth();
  const navigate = useNavigate();
  const instanceId = selectedInstance?.id;
  const [activeTab, setActiveTab] = useState("faq");
  const [sources, setSources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [faq, setFaq] = useState({ title: "", content: "", priority: 0 });
  const [urlEntry, setUrlEntry] = useState({ url: "", title: "", priority: 0, auth_username: "", auth_password: "", crawl_subpages: false, crawl_depth: 1, category: "" });
  const [docTitle, setDocTitle] = useState("");
  const [docPriority, setDocPriority] = useState(0);
  const [scraping, setScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState(null);
  const [bulkRescraping, setBulkRescraping] = useState(false);
  const [rescrapingUrl, setRescrapingUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryInput, setCategoryInput] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState(null); // null = not yet initialized
  const [selected, setSelected] = useState(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const fileRef = useRef(null);
  const importRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [allInstances, setAllInstances] = useState([]);
  const [shareTarget, setShareTarget] = useState("");
  const [sharing, setSharing] = useState(false);
  // GitHub crawler state
  const [ghUrl, setGhUrl] = useState("");
  const [ghToken, setGhToken] = useState("");
  const [ghUseToken, setGhUseToken] = useState(false);
  const [ghBranch, setGhBranch] = useState("");
  const [ghCategory, setGhCategory] = useState("");
  const [ghScanning, setGhScanning] = useState(false);
  const [ghScanResult, setGhScanResult] = useState(null);
  const [ghSelectedFiles, setGhSelectedFiles] = useState(new Set());
  const [ghImporting, setGhImporting] = useState(false);
  const [ghProgress, setGhProgress] = useState(null);
  const [ghFilterExts, setGhFilterExts] = useState(new Set());  // empty = show all
  const [ghFilterMaxSize, setGhFilterMaxSize] = useState(0);     // 0 = no limit (KB)

  const loadSources = useCallback(() => {
    api.get(`/knowledge/sources`).then(r => setSources(r.data)).catch(() => {});
    api.get(`/knowledge/categories`).then(r => setCategories(r.data || [])).catch(() => {});
  }, [instanceId]);

  useEffect(() => { loadSources(); }, [loadSources, instanceId]);

  // ── Export / Import / Share handlers ──
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get("/knowledge/export");
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kb-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${res.data.count} sources`);
    } catch { toast.error("Export failed"); }
    finally { setExporting(false); }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.sources || !Array.isArray(data.sources)) {
        toast.error("Invalid export file — missing 'sources' array");
        setImporting(false);
        return;
      }
      const overwrite = window.confirm(
        `Import ${data.sources.length} sources?\n\nChoose OK to REPLACE existing KB (old sources will be deactivated).\nChoose Cancel to MERGE (add alongside existing).`
      );
      const res = await api.post("/knowledge/import", { sources: data.sources, overwrite });
      toast.success(`Imported ${res.data.imported} sources${res.data.skipped ? `, skipped ${res.data.skipped} duplicates` : ""}`);
      loadSources();
    } catch (err) {
      if (err instanceof SyntaxError) toast.error("Invalid JSON file");
      else toast.error(err.response?.data?.detail || "Import failed");
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  };

  const openShareModal = async () => {
    try {
      const orgId = selectedOrg?.id;
      if (!orgId) { toast.error("No organisation selected"); return; }
      const res = await v2.listBots(orgId);
      const bots = res.data?.bots || [];
      const others = bots.filter(b => b.id !== instanceId);
      if (others.length === 0) {
        toast.error("No other bots to share with. Create another bot first.");
        return;
      }
      setAllInstances(others);
      setShareTarget(others[0]?.id || "");
      setShowShareModal(true);
    } catch { toast.error("Failed to load bots"); }
  };

  const handleShare = async () => {
    if (!shareTarget) { toast.error("Select a target instance"); return; }
    const sourceIds = selected.size > 0
      ? [...selected].flatMap(id => {
          const s = sources.find(src => (src.group_id || src.id) === id);
          return s?.parts || [s?.id];
        }).filter(Boolean)
      : sources.flatMap(s => s.parts || [s.id]);
    if (sourceIds.length === 0) { toast.error("No sources to share"); return; }
    setSharing(true);
    try {
      const res = await api.post("/knowledge/share", { source_ids: sourceIds, target_instance_id: shareTarget });
      toast.success(`Shared ${res.data.copied} sources to "${res.data.target_name}"`);
      setShowShareModal(false);
      setSelected(new Set());
    } catch (err) { toast.error(err.response?.data?.detail || "Share failed"); }
    finally { setSharing(false); }
  };

  // ── GitHub crawler handlers ──
  const ghScanRepo = async () => {
    if (!ghUrl.trim()) { toast.error("Enter a GitHub repository URL"); return; }
    setGhScanning(true);
    setGhScanResult(null);
    setGhSelectedFiles(new Set());
    try {
      const res = await api.post("/knowledge/sources/github/scan", {
        repo_url: ghUrl.trim(),
        branch: ghBranch.trim() || null,
        github_token: ghUseToken && ghToken.trim() ? ghToken.trim() : null,
      }, { timeout: 30000 }); // 30s timeout for large repos
      setGhScanResult(res.data);
      setGhSelectedFiles(new Set(res.data.doc_files.map(f => f.path)));
      if (res.data.doc_count === 0) toast.info("No documentation files found in this repository.");
      else toast.success(`Found ${res.data.doc_count} documentation files`);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Failed to scan repository";
      toast.error(msg.includes("timeout") ? "Scan timed out — try again or use a GitHub token for faster access" : msg);
    }
    finally { setGhScanning(false); }
  };

  const ghToggleFile = (path) => {
    setGhSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const ghToggleAll = () => {
    if (!ghScanResult) return;
    const visible = ghFilteredFiles;
    if (ghSelectedFiles.size === visible.length && visible.every(f => ghSelectedFiles.has(f.path))) {
      setGhSelectedFiles(new Set());
    } else {
      setGhSelectedFiles(new Set(visible.map(f => f.path)));
    }
  };

  // Compute filtered file list from scan results
  const ghFilteredFiles = (ghScanResult?.doc_files || []).filter(f => {
    if (ghFilterExts.size > 0 && !ghFilterExts.has(f.extension)) return false;
    if (ghFilterMaxSize > 0 && f.size > ghFilterMaxSize * 1024) return false;
    return true;
  });

  // Available extensions from scan
  const ghAvailableExts = [...new Set((ghScanResult?.doc_files || []).map(f => f.extension).filter(Boolean))].sort();

  const ghImportFiles = async () => {
    if (ghSelectedFiles.size === 0) { toast.error("Select at least one file"); return; }
    setGhImporting(true);
    setGhProgress({ current: 0, total: ghSelectedFiles.size, message: "Starting import...", imported: 0, failed: 0 });
    try {
      await consumeSSE("/knowledge/sources/github/import-stream", {
        repo_url: ghUrl.trim(),
        branch: ghScanResult?.branch || ghBranch.trim() || "main",
        files: [...ghSelectedFiles],
        category: ghCategory.trim() || null,
        github_token: ghUseToken && ghToken.trim() ? ghToken.trim() : null,
      }, {
        onProgress: (data) => {
          if (data.type === "progress") {
            setGhProgress(prev => ({
              ...prev,
              current: data.current || prev.current,
              total: data.total || prev.total,
              message: data.message || data.file || prev.message,
            }));
          }
        },
        onComplete: (data) => {
          if (data.type === "success") {
            setGhProgress(prev => ({ ...prev, imported: (prev.imported || 0) + 1 }));
          } else if (data.type === "error") {
            setGhProgress(prev => ({ ...prev, failed: (prev.failed || 0) + 1 }));
          } else if (data.type === "done") {
            toast.success(`Imported ${data.imported} files${data.failed ? `, ${data.failed} failed` : ""}`);
            loadSources();
            setGhImporting(false);
            setGhProgress(null);
            setGhScanResult(null);
            setGhSelectedFiles(new Set());
          }
        },
        onError: (err) => {
          toast.error(`Import error: ${err}`);
          setGhImporting(false);
          setGhProgress(null);
        },
      });
    } catch (err) {
      toast.error("Import failed");
      setGhImporting(false);
      setGhProgress(null);
    }
  };

  const addFaq = async () => {
    if (!faq.title.trim() || !faq.content.trim()) { toast.error("Title and content are required"); return; }
    setLoading(true);
    try {
      await api.post(`/knowledge/sources/faq`, faq);
      toast.success("FAQ added successfully");
      setFaq({ title: "", content: "", priority: 0 });
      loadSources();
    } catch { toast.error("Failed to add FAQ"); }
    finally { setLoading(false); }
  };

  // SSE stream consumer helper
  const consumeSSE = async (url, payload, { onProgress, onComplete, onError }) => {
    const token = localStorage.getItem("bf_token");
    const instanceHeader = selectedInstance?.id || "";
    const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "X-Instance-ID": instanceHeader,
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "Unknown error");
      throw new Error(errText);
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const dataLine = line.replace(/^data: /, "").trim();
        if (!dataLine) continue;
        try {
          const data = JSON.parse(dataLine);
          if (data.type === "complete" || data.type === "done") { onComplete?.(data); }
          else if (data.type === "success" || data.type === "error") { onComplete?.(data); }
          else { onProgress?.(data); }
        } catch { /* skip malformed events */ }
      }
    }
  };

  const scrapeUrl = async () => {
    if (!urlEntry.url.trim()) { toast.error("URL is required"); return; }
    setScraping(true);
    setScrapeProgress(null);
    try {
      const payload = { url: urlEntry.url, title: urlEntry.title, priority: urlEntry.priority };
      if (urlEntry.auth_username?.trim()) payload.auth_username = urlEntry.auth_username.trim();
      if (urlEntry.auth_password?.trim()) payload.auth_password = urlEntry.auth_password.trim();
      if (urlEntry.category?.trim()) payload.category = urlEntry.category.trim();

      if (urlEntry.crawl_subpages) {
        payload.crawl_subpages = true;
        payload.crawl_depth = urlEntry.crawl_depth;
        let sseWorked = false;
        try {
          // Try SSE stream for real-time progress
          setScrapeProgress({ current: 0, total: 1, message: "Starting crawl...", scraped: 0, failed: 0, url: urlEntry.url });
          await consumeSSE("/api/knowledge/sources/url/crawl-stream", payload, {
            onProgress: (data) => {
              sseWorked = true;
              setScrapeProgress(prev => ({
                ...prev,
                current: data.current || prev?.current || 0,
                total: data.total || prev?.total || 1,
                message: data.message || prev?.message,
                scraped: data.scraped ?? prev?.scraped ?? 0,
                failed: data.failed ?? prev?.failed ?? 0,
                url: data.url || prev?.url,
              }));
            },
            onComplete: (data) => {
              sseWorked = true;
              const ok = data.scraped || 0;
              const fail = data.failed || 0;
              if (ok > 0) toast.success(`Crawled ${ok} page${ok > 1 ? "s" : ""} successfully${fail > 0 ? ` (${fail} failed)` : ""}`);
              else toast.error(`Crawl failed: ${fail} page${fail > 1 ? "s" : ""} could not be scraped`);
            },
          });
        } catch {
          // SSE failed (proxy buffering, network issue) — fall back to non-SSE endpoint
          if (!sseWorked) {
            setScrapeProgress({ current: 0, total: 1, message: "Crawling pages (progress unavailable)...", scraped: 0, failed: 0, url: urlEntry.url });
            try {
              const r = await api.post(`/knowledge/sources/url/crawl`, payload);
              const data = r.data;
              const ok = data.scraped?.length || 0;
              const fail = data.failed?.length || 0;
              if (ok > 0) toast.success(`Crawled ${ok} page${ok > 1 ? "s" : ""} successfully${fail > 0 ? ` (${fail} failed)` : ""}`);
              else toast.error(`Crawl failed: ${fail} page${fail > 1 ? "s" : ""} could not be scraped`);
            } catch (fallbackErr) {
              toast.error(fallbackErr.response?.data?.detail || "Crawl failed");
            }
          }
        }
      } else {
        await api.post(`/knowledge/sources/url`, payload);
        toast.success("URL scraped and saved successfully");
      }
      setUrlEntry({ url: "", title: "", priority: 0, auth_username: "", auth_password: "", crawl_subpages: false, crawl_depth: 1, category: "" });
      loadSources();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to scrape URL"); }
    finally { setScraping(false); setScrapeProgress(null); }
  };

  const bulkRescrape = async () => {
    const urlCount = sources.filter(s => s.type === "url").length;
    if (urlCount === 0) { toast.error("No URL sources to re-scrape"); return; }
    if (!window.confirm(`Re-scrape all ${urlCount} URL sources? This will replace existing content with fresh data.`)) return;
    setBulkRescraping(true);
    setScrapeProgress({ current: 0, total: urlCount, message: "Starting bulk re-scrape...", scraped: 0, failed: 0, url: "" });
    let sseWorked = false;
    try {
      await consumeSSE("/api/knowledge/sources/bulk-rescrape", null, {
        onProgress: (data) => {
          sseWorked = true;
          setScrapeProgress(prev => ({
            ...prev,
            current: data.current || prev?.current || 0,
            total: data.total || prev?.total || urlCount,
            message: data.message || prev?.message,
            scraped: data.scraped ?? prev?.scraped ?? 0,
            failed: data.failed ?? prev?.failed ?? 0,
            url: data.url || prev?.url,
          }));
        },
        onComplete: (data) => {
          sseWorked = true;
          const ok = data.scraped || 0;
          const fail = data.failed || 0;
          toast.success(`Re-scraped ${ok} URL${ok > 1 ? "s" : ""} successfully${fail > 0 ? ` (${fail} failed)` : ""}`);
          loadSources();
        },
      });
    } catch {
      // SSE failed — fall back to sequential individual re-scrapes
      if (!sseWorked) {
        const urlSources = sources.filter(s => s.type === "url" && s.url);
        let ok = 0, fail = 0;
        for (let i = 0; i < urlSources.length; i++) {
          setScrapeProgress({ current: i + 1, total: urlSources.length, message: `Re-scraping ${i + 1}/${urlSources.length}...`, scraped: ok, failed: fail, url: urlSources[i].url });
          try {
            await api.post(`/knowledge/sources/url/rescrape`, { url: urlSources[i].url });
            ok++;
          } catch { fail++; }
        }
        toast.success(`Re-scraped ${ok} URL${ok > 1 ? "s" : ""} successfully${fail > 0 ? ` (${fail} failed)` : ""}`);
      }
    }
    finally { setBulkRescraping(false); setScrapeProgress(null); loadSources(); }
  };

  const rescrapeSource = async (source) => {
    if (!source.url) return;
    setRescrapingUrl(source.url);
    try {
      await api.post(`/knowledge/sources/url/rescrape`, { url: source.url });
      toast.success(`Re-scraped "${source.title || source.url}" successfully`);
      loadSources();
    } catch (e) { toast.error(e.response?.data?.detail || "Re-scrape failed"); }
    finally { setRescrapingUrl(null); }
  };

  const uploadFile = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("Please select a file"); return; }
    if (!docTitle.trim()) { toast.error("Title is required"); return; }
    const form = new FormData();
    form.append("file", file);
    form.append("title", docTitle);
    form.append("priority", docPriority);
    setUploading(true);
    try {
      await api.post(`/knowledge/sources/upload`, form);
      toast.success("Document uploaded successfully");
      setDocTitle("");
      setDocPriority(0);
      if (fileRef.current) fileRef.current.value = "";
      loadSources();
    } catch (e) { toast.error(e.response?.data?.detail || "Upload failed"); }
    finally { setUploading(false); }
  };

  const deleteSource = async (source) => {
    try {
      if (source.total_parts > 1 && source.group_id) {
        await api.delete(`/knowledge/sources/group/${encodeURIComponent(source.group_id)}`);
        toast.success(`Deleted ${source.total_parts} parts`);
      } else if (source.parts?.length === 1) {
        await api.delete(`/knowledge/sources/${source.parts[0]}`);
        toast.success("Source deleted");
      } else {
        await api.delete(`/knowledge/sources/${source.id}`);
        toast.success("Source deleted");
      }
      loadSources();
    } catch { toast.error("Failed to delete"); }
  };

  const toggleSource = async (source) => {
    try {
      if (source.total_parts > 1 && source.group_id) {
        const r = await api.patch(`/knowledge/sources/group/${encodeURIComponent(source.group_id)}/toggle`);
        setSources(prev => prev.map(s => s.group_id === source.group_id ? { ...s, is_active: r.data.is_active } : s));
      } else if (source.parts?.length === 1) {
        const r = await api.patch(`/knowledge/sources/${source.parts[0]}/toggle`);
        setSources(prev => prev.map(s => (s.parts?.[0] === source.parts?.[0] || s.id === source.parts?.[0]) ? { ...s, is_active: r.data.is_active } : s));
      } else {
        const r = await api.patch(`/knowledge/sources/${source.id}/toggle`);
        setSources(prev => prev.map(s => s.id === source.id ? { ...s, is_active: r.data.is_active } : s));
      }
    } catch { toast.error("Failed to toggle"); }
  };

  const updatePriority = async (source, newPriority) => {
    try {
      if (source.total_parts > 1 && source.group_id) {
        await api.patch(`/knowledge/sources/group/${encodeURIComponent(source.group_id)}/priority`, { priority: newPriority });
      } else if (source.parts?.length === 1) {
        await api.patch(`/knowledge/sources/${source.parts[0]}/priority`, { priority: newPriority });
      } else {
        await api.patch(`/knowledge/sources/${source.id}/priority`, { priority: newPriority });
      }
      loadSources();
      const label = PRIORITY_LEVELS.find(p => p.value === newPriority)?.label || "Normal";
      toast.success(`Priority set to ${label}`);
    } catch { toast.error("Failed to update priority"); }
  };

  const saveCategory = async (source) => {
    try {
      if (source.total_parts > 1 && source.group_id) {
        await api.patch(`/knowledge/sources/group/${encodeURIComponent(source.group_id)}/category`, { category: categoryInput });
      } else if (source.parts?.length === 1) {
        await api.patch(`/knowledge/sources/${source.parts[0]}/category`, { category: categoryInput });
      } else {
        await api.patch(`/knowledge/sources/${source.id}/category`, { category: categoryInput });
      }
      toast.success(categoryInput ? `Category: ${categoryInput}` : "Category removed");
      setEditingCategory(null);
      setCategoryInput("");
      loadSources();
    } catch { toast.error("Failed to update category"); }
  };

  const handleEditSaved = (updated) => {
    loadSources();
    setEditing(null);
  };

  const toggleSelect = (key) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filteredSources.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredSources.map(s => s.group_id || s.id || s.parts?.[0])));
    }
  };

  const bulkAssignCategory = async () => {
    if (!bulkCategory.trim() && !window.confirm("Remove category from all selected sources?")) return;
    setBulkAssigning(true);
    try {
      const selectedSources = filteredSources.filter(s => selected.has(s.group_id || s.id || s.parts?.[0]));
      const promises = selectedSources.map(source => {
        if (source.total_parts > 1 && source.group_id) {
          return api.patch(`/knowledge/sources/group/${encodeURIComponent(source.group_id)}/category`, { category: bulkCategory.trim() });
        } else if (source.parts?.length === 1) {
          return api.patch(`/knowledge/sources/${source.parts[0]}/category`, { category: bulkCategory.trim() });
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
      toast.success(`Category ${bulkCategory.trim() ? `"${bulkCategory.trim()}"` : "removed"} applied to ${selectedSources.length} source${selectedSources.length > 1 ? "s" : ""}`);
      setSelected(new Set());
      setBulkCategory("");
      loadSources();
    } catch { toast.error("Failed to assign category"); }
    finally { setBulkAssigning(false); }
  };

  const [bulkDeleting, setBulkDeleting] = useState(false);
  const bulkDeleteSources = async () => {
    const count = selected.size;
    if (!window.confirm(`Delete ${count} selected source${count > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const selectedSources = filteredSources.filter(s => selected.has(s.group_id || s.id || s.parts?.[0]));
      const items = selectedSources.map(source => {
        if (source.total_parts > 1 && source.group_id) {
          return { type: "group", id: source.group_id };
        } else if (source.parts?.length === 1) {
          return { type: "source", id: source.parts[0] };
        }
        return { type: "source", id: source.id };
      });
      const r = await api.post("/knowledge/sources/bulk-delete", { items });
      toast.success(`Deleted ${r.data.deleted || count} source${(r.data.deleted || count) > 1 ? "s" : ""}`);
      setSelected(new Set());
      loadSources();
    } catch { toast.error("Failed to delete sources"); }
    finally { setBulkDeleting(false); }
  };

  const filteredSources = categoryFilter
    ? sources.filter(s => (s.category || "") === categoryFilter)
    : sources;

  // Group sources by category for collapsible rendering
  const groupedSources = useMemo(() => {
    const groups = {};
    filteredSources.forEach(source => {
      const cat = source.category || "Uncategorized";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(source);
    });
    // Sort categories: named first (alphabetical), Uncategorized last
    const sorted = Object.entries(groups).sort(([a], [b]) => {
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return a.localeCompare(b);
    });
    return sorted;
  }, [filteredSources]);

  // Initialize all categories as collapsed on first load
  useEffect(() => {
    if (collapsedCategories === null && groupedSources.length > 0) {
      setCollapsedCategories(new Set(groupedSources.map(([cat]) => cat)));
    }
  }, [groupedSources, collapsedCategories]);

  const toggleCategory = (cat) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev || []);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Clear selection when filter changes to avoid stale hidden selections
  useEffect(() => { setSelected(new Set()); }, [categoryFilter]);

  const tabs = [
    { id: "faq", label: "FAQ", icon: HelpCircle },
    { id: "url", label: "URL Scraper", icon: Globe },
    { id: "github", label: "GitHub Crawler", icon: Github },
    { id: "document", label: "Upload Document", icon: FileText },
    { id: "api", label: "API Scraper", icon: Zap },
  ];

  return (
    <div style={T.page}>
      <p style={T.overline}>Knowledge Management</p>
      <h1 style={T.h1}>Knowledge Base</h1>

      {/* KB Tools: Export / Import / Share */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
        <button data-testid="kb-export-btn" onClick={handleExport} disabled={exporting || sources.length === 0}
          style={{
            padding: "7px 14px", borderRadius: "10px", fontSize: "12px", fontFamily: fonts.body, fontWeight: "500",
            backgroundColor: "transparent", border: `1px solid ${colors.border.default}`,
            color: sources.length === 0 ? colors.text.muted : colors.text.secondary,
            cursor: sources.length === 0 ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s",
          }}>
          {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          Export KB
        </button>
        <button data-testid="kb-import-btn" onClick={() => importRef.current?.click()} disabled={importing}
          style={{
            padding: "7px 14px", borderRadius: "10px", fontSize: "12px", fontFamily: fonts.body, fontWeight: "500",
            backgroundColor: "transparent", border: `1px solid ${colors.border.default}`,
            color: colors.text.secondary, cursor: importing ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s",
          }}>
          {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {importing ? "Importing..." : "Import KB"}
        </button>
        <button data-testid="kb-share-btn" onClick={openShareModal}
          style={{
            padding: "7px 14px", borderRadius: "10px", fontSize: "12px", fontFamily: fonts.body, fontWeight: "500",
            backgroundColor: "transparent", border: `1px solid ${colors.border.default}`,
            color: sources.length === 0 ? colors.text.muted : colors.text.secondary,
            cursor: sources.length === 0 ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s",
          }}
          disabled={sources.length === 0}>
          <Share2 size={13} />
          {selected.size > 0 ? `Share ${selected.size} Selected` : "Share to Instance"}
        </button>
        <input ref={importRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleImportFile} />
        {sources.length > 0 && (
          <span style={{ marginLeft: "auto", fontFamily: fonts.mono, fontSize: "11px", color: colors.text.muted }}>
            {sources.length} source{sources.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowShareModal(false)}>
          <div onClick={e => e.stopPropagation()} data-testid="share-modal" style={{
            width: "100%", maxWidth: "420px", backgroundColor: colors.bg.surface,
            border: `1px solid ${colors.border.default}`, borderRadius: "14px", padding: "28px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Share2 size={16} color={colors.brand.cyan} />
                <h2 style={{ fontFamily: fonts.heading, fontSize: "17px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
                  Share Knowledge Base
                </h2>
              </div>
              <button onClick={() => setShowShareModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: colors.text.secondary }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, marginBottom: "16px", lineHeight: "1.5" }}>
              {selected.size > 0
                ? `Copy ${selected.size} selected source${selected.size > 1 ? "s" : ""} to another bot instance.`
                : `Copy all ${sources.length} KB sources to another bot instance.`}
            </p>
            <label style={T.label}>Target Instance</label>
            <select data-testid="share-target-select" value={shareTarget} onChange={e => setShareTarget(e.target.value)}
              style={{ ...T.input, cursor: "pointer", marginBottom: "20px" }}>
              {allInstances.map(inst => (
                <option key={inst.id} value={inst.id}>{inst.name || inst.id.slice(0, 12)}</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: "10px" }}>
              <button data-testid="share-confirm-btn" onClick={handleShare} disabled={sharing}
                style={{ ...T.btnPrimary, flex: 1, opacity: sharing ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                {sharing ? <Loader2 size={13} className="animate-spin" /> : <Share2 size={13} />}
                {sharing ? "Sharing..." : "Share Now"}
              </button>
              <button onClick={() => setShowShareModal(false)}
                style={{ padding: "9px 18px", borderRadius: "10px", fontSize: "13px", fontFamily: fonts.body, backgroundColor: "transparent", border: `1px solid ${colors.border.default}`, color: colors.text.secondary, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", borderBottom: `1px solid ${colors.border.default}`, paddingBottom: "0" }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} data-testid={`tab-${id}`} style={{
            padding: "10px 20px", backgroundColor: "transparent", border: "none",
            borderBottom: activeTab === id ? `2px solid ${colors.brand.cyan}` : "2px solid transparent",
            color: activeTab === id ? colors.text.primary : colors.text.secondary, cursor: "pointer",
            fontFamily: fonts.body, fontSize: "13px", fontWeight: "500",
            display: "flex", alignItems: "center", gap: "7px", marginBottom: "-1px",
            transition: "color 0.2s ease, border-color 0.2s ease",
          }}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* FAQ Tab */}
      {activeTab === "faq" && (
        <div style={T.card}>
          <p style={T.sectionTitle}>Add FAQ Entry</p>
          <div style={{ display: "grid", gap: "14px", marginTop: "16px" }}>
            <div>
              <label style={T.label}>Question / Title *</label>
              <input style={T.input} value={faq.title} onChange={e => setFaq(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. How do I reset my password?" data-testid="faq-title-input"
                onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <label style={T.label}>Answer / Content *</label>
              <textarea style={{ ...T.textarea, minHeight: "100px" }} value={faq.content} onChange={e => setFaq(p => ({ ...p, content: e.target.value }))}
                placeholder="Provide a clear, detailed answer..." data-testid="faq-content-input"
                onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <label style={T.label}>Priority</label>
              <PrioritySelector value={faq.priority} onChange={v => setFaq(p => ({ ...p, priority: v }))} />
              <p style={T.hint}>High priority sources are checked first when answering questions.</p>
            </div>
            <div>
              <button onClick={addFaq} disabled={loading} data-testid="faq-add-btn" style={{ ...T.btnPrimary, opacity: loading ? 0.6 : 1 }}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add FAQ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* URL Tab */}
      {activeTab === "url" && (
        <div style={T.card}>
          <p style={T.sectionTitle}>Scrape URL</p>
          <p style={{ ...T.sectionSub, marginTop: "4px" }}>
            Enter a URL and we&apos;ll automatically extract and index its content. Large pages are split into searchable chunks automatically.
          </p>
          <div style={{ display: "grid", gap: "14px" }}>
            <div>
              <label style={T.label}>URL *</label>
              <input style={T.input} value={urlEntry.url} onChange={e => setUrlEntry(p => ({ ...p, url: e.target.value }))}
                placeholder="https://docs.yoursite.com/faq" data-testid="url-input" onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <label style={T.label}>Custom Title (optional)</label>
              <input style={T.input} value={urlEntry.title} onChange={e => setUrlEntry(p => ({ ...p, title: e.target.value }))}
                placeholder="Auto-detected from page title" data-testid="url-title-input" onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <label style={T.label}>Priority</label>
              <PrioritySelector value={urlEntry.priority} onChange={v => setUrlEntry(p => ({ ...p, priority: v }))} />
            </div>
            <div>
              <label style={T.label}>Category (optional)</label>
              <input style={T.input} value={urlEntry.category} onChange={e => setUrlEntry(p => ({ ...p, category: e.target.value }))}
                placeholder="e.g. Staking, API Docs, Getting Started" data-testid="url-category-input" onFocus={onFocus} onBlur={onBlur}
                list="existing-categories" />
              <datalist id="existing-categories">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
              <p style={T.hint}>All scraped pages will be assigned this category</p>
            </div>
            {/* Crawl sub-pages option */}
            <div style={{ padding: "14px", backgroundColor: colors.bg.base, borderRadius: "10px", border: `1px solid ${colors.border.subtle}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Network size={14} color={urlEntry.crawl_subpages ? colors.brand.cyan : colors.text.muted} />
                  <div>
                    <label style={{ ...T.label, margin: 0, fontSize: "13px" }}>Crawl Sub-pages</label>
                    <p style={{ ...T.hint, marginTop: "2px", marginBottom: 0, fontSize: "11px" }}>
                      Also scrape linked pages under the same URL path
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUrlEntry(p => ({ ...p, crawl_subpages: !p.crawl_subpages }))}
                  data-testid="crawl-toggle"
                  style={{ background: "none", border: "none", cursor: "pointer", color: urlEntry.crawl_subpages ? colors.brand.success : colors.text.muted, padding: 0 }}
                >
                  {urlEntry.crawl_subpages ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              </div>
              {urlEntry.crawl_subpages && (
                <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <label style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary }}>Depth:</label>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {[1, 2, 3].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setUrlEntry(p => ({ ...p, crawl_depth: d }))}
                        data-testid={`depth-${d}`}
                        style={{
                          padding: "5px 14px", borderRadius: "6px", fontSize: "12px", fontFamily: fonts.mono,
                          border: `1px solid ${urlEntry.crawl_depth === d ? colors.brand.cyan : colors.border.default}`,
                          backgroundColor: urlEntry.crawl_depth === d ? "rgba(96,165,250,0.08)" : "transparent",
                          color: urlEntry.crawl_depth === d ? colors.brand.cyan : colors.text.secondary,
                          cursor: "pointer", transition: "all 0.2s",
                        }}
                      >
                        {d} {d === 1 ? "level" : "levels"}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>
                    max 50 pages per crawl
                  </span>
                </div>
              )}
            </div>
            <div>
              <button onClick={scrapeUrl} disabled={scraping || bulkRescraping} data-testid="url-scrape-btn" style={{ ...T.btnPrimary, opacity: (scraping || bulkRescraping) ? 0.6 : 1 }}>
                {scraping ? <Loader2 size={14} className="animate-spin" /> : urlEntry.crawl_subpages ? <Network size={14} /> : <Globe size={14} />}
                {scraping ? (urlEntry.crawl_subpages ? "Crawling..." : "Scraping...") : (urlEntry.crawl_subpages ? "Crawl & Save" : "Scrape & Save")}
              </button>
            </div>
          </div>
          {/* SSE Progress Bar */}
          {scrapeProgress && <ScrapeProgressBar progress={scrapeProgress} />}
        </div>
      )}

      {/* GitHub Crawler Tab */}
      {activeTab === "github" && (
        <div style={T.card}>
          <p style={T.sectionTitle}>GitHub Repository Crawler</p>
          <p style={{ ...T.sectionSub, marginTop: "4px" }}>
            Paste a GitHub repo URL to auto-discover and import documentation files (README, docs/, .md, .rst, changelogs, etc.).
          </p>
          <div style={{ display: "grid", gap: "14px", marginTop: "16px" }}>
            <div>
              <label style={T.label}>Repository URL *</label>
              <input
                data-testid="gh-repo-url"
                style={T.input}
                value={ghUrl}
                onChange={e => setGhUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                onFocus={onFocus} onBlur={onBlur}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label style={T.label}>Branch (optional)</label>
                <input
                  data-testid="gh-branch"
                  style={T.input}
                  value={ghBranch}
                  onChange={e => setGhBranch(e.target.value)}
                  placeholder="auto-detect"
                  onFocus={onFocus} onBlur={onBlur}
                />
              </div>
              <div>
                <label style={T.label}>Category (optional)</label>
                <input
                  data-testid="gh-category"
                  style={T.input}
                  value={ghCategory}
                  onChange={e => setGhCategory(e.target.value)}
                  placeholder="Auto-categorise"
                  list="gh-category-suggestions"
                  onFocus={onFocus} onBlur={onBlur}
                />
                <datalist id="gh-category-suggestions">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <label style={{ ...T.label, margin: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                    onClick={() => setGhUseToken(p => !p)}>
                    <input
                      type="checkbox"
                      checked={ghUseToken}
                      onChange={e => setGhUseToken(e.target.checked)}
                      data-testid="gh-use-token-toggle"
                      style={{ width: "14px", height: "14px", accentColor: colors.brand.cyan, cursor: "pointer" }}
                    />
                    Private Repo Token
                  </label>
                </div>
                {ghUseToken ? (
                  <input
                    data-testid="gh-token"
                    type="password"
                    style={T.input}
                    value={ghToken}
                    onChange={e => setGhToken(e.target.value)}
                    placeholder="ghp_xxxx"
                    onFocus={onFocus} onBlur={onBlur}
                  />
                ) : (
                  <div style={{ padding: "9px 12px", borderRadius: "10px", border: `1px solid ${colors.border.faint}`, backgroundColor: colors.bg.base, fontSize: "11px", fontFamily: fonts.mono, color: colors.text.muted }}>
                    Public access (no token)
                  </div>
                )}
              </div>
            </div>
            <div>
              <button
                data-testid="gh-scan-btn"
                onClick={ghScanRepo}
                disabled={ghScanning || !ghUrl.trim()}
                style={{ ...T.btnPrimary, opacity: ghScanning || !ghUrl.trim() ? 0.6 : 1, display: "flex", alignItems: "center", gap: "6px" }}
              >
                {ghScanning ? <Loader2 size={14} className="animate-spin" /> : <Network size={14} />}
                {ghScanning ? "Scanning..." : "Scan Repository"}
              </button>
            </div>
          </div>

          {/* Scan Results */}
          {ghScanResult && (
            <div style={{ marginTop: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
                    {ghScanResult.owner}/{ghScanResult.repo}
                    <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.secondary, marginLeft: "8px" }}>
                      {ghScanResult.branch}
                    </span>
                  </p>
                  <p style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.muted, margin: "4px 0 0" }}>
                    {ghScanResult.total_files} total files, {ghScanResult.doc_count} docs found
                    {ghFilteredFiles.length !== ghScanResult.doc_count && ` (${ghFilteredFiles.length} shown after filters)`}
                    {ghScanResult.truncated && <span style={{ color: colors.brand.warning }}> (tree truncated — large repo)</span>}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    data-testid="gh-toggle-all"
                    onClick={ghToggleAll}
                    style={{
                      padding: "5px 12px", borderRadius: "8px", fontSize: "11px", fontFamily: fonts.body,
                      backgroundColor: "transparent", border: `1px solid ${colors.border.default}`,
                      color: colors.text.secondary, cursor: "pointer",
                    }}
                  >
                    {ghSelectedFiles.size === ghFilteredFiles.length && ghFilteredFiles.length > 0 ? "Deselect All" : "Select All"}
                  </button>
                  <button
                    data-testid="gh-import-btn"
                    onClick={ghImportFiles}
                    disabled={ghImporting || ghSelectedFiles.size === 0}
                    style={{
                      ...T.btnPrimary,
                      opacity: ghImporting || ghSelectedFiles.size === 0 ? 0.6 : 1,
                      display: "flex", alignItems: "center", gap: "6px",
                    }}
                  >
                    {ghImporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    {ghImporting ? "Importing..." : `Import ${ghSelectedFiles.size} Files`}
                  </button>
                </div>
              </div>

              {/* Smart Filters */}
              <div data-testid="gh-filters" style={{
                display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap",
                padding: "10px 14px", marginBottom: "10px", borderRadius: "10px",
                backgroundColor: colors.bg.base, border: `1px solid ${colors.border.faint}`,
              }}>
                <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  <Filter size={10} style={{ marginRight: "4px", verticalAlign: "middle" }} />Filters
                </span>
                {/* Extension toggles */}
                {ghAvailableExts.map(ext => {
                  const active = ghFilterExts.has(ext);
                  return (
                    <button key={ext} data-testid={`gh-filter-ext-${ext.replace(".", "")}`}
                      onClick={() => {
                        setGhFilterExts(prev => {
                          const next = new Set(prev);
                          if (next.has(ext)) next.delete(ext); else next.add(ext);
                          return next;
                        });
                      }}
                      style={{
                        padding: "3px 10px", borderRadius: "8px", fontSize: "11px", fontFamily: fonts.mono,
                        backgroundColor: active ? "rgba(139,92,246,0.12)" : "transparent",
                        border: `1px solid ${active ? "rgba(139,92,246,0.4)" : colors.border.default}`,
                        color: active ? "rgba(139,92,246,0.9)" : colors.text.secondary,
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      {ext || "no ext"}
                    </button>
                  );
                })}
                {/* Size filter */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
                  <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>Max size:</span>
                  <select data-testid="gh-filter-size"
                    value={ghFilterMaxSize}
                    onChange={e => setGhFilterMaxSize(Number(e.target.value))}
                    style={{
                      padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontFamily: fonts.mono,
                      backgroundColor: colors.bg.surface, border: `1px solid ${colors.border.default}`,
                      color: colors.text.primary, cursor: "pointer",
                    }}
                  >
                    <option value={0}>No limit</option>
                    <option value={10}>10 KB</option>
                    <option value={50}>50 KB</option>
                    <option value={100}>100 KB</option>
                    <option value={500}>500 KB</option>
                  </select>
                </div>
                {(ghFilterExts.size > 0 || ghFilterMaxSize > 0) && (
                  <button onClick={() => { setGhFilterExts(new Set()); setGhFilterMaxSize(0); }}
                    style={{
                      padding: "3px 10px", borderRadius: "8px", fontSize: "10px", fontFamily: fonts.body,
                      backgroundColor: "transparent", border: `1px solid ${colors.border.default}`,
                      color: colors.text.secondary, cursor: "pointer",
                    }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Import progress */}
              {ghImporting && ghProgress && (
                <ScrapeProgressBar progress={{
                  current: ghProgress.current,
                  total: ghProgress.total,
                  message: ghProgress.message,
                  scraped: ghProgress.imported || 0,
                  failed: ghProgress.failed || 0,
                }} />
              )}

              {/* File list */}
              <div style={{
                backgroundColor: colors.bg.surface, border: `1px solid ${colors.border.default}`,
                borderRadius: "10px", maxHeight: "400px", overflowY: "auto",
              }}>
                {ghFilteredFiles.map(file => (
                  <label
                    key={file.path}
                    data-testid="gh-file-item"
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "8px 16px", borderBottom: `1px solid ${colors.border.faint}`,
                      cursor: "pointer", transition: "background-color 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(96,165,250,0.04)"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <input
                      type="checkbox"
                      checked={ghSelectedFiles.has(file.path)}
                      onChange={() => ghToggleFile(file.path)}
                      style={{ width: "14px", height: "14px", accentColor: colors.brand.cyan, cursor: "pointer" }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: fonts.mono, fontSize: "12px", color: colors.text.primary, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {file.path}
                      </p>
                    </div>
                    <span style={{
                      padding: "2px 8px", borderRadius: "8px", fontSize: "9px", fontFamily: fonts.mono,
                      backgroundColor: "rgba(139,92,246,0.1)", color: "rgba(139,92,246,0.9)",
                      textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0,
                    }}>
                      {file.category}
                    </span>
                    <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, flexShrink: 0 }}>
                      {file.size > 1024 ? `${(file.size / 1024).toFixed(1)}KB` : `${file.size}B`}
                    </span>
                  </label>
                ))}
                {ghFilteredFiles.length === 0 && (
                  <div style={{ padding: "32px", textAlign: "center" }}>
                    <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary }}>
                      {ghScanResult.doc_count === 0
                        ? "No documentation files detected. This repo may use non-standard doc locations."
                        : "No files match the current filters. Try adjusting or clearing them."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Document Tab */}
      {activeTab === "document" && (
        <div style={T.card}>
          <p style={T.sectionTitle}>Upload Document</p>
          <p style={{ ...T.sectionSub, marginTop: "4px" }}>Upload .txt or .pdf files. Content will be extracted and indexed.</p>
          <div style={{ display: "grid", gap: "14px" }}>
            <div>
              <label style={T.label}>Title *</label>
              <input style={T.input} value={docTitle} onChange={e => setDocTitle(e.target.value)}
                placeholder="e.g. Product Documentation v2" data-testid="doc-title-input" onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <label style={T.label}>File (.txt or .pdf) *</label>
              <input ref={fileRef} type="file" accept=".txt,.pdf" data-testid="doc-file-input"
                style={{ ...T.input, padding: "8px 14px", cursor: "pointer" }} />
            </div>
            <div>
              <label style={T.label}>Priority</label>
              <PrioritySelector value={docPriority} onChange={setDocPriority} />
            </div>
            <div>
              <button onClick={uploadFile} disabled={uploading} data-testid="doc-upload-btn" style={{ ...T.btnPrimary, opacity: uploading ? 0.6 : 1 }}>
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                {uploading ? "Uploading..." : "Upload Document"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sources List — hidden when API Scraper tab is active */}
      {activeTab !== "api" && (
      <div style={{ backgroundColor: colors.bg.surface, border: `1px solid ${colors.border.default}`, borderRadius: "10px", overflow: "hidden", marginTop: "24px" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.border.default}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {filteredSources.length > 0 && (
              <input
                type="checkbox"
                checked={selected.size > 0 && selected.size === filteredSources.length}
                ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < filteredSources.length; }}
                onChange={selectAll}
                data-testid="select-all-checkbox"
                style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: colors.brand.cyan }}
              />
            )}
            <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
              All Sources
              <span style={{ marginLeft: "10px", fontFamily: fonts.mono, fontSize: "11px", color: colors.text.secondary }}>{filteredSources.length}</span>
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {categories.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Filter size={11} color={colors.text.muted} />
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  data-testid="category-filter"
                  style={{
                    padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontFamily: fonts.mono,
                    backgroundColor: colors.bg.base, border: `1px solid ${colors.border.default}`,
                    color: colors.text.primary, cursor: "pointer",
                  }}
                >
                  <option value="">All categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            {sources.some(s => s.type === "url") && (
              <button
                onClick={bulkRescrape}
                disabled={bulkRescraping || scraping}
                data-testid="bulk-rescrape-btn"
                title="Re-scrape all URL sources to refresh content"
                style={{
                  padding: "5px 12px", borderRadius: "8px", fontSize: "11px", fontFamily: fonts.body, fontWeight: "600",
                  backgroundColor: "transparent", border: `1px solid ${colors.border.default}`,
                  color: bulkRescraping ? colors.text.muted : colors.text.secondary,
                  cursor: bulkRescraping ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: "5px", transition: "all 0.2s",
                }}
                onMouseEnter={e => { if (!bulkRescraping) { e.currentTarget.style.borderColor = colors.brand.cyan; e.currentTarget.style.color = colors.brand.cyan; } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border.default; e.currentTarget.style.color = colors.text.secondary; }}
              >
                {bulkRescraping ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                {bulkRescraping ? "Re-scraping..." : "Refresh All URLs"}
              </button>
            )}
            <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, margin: 0 }}>
              Sorted by priority
            </p>
          </div>
        </div>

        {/* Bulk rescrape progress bar */}
        {bulkRescraping && scrapeProgress && (
          <div style={{ padding: "0 20px", paddingTop: "12px" }}>
            <ScrapeProgressBar progress={scrapeProgress} />
          </div>
        )}

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div data-testid="bulk-action-bar" style={{
            padding: "10px 20px", borderBottom: `1px solid ${colors.border.default}`,
            backgroundColor: "rgba(96,165,250,0.06)",
            display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
          }}>
            <span style={{ fontFamily: fonts.mono, fontSize: "12px", color: colors.brand.light, fontWeight: "600" }}>
              {selected.size} selected
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Tag size={12} color={colors.text.secondary} />
              <input
                value={bulkCategory}
                onChange={e => setBulkCategory(e.target.value)}
                placeholder="Category name"
                list="bulk-category-suggestions"
                data-testid="bulk-category-input"
                onKeyDown={e => { if (e.key === "Enter") bulkAssignCategory(); }}
                style={{ ...T.input, padding: "5px 10px", fontSize: "12px", width: "160px" }}
              />
              <datalist id="bulk-category-suggestions">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
              <button
                onClick={bulkAssignCategory}
                disabled={bulkAssigning}
                data-testid="bulk-assign-btn"
                style={{
                  padding: "5px 14px", borderRadius: "8px", fontSize: "12px", fontFamily: fonts.body, fontWeight: "600",
                  backgroundColor: colors.brand.cyan, border: "none", color: "#000", cursor: "pointer",
                  opacity: bulkAssigning ? 0.6 : 1, display: "flex", alignItems: "center", gap: "5px",
                }}
              >
                {bulkAssigning ? <Loader2 size={12} className="animate-spin" /> : <Tag size={12} />}
                {bulkAssigning ? "Applying..." : "Assign"}
              </button>
              <div style={{ width: "1px", height: "20px", backgroundColor: colors.border.default, margin: "0 4px" }} />
              <button
                onClick={bulkDeleteSources}
                disabled={bulkDeleting}
                data-testid="bulk-delete-btn"
                style={{
                  padding: "5px 14px", borderRadius: "8px", fontSize: "12px", fontFamily: fonts.body, fontWeight: "600",
                  backgroundColor: "rgba(244,63,94,0.12)", border: `1px solid rgba(244,63,94,0.3)`, color: colors.brand.error, cursor: "pointer",
                  opacity: bulkDeleting ? 0.6 : 1, display: "flex", alignItems: "center", gap: "5px",
                }}
              >
                {bulkDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                {bulkDeleting ? "Deleting..." : "Delete"}
              </button>
              <button
                onClick={() => { setSelected(new Set()); setBulkCategory(""); }}
                data-testid="bulk-cancel-btn"
                style={{ padding: "5px 10px", borderRadius: "8px", fontSize: "12px", fontFamily: fonts.body, backgroundColor: "transparent", border: `1px solid ${colors.border.default}`, color: colors.text.secondary, cursor: "pointer" }}
              >
                Cancel
              </button>
              <div style={{ width: "1px", height: "20px", backgroundColor: colors.border.default, margin: "0 4px" }} />
              <button
                onClick={openShareModal}
                data-testid="bulk-share-btn"
                style={{
                  padding: "5px 14px", borderRadius: "8px", fontSize: "12px", fontFamily: fonts.body, fontWeight: "600",
                  backgroundColor: "rgba(96,165,250,0.08)", border: `1px solid rgba(96,165,250,0.3)`, color: colors.brand.cyan, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "5px",
                }}
              >
                <Share2 size={12} />Share Selected
              </button>
            </div>
          </div>
        )}
        {filteredSources.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center" }}>
            <p style={{ fontFamily: fonts.body, color: colors.text.secondary, fontSize: "14px" }}>
              {categoryFilter ? "No sources in this category." : "No knowledge sources yet. Add your first source above."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {groupedSources.map(([category, catSources]) => {
              const isCollapsed = collapsedCategories ? collapsedCategories.has(category) : true;
              const catChars = catSources.reduce((sum, s) => sum + (s.total_chars || 0), 0);
              return (
                <div key={category}>
                  {/* Category header — only show if there are multiple categories */}
                  {groupedSources.length > 1 && (
                    <div
                      onClick={() => toggleCategory(category)}
                      data-testid={`category-group-${category}`}
                      style={{
                        padding: "10px 20px", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "10px",
                        backgroundColor: "rgba(96,165,250,0.03)",
                        borderBottom: `1px solid ${colors.border.faint}`,
                        transition: "background-color 0.15s",
                        userSelect: "none",
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(96,165,250,0.06)"}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = "rgba(96,165,250,0.03)"}
                    >
                      <ChevronRight
                        size={14}
                        color={colors.text.muted}
                        style={{ transition: "transform 0.2s", transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)" }}
                      />
                      {isCollapsed
                        ? <FolderClosed size={14} color={colors.brand.light} />
                        : <FolderOpen size={14} color={colors.brand.light} />}
                      <span style={{ fontFamily: fonts.heading, fontSize: "12px", fontWeight: 600, color: colors.text.primary, letterSpacing: "0.02em" }}>
                        {category}
                      </span>
                      <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>
                        {catSources.length} source{catSources.length !== 1 ? "s" : ""}
                      </span>
                      <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>
                        {catChars > 1000 ? `${(catChars / 1000).toFixed(1)}k` : catChars} chars
                      </span>
                    </div>
                  )}

                  {/* Source rows — hidden when collapsed */}
                  {!isCollapsed && catSources.map((source, idx) => {
              const sourceKey = source.group_id || source.id || source.parts?.[0] || idx;
              const isGroup = (source.total_parts || 1) > 1;
              const totalChars = source.total_chars || 0;

              return (
                <div
                  key={sourceKey}
                  data-testid="knowledge-source-row"
                  style={{
                    padding: "14px 20px",
                    borderBottom: `1px solid ${colors.border.faint}`,
                    display: "flex", alignItems: "center", gap: "14px",
                    transition: "background-color 0.15s",
                  }}
                  onMouseEnter={rowEnter} onMouseLeave={rowLeave}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selected.has(sourceKey)}
                    onChange={() => toggleSelect(sourceKey)}
                    data-testid="source-checkbox"
                    style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: colors.brand.cyan, flexShrink: 0 }}
                  />

                  {/* Type */}
                  <div style={{ minWidth: "70px" }}>
                    <TypeBadge type={source.type} />
                  </div>

                  {/* Title + metadata */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span
                        onClick={() => {
                          const isGroup = (source.total_parts || 1) > 1;
                          if (isGroup && source.group_id) {
                            navigate(`/admin/knowledge/view?group=${encodeURIComponent(source.group_id)}`);
                          } else if (source.parts?.[0]) {
                            navigate(`/admin/knowledge/view?id=${source.parts[0]}`);
                          }
                        }}
                        data-testid="view-source-content"
                        style={{
                          fontFamily: fonts.body, fontSize: "13px", fontWeight: 500, color: colors.text.primary,
                          cursor: "pointer", transition: "color 0.2s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = colors.brand.cyan}
                        onMouseLeave={e => e.currentTarget.style.color = colors.text.primary}
                      >
                        {source.title}
                      </span>
                      <PartsBadge parts={source.total_parts} />
                      <CategoryBadge category={source.category} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "3px", flexWrap: "wrap" }}>
                      {source.url && (
                        <span style={{ fontSize: "11px", color: colors.text.muted, fontFamily: fonts.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "300px" }}>
                          {source.url}
                        </span>
                      )}
                      {source.created_at && (
                        <span style={{ fontSize: "10px", color: colors.text.muted, fontFamily: fonts.mono, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                          <Calendar size={9} />{formatDate(source.created_at)}
                        </span>
                      )}
                      {totalChars > 0 && (
                        <span style={{ fontSize: "10px", color: colors.text.muted, fontFamily: fonts.mono }}>
                          {totalChars > 1000 ? `${(totalChars / 1000).toFixed(1)}k` : totalChars} chars
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category edit */}
                  <div style={{ minWidth: "90px" }}>
                    {editingCategory === sourceKey ? (
                      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                        <input
                          value={categoryInput}
                          onChange={e => setCategoryInput(e.target.value)}
                          placeholder="Category"
                          list="category-suggestions"
                          data-testid="category-input"
                          onKeyDown={e => { if (e.key === "Enter") saveCategory(source); if (e.key === "Escape") setEditingCategory(null); }}
                          autoFocus
                          style={{ ...T.input, padding: "4px 6px", fontSize: "11px", width: "90px" }}
                        />
                        <datalist id="category-suggestions">
                          {categories.map(c => <option key={c} value={c} />)}
                        </datalist>
                        <button onClick={() => saveCategory(source)} data-testid="save-category-btn" style={{ background: "none", border: "none", cursor: "pointer", color: colors.brand.success, padding: "2px" }}>
                          <Save size={12} />
                        </button>
                        <button onClick={() => setEditingCategory(null)} data-testid="cancel-category-btn" style={{ background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "2px" }}>
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingCategory(sourceKey); setCategoryInput(source.category || ""); }}
                        data-testid="set-category-btn"
                        style={{
                          background: "none", border: `1px dashed ${colors.border.default}`, borderRadius: "6px",
                          cursor: "pointer", color: colors.text.muted, padding: "3px 8px", fontSize: "10px",
                          fontFamily: fonts.mono, display: "flex", alignItems: "center", gap: "4px",
                        }}
                      >
                        <Tag size={9} />{source.category || "Set category"}
                      </button>
                    )}
                  </div>

                  {/* Priority */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <PriorityBadge priority={source.priority || 0} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                      <button
                        onClick={() => updatePriority(source, Math.min((source.priority || 0) + 1, 2))}
                        disabled={(source.priority || 0) >= 2}
                        data-testid="priority-up-btn"
                        style={{ background: "none", border: "none", cursor: (source.priority || 0) >= 2 ? "default" : "pointer", color: (source.priority || 0) >= 2 ? colors.border.subtle : colors.text.secondary, padding: "0", lineHeight: 1 }}
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={() => updatePriority(source, Math.max((source.priority || 0) - 1, 0))}
                        disabled={(source.priority || 0) <= 0}
                        data-testid="priority-down-btn"
                        style={{ background: "none", border: "none", cursor: (source.priority || 0) <= 0 ? "default" : "pointer", color: (source.priority || 0) <= 0 ? colors.border.subtle : colors.text.secondary, padding: "0", lineHeight: 1 }}
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Active */}
                  <button onClick={() => toggleSource(source)} data-testid="toggle-source-btn"
                    style={{ background: "none", border: "none", cursor: "pointer", color: source.is_active ? colors.brand.success : colors.text.muted, padding: 0 }}>
                    {source.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      onClick={() => {
                        if (isGroup && source.group_id) navigate(`/admin/knowledge/view?group=${encodeURIComponent(source.group_id)}`);
                        else if (source.parts?.[0]) navigate(`/admin/knowledge/view?id=${source.parts[0]}`);
                      }}
                      data-testid="view-content-btn"
                      title="View stored content"
                      style={{ background: "none", border: "none", cursor: "pointer", color: colors.text.secondary, padding: "4px", transition: "color 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.color = colors.brand.cyan}
                      onMouseLeave={e => e.currentTarget.style.color = colors.text.secondary}
                    >
                      <Eye size={14} />
                    </button>
                    {source.type === "url" && source.url && (
                      <button
                        onClick={() => rescrapeSource(source)}
                        disabled={rescrapingUrl === source.url}
                        data-testid="rescrape-source-btn"
                        title="Re-scrape this URL to refresh content"
                        style={{ background: "none", border: "none", cursor: rescrapingUrl === source.url ? "not-allowed" : "pointer", color: rescrapingUrl === source.url ? colors.brand.cyan : colors.text.secondary, padding: "4px", transition: "color 0.2s" }}
                        onMouseEnter={e => { if (rescrapingUrl !== source.url) e.currentTarget.style.color = colors.brand.success; }}
                        onMouseLeave={e => { if (rescrapingUrl !== source.url) e.currentTarget.style.color = colors.text.secondary; }}
                      >
                        {rescrapingUrl === source.url ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      </button>
                    )}
                    {!isGroup && source.parts?.length === 1 && (
                      <button onClick={() => setEditing({ ...source, id: source.parts[0] })} data-testid="edit-source-btn"
                        style={{ background: "none", border: "none", cursor: "pointer", color: colors.text.secondary, padding: "4px", transition: "color 0.2s" }}
                        onMouseEnter={e => e.currentTarget.style.color = colors.brand.cyan}
                        onMouseLeave={e => e.currentTarget.style.color = colors.text.secondary}>
                        <Pencil size={14} />
                      </button>
                    )}
                    <button onClick={() => deleteSource(source)} data-testid="delete-source-btn"
                      style={{ background: "none", border: "none", cursor: "pointer", color: colors.text.secondary, padding: "4px", transition: "color 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.color = colors.brand.error}
                      onMouseLeave={e => e.currentTarget.style.color = colors.text.secondary}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* API Scraper Tab */}
      {activeTab === "api" && (
        <ApiIntegrations />
      )}

      {/* Edit Modal */}
      {editing && (
        <EditModal source={editing} onClose={() => setEditing(null)} onSaved={handleEditSaved} />
      )}
    </div>
  );
}
