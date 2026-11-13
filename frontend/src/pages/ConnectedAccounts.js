import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link2, Plus, Loader2, Zap, Send, Headphones, AlertCircle, WifiOff, Wifi, RefreshCw, Trash2, Edit2 } from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur } from "@/theme";
import { toast } from "sonner";
import v2 from "@/utils/v2api";

const PROVIDER_META = {
  discord: { label: "Discord", icon: Zap, color: "#5865F2" },
  telegram: { label: "Telegram", icon: Send, color: "#26A5E4" },
  zendesk: { label: "Zendesk", icon: Headphones, color: "#03363D" },
};

const PROVIDER_FIELDS = {
  discord: [
    { key: "bot_token", label: "Bot Token", type: "password", required: true },
  ],
  telegram: [
    { key: "bot_token", label: "Bot Token", type: "password", required: true },
  ],
  zendesk: [
    { key: "subdomain", label: "Zendesk Subdomain", type: "text", required: true },
    { key: "auth_type", label: "Auth Type", type: "select", options: ["oauth", "api_token"], required: true },
    { key: "api_token", label: "API Token (if token auth)", type: "password" },
    { key: "user_email", label: "Admin Email", type: "text" },
  ],
};

function StatusBadge({ status }) {
  const isConn = status === "connected";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 10px", borderRadius: radius.full,
      fontSize: "10px", fontWeight: "600", fontFamily: fonts.mono,
      backgroundColor: isConn ? "rgba(52,211,153,0.08)" : "rgba(244,63,94,0.08)",
      color: isConn ? colors.brand.success : colors.brand.error,
      border: `1px solid ${isConn ? "rgba(52,211,153,0.2)" : "rgba(244,63,94,0.2)"}`,
    }}>
      {isConn ? <Wifi size={9} /> : <WifiOff size={9} />}
      {status}
    </span>
  );
}

