import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "react-router-dom";
import v2 from "@/utils/v2api";
import { colors, fonts, radius, T, onFocus, onBlur } from "@/theme";
import {
  Settings, Users, CreditCard, Zap, Loader2, Trash2, Plus, Shield, Edit2, Check, X,
  Building2, Bot, ChevronRight, Crown,
} from "lucide-react";
import { toast } from "sonner";

function TabButton({ active, icon: Icon, label, onClick, testId }) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "10px 18px", border: "none", cursor: "pointer",
        fontFamily: fonts.body, fontSize: "13px", fontWeight: active ? "600" : "400",
        color: active ? colors.brand.light : colors.text.secondary,
        backgroundColor: active ? "rgba(59,130,246,0.08)" : "transparent",
        borderBottom: active ? `2px solid ${colors.brand.light}` : "2px solid transparent",
        transition: "all 0.15s",
      }}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <h2 style={{ fontFamily: fonts.heading, fontSize: "18px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, marginTop: "4px" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function RoleBadge({ role }) {
  const isOwner = role === "owner";
  const c = isOwner ? "#F59E0B" : colors.brand.light;
  return (
    <span style={{
      padding: "2px 8px", borderRadius: radius.full,
      fontSize: "9px", fontWeight: "600", fontFamily: fonts.mono,
      textTransform: "uppercase", letterSpacing: "0.08em",
      backgroundColor: `${c}15`, color: c, border: `1px solid ${c}30`,
    }}>
      {isOwner && <Crown size={8} style={{ marginRight: "3px", verticalAlign: "middle" }} />}
      {role}
    </span>
  );
}

// ── General Tab ──
function GeneralTab({ workspace, onRefresh }) {
  const [name, setName] = useState(workspace?.name || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setName(workspace?.name || ""); }, [workspace]);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await v2.updateWorkspace(workspace.id, { name: name.trim() });
      toast.success("Workspace updated");
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update");
    } finally { setSaving(false); }
  };

  if (!workspace) return null;
  return (
    <div>
      <SectionTitle title="General Settings" subtitle="Manage your workspace name and details" />
      <div style={{ maxWidth: "480px" }}>
        <label style={T.label}>Workspace Name</label>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            data-testid="ws-name-input"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ ...T.input, flex: 1 }}
            onFocus={onFocus} onBlur={onBlur}
          />
          <button
            data-testid="ws-name-save"
            onClick={save}
            disabled={saving || name.trim() === workspace.name}
            style={{ ...T.btnPrimary, opacity: saving || name.trim() === workspace.name ? 0.5 : 1, padding: "8px 16px" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : "Save"}
          </button>
        </div>
        <div style={{ marginTop: "20px", padding: "16px", backgroundColor: colors.bg.panel, borderRadius: radius.md, border: `1px solid ${colors.border.default}` }}>
          <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "0 0 4px" }}>WORKSPACE ID</p>
          <p style={{ fontFamily: fonts.mono, fontSize: "12px", color: colors.text.secondary, margin: 0, wordBreak: "break-all" }}>{workspace.id}</p>
          <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "12px 0 4px" }}>SLUG</p>
          <p style={{ fontFamily: fonts.mono, fontSize: "12px", color: colors.text.secondary, margin: 0 }}>{workspace.slug}</p>
          <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "12px 0 4px" }}>CREATED</p>
          <p style={{ fontFamily: fonts.mono, fontSize: "12px", color: colors.text.secondary, margin: 0 }}>{new Date(workspace.created_at).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}

