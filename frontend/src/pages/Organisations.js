import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Building2, Plus, Pencil, Check, X, Loader2,
  Bot, Link2, Network, Users, ArrowRight,
} from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur, rowEnter, rowLeave } from "../theme";
import { toast } from "sonner";
import v2 from "../utils/v2api";

export default function Organisations() {
  const { orgs, selectedOrg, selectOrg, refreshOrgs, selectedWorkspace } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Onboarding deep link from the Bots page: /admin/organisations?create=1&next=/admin/bots
  const nextPath = searchParams.get("next");
  const safeNext = nextPath && nextPath.startsWith("/admin/") ? nextPath : null;

  const [creating, setCreating] = useState(searchParams.get("create") === "1");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const res = await v2.createOrg({
        name,
        description: newDesc.trim(),
        ...(selectedWorkspace?.id && { workspace_id: selectedWorkspace.id }),
      });
      setCreating(false);
      setNewName("");
      setNewDesc("");
      // Refresh first, then select: refreshOrgs would otherwise restore the
      // previously selected org over the new one.
      await refreshOrgs();
      if (res?.data?.id) selectOrg(res.data);
      toast.success(`"${name}" created and selected`);
      if (safeNext) navigate(safeNext);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to create organisation");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (orgId) => {
    const name = editName.trim();
    if (!name) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      await v2.updateOrg(orgId, { name, description: editDesc.trim() });
      toast.success("Organisation updated");
      setEditId(null);
      await refreshOrgs();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (org) => {
    setEditId(org.id);
    setEditName(org.name || "");
    setEditDesc(org.description || "");
    setCreating(false);
  };

  const handleSelect = (org) => {
    selectOrg(org);
    navigate("/admin");
  };

  return (
    <div style={T.page} data-testid="organisations-page">
      <p style={T.overline}>Manage</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ ...T.h1, margin: 0 }}>Organisations</h1>
        {!creating && (
          <button
            data-testid="create-org-btn"
            onClick={() => { setCreating(true); setEditId(null); }}
            style={{ ...T.btn, display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={14} /> New Organisation
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <div data-testid="create-org-form" style={{
          ...T.card, marginBottom: "20px", padding: "20px",
          border: `1px solid ${colors.brand.light}40`,
        }}>
          <p style={{ ...T.monoLabel, marginBottom: "12px" }}>New Organisation</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <input
              data-testid="org-name-input"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Organisation name"
              style={T.input}
              onFocus={onFocus} onBlur={onBlur}
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
            />
            <input
              data-testid="org-desc-input"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              style={T.input}
              onFocus={onFocus} onBlur={onBlur}
            />
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                data-testid="cancel-create-org"
                onClick={() => { setCreating(false); setNewName(""); setNewDesc(""); }}
                style={T.btnGhost}
              >
                Cancel
              </button>
              <button
                data-testid="save-org-btn"
                onClick={handleCreate}
                disabled={saving || !newName.trim()}
                style={{
                  ...T.btn, opacity: saving || !newName.trim() ? 0.5 : 1,
                  display: "flex", alignItems: "center", gap: "5px",
                }}
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Org list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {orgs.length === 0 && !creating && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <Building2 size={36} color={colors.border.default} style={{ margin: "0 auto 12px" }} />
            <p style={{ fontFamily: fonts.heading, fontSize: "16px", color: colors.text.secondary, margin: "0 0 8px" }}>
              No organisations yet
            </p>
            <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, margin: "0 0 16px", lineHeight: 1.6 }}>
              Bots live inside an organisation: <strong>Workspace → Organisation → Bot</strong>.
              <br />Create your first organisation{selectedWorkspace?.name ? ` in ${selectedWorkspace.name}` : ""} to start adding bots.
            </p>
            <button data-testid="create-first-org" onClick={() => setCreating(true)} style={T.btn}>
              <Plus size={14} /> Create Organisation
            </button>
          </div>
        )}

        {orgs.map(org => {
          const isSelected = selectedOrg?.id === org.id;
          const isEditing = editId === org.id;

          return (
            <div
              key={org.id}
              data-testid={`org-card-${org.id}`}
              style={{
                backgroundColor: colors.bg.surface,
                borderRadius: radius.lg,
                border: `1px solid ${isSelected ? colors.brand.light + "50" : colors.border.default}`,
                overflow: "hidden",
                transition: "border-color 0.2s",
              }}
            >
              {isEditing ? (
                /* Edit mode */
                <div style={{ padding: "16px 20px" }} data-testid={`edit-org-form-${org.id}`}>
                  <p style={{ ...T.monoLabel, marginBottom: "10px" }}>Edit Organisation</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <input
                      data-testid={`edit-org-name-${org.id}`}
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Organisation name"
                      style={T.input}
                      onFocus={onFocus} onBlur={onBlur}
                      autoFocus
                      onKeyDown={e => { if (e.key === "Enter") handleUpdate(org.id); }}
                    />
                    <input
                      data-testid={`edit-org-desc-${org.id}`}
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      placeholder="Description (optional)"
                      style={T.input}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                      <button data-testid={`cancel-edit-${org.id}`} onClick={() => setEditId(null)} style={T.btnGhost}>
                        Cancel
                      </button>
                      <button
                        data-testid={`save-edit-${org.id}`}
                        onClick={() => handleUpdate(org.id)}
                        disabled={saving || !editName.trim()}
                        style={{ ...T.btn, opacity: saving || !editName.trim() ? 0.5 : 1, display: "flex", alignItems: "center", gap: "5px" }}
                      >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Display mode */
                <div style={{
                  display: "flex", alignItems: "center", gap: "14px",
                  padding: "16px 20px",
                }}>
                  {/* Icon */}
                  <div style={{
                    width: "40px", height: "40px", borderRadius: radius.md,
                    backgroundColor: isSelected ? "rgba(96,165,250,0.12)" : "rgba(148,163,184,0.08)",
                    border: `1.5px solid ${isSelected ? "rgba(96,165,250,0.3)" : colors.border.muted}`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Building2 size={18} color={isSelected ? colors.brand.light : colors.text.secondary} />
                  </div>

                  {/* Name + description */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontFamily: fonts.body, fontSize: "15px", fontWeight: "600", color: colors.text.primary }}>
                        {org.name}
                      </span>
                      {isSelected && (
                        <span style={{
                          padding: "1px 7px", borderRadius: radius.full,
                          fontSize: "8px", fontFamily: fonts.mono, fontWeight: "700",
                          textTransform: "uppercase", letterSpacing: "0.1em",
                          backgroundColor: "rgba(96,165,250,0.1)", color: colors.brand.light,
                          border: `1px solid rgba(96,165,250,0.2)`,
                        }}>
                          Active
                        </span>
                      )}
                    </div>
                    {org.description && (
                      <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, margin: "2px 0 0" }}>
                        {org.description}
                      </p>
                    )}
                  </div>

                  {/* Stats */}
                  <div style={{ display: "flex", gap: "14px", flexShrink: 0 }}>
                    <MiniCount icon={Bot} count={org.bot_count || 0} label="bots" />
                    <MiniCount icon={Link2} count={org.account_count || 0} label="accts" />
                    <MiniCount icon={Users} count={org.member_count || 0} label="mbrs" />
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "6px", flexShrink: 0, marginLeft: "8px" }}>
                    <button
                      data-testid={`edit-org-${org.id}`}
                      onClick={(e) => { e.stopPropagation(); startEdit(org); }}
                      title="Edit"
                      style={{
                        width: "32px", height: "32px", borderRadius: radius.md,
                        backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.muted}`,
                        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                        transition: "background-color 0.15s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.bg.hover}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = colors.bg.panel}
                    >
                      <Pencil size={12} color={colors.text.secondary} />
                    </button>

                    {!isSelected ? (
                      <button
                        data-testid={`select-org-${org.id}`}
                        onClick={() => handleSelect(org)}
                        style={{
                          display: "flex", alignItems: "center", gap: "5px",
                          padding: "6px 14px", borderRadius: radius.md,
                          backgroundColor: "rgba(96,165,250,0.08)", border: `1px solid rgba(96,165,250,0.2)`,
                          color: colors.brand.light, cursor: "pointer",
                          fontFamily: fonts.body, fontSize: "11px", fontWeight: "600",
                          transition: "background-color 0.15s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(96,165,250,0.15)"}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = "rgba(96,165,250,0.08)"}
                      >
                        Switch <ArrowRight size={11} />
                      </button>
                    ) : (
                      <button
                        data-testid={`go-overview-${org.id}`}
                        onClick={() => navigate("/admin")}
                        style={{
                          display: "flex", alignItems: "center", gap: "5px",
                          padding: "6px 14px", borderRadius: radius.md,
                          backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.muted}`,
                          color: colors.text.secondary, cursor: "pointer",
                          fontFamily: fonts.body, fontSize: "11px", fontWeight: "600",
                        }}
                      >
                        Overview <ArrowRight size={11} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function MiniCount({ icon: Icon, count, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <Icon size={11} color={colors.text.muted} />
      <span style={{ fontFamily: fonts.mono, fontSize: "11px", fontWeight: "600", color: colors.text.primary }}>
        {count}
      </span>
      <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted }}>{label}</span>
    </div>
  );
}
