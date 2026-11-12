import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import BridgeBotLogo from "../components/BridgeBotLogo";
import confetti from "canvas-confetti";
import {
  Shield, BookOpen, Settings, MessageSquare, Globe,
  Zap, Send, Headphones, Code2, ChevronRight, ChevronLeft,
  CheckCircle2, Circle, ExternalLink, Plus, Sparkles,
  ArrowRight, Rocket, PartyPopper,
} from "lucide-react";
import { colors, fonts, radius } from "../theme";

const STEPS = [
  {
    key: "create_instance",
    icon: Shield,
    title: "Create Your First Bot",
    subtitle: "Set up a workspace",
    desc: "A bot instance is your workspace. Give it a name and an optional description, then you're ready to teach it.",
    color: "#60A5FA",
    actionLabel: "Go to Bot Instances",
    actionPath: "/admin/instances",
    tip: "Each instance is independent — great for separating products, teams, or clients.",
  },
  {
    key: "add_knowledge",
    icon: BookOpen,
    title: "Add Knowledge",
    subtitle: "Teach your bot",
    desc: "Feed your bot with FAQs, URLs, uploaded documents, or GitHub repos. The more context it has, the better it answers.",
    color: "#A78BFA",
    actionLabel: "Open Knowledge Base",
    actionPath: "/admin/knowledge",
    tip: "Start with 5-10 high-priority FAQs covering your most common questions. You can always add more later.",
  },
  {
    key: "customize_persona",
    icon: Settings,
    title: "Set the Persona",
    subtitle: "Customize tone and behavior",
    desc: "Name your bot, write a system prompt to define its personality, and set a welcome message for new conversations.",
    color: "#F59E0B",
    actionLabel: "Open Bot Settings",
    actionPath: "/admin/settings",
    tip: "A clear system prompt like \"You are a friendly support agent for Acme Co\" dramatically improves response quality.",
  },
  {
    key: "test_bot",
    icon: MessageSquare,
    title: "Test Your Bot",
    subtitle: "Try a live conversation",
    desc: "Open the chat demo and ask your bot a question. See how it responds using the knowledge you've added.",
    color: "#34D399",
    actionLabel: "Open Chat Demo",
    actionExternal: true,
    tip: "Try asking something your FAQ covers, then something it doesn't — this helps you find knowledge gaps early.",
  },
  {
    key: "connect_channel",
    icon: Globe,
    title: "Deploy to a Channel",
    subtitle: "Go live",
    desc: "Connect your bot to one or more channels. Each channel can be configured independently.",
    color: "#EC4899",
    channels: [
      { label: "Web Widget", path: "/admin/embed", icon: Code2, color: "#60A5FA" },
      { label: "Discord", path: "/admin/discord", icon: Zap, color: "#5865F2" },
      { label: "Telegram", path: "/admin/telegram", icon: Send, color: "#0088CC" },
      { label: "Zendesk", path: "/admin/zendesk", icon: Headphones, color: "#17A589" },
    ],
    tip: "The Web Widget is the fastest — just copy the embed snippet and paste it into your site.",
  },
];

