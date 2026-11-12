import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import {
  Sparkles, Plus, Pencil, Trash2, Save, X, Loader2, Clock, Tag,
} from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur } from "../theme";

const card = {
  backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
  borderRadius: "12px", padding: "20px", marginBottom: "14px",
};

function FeatureTag({ text }) {
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: "20px",
      fontSize: "11px", fontFamily: fonts.body, fontWeight: "500",
      backgroundColor: "rgba(96,165,250,0.08)", color: "#93C5FD",
      border: "1px solid rgba(96,165,250,0.12)", marginRight: "6px", marginBottom: "4px",
    }}>
      {text}
    </span>
  );
}

function EntryEditor({ entry, onSave, onCancel, saving }) {
  const [version, setVersion] = useState(entry?.version || "");
  const [title, setTitle] = useState(entry?.title || "");
  const [description, setDescription] = useState(entry?.description || "");
  const [features, setFeatures] = useState((entry?.features || []).join("\n"));
  const [date, setDate] = useState(entry?.date || new Date().toISOString().slice(0, 10));

  const handleSubmit = () => {
    if (!version.trim() || !title.trim()) {
      toast.error("Version and title are required");
      return;
    }
    onSave({
      version: version.trim(),
      title: title.trim(),
      description: description.trim(),
      features: features.split("\n").map(f => f.trim()).filter(Boolean),
      date: date || new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div style={{ ...card, borderColor: "rgba(96,165,250,0.3)" }} data-testid="changelog-editor">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
        <div>
          <label style={T.label}>Version</label>
          <input value={version} onChange={e => setVersion(e.target.value)} placeholder="v2.5.0"
            style={T.input} onFocus={onFocus} onBlur={onBlur} data-testid="changelog-version-input" />
        </div>
        <div>
          <label style={T.label}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={T.input} data-testid="changelog-date-input" />
        </div>
      </div>
      <label style={T.label}>Title</label>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Telegram & Zendesk Integration"
        style={{ ...T.input, marginBottom: "10px" }} onFocus={onFocus} onBlur={onBlur} data-testid="changelog-title-input" />
      <label style={T.label}>Description</label>
      <textarea value={description} onChange={e => setDescription(e.target.value)}
        placeholder="Brief summary of what changed..."
        rows={2} style={{ ...T.input, resize: "vertical", marginBottom: "10px" }} onFocus={onFocus} onBlur={onBlur}
        data-testid="changelog-desc-input" />
      <label style={T.label}>Features (one per line)</label>
      <textarea value={features} onChange={e => setFeatures(e.target.value)}
        placeholder="Telegram bot integration with 3 listen modes&#10;Zendesk auto-reply and agent-assist&#10;Platform stats dashboard"
        rows={4} style={{ ...T.input, resize: "vertical", marginBottom: "14px" }} onFocus={onFocus} onBlur={onBlur}
        data-testid="changelog-features-input" />
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={handleSubmit} disabled={saving} data-testid="changelog-save-btn"
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "9px 20px", borderRadius: "10px", border: "none",
            background: "linear-gradient(135deg, #60A5FA, #A78BFA)",
            color: "#fff", fontSize: "13px", fontWeight: "600", fontFamily: fonts.body,
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.5 : 1,
          }}>
          {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
          {entry ? "Update" : "Publish"}
        </button>
        <button onClick={onCancel} style={{
          padding: "9px 16px", borderRadius: "10px",
          border: `1px solid ${colors.border.default}`, backgroundColor: colors.bg.base,
          color: colors.text.secondary, fontSize: "13px", fontFamily: fonts.body, cursor: "pointer",
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ChangelogPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | entry_id
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === "superadmin";

  const fetchEntries = useCallback(async () => {
    try {
      const res = await api.get("/changelog");
      setEntries(res.data.entries || []);
    } catch {
      toast.error("Failed to load changelog");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (editing === "new") {
        await api.post("/admin/changelog", data);
        toast.success("Changelog entry published");
      } else {
        await api.put(`/admin/changelog/${editing}`, data);
        toast.success("Entry updated");
      }
      setEditing(null);
      await fetchEntries();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this changelog entry?")) return;
    try {
      await api.delete(`/admin/changelog/${id}`);
      toast.success("Entry deleted");
      await fetchEntries();
    } catch {
      toast.error("Failed to delete");
    }
  };

  if (loading) {
    return (
      <div style={{ ...T.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={24} color={colors.text.muted} style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div style={T.page} data-testid="changelog-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <p style={T.overline}>Updates</p>
          <h1 style={T.h1}>Changelog</h1>
        </div>
        {isAdmin && editing === null && (
          <button onClick={() => setEditing("new")} data-testid="changelog-add-btn"
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "9px 18px", borderRadius: "10px", border: "none",
              background: "linear-gradient(135deg, #60A5FA, #A78BFA)",
              color: "#fff", fontSize: "13px", fontWeight: "600", fontFamily: fonts.body, cursor: "pointer",
            }}>
            <Plus size={14} /> New Entry
          </button>
        )}
      </div>

      {/* Editor */}
      {editing === "new" && (
        <EntryEditor onSave={handleSave} onCancel={() => setEditing(null)} saving={saving} />
      )}

      {/* Entries */}
      {entries.length === 0 && editing === null ? (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          backgroundColor: colors.bg.panel, borderRadius: "12px", border: `1px solid ${colors.border.default}`,
        }}>
          <Sparkles size={28} color={colors.text.muted} style={{ marginBottom: "12px" }} />
          <p style={{ fontFamily: fonts.heading, fontSize: "16px", color: colors.text.primary, margin: "0 0 6px" }}>
            No changelog entries yet
          </p>
          <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: 0 }}>
            {isAdmin ? "Click \"New Entry\" to publish your first update." : "Updates will appear here when published."}
          </p>
        </div>
      ) : (
        <div style={{ position: "relative", paddingLeft: "24px" }}>
          {/* Timeline line */}
          <div style={{
            position: "absolute", left: "7px", top: "8px", bottom: "8px", width: "2px",
            background: `linear-gradient(to bottom, ${colors.border.default}, transparent)`,
          }} />

          {entries.map((entry, i) => (
            <div key={entry.id} style={{ position: "relative", marginBottom: "20px" }} data-testid="changelog-entry">
              {/* Timeline dot */}
              <div style={{
                position: "absolute", left: "-20px", top: "24px",
                width: "12px", height: "12px", borderRadius: "50%",
                backgroundColor: i === 0 ? "#60A5FA" : colors.border.default,
                border: `2px solid ${colors.bg.panel}`,
              }} />

              {editing === entry.id ? (
                <EntryEditor entry={entry} onSave={handleSave} onCancel={() => setEditing(null)} saving={saving} />
              ) : (
                <div style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: "8px", fontSize: "12px", fontFamily: fonts.mono,
                        fontWeight: "700", backgroundColor: "rgba(96,165,250,0.1)", color: "#60A5FA",
                        border: "1px solid rgba(96,165,250,0.15)",
                      }}>
                        {entry.version}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: colors.text.muted, fontFamily: fonts.mono }}>
                        <Clock size={10} /> {entry.date}
                      </span>
                    </div>
                    {isAdmin && (
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button onClick={() => setEditing(entry.id)} data-testid="changelog-edit-btn"
                          style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: colors.text.muted }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(entry.id)} data-testid="changelog-delete-btn"
                          style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "rgba(244,63,94,0.5)" }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                  <h3 style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: "0 0 6px" }}>
                    {entry.title}
                  </h3>
                  {entry.description && (
                    <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: "0 0 12px", lineHeight: 1.6 }}>
                      {entry.description}
                    </p>
                  )}
                  {entry.features && entry.features.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
                      {entry.features.map((f, fi) => <FeatureTag key={fi} text={f} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
