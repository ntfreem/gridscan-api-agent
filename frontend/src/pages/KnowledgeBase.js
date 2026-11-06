import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Plus, Trash2, Globe, FileText, HelpCircle, ToggleLeft, ToggleRight, Loader2, ChevronUp, ChevronDown, ArrowUpCircle, Pencil, X, Save, Lock, Tag, Calendar, Layers, Filter, Eye, Network } from "lucide-react";
import { colors, fonts, T, onFocus, onBlur, rowEnter, rowLeave } from "../theme";

const typeIcon = { faq: HelpCircle, url: Globe, document: FileText };
const typeColor = { faq: colors.brand.blue, url: colors.brand.success, document: colors.text.secondary };

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
  const { selectedInstance } = useAuth();
  const navigate = useNavigate();
  const instanceId = selectedInstance?.id;
  const [activeTab, setActiveTab] = useState("faq");
  const [sources, setSources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [faq, setFaq] = useState({ title: "", content: "", priority: 0 });
  const [urlEntry, setUrlEntry] = useState({ url: "", title: "", priority: 0, auth_username: "", auth_password: "", crawl_subpages: false, crawl_depth: 1 });
  const [docTitle, setDocTitle] = useState("");
  const [docPriority, setDocPriority] = useState(0);
  const [scraping, setScraping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryInput, setCategoryInput] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const fileRef = useRef(null);

  const loadSources = useCallback(() => {
    api.get(`/knowledge/sources`).then(r => setSources(r.data)).catch(() => {});
    api.get(`/knowledge/categories`).then(r => setCategories(r.data || [])).catch(() => {});
  }, [instanceId]);

  useEffect(() => { loadSources(); }, [loadSources, instanceId]);

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

  const scrapeUrl = async () => {
    if (!urlEntry.url.trim()) { toast.error("URL is required"); return; }
    setScraping(true);
    try {
      const payload = { url: urlEntry.url, title: urlEntry.title, priority: urlEntry.priority };
      if (urlEntry.auth_username?.trim()) payload.auth_username = urlEntry.auth_username.trim();
      if (urlEntry.auth_password?.trim()) payload.auth_password = urlEntry.auth_password.trim();

      if (urlEntry.crawl_subpages) {
        payload.crawl_subpages = true;
        payload.crawl_depth = urlEntry.crawl_depth;
        const r = await api.post(`/knowledge/sources/url/crawl`, payload);
        const data = r.data;
        const ok = data.scraped?.length || 0;
        const fail = data.failed?.length || 0;
        if (ok > 0) toast.success(`Crawled ${ok} page${ok > 1 ? "s" : ""} successfully${fail > 0 ? ` (${fail} failed)` : ""}`);
        else toast.error(`Crawl failed: ${fail} page${fail > 1 ? "s" : ""} could not be scraped`);
      } else {
        await api.post(`/knowledge/sources/url`, payload);
        toast.success("URL scraped and saved successfully");
      }
      setUrlEntry({ url: "", title: "", priority: 0, auth_username: "", auth_password: "", crawl_subpages: false, crawl_depth: 1 });
      loadSources();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to scrape URL"); }
    finally { setScraping(false); }
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

  // Clear selection when filter changes to avoid stale hidden selections
  useEffect(() => { setSelected(new Set()); }, [categoryFilter]);

  const tabs = [
    { id: "faq", label: "FAQ", icon: HelpCircle },
    { id: "url", label: "URL Scraper", icon: Globe },
    { id: "document", label: "Upload Document", icon: FileText },
  ];

  return (
    <div style={T.page}>
      <p style={T.overline}>Knowledge Management</p>
      <h1 style={T.h1}>Knowledge Base</h1>

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
            <div style={{ padding: "14px", backgroundColor: colors.bg.base, borderRadius: "10px", border: `1px solid ${colors.border.subtle}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
                <Lock size={12} color={colors.text.muted} />
                <label style={{ ...T.label, margin: 0, fontSize: "12px" }}>Authentication (optional)</label>
              </div>
              <p style={{ ...T.hint, marginTop: 0, marginBottom: "10px" }}>If the URL requires login, enter credentials below.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ ...T.label, fontSize: "11px" }}>Username / Email</label>
                  <input style={T.input} value={urlEntry.auth_username} onChange={e => setUrlEntry(p => ({ ...p, auth_username: e.target.value }))}
                    placeholder="username" data-testid="url-auth-username" onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={{ ...T.label, fontSize: "11px" }}>Password</label>
                  <input style={T.input} type="password" value={urlEntry.auth_password} onChange={e => setUrlEntry(p => ({ ...p, auth_password: e.target.value }))}
                    placeholder="password" data-testid="url-auth-password" onFocus={onFocus} onBlur={onBlur} />
                </div>
              </div>
            </div>
            <div>
              <button onClick={scrapeUrl} disabled={scraping} data-testid="url-scrape-btn" style={{ ...T.btnPrimary, opacity: scraping ? 0.6 : 1 }}>
                {scraping ? <Loader2 size={14} className="animate-spin" /> : urlEntry.crawl_subpages ? <Network size={14} /> : <Globe size={14} />}
                {scraping ? (urlEntry.crawl_subpages ? "Crawling..." : "Scraping...") : (urlEntry.crawl_subpages ? "Crawl & Save" : "Scrape & Save")}
              </button>
            </div>
          </div>
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

      {/* Sources List */}
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
            <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, margin: 0 }}>
              Sorted by priority
            </p>
          </div>
        </div>

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
            {filteredSources.map((source, idx) => {
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
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <EditModal source={editing} onClose={() => setEditing(null)} onSaved={handleEditSaved} />
      )}
    </div>
  );
}
