import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Network, Plus, Loader2, Zap, Send, Headphones, Link2, Power, PowerOff, Play, Pause, MessageSquare, Settings, Activity, ChevronRight } from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur } from "@/theme";
import { toast } from "sonner";
import v2 from "@/utils/v2api";

const PROVIDER_META = {
  discord: { label: "Discord", icon: Zap, color: "#5865F2" },
  telegram: { label: "Telegram", icon: Send, color: "#26A5E4" },
  zendesk: { label: "Zendesk", icon: Headphones, color: "#03363D" },
};

const RESPONSE_MODES = [
  { value: "auto_reply", label: "Auto-Reply", desc: "Bot replies to customers automatically" },
  { value: "agent_assist", label: "Agent Assist", desc: "Suggests replies for agents to review" },
  { value: "internal_note", label: "Internal Note", desc: "Adds AI suggestion as a private note" },
  { value: "sidebar_only", label: "Sidebar Only", desc: "On-demand via sidebar, no automatic action" },
];

function ModeBadge({ mode }) {
  const modeMap = {
    auto_reply: { label: "Auto-Reply", bg: "rgba(52,211,153,0.08)", color: "#34D399", border: "rgba(52,211,153,0.2)" },
    agent_assist: { label: "Agent Assist", bg: "rgba(96,165,250,0.08)", color: "#60A5FA", border: "rgba(96,165,250,0.2)" },
    internal_note: { label: "Internal Note", bg: "rgba(251,191,36,0.08)", color: "#FBBF24", border: "rgba(251,191,36,0.2)" },
    sidebar_only: { label: "Sidebar Only", bg: "rgba(148,163,184,0.08)", color: "#94A3B8", border: "rgba(148,163,184,0.2)" },
  };
  const m = modeMap[mode] || modeMap.agent_assist;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: radius.full,
      fontSize: "10px", fontWeight: "600", fontFamily: fonts.mono, letterSpacing: "0.02em",
      backgroundColor: m.bg, color: m.color, border: `1px solid ${m.border}`,
    }}>
      {m.label}
    </span>
  );
}

