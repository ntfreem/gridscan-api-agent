import { useState, useEffect } from "react";
import { SlidersHorizontal, Zap, Send, Headphones, Wifi, WifiOff, Network, Activity, Loader2 } from "lucide-react";
import { colors, fonts, radius, T } from "@/theme";
import v2 from "@/utils/v2api";

const PROVIDERS = {
  discord: { label: "Discord", icon: Zap, color: "#5865F2", desc: "Connect Discord bot apps to guilds and channels" },
  telegram: { label: "Telegram", icon: Send, color: "#26A5E4", desc: "Connect Telegram bots via BotFather tokens" },
  zendesk: { label: "Zendesk", icon: Headphones, color: "#03363D", desc: "Connect Zendesk accounts via OAuth or API tokens" },
};

function StatChip({ label, value, color }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
      padding: "8px 16px", borderRadius: radius.md,
      backgroundColor: `${color}08`, border: `1px solid ${color}20`,
      minWidth: "80px",
    }}>
      <span style={{ fontFamily: fonts.heading, fontSize: "20px", fontWeight: "700", color }}>{value}</span>
      <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
    </div>
  );
}

export default function ProviderApps() {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([v2.listProviderApps(), v2.platformStats()])
      .then(([appsRes, statsRes]) => {
        setData(appsRes.data);
        setStats(statsRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "60px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", color: colors.text.muted }}>
        <Loader2 size={18} className="animate-spin" /> Loading provider apps...
      </div>
    );
  }

  const providers = data?.providers || [];

  return (
    <div data-testid="provider-apps-page" style={{ padding: "32px 40px", maxWidth: "1100px" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "6px" }}>
          Platform Admin
        </p>
        <h1 style={{ fontFamily: fonts.heading, fontSize: "28px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
          Provider Apps
        </h1>
        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, marginTop: "6px" }}>
          Manage provider integrations across your platform. Each provider represents a channel that bots can connect to.
        </p>
      </div>

      {/* Global Stats */}
      {stats && (
        <div data-testid="platform-stats" style={{
          display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "32px",
          padding: "20px", backgroundColor: colors.bg.surface, borderRadius: radius.lg,
          border: `1px solid ${colors.border.default}`,
        }}>
          <StatChip label="Accounts" value={stats.accounts} color={colors.brand.light} />
          <StatChip label="Connections" value={stats.connections} color={colors.brand.success} />
          <StatChip label="Bots" value={stats.bots} color={colors.brand.warning} />
          <StatChip label="Suggestions" value={stats.suggestions} color="#A78BFA" />

          <div style={{ flex: 1 }} />

          {/* Mode breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: "3px", justifyContent: "center" }}>
            <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>By Mode</span>
            {Object.entries(stats.mode_breakdown || {}).map(([mode, count]) => (
              <span key={mode} style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.secondary }}>
                {mode.replace("_", " ")}: <span style={{ color: colors.text.primary, fontWeight: "600" }}>{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Provider Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {providers.map(prov => {
          const meta = PROVIDERS[prov.provider] || {};
          const Icon = meta.icon || Network;
          const accts = prov.accounts || {};
          const conns = prov.connections || {};

          return (
            <div
              key={prov.provider}
              data-testid={`provider-card-${prov.provider}`}
              style={{
                padding: "24px", backgroundColor: colors.bg.surface,
                borderRadius: radius.lg, border: `1px solid ${colors.border.default}`,
                transition: "border-color 0.2s",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                {/* Provider icon + name */}
                <div style={{
                  width: "48px", height: "48px", borderRadius: radius.md,
                  backgroundColor: `${meta.color}15`, border: `1px solid ${meta.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon size={22} color={meta.color} />
                </div>

                <div style={{ flex: 1, minWidth: "200px" }}>
                  <h3 style={{ fontFamily: fonts.heading, fontSize: "18px", fontWeight: "600", color: colors.text.primary, margin: "0 0 4px" }}>
                    {meta.label}
                  </h3>
                  <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: 0 }}>
                    {meta.desc}
                  </p>
                </div>

                {/* Stats row */}
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                  {/* Accounts */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "6px 14px", borderRadius: radius.md,
                    backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.muted}`,
                  }}>
                    <Wifi size={12} color={colors.brand.success} />
                    <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.primary, fontWeight: "600" }}>
                      {accts.connected || 0}
                    </span>
                    <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>connected</span>
                    {accts.disconnected > 0 && (
                      <>
                        <span style={{ color: colors.border.default }}>·</span>
                        <WifiOff size={10} color={colors.brand.error} />
                        <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.brand.error }}>{accts.disconnected}</span>
                      </>
                    )}
                  </div>

                  {/* Connections */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "6px 14px", borderRadius: radius.md,
                    backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.muted}`,
                  }}>
                    <Network size={12} color={colors.brand.light} />
                    <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.primary, fontWeight: "600" }}>
                      {conns.enabled || 0}
                    </span>
                    <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>active</span>
                    {conns.disabled > 0 && (
                      <>
                        <span style={{ color: colors.border.default }}>·</span>
                        <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>{conns.disabled} paused</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
