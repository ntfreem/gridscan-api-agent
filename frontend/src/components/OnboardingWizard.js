import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import {
  BookOpen, Globe, Zap, Send, Headphones, Code2, ChevronRight,
  CheckCircle, Rocket, X, Sparkles,
} from "lucide-react";
import { colors, fonts, radius } from "../theme";

const STEPS = [
  {
    key: "knowledge",
    icon: BookOpen,
    title: "Add Knowledge",
    desc: "Train your bot with FAQs, URLs, documents, or GitHub repos",
    action: "/admin/knowledge",
    color: "#60A5FA",
    tip: "Start with 5-10 high-priority FAQs covering your most common questions.",
  },
  {
    key: "channel",
    icon: Globe,
    title: "Connect a Channel",
    desc: "Deploy your bot on Discord, Telegram, Zendesk, or the web widget",
    links: [
      { label: "Discord", path: "/admin/discord", icon: Zap, color: "#5865F2" },
      { label: "Telegram", path: "/admin/telegram", icon: Send, color: "#0088CC" },
      { label: "Zendesk", path: "/admin/zendesk", icon: Headphones, color: "#17A589" },
    ],
    color: "#A78BFA",
    tip: "Telegram is the fastest to set up — just paste a BotFather token.",
  },
  {
    key: "widget",
    icon: Code2,
    title: "Customize & Embed",
    desc: "Theme your widget, set a welcome message, and embed it on your site",
    action: "/admin/embed",
    color: "#34D399",
    tip: "Use the Theme Configurator for a live preview before embedding.",
  },
];

export default function OnboardingWizard({ onComplete, onDismiss }) {
  const [step, setStep] = useState(0);
  const [visited, setVisited] = useState({});
  const navigate = useNavigate();

  const handleVisit = (path) => {
    setVisited(v => ({ ...v, [STEPS[step].key]: true }));
    navigate(path);
    if (onDismiss) onDismiss();
  };

  const handleSkip = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      if (onComplete) onComplete();
    }
  };

  const handleFinish = () => {
    if (onComplete) onComplete();
  };

  const current = STEPS[step];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
    }} data-testid="onboarding-wizard">
      <div style={{
        width: "520px", maxWidth: "92vw",
        backgroundColor: colors.bg.panel, border: `1px solid ${colors.border.default}`,
        borderRadius: "16px", overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          padding: "24px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "linear-gradient(135deg, #60A5FA, #A78BFA)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Rocket size={18} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontFamily: fonts.heading, fontSize: "18px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
                Setup Guide
              </h2>
              <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Step {step + 1} of {STEPS.length}
              </p>
            </div>
          </div>
          <button onClick={() => { if (onDismiss) onDismiss(); }} data-testid="wizard-close-btn"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: colors.text.muted }}>
            <X size={18} />
          </button>
        </div>

        {/* Progress dots */}
        <div style={{ display: "flex", gap: "6px", padding: "16px 24px 0", justifyContent: "center" }}>
          {STEPS.map((s, i) => (
            <div key={s.key} onClick={() => setStep(i)} style={{
              width: i === step ? "32px" : "8px", height: "8px",
              borderRadius: "4px", cursor: "pointer",
              backgroundColor: i < step || visited[s.key] ? current.color : i === step ? current.color : "rgba(148,163,184,0.2)",
              opacity: i === step ? 1 : 0.5,
              transition: "all 0.3s",
            }} />
          ))}
        </div>

        {/* Step content */}
        <div style={{ padding: "24px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px",
          }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "12px",
              background: `${current.color}14`, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <current.icon size={22} color={current.color} />
            </div>
            <div>
              <h3 style={{ fontFamily: fonts.heading, fontSize: "16px", fontWeight: "700", color: colors.text.primary, margin: 0 }}>
                {current.title}
              </h3>
              <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: "2px 0 0" }}>
                {current.desc}
              </p>
            </div>
          </div>

          {/* Tip */}
          <div style={{
            padding: "10px 14px", borderRadius: "8px", marginBottom: "18px",
            backgroundColor: `${current.color}08`, border: `1px solid ${current.color}18`,
            display: "flex", alignItems: "flex-start", gap: "8px",
          }}>
            <Sparkles size={14} color={current.color} style={{ marginTop: "1px", flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: "12px", color: colors.text.secondary, fontFamily: fonts.body, lineHeight: 1.5 }}>
              {current.tip}
            </p>
          </div>

          {/* Action buttons */}
          {current.action ? (
            <button onClick={() => handleVisit(current.action)} data-testid={`wizard-go-${current.key}`}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                width: "100%", padding: "12px", borderRadius: "10px", border: "none",
                background: `linear-gradient(135deg, ${current.color}, ${current.color}CC)`,
                color: "#fff", fontSize: "14px", fontWeight: "600", fontFamily: fonts.body,
                cursor: "pointer",
              }}>
              {visited[current.key] && <CheckCircle size={15} />}
              {visited[current.key] ? `${current.title} — Done!` : `Go to ${current.title}`}
              <ChevronRight size={15} />
            </button>
          ) : current.links ? (
            <div style={{ display: "flex", gap: "8px" }}>
              {current.links.map(l => (
                <button key={l.path} onClick={() => handleVisit(l.path)} data-testid={`wizard-go-${l.label.toLowerCase()}`}
                  style={{
                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                    padding: "14px 10px", borderRadius: "10px",
                    border: `1px solid ${l.color}30`, backgroundColor: `${l.color}08`,
                    color: colors.text.primary, fontSize: "12px", fontWeight: "600", fontFamily: fonts.body,
                    cursor: "pointer",
                  }}>
                  <l.icon size={18} color={l.color} />
                  {l.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div style={{
          padding: "0 24px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <button onClick={handleSkip} data-testid="wizard-skip-btn"
            style={{
              background: "none", border: "none", color: colors.text.muted,
              fontSize: "12px", fontFamily: fonts.body, cursor: "pointer", padding: "6px 0",
            }}>
            {step < STEPS.length - 1 ? "Skip this step" : "Skip"}
          </button>
          <div style={{ display: "flex", gap: "8px" }}>
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} data-testid="wizard-back-btn"
                style={{
                  padding: "8px 16px", borderRadius: "8px",
                  border: `1px solid ${colors.border.default}`, backgroundColor: colors.bg.base,
                  color: colors.text.secondary, fontSize: "12px", fontFamily: fonts.body, cursor: "pointer",
                }}>
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(step + 1)} data-testid="wizard-next-btn"
                style={{
                  padding: "8px 20px", borderRadius: "8px", border: "none",
                  backgroundColor: colors.bg.surface, color: colors.text.primary,
                  fontSize: "12px", fontWeight: "600", fontFamily: fonts.body, cursor: "pointer",
                }}>
                Next
              </button>
            ) : (
              <button onClick={handleFinish} data-testid="wizard-finish-btn"
                style={{
                  padding: "8px 20px", borderRadius: "8px", border: "none",
                  background: "linear-gradient(135deg, #34D399, #60A5FA)",
                  color: "#fff", fontSize: "12px", fontWeight: "600", fontFamily: fonts.body, cursor: "pointer",
                }}>
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