// ── Members Tab ──
function MembersTab({ workspace }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await v2.getWorkspaceMembers(workspace.id);
      setMembers(res.data.members || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { if (workspace) load(); }, [workspace]); // eslint-disable-line

  const removeMember = async (userId, email) => {
    if (!confirm(`Remove ${email} from this workspace?`)) return;
    try {
      await v2.removeWorkspaceMember(workspace.id, userId);
      toast.success(`${email} removed`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to remove member");
    }
  };

  return (
    <div>
      <SectionTitle title="Workspace Members" subtitle="Manage who has access to this workspace" />
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: colors.text.muted, padding: "20px 0" }}>
          <Loader2 size={14} className="animate-spin" /> Loading members...
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxWidth: "600px" }}>
          {members.map(m => (
            <div key={m.user_id} data-testid={`ws-member-${m.user_id}`}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", backgroundColor: colors.bg.surface,
                border: `1px solid ${colors.border.default}`, borderRadius: radius.md,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <span style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "500", color: colors.text.primary }}>
                  {m.username || m.email}
                </span>
                {m.username && m.email && (
                  <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, marginLeft: "8px" }}>{m.email}</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <RoleBadge role={m.role} />
                {!m.is_owner && (
                  <button
                    data-testid={`ws-remove-member-${m.user_id}`}
                    onClick={() => removeMember(m.user_id, m.email || m.username)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "4px" }}
                    title="Remove member"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <p style={{ color: colors.text.muted, fontSize: "13px" }}>No members found.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Billing Tab ──
function BillingTab({ workspace }) {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace) return;
    v2.getWorkspaceBilling(workspace.id)
      .then(res => setBilling(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspace]);

  if (loading) {
    return <div style={{ display: "flex", alignItems: "center", gap: "8px", color: colors.text.muted }}><Loader2 size={14} className="animate-spin" /> Loading billing...</div>;
  }

  const plan = billing?.billing || {};
  const limits = plan.limits || {};
  const usage = billing?.usage || {};

  return (
    <div>
      <SectionTitle title="Billing & Limits" subtitle="Your workspace plan, limits, and current usage" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", maxWidth: "600px" }}>
        {/* Plan card */}
        <div style={{
          padding: "20px", backgroundColor: colors.bg.surface, borderRadius: radius.lg,
          border: `1px solid ${colors.border.default}`, gridColumn: "1 / -1",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", margin: "0 0 4px" }}>CURRENT PLAN</p>
              <p style={{ fontFamily: fonts.heading, fontSize: "22px", fontWeight: "700", color: colors.brand.light, margin: 0, textTransform: "capitalize" }}>
                {plan.plan || "Free"}
              </p>
            </div>
            {plan.stripe_subscription_id && (
              <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.brand.success, padding: "2px 8px", borderRadius: radius.full, backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
                ACTIVE
              </span>
            )}
          </div>
        </div>

        {/* Limits */}
        {[
          { label: "Organisations", value: limits.max_organisations },
          { label: "Bots per Org", value: limits.max_bots_per_org },
          { label: "Discord Connections", value: limits.max_discord_connections },
          { label: "Monthly AI Messages", value: limits.max_monthly_ai_messages?.toLocaleString() },
          { label: "Custom Discord Apps", value: limits.max_custom_discord_apps },
        ].map(item => (
          <div key={item.label} style={{
            padding: "14px 16px", backgroundColor: colors.bg.panel, borderRadius: radius.md,
            border: `1px solid ${colors.border.muted}`,
          }}>
            <p style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted, textTransform: "uppercase", margin: "0 0 6px" }}>{item.label}</p>
            <p style={{ fontFamily: fonts.heading, fontSize: "18px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>{item.value ?? "—"}</p>
          </div>
        ))}

        {/* Usage */}
        <div style={{
          padding: "14px 16px", backgroundColor: colors.bg.panel, borderRadius: radius.md,
          border: `1px solid ${colors.border.muted}`, gridColumn: "1 / -1",
        }}>
          <p style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted, textTransform: "uppercase", margin: "0 0 6px" }}>AI MESSAGES USED THIS PERIOD</p>
          <p style={{ fontFamily: fonts.heading, fontSize: "18px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
            {(usage.ai_messages_used || 0).toLocaleString()} <span style={{ fontSize: "12px", fontWeight: "400", color: colors.text.muted }}>/ {(limits.max_monthly_ai_messages || 0).toLocaleString()}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Discord Apps Tab ──
function DiscordAppsTab({ workspace }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [platformApp, setPlatformApp] = useState(null);
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin" || user?.platform_role === "superadmin";

  const load = async () => {
    try {
      const res = await v2.getWorkspaceDiscordApps(workspace.id);
      setApps(res.data.discord_apps || []);
    } catch {} finally { setLoading(false); }
    if (isSuperAdmin) {
      try {
        const pRes = await v2.getPlatformDiscordApp();
        setPlatformApp(pRes.data);
      } catch {}
    }
  };

  useEffect(() => { if (workspace) load(); }, [workspace]); // eslint-disable-line

  return (
    <div>
      <SectionTitle title="Discord Applications" subtitle="Platform-provided and custom Discord bot applications for your workspace" />

      {/* Platform app */}
      <div style={{
        padding: "16px 20px", backgroundColor: colors.bg.surface, borderRadius: radius.lg,
        border: `1px solid rgba(88,101,242,0.3)`, marginBottom: "16px", maxWidth: "600px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <Shield size={14} color="#5865F2" />
          <span style={{ fontFamily: fonts.body, fontSize: "14px", fontWeight: "600", color: colors.text.primary }}>Platform Discord App</span>
          <span style={{
            fontSize: "9px", fontFamily: fonts.mono, padding: "1px 6px", borderRadius: radius.full,
            backgroundColor: "rgba(88,101,242,0.1)", color: "#5865F2", border: "1px solid rgba(88,101,242,0.2)",
          }}>MANAGED</span>
        </div>
        <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: "0 0 4px" }}>
          The shared BitBot Pro Discord application. Available to all organisations.
        </p>
        {platformApp?.configured && (
          <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: 0 }}>
            Client ID: {platformApp.client_id}
          </p>
        )}
      </div>

      {/* Custom apps */}
      <h3 style={{ fontFamily: fonts.heading, fontSize: "14px", fontWeight: "600", color: colors.text.primary, marginBottom: "12px" }}>
        Custom Discord Applications
      </h3>
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: colors.text.muted }}><Loader2 size={14} className="animate-spin" /> Loading...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "600px" }}>
          {apps.map(app => (
            <div key={app.id} data-testid={`discord-app-${app.id}`}
              style={{
                padding: "14px 18px", backgroundColor: colors.bg.surface, borderRadius: radius.md,
                border: `1px solid ${colors.border.default}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "600", color: colors.text.primary }}>{app.name}</span>
                  <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "4px 0 0" }}>
                    Client: {app.client_id} · Token: {app.bot_token}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete Discord app "${app.name}"?`)) return;
                    try {
                      await v2.deleteWorkspaceDiscordApp(workspace.id, app.id);
                      toast.success("Discord app deleted");
                      load();
                    } catch (err) {
                      toast.error(err.response?.data?.detail || "Failed to delete");
                    }
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "4px" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {apps.length === 0 && (
            <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted }}>
              No custom Discord applications. Your organisations use the platform-provided app.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──
export default function WorkspaceSettings() {
  const { selectedWorkspace, refreshWorkspaces } = useAuth();
  const location = useLocation();

  // Determine active tab from URL path
  const path = location.pathname;
  const activeTab = path.includes("/members") ? "members"
    : path.includes("/billing") ? "billing"
    : path.includes("/discord-apps") ? "discord-apps"
    : "general";

  if (!selectedWorkspace) {
    return (
      <div style={{ padding: "60px 40px", textAlign: "center" }}>
        <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.text.muted }}>
          No workspace selected. Please select a workspace from the sidebar.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="workspace-settings-page" style={{ padding: "32px 40px", maxWidth: "900px" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "6px" }}>
          Workspace Settings
        </p>
        <h1 style={{ fontFamily: fonts.heading, fontSize: "28px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
          {selectedWorkspace.name}
        </h1>
      </div>

      {/* Content */}
      <div style={{ marginTop: "24px" }}>
        {activeTab === "general" && <GeneralTab workspace={selectedWorkspace} onRefresh={refreshWorkspaces} />}
        {activeTab === "members" && <MembersTab workspace={selectedWorkspace} />}
        {activeTab === "billing" && <BillingTab workspace={selectedWorkspace} />}
        {activeTab === "discord-apps" && <DiscordAppsTab workspace={selectedWorkspace} />}
      </div>
    </div>
  );
}
