import { useState, useEffect } from "react";
import { Layers, Building2, Bot, Link2, Users, ChevronRight, ChevronDown, Loader2, Search, Network } from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur } from "@/theme";
import v2 from "@/utils/v2api";

function MiniStat({ icon: Icon, value, label, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
      <Icon size={11} color={color || colors.text.muted} />
      <span style={{ fontFamily: fonts.mono, fontSize: "11px", fontWeight: "600", color: colors.text.primary }}>{value}</span>
      <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>{label}</span>
    </div>
  );
}

function RoleBadge({ role }) {
  const isAdmin = role === "admin" || role === "owner";
  return (
    <span style={{
      padding: "2px 8px", borderRadius: radius.full,
      fontSize: "9px", fontWeight: "600", fontFamily: fonts.mono,
      textTransform: "uppercase", letterSpacing: "0.08em",
      backgroundColor: isAdmin ? "rgba(96,165,250,0.08)" : "rgba(148,163,184,0.08)",
      color: isAdmin ? colors.brand.light : colors.text.muted,
      border: `1px solid ${isAdmin ? "rgba(96,165,250,0.2)" : "rgba(148,163,184,0.15)"}`,
    }}>
      {role}
    </span>
  );
}

function ProviderDot({ provider }) {
  const colorMap = { discord: "#5865F2", telegram: "#26A5E4", zendesk: "#03363D" };
  return (
    <span style={{
      width: "8px", height: "8px", borderRadius: "50%",
      backgroundColor: colorMap[provider] || colors.text.muted, display: "inline-block",
    }} title={provider} />
  );
}

