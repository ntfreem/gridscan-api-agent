import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Sparkles, Check, X, Copy, Filter, Loader2, Zap, Send, Headphones,
  MessageSquare, Clock, ChevronDown, RefreshCw, Inbox,
} from "lucide-react";
import { colors, fonts, radius, T } from "@/theme";
import { toast } from "sonner";
import v2 from "@/utils/v2api";

const PROVIDER_ICONS = { discord: Zap, telegram: Send, zendesk: Headphones };
const PROVIDER_COLORS = { discord: "#5865F2", telegram: "#26A5E4", zendesk: "#03363D" };

const STATUS_CONFIG = {
  pending: { label: "Pending", bg: "rgba(251,191,36,0.08)", color: "#FBBF24", border: "rgba(251,191,36,0.2)" },
  accepted: { label: "Accepted", bg: "rgba(52,211,153,0.08)", color: "#34D399", border: "rgba(52,211,153,0.2)" },
  dismissed: { label: "Dismissed", bg: "rgba(148,163,184,0.08)", color: "#94A3B8", border: "rgba(148,163,184,0.15)" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: radius.full,
      fontSize: "9px", fontWeight: "600", fontFamily: fonts.mono, letterSpacing: "0.04em",
      backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      textTransform: "uppercase",
    }}>
      {cfg.label}
    </span>
  );
}

function TimeAgo({ dateStr }) {
  if (!dateStr) return null;
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return <span>{seconds}s ago</span>;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return <span>{minutes}m ago</span>;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return <span>{hours}h ago</span>;
  const days = Math.floor(hours / 24);
  return <span>{days}d ago</span>;
}

