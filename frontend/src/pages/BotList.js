/**
 * Bots listing page — shows all bots for the selected organisation.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { Bot, Plus, ArrowRight, Loader2, Network } from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur, rowEnter, rowLeave } from "../theme";
import { toast } from "sonner";

export default function BotList() {
  const { selectedOrg, bots, refreshBots, api } = useSession();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !selectedOrg) return;
    setCreating(true);
    try {
      const data = await api.createBot(selectedOrg.id, { name: name.trim() });
      toast.success(`Bot "${name.trim()}" created`);
      setName(""); setShowCreate(false);
      await refreshBots();
      const newBot = data;
      if (newBot?.id) navigate(`/admin/bots/${newBot.id}`);
    } catch (err) {
      toast.error(err.detail || "Failed to create bot");
    } finally { setCreating(false); }
  };

  if (!selectedOrg) {
    return (
      <div style={{ ...T.page, textAlign: "center", paddingTop: "80px" }}>
        <Bot size={32} color={colors.border.default} style={{ margin: "0 auto 12px" }} />
        <p style={{ fontFamily: fonts.heading, fontSize: "18px", fontWeight: "600", color: colors.text.primary }}>Select an organisation first</p>
      </div>
    );
  }

  return (
    <div style={T.page} data-testid="bots-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <p style={T.overline}>{selectedOrg.name}</p>
          <h1 style={{ ...T.h1, marginBottom: 0 }}>Bots</h1>
        </div>
        <button onClick={() => setShowCreate(true)} data-testid="create-bot-btn"
          style={T.btnPrimary}>
          <Plus size={14} /> New Bot
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        }} onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div data-testid="create-bot-modal" style={{
            width: "400px", backgroundColor: colors.bg.panel, borderRadius: "16px",
            border: `1px solid ${colors.border.default}`, padding: "28px",
          }}>
            <h2 style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: "0 0 16px" }}>
              New Bot
            </h2>
            <label style={T.label}>Bot Name</label>
            <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Support Assistant" data-testid="new-bot-name" autoFocus
              style={{ ...T.input, marginBottom: "16px" }} onFocus={onFocus} onBlur={onBlur} />
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowCreate(false)} style={T.btnGhost}>Cancel</button>
              <button onClick={handleCreate} disabled={creating || !name.trim()} data-testid="confirm-create-bot"
                style={{ ...T.btnPrimary, opacity: creating || !name.trim() ? 0.6 : 1 }}>
                {creating ? "Creating..." : "Create Bot"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bot list */}
      {bots.length === 0 ? (
        <div style={{ ...T.card, textAlign: "center", padding: "48px 24px" }}>
          <Bot size={32} color={colors.border.default} style={{ margin: "0 auto 12px" }} />
          <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "600", color: colors.text.primary, margin: "0 0 6px" }}>
            No bots yet
          </p>
          <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary }}>
            Create your first AI bot to get started.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {bots.map(b => (
            <div key={b.id}
              style={{
                ...T.card, display: "flex", alignItems: "center", gap: "14px",
                padding: "16px 20px", cursor: "pointer", transition: "all 0.2s",
              }}
              onClick={() => navigate(`/admin/bots/${b.id}`)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = colors.brand.light; e.currentTarget.style.boxShadow = colors.shadow.cardHover; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border.default; e.currentTarget.style.boxShadow = colors.shadow.card; }}
              data-testid={`bot-card-${b.id}`}
            >
              <div style={{
                width: "36px", height: "36px", borderRadius: radius.md,
                backgroundColor: "rgba(59,130,246,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Bot size={18} color={colors.brand.light} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
                  {b.name}
                </p>
                <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "2px 0 0" }}>
                  {b.state || "active"}
                </p>
              </div>
              <ArrowRight size={14} color={colors.text.muted} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