export default function IntegrationsPage() {
  const { selectedOrg, selectedBot } = useAuth();
  const orgId = selectedOrg?.id;
  const botId = selectedBot?.id;

  const [connections, setConnections] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [detailConn, setDetailConn] = useState(null);
  const [detailTab, setDetailTab] = useState("connection");
  const [activity, setActivity] = useState([]);

  // Add form state
  const [addAccountId, setAddAccountId] = useState("");
  const [addName, setAddName] = useState("");
  const [addMode, setAddMode] = useState("agent_assist");
  const [addDest, setAddDest] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!orgId || !botId) return;
    setLoading(true);
    try {
      const [connRes, accRes] = await Promise.all([
        v2.listConnections(orgId, botId),
        v2.listAccounts(orgId),
      ]);
      setConnections(connRes.data.connections || []);
      setAccounts((accRes.data.accounts || []).filter(a => a.status === "connected"));
    } catch {
      toast.error("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [orgId, botId]);

  const handleToggle = async (conn) => {
    try {
      const res = await v2.toggleConnection(orgId, botId, conn.id);
      setConnections(prev => prev.map(c => c.id === conn.id ? { ...c, enabled: res.data.enabled } : c));
      toast.success(res.data.enabled ? "Connection enabled" : "Connection disabled");
    } catch {
      toast.error("Failed to toggle connection");
    }
  };

  const handleAdd = async () => {
    if (!addAccountId || !addName.trim()) return;
    setSaving(true);
    try {
      await v2.createConnection(orgId, botId, {
        account_id: addAccountId,
        name: addName.trim(),
        response_mode: addMode,
        destination: addDest,
      });
      toast.success("Connection created");
      setShowAdd(false);
      setAddAccountId("");
      setAddName("");
      setAddMode("agent_assist");
      setAddDest({});
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create connection");
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (conn) => {
    setDetailConn(conn);
    setDetailTab("connection");
    // Load activity
    try {
      const res = await v2.connectionActivity(orgId, botId, conn.id);
      setActivity(res.data.activity || []);
    } catch {
      setActivity([]);
    }
  };

  if (!selectedBot) return (
    <div style={T.page}>
      <p style={{ ...T.sectionSub, textAlign: "center", marginTop: "60px" }}>Select a bot to manage integrations.</p>
    </div>
  );

  // Detail view
  if (detailConn) {
    const meta = PROVIDER_META[detailConn.provider] || { label: detailConn.provider, icon: Link2, color: colors.text.muted };
    const Icon = meta.icon;
    return (
      <div style={T.page} data-testid="connection-detail-page">
        <button onClick={() => setDetailConn(null)} style={{ ...T.btnGhost, marginBottom: "16px", fontSize: "12px" }}>
          ← Back to Integrations
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: radius.md, backgroundColor: meta.color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={20} color={meta.color} />
          </div>
          <div>
            <h1 style={{ ...T.h1, margin: 0, fontSize: "22px" }}>{detailConn.name}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
              <ModeBadge mode={detailConn.response_mode} />
              <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>
                via {detailConn.account_name}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: `1px solid ${colors.border.default}`, paddingBottom: "2px" }}>
          {[
            { key: "connection", label: "Connection", icon: Link2 },
            { key: "behaviour", label: "Behaviour", icon: Settings },
            { key: "activity", label: "Activity", icon: Activity },
          ].map(tab => (
            <button key={tab.key} onClick={() => setDetailTab(tab.key)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "8px 16px", border: "none", cursor: "pointer",
                backgroundColor: detailTab === tab.key ? "rgba(59,130,246,0.1)" : "transparent",
                color: detailTab === tab.key ? colors.brand.light : colors.text.secondary,
                fontFamily: fonts.body, fontSize: "13px", fontWeight: detailTab === tab.key ? "600" : "400",
                borderRadius: `${radius.md} ${radius.md} 0 0`,
                transition: "all 0.15s",
              }}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {detailTab === "connection" && (
          <div style={T.card}>
            <h3 style={{ ...T.sectionTitle, marginBottom: "14px" }}>Connection Details</h3>
            <div style={{ display: "grid", gap: "10px" }}>
              <div><span style={T.monoLabel}>Provider</span><p style={{ margin: "4px 0 0", color: colors.text.primary, fontFamily: fonts.body }}>{meta.label}</p></div>
              <div><span style={T.monoLabel}>Account</span><p style={{ margin: "4px 0 0", color: colors.text.primary, fontFamily: fonts.body }}>{detailConn.account_name} ({detailConn.account_status})</p></div>
              <div><span style={T.monoLabel}>Response Mode</span><div style={{ marginTop: "4px" }}><ModeBadge mode={detailConn.response_mode} /></div></div>
              <div><span style={T.monoLabel}>Status</span><p style={{ margin: "4px 0 0", color: detailConn.enabled ? colors.brand.success : colors.brand.error, fontFamily: fonts.body }}>{detailConn.enabled ? "Enabled" : "Disabled"}</p></div>
              {detailConn.destination && Object.keys(detailConn.destination).length > 0 && (
                <div>
                  <span style={T.monoLabel}>Destination</span>
                  <pre style={{ margin: "4px 0 0", color: colors.text.secondary, fontFamily: fonts.mono, fontSize: "11px", whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(detailConn.destination, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {detailTab === "behaviour" && (
          <div style={T.card}>
            <h3 style={{ ...T.sectionTitle, marginBottom: "4px" }}>Effective Behaviour</h3>
            <p style={{ ...T.sectionSub, marginBottom: "16px" }}>
              Settings inherited from bot defaults. Override-specific settings are coming in Phase 3.
            </p>
            {detailConn.effective_settings && Object.entries(detailConn.effective_settings).map(([k, v]) => (
              <div key={k} style={{ marginBottom: "10px" }}>
                <span style={T.monoLabel}>{k.replace(/_/g, " ")}</span>
                <p style={{ margin: "2px 0 0", color: colors.text.primary, fontFamily: fonts.body, fontSize: "13px" }}>
                  {v === "" ? <span style={{ color: colors.text.muted, fontStyle: "italic" }}>Not set (using bot default)</span> : String(v).slice(0, 200)}
                </p>
              </div>
            ))}
          </div>
        )}

        {detailTab === "activity" && (
          <div style={T.card}>
            <h3 style={{ ...T.sectionTitle, marginBottom: "14px" }}>Recent Activity</h3>
            {activity.length === 0 ? (
              <p style={{ ...T.sectionSub, textAlign: "center", padding: "20px" }}>No activity recorded yet for this connection.</p>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                {activity.map((item, i) => (
                  <div key={i} style={{
                    padding: "10px 14px", borderRadius: radius.md,
                    backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.muted}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontFamily: fonts.body, fontSize: "12px", fontWeight: "600", color: colors.text.primary }}>
                        {item.platform || "unknown"}
                      </span>
                      <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>
                        {item.timestamp ? new Date(item.timestamp).toLocaleString() : "—"}
                      </span>
                    </div>
                    <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: 0 }}>
                      {(item.user_message || "").slice(0, 120)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={T.page} data-testid="integrations-page">
      <p style={T.overline}>Connections</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <h1 style={{ ...T.h1, margin: 0 }}>Integrations</h1>
        <button onClick={() => setShowAdd(true)} data-testid="add-connection-btn"
          style={{ ...T.btnPrimary, padding: "8px 16px", fontSize: "12px" }}>
          <Plus size={14} /> Add Connection
        </button>
      </div>

      {/* Add connection wizard */}
      {showAdd && (
        <div style={{ ...T.card, marginBottom: "20px", border: `1px solid ${colors.brand.primary}40` }}>
          <h3 style={{ ...T.sectionTitle, marginBottom: "14px" }}>Add Connection</h3>

          <label style={T.label}>Connected Account</label>
          <select value={addAccountId} onChange={e => { setAddAccountId(e.target.value); const acc = accounts.find(a => a.id === e.target.value); if (acc && !addName) setAddName(`${PROVIDER_META[acc.provider]?.label || acc.provider} — ${acc.name}`); }}
            style={{ ...T.input, marginBottom: "12px", cursor: "pointer" }}
            data-testid="connection-account-select">
            <option value="">Select an account...</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {(PROVIDER_META[acc.provider]?.label || acc.provider)} — {acc.name}
              </option>
            ))}
          </select>

          <label style={T.label}>Connection Name</label>
          <input value={addName} onChange={e => setAddName(e.target.value)}
            placeholder="e.g., Discord — #support" style={{ ...T.input, marginBottom: "12px" }}
            onFocus={onFocus} onBlur={onBlur} data-testid="connection-name-input" />

          <label style={T.label}>Response Mode</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "12px" }}>
            {RESPONSE_MODES.map(mode => (
              <button key={mode.value} onClick={() => setAddMode(mode.value)}
                data-testid={`mode-${mode.value}`}
                style={{
                  padding: "10px 14px", borderRadius: radius.md, cursor: "pointer",
                  border: `1px solid ${addMode === mode.value ? colors.brand.primary : colors.border.default}`,
                  backgroundColor: addMode === mode.value ? "rgba(59,130,246,0.08)" : colors.bg.panel,
                  textAlign: "left", transition: "all 0.15s",
                }}>
                <span style={{ fontFamily: fonts.body, fontSize: "12px", fontWeight: "600", color: addMode === mode.value ? colors.brand.light : colors.text.primary, display: "block" }}>
                  {mode.label}
                </span>
                <span style={{ fontFamily: fonts.body, fontSize: "10px", color: colors.text.muted }}>
                  {mode.desc}
                </span>
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button onClick={handleAdd} disabled={saving || !addAccountId || !addName.trim()}
              data-testid="save-connection-btn"
              style={{ ...T.btnPrimary, opacity: saving || !addAccountId || !addName.trim() ? 0.5 : 1 }}>
              {saving ? <Loader2 size={14} className="spin" /> : "Create Connection"}
            </button>
            <button onClick={() => { setShowAdd(false); setAddAccountId(""); setAddName(""); setAddDest({}); }}
              style={T.btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* Connection cards */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
          <Loader2 size={24} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : connections.length === 0 ? (
        <div style={{ ...T.card, textAlign: "center", padding: "48px" }}>
          <Network size={32} color={colors.text.muted} style={{ marginBottom: "12px" }} />
          <p style={{ ...T.sectionTitle, marginBottom: "8px" }}>No connections</p>
          <p style={T.sectionSub}>Add a connection to route messages from a provider to this bot.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {connections.map(conn => {
            const meta = PROVIDER_META[conn.provider] || { label: conn.provider, icon: Link2, color: colors.text.muted };
            const Icon = meta.icon;
            return (
              <div key={conn.id}
                data-testid={`connection-card-${conn.id}`}
                style={{
                  ...T.card, display: "flex", alignItems: "center", gap: "14px",
                  padding: "14px 18px", cursor: "pointer",
                  opacity: conn.enabled ? 1 : 0.6,
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onClick={() => openDetail(conn)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = meta.color + "50"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border.default; }}
              >
                <div style={{
                  width: "36px", height: "36px", borderRadius: radius.md,
                  backgroundColor: meta.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon size={16} color={meta.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                    <span style={{ fontFamily: fonts.heading, fontSize: "13px", fontWeight: "600", color: colors.text.primary }}>
                      {conn.name}
                    </span>
                    <ModeBadge mode={conn.response_mode} />
                  </div>
                  <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>
                    via {conn.account_name} · {conn.enabled ? "active" : "disabled"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <button
                    onClick={e => { e.stopPropagation(); handleToggle(conn); }}
                    title={conn.enabled ? "Disable" : "Enable"}
                    data-testid={`toggle-connection-${conn.id}`}
                    style={{
                      ...T.btnGhost, padding: "5px 10px",
                      color: conn.enabled ? colors.brand.success : colors.text.muted,
                      borderColor: conn.enabled ? "rgba(52,211,153,0.2)" : colors.border.default,
                    }}
                  >
                    {conn.enabled ? <Power size={13} /> : <PowerOff size={13} />}
                  </button>
                  <ChevronRight size={14} color={colors.text.muted} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