export default function SuggestionsInbox() {
  const { selectedOrg, selectedBot } = useAuth();
  const orgId = selectedOrg?.id;
  const botId = selectedBot?.id;

  const [suggestions, setSuggestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [filterOpen, setFilterOpen] = useState(false);
  const [updating, setUpdating] = useState({});

  const fetchSuggestions = useCallback(() => {
    if (!orgId || !botId) return;
    setLoading(true);
    const params = { limit: 50 };
    if (statusFilter) params.status = statusFilter;
    v2.listSuggestions(orgId, botId, params)
      .then(res => {
        setSuggestions(res.data.suggestions || []);
        setTotal(res.data.total || 0);
      })
      .catch(() => toast.error("Failed to load suggestions"))
      .finally(() => setLoading(false));
  }, [orgId, botId, statusFilter]);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  const handleAction = async (suggestion, action) => {
    const id = suggestion._id || suggestion.id;
    if (!id) { toast.error("Missing suggestion ID"); return; }
    setUpdating(prev => ({ ...prev, [id]: true }));
    try {
      await v2.updateSuggestion(orgId, botId, id, { status: action });
      toast.success(action === "accepted" ? "Suggestion accepted" : "Suggestion dismissed");
      fetchSuggestions();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update suggestion");
    } finally {
      setUpdating(prev => ({ ...prev, [id]: false }));
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Copy failed"),
    );
  };

  const filterOptions = [
    { value: "pending", label: "Pending", count: null },
    { value: "accepted", label: "Accepted", count: null },
    { value: "dismissed", label: "Dismissed", count: null },
    { value: "", label: "All", count: null },
  ];

  if (!orgId || !botId) {
    return (
      <div style={{ padding: "60px", textAlign: "center", color: colors.text.muted, fontFamily: fonts.body }}>
        Select an organisation and bot to view suggestions.
      </div>
    );
  }

  return (
    <div data-testid="suggestions-inbox" style={{ padding: "32px 40px", maxWidth: "900px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "6px" }}>
            {selectedBot?.name || "Bot"}
          </p>
          <h1 style={{ fontFamily: fonts.heading, fontSize: "28px", fontWeight: "700", color: colors.text.primary, margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            <Sparkles size={22} color={colors.brand.light} />
            Suggestions Inbox
          </h1>
          <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, marginTop: "6px" }}>
            Review AI-generated suggestions from agent_assist and internal_note connections. Accept, dismiss, or copy.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Status filter */}
          <div style={{ position: "relative" }}>
            <button
              data-testid="suggestions-filter"
              onClick={() => setFilterOpen(!filterOpen)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "7px 14px", borderRadius: radius.md,
                backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
                cursor: "pointer", fontFamily: fonts.mono, fontSize: "11px", color: colors.text.primary,
              }}
            >
              <Filter size={12} />
              {statusFilter ? filterOptions.find(f => f.value === statusFilter)?.label : "All"}
              <ChevronDown size={10} color={colors.text.muted} />
            </button>
            {filterOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", right: 0, minWidth: "140px",
                backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
                borderRadius: radius.md, zIndex: 50, overflow: "hidden",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}>
                {filterOptions.map(opt => (
                  <button
                    key={opt.value}
                    data-testid={`filter-${opt.value || "all"}`}
                    onClick={() => { setStatusFilter(opt.value); setFilterOpen(false); }}
                    style={{
                      width: "100%", padding: "8px 14px", background: statusFilter === opt.value ? colors.bg.hover : "none",
                      border: "none", textAlign: "left", cursor: "pointer",
                      fontFamily: fonts.mono, fontSize: "11px", color: colors.text.primary,
                      borderBottom: `1px solid ${colors.border.muted}`,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Refresh */}
          <button
            data-testid="suggestions-refresh"
            onClick={fetchSuggestions}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "34px", height: "34px", borderRadius: radius.md,
              backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={13} color={colors.text.secondary} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: "40px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: colors.text.muted }}>
          <Loader2 size={16} className="animate-spin" /> Loading suggestions...
        </div>
      ) : suggestions.length === 0 ? (
        <div data-testid="suggestions-empty" style={{
          padding: "60px", textAlign: "center", backgroundColor: colors.bg.surface,
          borderRadius: radius.lg, border: `1px solid ${colors.border.default}`,
        }}>
          <Inbox size={40} color={colors.border.default} style={{ margin: "0 auto 12px" }} />
          <h3 style={{ fontFamily: fonts.heading, fontSize: "16px", color: colors.text.secondary, margin: "0 0 6px" }}>
            {statusFilter === "pending" ? "No pending suggestions" : "No suggestions found"}
          </h3>
          <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, margin: 0 }}>
            {statusFilter === "pending"
              ? "Suggestions appear here when agent_assist or internal_note connections process messages."
              : `No ${statusFilter || ""} suggestions for this bot.`}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "0 0 4px" }}>
            {total} suggestion{total !== 1 ? "s" : ""} {statusFilter ? `(${statusFilter})` : "(all)"}
          </p>

          {suggestions.map((s, idx) => {
            const sId = s._id || s.id || `idx-${idx}`;
            const ProvIcon = PROVIDER_ICONS[s.provider] || MessageSquare;
            const provColor = PROVIDER_COLORS[s.provider] || colors.text.muted;
            const isUpdating = updating[sId];

            return (
              <div
                key={sId}
                data-testid={`suggestion-card-${sId}`}
                style={{
                  backgroundColor: colors.bg.surface, borderRadius: radius.lg,
                  border: `1px solid ${colors.border.default}`, overflow: "hidden",
                  opacity: isUpdating ? 0.6 : 1, transition: "opacity 0.2s",
                }}
              >
                {/* Card header */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px",
                  borderBottom: `1px solid ${colors.border.faint}`,
                }}>
                  <div style={{
                    width: "24px", height: "24px", borderRadius: "6px",
                    backgroundColor: `${provColor}15`, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <ProvIcon size={12} color={provColor} />
                  </div>
                  <span style={{ fontFamily: fonts.body, fontSize: "12px", fontWeight: "500", color: colors.text.primary }}>
                    {s.connection_name || "Connection"}
                  </span>
                  <StatusBadge status={s.status} />
                  <span style={{ flex: 1 }} />
                  <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, display: "flex", alignItems: "center", gap: "4px" }}>
                    <Clock size={10} /> <TimeAgo dateStr={s.created_at} />
                  </span>
                </div>

                {/* User message */}
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border.faint}` }}>
                  <p style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 4px" }}>
                    Customer Message
                  </p>
                  <p style={{
                    fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary,
                    margin: 0, lineHeight: "1.5", whiteSpace: "pre-wrap",
                    maxHeight: "80px", overflow: "hidden",
                  }}>
                    {s.user_message}
                  </p>
                </div>

                {/* AI Suggestion */}
                <div style={{ padding: "12px 16px", backgroundColor: "rgba(107,170,255,0.03)" }}>
                  <p style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.brand.light, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 4px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Sparkles size={9} /> AI Suggestion
                  </p>
                  <p style={{
                    fontFamily: fonts.body, fontSize: "13px", color: colors.text.primary,
                    margin: 0, lineHeight: "1.6", whiteSpace: "pre-wrap",
                  }}>
                    {s.ai_suggestion}
                  </p>
                </div>

                {/* Actions */}
                {s.status === "pending" && (
                  <div style={{
                    display: "flex", gap: "8px", padding: "10px 16px",
                    borderTop: `1px solid ${colors.border.faint}`,
                  }}>
                    <button
                      data-testid={`accept-${sId}`}
                      onClick={() => handleAction(s, "accepted")}
                      disabled={isUpdating}
                      style={{
                        display: "flex", alignItems: "center", gap: "5px",
                        padding: "6px 14px", borderRadius: radius.md,
                        backgroundColor: "rgba(52,211,153,0.1)", border: `1px solid rgba(52,211,153,0.25)`,
                        color: colors.brand.success, cursor: "pointer",
                        fontFamily: fonts.body, fontSize: "11px", fontWeight: "600",
                      }}
                    >
                      <Check size={12} /> Accept
                    </button>
                    <button
                      data-testid={`dismiss-${sId}`}
                      onClick={() => handleAction(s, "dismissed")}
                      disabled={isUpdating}
                      style={{
                        display: "flex", alignItems: "center", gap: "5px",
                        padding: "6px 14px", borderRadius: radius.md,
                        backgroundColor: "rgba(148,163,184,0.08)", border: `1px solid rgba(148,163,184,0.15)`,
                        color: colors.text.muted, cursor: "pointer",
                        fontFamily: fonts.body, fontSize: "11px", fontWeight: "600",
                      }}
                    >
                      <X size={12} /> Dismiss
                    </button>
                    <button
                      data-testid={`copy-${sId}`}
                      onClick={() => copyToClipboard(s.ai_suggestion)}
                      style={{
                        display: "flex", alignItems: "center", gap: "5px",
                        padding: "6px 14px", borderRadius: radius.md,
                        backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
                        color: colors.text.secondary, cursor: "pointer",
                        fontFamily: fonts.body, fontSize: "11px", fontWeight: "600",
                      }}
                    >
                      <Copy size={12} /> Copy
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
