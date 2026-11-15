import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Bot, Plus, Network, Loader2, Zap, Copy } from "lucide-react";
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

  useEffect(() => {
    if (!selectedOrg) return;
    setLoading(true);
    v2.listBots(selectedOrg.id)
      .then(r => setBots(r.data.bots || []))
      .catch(() => toast.error("Failed to load bots"))
      .finally(() => setLoading(false));
  }, [selectedOrg]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await v2.createBot(selectedOrg.id, { name: newName.trim() });
      setBots(prev => [...prev, res.data]);
      setNewName("");
      setShowCreate(false);
      refreshBots();
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

  if (!selectedOrg) return (
    <div style={T.page}>
      <p style={{ ...T.sectionSub, textAlign: "center", marginTop: "60px" }}>Select an organisation to view bots.</p>
    </div>
  );

  return (
    <div style={T.page} data-testid="bot-list-page">
      <p style={T.overline}>AI Bots</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <h1 style={{ ...T.h1, margin: 0 }}>Bots</h1>
        <button
          onClick={() => setShowCreate(true)}
          data-testid="create-bot-btn"
          style={{ ...T.btnPrimary, padding: "8px 16px", fontSize: "12px" }}
        >
          <Plus size={14} /> New Bot
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
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
            <button
              key={bot.id}
              onClick={() => openBot(bot)}
              data-testid={`bot-card-${bot.id}`}
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
                <div style={{ marginLeft: "auto" }}>
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
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
