/**
 * BotIntegrations — Zendesk and external API integrations for a bot.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import {
  Headphones, Plus, Loader2, ArrowRight, Zap, Code2, Trash2,
  ExternalLink, TestTube, CheckCircle, XCircle,
} from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur, rowEnter, rowLeave } from "../theme";
import { toast } from "sonner";

const INTEGRATION_TYPES = [
  { value: "zendesk", label: "Zendesk", icon: Headphones, color: "#03363D" },
  { value: "api", label: "External API", icon: Code2, color: "#A78BFA" },
];

export default function BotIntegrationsPage() {
  const { botId } = useParams();
  const { api } = useSession();
  const navigate = useNavigate();
  const [bot, setBot] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [intName, setIntName] = useState("");
  const [intType, setIntType] = useState("zendesk");
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    if (!botId) return;
    setLoading(true);
    try {
      const [botData, intData] = await Promise.all([
        api.bot(botId).catch(() => null),
        api.integrations(botId).catch(() => ({ integrations: [] })),
      ]);
      if (botData) setBot(botData);
      setIntegrations(intData?.integrations || intData || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [botId, api]);

  const handleCreate = async () => {
    if (!intName.trim()) return;
    setCreating(true);
    try {
      await api.createIntegration(botId, { name: intName.trim(), kind: intType });
      toast.success(`Integration "${intName.trim()}" created`);
      setIntName(""); setShowCreate(false);
      fetchData();
    } catch (err) { toast.error(err.detail || "Failed to create integration"); }
    finally { setCreating(false); }
  };

  const handleDelete = async (intId) => {
    if (!window.confirm("Delete this integration?")) return;
    try {
      await api.deleteIntegration(intId);
      toast.success("Integration deleted");
      fetchData();
    } catch (err) { toast.error(err.detail || "Failed to delete"); }
  };

  const handleTest = async (intId) => {
    try {
      const r = await api.integrationTest(intId);
      toast.success(r.message || "Test passed");
    } catch (err) { toast.error(err.detail || "Test failed"); }
  };

  if (loading) {
    return (
      <div style={{ ...T.page, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "100px" }}>
        <Loader2 size={20} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={T.page} data-testid="bot-integrations-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <p style={T.overline}>{bot?.name || "Bot"}</p>
          <h1 style={{ ...T.h1, marginBottom: 0 }}>Integrations</h1>
        </div>
        <button onClick={() => setShowCreate(true)} data-testid="create-integration-btn" style={T.btnPrimary}>
          <Plus size={14} /> New Integration
        </button>
      </div>

      {showCreate && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        }} onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div data-testid="create-integration-modal" style={{
            width: "420px", backgroundColor: colors.bg.panel, borderRadius: "16px",
            border: `1px solid ${colors.border.default}`, padding: "28px",
          }}>
            <h2 style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: "0 0 16px" }}>
              New Integration
            </h2>
            <label style={T.label}>Name</label>
            <input value={intName} onChange={e => setIntName(e.target.value)} data-testid="integration-name-input"
              placeholder="e.g. Zendesk Support" style={{ ...T.input, marginBottom: "12px" }} onFocus={onFocus} onBlur={onBlur} />
            <label style={T.label}>Type</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
              {INTEGRATION_TYPES.map(t => {
                const selected = intType === t.value;
                return (
                  <button key={t.value} onClick={() => setIntType(t.value)}
                    style={{
                      padding: "14px", borderRadius: radius.md, cursor: "pointer",
                      backgroundColor: selected ? `${t.color}14` : colors.bg.surface,
                      border: `1.5px solid ${selected ? t.color : colors.border.default}`,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                      transition: "all 0.15s",
                    }}>
                    <t.icon size={20} color={selected ? t.color : colors.text.muted} />
                    <span style={{ fontFamily: fonts.body, fontSize: "11px", fontWeight: "600", color: selected ? t.color : colors.text.secondary }}>
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowCreate(false)} style={T.btnGhost}>Cancel</button>
              <button onClick={handleCreate} disabled={creating || !intName.trim()} data-testid="confirm-create-integration"
                style={{ ...T.btnPrimary, opacity: creating || !intName.trim() ? 0.6 : 1 }}>
                {creating ? "Creating..." : "Create Integration"}
              </button>
            </div>
          </div>
        </div>
      )}

      {integrations.length === 0 ? (
        <div style={{ ...T.card, textAlign: "center", padding: "48px 24px" }}>
          <Headphones size={32} color={colors.border.default} style={{ margin: "0 auto 12px" }} />
          <p style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "600", color: colors.text.primary, margin: "0 0 6px" }}>
            No integrations yet
          </p>
          <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary }}>
            Connect Zendesk or external APIs to extend your bot.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {integrations.map(integ => {
            const meta = INTEGRATION_TYPES.find(t => t.value === integ.kind) || INTEGRATION_TYPES[1];
            return (
              <div key={integ.id} data-testid={`integration-card-${integ.id}`}
                style={{
                  ...T.card, display: "flex", alignItems: "center", gap: "14px",
                  padding: "16px 20px", transition: "all 0.2s",
                }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: radius.md,
                  backgroundColor: `${meta.color}14`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <meta.icon size={18} color={meta.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, margin: 0 }}>
                    {integ.name}
                  </p>
                  <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "2px 0 0" }}>
                    {meta.label} • {integ.state || "active"}
                  </p>
                </div>
                <button onClick={() => handleTest(integ.id)} style={{ ...T.btnGhost, fontSize: "11px" }}>
                  <TestTube size={12} /> Test
                </button>
                <button onClick={() => handleDelete(integ.id)}
                  style={{ ...T.btnGhost, fontSize: "11px", color: colors.brand.error, borderColor: "rgba(244,63,94,0.3)" }}>
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
