import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Bot, Plus, Network, Loader2, Zap, Copy, LayoutTemplate, Trash2, ArrowRight } from "lucide-react";
import { colors, fonts, radius, T } from "@/theme";
import { toast } from "sonner";
import v2 from "@/utils/v2api";

export default function BotList() {
  const { selectedOrg, selectBot, refreshBots } = useAuth();
  const navigate = useNavigate();
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [cloning, setCloning] = useState(null);
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Templates
  const [tab, setTab] = useState("bots"); // "bots" | "templates"
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [creatingFromTpl, setCreatingFromTpl] = useState(null);
  const [deletingTpl, setDeletingTpl] = useState(null);

  useEffect(() => {
    if (!selectedOrg) return;
    setLoading(true);
    v2.listBots(selectedOrg.id)
      .then(r => setBots(r.data.bots || []))
      .catch(() => toast.error("Failed to load bots"))
      .finally(() => setLoading(false));
  }, [selectedOrg]);

  useEffect(() => {
    if (!selectedOrg || tab !== "templates") return;
    setTemplatesLoading(true);
    v2.listTemplates(selectedOrg.id)
      .then(r => setTemplates(r.data.templates || []))
      .catch(() => toast.error("Failed to load templates"))
      .finally(() => setTemplatesLoading(false));
  }, [selectedOrg, tab]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await v2.createBot(selectedOrg.id, { name: newName.trim() });
      setBots(prev => [...prev, res.data]);
      setNewName("");
      setShowCreate(false);
      await refreshBots();
      // Auto-select and navigate to the new bot
      selectBot(res.data);
      navigate(`/admin/bots/${res.data.id}`);
      toast.success(`Bot "${res.data.name}" created`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create bot");
    } finally {
      setCreating(false);
    }
  };

  const openBot = (bot) => {
    selectBot(bot);
    navigate(`/admin/bots/${bot.id}`);
  };

  const handleClone = async (e, bot) => {
    e.stopPropagation();
    setCloning(bot.id);
    try {
      const res = await v2.cloneBot(selectedOrg.id, bot.id);
      setBots(prev => [...prev, res.data]);
      refreshBots();
      toast.success(`Cloned "${bot.name}" → "${res.data.name}"`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to clone bot");
    } finally {
      setCloning(null);
    }
  };

  const [deletingBot, setDeletingBot] = useState(null);
  const handleDeleteBot = async (e, bot) => {
    e.stopPropagation();
    if (!confirm(`Delete bot "${bot.name}"? This cannot be undone.`)) return;
    setDeletingBot(bot.id);
    try {
      await v2.deleteBot(selectedOrg.id, bot.id);
      setBots(prev => prev.filter(b => b.id !== bot.id));
      refreshBots();
      toast.success(`Bot "${bot.name}" deleted`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete bot");
    } finally {
      setDeletingBot(null);
    }
  };

  const handleCreateFromTemplate = async (tpl) => {
    const name = prompt("Bot name:", tpl.name.replace(/ Template$/, ""));
    if (!name) return;
    setCreatingFromTpl(tpl.id);
    try {
      const res = await v2.createBotFromTemplate(selectedOrg.id, tpl.id, { name: name.trim() });
      setBots(prev => [...prev, res.data]);
      refreshBots();
      toast.success(`Bot "${res.data.name}" created from template`);
      setTab("bots");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create bot from template");
    } finally {
      setCreatingFromTpl(null);
    }
  };

  const handleDeleteTemplate = async (e, tpl) => {
    e.stopPropagation();
    if (!confirm(`Delete template "${tpl.name}"?`)) return;
    setDeletingTpl(tpl.id);
    try {
      await v2.deleteTemplate(selectedOrg.id, tpl.id);
      setTemplates(prev => prev.filter(t => t.id !== tpl.id));
      toast.success("Template deleted");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete template");
    } finally {
      setDeletingTpl(null);
    }
  };

  if (!selectedOrg) return (
    <div style={T.page}>
      <p style={{ ...T.sectionSub, textAlign: "center", marginTop: "60px" }}>Select an organisation to view bots.</p>
    </div>
  );

  const tabStyle = (active) => ({
    background: "none",
    border: "none",
    borderBottom: `2px solid ${active ? colors.brand.primary : "transparent"}`,
    padding: "10px 18px",
    cursor: "pointer",
    fontFamily: fonts.heading,
    fontSize: "13px",
    fontWeight: active ? "600" : "400",
    color: active ? colors.brand.light : colors.text.secondary,
    transition: "color 0.15s, border-color 0.15s",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  });

  return (
    <div style={T.page} data-testid="bot-list-page">
      <p style={T.overline}>AI Bots</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <h1 style={{ ...T.h1, margin: 0 }}>Bots</h1>
        {tab === "bots" && (
          <button
            onClick={() => setShowCreate(true)}
            data-testid="create-bot-btn"
            style={{ ...T.btnPrimary, padding: "8px 16px", fontSize: "12px" }}
          >
            <Plus size={14} /> New Bot
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${colors.border.default}`, marginBottom: "20px" }}>
        <button style={tabStyle(tab === "bots")} onClick={() => setTab("bots")} data-testid="tab-bots">
          <Bot size={14} /> Bots {bots.length > 0 && <span style={{ fontSize: "11px", opacity: 0.6 }}>({bots.length})</span>}
        </button>
        <button style={tabStyle(tab === "templates")} onClick={() => setTab("templates")} data-testid="tab-templates">
          <LayoutTemplate size={14} /> Templates {templates.length > 0 && <span style={{ fontSize: "11px", opacity: 0.6 }}>({templates.length})</span>}
        </button>
      </div>

      {/* Create bot modal */}
      {showCreate && tab === "bots" && (
        <div style={{ ...T.card, marginBottom: "20px", border: `1px solid ${colors.brand.primary}40` }}>
          <h3 style={{ ...T.sectionTitle, marginBottom: "12px" }}>Create New Bot</h3>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Bot name (e.g., Customer Support Bot)"
              data-testid="new-bot-name-input"
              style={{ ...T.input, flex: 1 }}
              autoFocus
              onKeyDown={e => e.key === "Enter" && handleCreate()}
            />
            <button onClick={handleCreate} disabled={creating || !newName.trim()}
              data-testid="save-bot-btn"
              style={{ ...T.btnPrimary, opacity: creating || !newName.trim() ? 0.5 : 1 }}>
              {creating ? <Loader2 size={14} className="spin" /> : "Create"}
            </button>
            <button onClick={() => setShowCreate(false)} style={T.btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* ─── BOTS TAB ─── */}
      {tab === "bots" && (
        <>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
              <Loader2 size={24} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : bots.length === 0 ? (
            <div style={{ ...T.card, textAlign: "center", padding: "48px" }}>
              <Bot size={32} color={colors.text.muted} style={{ marginBottom: "12px" }} />
              <p style={{ ...T.sectionTitle, marginBottom: "8px" }}>No bots yet</p>
              <p style={T.sectionSub}>Create your first AI bot to start connecting it to channels.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {bots.map(bot => (
                <div
                  key={bot.id}
                  onClick={() => openBot(bot)}
                  data-testid={`bot-card-${bot.id}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && openBot(bot)}
                  style={{
                    ...T.card, cursor: "pointer", textAlign: "left", width: "100%",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    borderColor: colors.border.default,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = colors.brand.primary + "60"; e.currentTarget.style.boxShadow = colors.shadow.cardHover; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border.default; e.currentTarget.style.boxShadow = colors.shadow.card; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                    <div style={{
                      width: "36px", height: "36px", borderRadius: radius.md,
                      background: `linear-gradient(135deg, ${colors.brand.primary}30, ${colors.brand.light}15)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Bot size={18} color={colors.brand.light} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
                        {bot.name}
                      </p>
                      {bot.description && (
                        <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {bot.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <Network size={12} color={colors.text.muted} />
                      <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.secondary }}>
                        {bot.active_connection_count || 0}/{bot.connection_count || 0} active
                      </span>
                    </div>
                    {bot.knowledge_gate && (
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <Zap size={12} color={colors.text.muted} />
                        <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.secondary }}>
                          {bot.knowledge_gate}
                        </span>
                      </div>
                    )}
                    <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                      <button
                        onClick={(e) => handleClone(e, bot)}
                        disabled={cloning === bot.id}
                        data-testid={`clone-bot-${bot.id}`}
                        title="Clone this bot"
                        style={{
                          background: "none", border: `1px solid ${colors.border.default}`,
                          borderRadius: radius.sm, padding: "4px 10px", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: "5px",
                          color: colors.text.secondary, fontSize: "11px", fontFamily: fonts.body,
                          transition: "border-color 0.15s, color 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = colors.brand.primary; e.currentTarget.style.color = colors.brand.light; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border.default; e.currentTarget.style.color = colors.text.secondary; }}
                      >
                        {cloning === bot.id ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Copy size={11} />}
                        Clone
                      </button>
                      <button
                        onClick={(e) => handleDeleteBot(e, bot)}
                        disabled={deletingBot === bot.id}
                        data-testid={`delete-bot-${bot.id}`}
                        title="Delete this bot"
                        style={{
                          background: "none", border: `1px solid ${colors.border.default}`,
                          borderRadius: radius.sm, padding: "4px 8px", cursor: "pointer",
                          display: "flex", alignItems: "center",
                          color: colors.brand.error, fontSize: "11px", fontFamily: fonts.body,
                          opacity: 0.6, transition: "opacity 0.15s, border-color 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.borderColor = colors.brand.error; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = "0.6"; e.currentTarget.style.borderColor = colors.border.default; }}
                      >
                        {deletingBot === bot.id ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={11} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── TEMPLATES TAB ─── */}
      {tab === "templates" && (
        <>
          {templatesLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
              <Loader2 size={24} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : templates.length === 0 ? (
            <div style={{ ...T.card, textAlign: "center", padding: "48px" }}>
              <LayoutTemplate size={32} color={colors.text.muted} style={{ marginBottom: "12px" }} />
              <p style={{ ...T.sectionTitle, marginBottom: "8px" }}>No templates yet</p>
              <p style={T.sectionSub}>Go to a bot's settings and click "Save as Template" to create one.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {templates.map(tpl => (
                <div
                  key={tpl.id}
                  data-testid={`template-card-${tpl.id}`}
                  style={{
                    ...T.card,
                    borderColor: colors.border.default,
                    position: "relative",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                    <div style={{
                      width: "36px", height: "36px", borderRadius: radius.md,
                      background: `linear-gradient(135deg, ${colors.brand.primary}15, ${colors.brand.light}08)`,
                      border: `1px dashed ${colors.brand.primary}40`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <LayoutTemplate size={17} color={colors.brand.light} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: fonts.heading, fontSize: "15px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
                        {tpl.name}
                      </p>
                      <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, margin: "2px 0 0" }}>
                        from {tpl.source_bot_name || "unknown bot"}
                      </p>
                    </div>
                  </div>

                  {/* Persona preview */}
                  {tpl.persona && (
                    <p style={{
                      fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary,
                      margin: "0 0 12px", lineHeight: "1.5",
                      overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }}>
                      {tpl.persona}
                    </p>
                  )}

                  {/* Meta badges */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
                    {tpl.knowledge_gate && (
                      <span style={{
                        fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted,
                        background: colors.bg.surface, border: `1px solid ${colors.border.default}`,
                        borderRadius: radius.sm, padding: "2px 8px", display: "flex", alignItems: "center", gap: "4px",
                      }}>
                        <Zap size={10} /> {tpl.knowledge_gate}
                      </span>
                    )}
                    {tpl.tone_instructions && (
                      <span style={{
                        fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted,
                        background: colors.bg.surface, border: `1px solid ${colors.border.default}`,
                        borderRadius: radius.sm, padding: "2px 8px",
                      }}>
                        Tone set
                      </span>
                    )}
                    {(tpl.manual_tone_examples || []).length > 0 && (
                      <span style={{
                        fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted,
                        background: colors.bg.surface, border: `1px solid ${colors.border.default}`,
                        borderRadius: radius.sm, padding: "2px 8px",
                      }}>
                        {tpl.manual_tone_examples.length} example{tpl.manual_tone_examples.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => handleCreateFromTemplate(tpl)}
                      disabled={creatingFromTpl === tpl.id}
                      data-testid={`use-template-${tpl.id}`}
                      style={{
                        ...T.btnPrimary, flex: 1, fontSize: "12px", padding: "7px 14px",
                        opacity: creatingFromTpl === tpl.id ? 0.6 : 1,
                      }}
                    >
                      {creatingFromTpl === tpl.id
                        ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                        : <><ArrowRight size={12} /> Use Template</>
                      }
                    </button>
                    <button
                      onClick={(e) => handleDeleteTemplate(e, tpl)}
                      disabled={deletingTpl === tpl.id}
                      data-testid={`delete-template-${tpl.id}`}
                      title="Delete template"
                      style={{
                        ...T.btnGhost, padding: "7px 10px",
                        color: deletingTpl === tpl.id ? colors.text.muted : colors.brand.error,
                        opacity: deletingTpl === tpl.id ? 0.5 : 0.7,
                      }}
                    >
                      {deletingTpl === tpl.id
                        ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                        : <Trash2 size={13} />
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