export default function Workspaces() {
  const [workspaces, setWorkspaces] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedOrg, setExpandedOrg] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([v2.listWorkspaces(), v2.platformStats()])
      .then(([wsRes, statsRes]) => {
        setWorkspaces(wsRes.data.workspaces || []);
        setStats(statsRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = async (orgId) => {
    if (expandedOrg === orgId) {
      setExpandedOrg(null);
      setDetail(null);
      return;
    }
    setExpandedOrg(orgId);
    setDetailLoading(true);
    try {
      const res = await v2.workspaceDetail(orgId);
      setDetail(res.data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const filtered = workspaces.filter(w =>
    !search || w.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ padding: "60px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", color: colors.text.muted }}>
        <Loader2 size={18} className="animate-spin" /> Loading workspaces...
      </div>
    );
  }

  return (
    <div data-testid="workspaces-page" style={{ padding: "32px 40px", maxWidth: "1100px" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "6px" }}>
          Platform Admin
        </p>
        <h1 style={{ fontFamily: fonts.heading, fontSize: "28px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
          Workspaces & Users
        </h1>
        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, marginTop: "6px" }}>
          All organisations on the platform with their bots, accounts, and team members.
        </p>
      </div>

      {/* Summary stats */}
      {stats && (
        <div data-testid="workspace-stats" style={{
          display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "24px",
        }}>
          <MiniStat icon={Building2} value={stats.orgs} label="workspaces" color={colors.brand.light} />
          <MiniStat icon={Users} value={stats.users} label="users" color={colors.brand.warning} />
          <MiniStat icon={Bot} value={stats.bots} label="bots" color={colors.brand.success} />
          <MiniStat icon={Network} value={stats.connections} label="connections" color="#A78BFA" />
        </div>
      )}

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "20px", maxWidth: "320px" }}>
        <Search size={14} color={colors.text.muted} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
        <input
          data-testid="workspace-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search workspaces..."
          style={{ ...T.input, paddingLeft: "34px", fontSize: "12px" }}
          onFocus={onFocus} onBlur={onBlur}
        />
      </div>

      {/* Workspace list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filtered.length === 0 && (
          <p style={{ color: colors.text.muted, fontFamily: fonts.body, fontSize: "13px", textAlign: "center", padding: "40px" }}>
            No workspaces found.
          </p>
        )}

        {filtered.map(ws => {
          const isExpanded = expandedOrg === ws.id;
          return (
            <div key={ws.id} data-testid={`workspace-card-${ws.id}`} style={{
              backgroundColor: colors.bg.surface, borderRadius: radius.lg,
              border: `1px solid ${isExpanded ? colors.border.active : colors.border.default}`,
              overflow: "hidden", transition: "border-color 0.2s",
            }}>
              {/* Row header */}
              <button
                data-testid={`workspace-expand-${ws.id}`}
                onClick={() => toggleExpand(ws.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: "12px",
                  padding: "16px 20px", background: "none", border: "none", cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {isExpanded
                  ? <ChevronDown size={14} color={colors.brand.light} />
                  : <ChevronRight size={14} color={colors.text.muted} />}

                <Building2 size={16} color={isExpanded ? colors.brand.light : colors.text.secondary} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: fonts.body, fontSize: "14px", fontWeight: "600", color: colors.text.primary }}>
                    {ws.name}
                  </span>
                  {ws.description && (
                    <span style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted, marginLeft: "10px" }}>
                      {ws.description}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "16px", flexShrink: 0 }}>
                  <MiniStat icon={Bot} value={ws.bot_count || 0} label="bots" />
                  <MiniStat icon={Link2} value={ws.account_count || 0} label="accounts" />
                  <MiniStat icon={Network} value={ws.connection_count || 0} label="routes" />
                  <MiniStat icon={Users} value={ws.member_count || 0} label="members" />
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{
                  padding: "0 20px 20px", borderTop: `1px solid ${colors.border.muted}`,
                }}>
                  {detailLoading ? (
                    <div style={{ padding: "20px", display: "flex", alignItems: "center", gap: "8px", color: colors.text.muted }}>
                      <Loader2 size={14} className="animate-spin" /> Loading details...
                    </div>
                  ) : detail ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", paddingTop: "16px" }}>
                      {/* Members */}
                      <div>
                        <h4 style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 10px" }}>
                          Members ({detail.members?.length || 0})
                        </h4>
                        {(detail.members || []).map(m => (
                          <div key={m.id} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "6px 0", borderBottom: `1px solid ${colors.border.faint}`,
                          }}>
                            <div>
                              <span style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.primary, fontWeight: "500" }}>
                                {m.username || m.email}
                              </span>
                              {m.email && m.username && (
                                <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, marginLeft: "6px" }}>
                                  {m.email}
                                </span>
                              )}
                            </div>
                            <RoleBadge role={m.org_role} />
                          </div>
                        ))}
                        {(!detail.members || detail.members.length === 0) && (
                          <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted }}>No members</p>
                        )}
                      </div>

                      {/* Bots */}
                      <div>
                        <h4 style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 10px" }}>
                          Bots ({detail.bots?.length || 0})
                        </h4>
                        {(detail.bots || []).map(b => (
                          <div key={b.id} style={{
                            display: "flex", alignItems: "center", gap: "8px",
                            padding: "6px 0", borderBottom: `1px solid ${colors.border.faint}`,
                          }}>
                            <Bot size={12} color={colors.brand.light} />
                            <span style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.primary, fontWeight: "500" }}>{b.name}</span>
                          </div>
                        ))}
                        {(!detail.bots || detail.bots.length === 0) && (
                          <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted }}>No bots</p>
                        )}
                      </div>

                      {/* Accounts */}
                      <div>
                        <h4 style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 10px" }}>
                          Accounts ({detail.accounts?.length || 0})
                        </h4>
                        {(detail.accounts || []).map(a => (
                          <div key={a.id} style={{
                            display: "flex", alignItems: "center", gap: "8px",
                            padding: "6px 0", borderBottom: `1px solid ${colors.border.faint}`,
                          }}>
                            <ProviderDot provider={a.provider} />
                            <span style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.primary }}>{a.name}</span>
                            <span style={{
                              fontFamily: fonts.mono, fontSize: "9px",
                              color: a.status === "connected" ? colors.brand.success : colors.brand.error,
                            }}>{a.status}</span>
                          </div>
                        ))}
                        {(!detail.accounts || detail.accounts.length === 0) && (
                          <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.muted }}>No accounts</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: colors.text.muted, fontFamily: fonts.body, fontSize: "12px", padding: "16px 0" }}>
                      Failed to load details.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