export default function SetupGuide() {
  const [step, setStep] = useState(0);
  const [stepStatus, setStepStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [justCompleted, setJustCompleted] = useState(new Set());
  const prevStatusRef = useRef({});
  const { selectedInstance } = useAuth();
  const navigate = useNavigate();

  const fetchStatus = useCallback(() => {
    api.get("/onboarding/step-status")
      .then(res => {
        const next = res.data;
        const prev = prevStatusRef.current;
        // Detect false→true transitions
        const newlyDone = new Set();
        for (const s of STEPS) {
          if (next[s.key] && !prev[s.key] && Object.keys(prev).length > 0) {
            newlyDone.add(s.key);
          }
        }
        if (newlyDone.size > 0) {
          setJustCompleted(newlyDone);
          // Clear the animation class after it plays
          setTimeout(() => setJustCompleted(new Set()), 1800);
        }
        prevStatusRef.current = next;
        setStepStatus(next);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus, selectedInstance]);

  // Poll every 8s so returning from another tab picks up changes live
  useEffect(() => {
    const id = setInterval(fetchStatus, 8000);
    const onFocus = () => fetchStatus();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, [fetchStatus]);

  const completedCount = STEPS.filter(s => stepStatus[s.key]).length;
  const allDone = completedCount === STEPS.length;
  const current = STEPS[step];
  const isDone = stepStatus[current.key];
  const firedRef = useRef(false);

  useEffect(() => {
    if (allDone && !firedRef.current) {
      firedRef.current = true;
      const duration = 2500;
      const end = Date.now() + duration;
      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 60,
          origin: { x: 0, y: 0.7 },
          colors: ["#60A5FA", "#A78BFA", "#34D399", "#F59E0B", "#EC4899"],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 60,
          origin: { x: 1, y: 0.7 },
          colors: ["#60A5FA", "#A78BFA", "#34D399", "#F59E0B", "#EC4899"],
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [allDone]);

  const handleAction = (path, external) => {
    if (external) {
      const chatUrl = `/chat${selectedInstance ? `?instance=${selectedInstance.id}` : ""}`;
      window.open(chatUrl, "_blank");
    } else {
      navigate(path);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", padding: "40px 48px",
      fontFamily: fonts.body,
    }} data-testid="setup-guide-page">
      {/* Header */}
      <div style={{ marginBottom: "40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "8px" }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "12px",
            background: "linear-gradient(135deg, #60A5FA, #A78BFA)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Rocket size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{
              fontFamily: fonts.heading, fontSize: "28px", fontWeight: "700",
              color: colors.text.primary, margin: 0, letterSpacing: "-0.5px",
            }}>
              Setup Guide
            </h1>
            <p style={{
              fontFamily: fonts.body, fontSize: "14px", color: colors.text.secondary,
              margin: "2px 0 0",
            }}>
              {allDone
                ? "You're all set! Your bot is ready to go."
                : `${completedCount} of ${STEPS.length} steps complete — let's get your bot live.`
              }
            </p>
          </div>
        </div>

        {/* Overall progress bar */}
        <div style={{
          marginTop: "20px", height: "6px", borderRadius: "3px",
          backgroundColor: "rgba(148,163,184,0.12)", overflow: "hidden",
          maxWidth: "600px",
        }}>
          <div style={{
            width: `${(completedCount / STEPS.length) * 100}%`,
            height: "100%", borderRadius: "3px",
            background: allDone
              ? "linear-gradient(90deg, #34D399, #60A5FA)"
              : "linear-gradient(90deg, #60A5FA, #A78BFA)",
            transition: "width 0.6s ease",
          }} />
        </div>
      </div>

      {/* Celebration banner when all done */}
      {allDone && (
        <div data-testid="celebration-banner" style={{
          marginBottom: "24px", padding: "20px 28px", borderRadius: "14px",
          background: "linear-gradient(135deg, rgba(52,211,153,0.08), rgba(96,165,250,0.08), rgba(167,139,250,0.08))",
          border: "1px solid rgba(52,211,153,0.2)",
          display: "flex", alignItems: "center", gap: "16px",
          maxWidth: "1100px",
          animation: "celebFadeIn 0.6s ease",
        }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "12px",
            background: "linear-gradient(135deg, #34D399, #60A5FA)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <PartyPopper size={24} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{
              fontFamily: fonts.heading, fontSize: "17px", fontWeight: "700",
              color: "#34D399", margin: "0 0 3px",
            }}>
              All set! Your bot is fully configured.
            </h3>
            <p style={{
              fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: 0,
            }}>
              Every step is complete. Your bot is trained, personalized, tested, and ready for conversations.
            </p>
          </div>
          <button
            onClick={() => navigate("/admin")}
            data-testid="celebration-dashboard-btn"
            style={{
              padding: "10px 20px", borderRadius: "10px", border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #34D399, #60A5FA)", color: "#fff",
              fontFamily: fonts.body, fontSize: "13px", fontWeight: "600", flexShrink: 0,
              display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            Go to Dashboard <ArrowRight size={14} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes celebFadeIn {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes badgePop {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.3); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes checkDraw {
          0% { opacity: 0; transform: scale(0) rotate(-45deg); }
          60% { transform: scale(1.2) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes labelSlide {
          0% { opacity: 0; transform: translateX(-6px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .step-badge-pop {
          animation: badgePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .step-label-pop {
          animation: labelSlide 0.4s ease 0.2s both;
        }
      `}</style>

      <div style={{ display: "flex", gap: "32px", maxWidth: "1100px" }}>
        {/* Left: Step list */}
        <div style={{ width: "300px", flexShrink: 0 }}>
          {STEPS.map((s, i) => {
            const done = stepStatus[s.key];
            const active = i === step;
            const justDone = justCompleted.has(s.key);
            return (
              <button
                key={s.key}
                onClick={() => setStep(i)}
                data-testid={`step-nav-${s.key}`}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  width: "100%", padding: "14px 16px", marginBottom: "4px",
                  borderRadius: "12px", border: "none", textAlign: "left",
                  cursor: "pointer",
                  backgroundColor: active ? `${s.color}10` : "transparent",
                  transition: "all 0.2s",
                }}
              >
                <div
                  className={justDone ? "step-badge-pop" : ""}
                  data-testid={done ? `step-check-${s.key}` : undefined}
                  style={{
                    width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    backgroundColor: done ? `${s.color}18` : active ? `${s.color}12` : "rgba(148,163,184,0.06)",
                    border: active ? `1.5px solid ${s.color}40` : "1.5px solid transparent",
                    transition: "all 0.2s",
                  }}>
                  {done
                    ? <CheckCircle2 size={16} color={s.color} style={justDone ? { animation: "checkDraw 0.5s ease 0.15s both" } : undefined} />
                    : <s.icon size={15} color={active ? s.color : colors.text.muted} />
                  }
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontFamily: fonts.body, fontSize: "13px",
                    fontWeight: active ? "600" : "500",
                    color: done ? s.color : active ? colors.text.primary : colors.text.secondary,
                    margin: 0, lineHeight: 1.3,
                    transition: "color 0.2s",
                  }}>
                    {s.title}
                  </p>
                  <p className={justDone ? "step-label-pop" : ""} style={{
                    fontFamily: fonts.body, fontSize: "11px",
                    color: justDone ? s.color : colors.text.muted, margin: "1px 0 0",
                    transition: "color 0.3s",
                  }}>
                    {done ? "Complete" : s.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Step detail */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            backgroundColor: colors.bg.surface,
            border: `1px solid ${colors.border.default}`,
            borderRadius: "16px", overflow: "hidden",
          }}>
            {/* Step header with colored top bar */}
            <div style={{
              height: "4px",
              background: `linear-gradient(90deg, ${current.color}, ${current.color}88)`,
            }} />

            <div style={{ padding: "32px" }}>
              {/* Icon + title */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "20px" }}>
                <div style={{
                  width: "56px", height: "56px", borderRadius: "14px",
                  background: `${current.color}12`,
                  border: `1px solid ${current.color}20`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <current.icon size={26} color={current.color} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                    <h2 style={{
                      fontFamily: fonts.heading, fontSize: "22px", fontWeight: "700",
                      color: colors.text.primary, margin: 0,
                    }}>
                      {current.title}
                    </h2>
                    {isDone && (
                      <span
                        className={justCompleted.has(current.key) ? "step-badge-pop" : ""}
                        data-testid={`step-done-badge-${current.key}`}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: "5px",
                          padding: "3px 10px", borderRadius: "20px",
                          backgroundColor: `${current.color}14`,
                          color: current.color, fontSize: "11px", fontWeight: "600",
                          fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.04em",
                        }}>
                        <CheckCircle2 size={12} /> Done
                      </span>
                    )}
                  </div>
                  <p style={{
                    fontFamily: fonts.body, fontSize: "14px", color: colors.text.secondary,
                    margin: 0, lineHeight: 1.6,
                  }}>
                    {current.desc}
                  </p>
                </div>
              </div>

              {/* Tip */}
              <div style={{
                padding: "14px 16px", borderRadius: "10px", marginBottom: "24px",
                backgroundColor: `${current.color}06`,
                border: `1px solid ${current.color}14`,
                display: "flex", alignItems: "flex-start", gap: "10px",
              }}>
                <Sparkles size={15} color={current.color} style={{ marginTop: "1px", flexShrink: 0 }} />
                <p style={{
                  margin: 0, fontSize: "13px", color: colors.text.secondary,
                  fontFamily: fonts.body, lineHeight: 1.6,
                }}>
                  {current.tip}
                </p>
              </div>

              {/* Action area */}
              {current.channels ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {current.channels.map(ch => (
                    <button
                      key={ch.path}
                      onClick={() => navigate(ch.path)}
                      data-testid={`wizard-channel-${ch.label.toLowerCase().replace(/\s+/g, "-")}`}
                      style={{
                        display: "flex", alignItems: "center", gap: "12px",
                        padding: "16px 18px", borderRadius: "12px",
                        border: `1px solid ${ch.color}25`,
                        backgroundColor: `${ch.color}06`,
                        color: colors.text.primary, fontSize: "14px",
                        fontWeight: "600", fontFamily: fonts.body,
                        cursor: "pointer", textAlign: "left",
                        transition: "all 0.2s",
                      }}
                    >
                      <div style={{
                        width: "36px", height: "36px", borderRadius: "9px",
                        backgroundColor: `${ch.color}14`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <ch.icon size={18} color={ch.color} />
                      </div>
                      <div>
                        <span>{ch.label}</span>
                        <ChevronRight size={14} style={{ marginLeft: "4px", opacity: 0.5 }} />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => handleAction(current.actionPath, current.actionExternal)}
                  data-testid={`wizard-action-${current.key}`}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                    width: "100%", padding: "14px 20px", borderRadius: "12px",
                    border: "none", cursor: "pointer",
                    background: isDone
                      ? `${current.color}12`
                      : `linear-gradient(135deg, ${current.color}, ${current.color}BB)`,
                    color: isDone ? current.color : "#fff",
                    fontSize: "15px", fontWeight: "600", fontFamily: fonts.body,
                    transition: "all 0.2s",
                  }}
                >
                  {isDone ? (
                    <>
                      <CheckCircle2 size={17} />
                      {current.actionLabel}
                      <ExternalLink size={14} style={{ opacity: 0.6 }} />
                    </>
                  ) : (
                    <>
                      {current.actionLabel}
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Navigation footer */}
            <div style={{
              padding: "16px 32px 24px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              borderTop: `1px solid ${colors.border.muted}`,
            }}>
              <button
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
                data-testid="wizard-prev-btn"
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "8px 16px", borderRadius: "8px",
                  border: `1px solid ${colors.border.default}`,
                  backgroundColor: colors.bg.base,
                  color: step === 0 ? colors.text.muted : colors.text.secondary,
                  fontSize: "13px", fontFamily: fonts.body, cursor: step === 0 ? "default" : "pointer",
                  opacity: step === 0 ? 0.4 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                <ChevronLeft size={14} /> Previous
              </button>

              <p style={{
                fontFamily: fonts.mono, fontSize: "11px", color: colors.text.muted,
                margin: 0, textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
                Step {step + 1} of {STEPS.length}
              </p>

              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  data-testid="wizard-next-btn"
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "8px 20px", borderRadius: "8px", border: "none",
                    backgroundColor: colors.bg.surface,
                    color: colors.text.primary,
                    fontSize: "13px", fontWeight: "600", fontFamily: fonts.body,
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  Next <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  onClick={() => navigate("/admin")}
                  data-testid="wizard-done-btn"
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "8px 20px", borderRadius: "8px", border: "none",
                    background: "linear-gradient(135deg, #34D399, #60A5FA)",
                    color: "#fff",
                    fontSize: "13px", fontWeight: "600", fontFamily: fonts.body,
                    cursor: "pointer",
                  }}
                >
                  Go to Dashboard <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