export default function ConnectedAccounts() {
  const { selectedOrg } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addProvider, setAddProvider] = useState("");
  const [addName, setAddName] = useState("");
  const [addCreds, setAddCreds] = useState({});
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);

  const fetchAccounts = () => {
    if (!selectedOrg) return;
    setLoading(true);
    v2.listAccounts(selectedOrg.id)
      .then(r => setAccounts(r.data.accounts || []))
      .catch(() => toast.error("Failed to load accounts"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAccounts(); }, [selectedOrg]);

  const handleAdd = async () => {
    if (!addProvider || !addName.trim()) return;
    setSaving(true);
    try {
      await v2.createAccount(selectedOrg.id, {
        provider: addProvider, name: addName.trim(), credentials: addCreds,
      });
      toast.success("Account connected");
      setShowAdd(false);
      setAddProvider("");
      setAddName("");
      setAddCreds({});
      fetchAccounts();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to add account");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (acc) => {
    if (acc.active_connection_count > 0) {
      if (!window.confirm(`This account has ${acc.active_connection_count} active connection(s). Disconnecting will disable them. Continue?`)) return;
    } else {
      if (!window.confirm(`Disconnect "${acc.name}"?`)) return;
    }
    try {
      const res = await v2.disconnectAccount(selectedOrg.id, acc.id);
      toast.success(res.data.warning || "Account disconnected");
      fetchAccounts();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to disconnect");
    }
  };

  const handleReconnect = async (acc) => {
    try {
      await v2.reconnectAccount(selectedOrg.id, acc.id);
      toast.success("Account reconnected");
      fetchAccounts();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to reconnect");
    }
  };

  if (!selectedOrg) return (
    <div style={T.page}>
      <p style={{ ...T.sectionSub, textAlign: "center", marginTop: "60px" }}>Select an organisation first.</p>
    </div>
  );

  return (
    <div style={T.page} data-testid="connected-accounts-page">
      <p style={T.overline}>Provider Accounts</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <h1 style={{ ...T.h1, margin: 0 }}>Connected Accounts</h1>
        <button onClick={() => setShowAdd(true)} data-testid="add-account-btn"
          style={{ ...T.btnPrimary, padding: "8px 16px", fontSize: "12px" }}>
          <Plus size={14} /> Connect Account
        </button>
      </div>

      {/* Add account form */}
      {showAdd && (
        <div style={{ ...T.card, marginBottom: "20px", border: `1px solid ${colors.brand.primary}40` }}>
          <h3 style={{ ...T.sectionTitle, marginBottom: "14px" }}>Connect a Provider Account</h3>

          {/* Provider selector */}
          {!addProvider ? (
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {Object.entries(PROVIDER_META).map(([key, meta]) => (
                <button key={key} onClick={() => setAddProvider(key)}
                  data-testid={`select-provider-${key}`}
                  style={{
                    ...T.card, cursor: "pointer", display: "flex", alignItems: "center", gap: "10px",
                    padding: "14px 20px", flex: "1", minWidth: "140px",
                    transition: "border-color 0.2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = meta.color}
                  onMouseLeave={e => e.currentTarget.style.borderColor = colors.border.default}
                >
                  <meta.icon size={20} color={meta.color} />
                  <span style={{ fontFamily: fonts.body, fontSize: "14px", fontWeight: "600", color: colors.text.primary }}>
                    {meta.label}
                  </span>
                </button>
              ))}
              <button onClick={() => setShowAdd(false)} style={{ ...T.btnGhost, alignSelf: "center" }}>Cancel</button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                {(() => { const M = PROVIDER_META[addProvider]; return <M.icon size={16} color={M.color} />; })()}
                <span style={{ fontFamily: fonts.body, fontSize: "14px", fontWeight: "600", color: colors.text.primary }}>
                  {PROVIDER_META[addProvider].label}
                </span>
                <button onClick={() => setAddProvider("")} style={{ ...T.btnGhost, marginLeft: "auto", fontSize: "11px" }}>
                  Change
                </button>
              </div>

              <label style={T.label}>Account Name</label>
              <input value={addName} onChange={e => setAddName(e.target.value)}
                placeholder={`e.g., My ${PROVIDER_META[addProvider].label} Bot`}
                style={{ ...T.input, marginBottom: "12px" }} onFocus={onFocus} onBlur={onBlur}
                data-testid="account-name-input" />

              {(PROVIDER_FIELDS[addProvider] || []).map(field => (
                <div key={field.key} style={{ marginBottom: "12px" }}>
                  <label style={T.label}>{field.label}</label>
                  {field.type === "select" ? (
                    <select
                      value={addCreds[field.key] || field.options[0]}
                      onChange={e => setAddCreds(prev => ({ ...prev, [field.key]: e.target.value }))}
                      style={{ ...T.input, cursor: "pointer" }}
                    >
                      {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type === "password" ? "password" : "text"}
                      value={addCreds[field.key] || ""}
                      onChange={e => setAddCreds(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.label}
                      style={T.input} onFocus={onFocus} onBlur={onBlur}
                      data-testid={`account-cred-${field.key}`}
                    />
                  )}
                </div>
              ))}

              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button onClick={handleAdd} disabled={saving || !addName.trim()}
                  data-testid="save-account-btn"
                  style={{ ...T.btnPrimary, opacity: saving || !addName.trim() ? 0.5 : 1 }}>
                  {saving ? <Loader2 size={14} className="spin" /> : "Connect"}
                </button>
                <button onClick={() => { setShowAdd(false); setAddProvider(""); setAddCreds({}); }}
                  style={T.btnGhost}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Account list */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
          <Loader2 size={24} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : accounts.length === 0 ? (
        <div style={{ ...T.card, textAlign: "center", padding: "48px" }}>
          <Link2 size={32} color={colors.text.muted} style={{ marginBottom: "12px" }} />
          <p style={{ ...T.sectionTitle, marginBottom: "8px" }}>No connected accounts</p>
          <p style={T.sectionSub}>Connect a Discord bot, Telegram bot, or Zendesk account to get started.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {accounts.map(acc => {
            const meta = PROVIDER_META[acc.provider] || { label: acc.provider, icon: Link2, color: colors.text.muted };
            const Icon = meta.icon;
            return (
              <div key={acc.id} style={{ ...T.card, display: "flex", alignItems: "center", gap: "14px", padding: "16px 20px" }}
                data-testid={`account-card-${acc.id}`}>
                <div style={{
                  width: "38px", height: "38px", borderRadius: radius.md,
                  backgroundColor: meta.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon size={18} color={meta.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "3px" }}>
                    <span style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary }}>
                      {acc.name}
                    </span>
                    <StatusBadge status={acc.status} />
                  </div>
                  <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>
                    {meta.label} · {acc.connection_count || 0} connection{acc.connection_count !== 1 ? "s" : ""}
                    {acc.active_connection_count > 0 && ` · ${acc.active_connection_count} active`}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  {acc.status === "disconnected" && (
                    <button onClick={() => handleReconnect(acc)} title="Reconnect"
                      style={{ ...T.btnGhost, color: colors.brand.success, borderColor: "rgba(52,211,153,0.3)" }}>
                      <RefreshCw size={12} /> Reconnect
                    </button>
                  )}
                  <button onClick={() => handleDisconnect(acc)} title="Disconnect"
                    data-testid={`disconnect-account-${acc.id}`}
                    style={{ ...T.btnGhost, color: colors.brand.error, borderColor: "rgba(244,63,94,0.2)" }}>
                    <WifiOff size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
