/**
 * BitBot Pro Logo — renders the actual logo PNG with animated pupils.
 */
import { useId } from "react";

export default function BridgeBotLogo({ size = 36, glow, style, className }) {
  const id = useId();
  const showPupils = size >= 22;
  const pw = Math.max(2, size * 0.065);
  const ph = Math.max(2.5, size * 0.08);

  return (
    <span
      className={`bb-logo${className ? ` ${className}` : ""}`}
      data-testid="bridgebot-logo"
      style={{
        display: "inline-flex",
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        filter: glow
          ? `drop-shadow(0 0 ${Math.max(3, size * 0.12)}px rgba(59,130,246,0.55)) drop-shadow(0 0 ${Math.max(2, size * 0.06)}px rgba(60,219,211,0.35))`
          : undefined,
        ...style,
      }}
    >
      <img
        src="/assets/bridgebot-logo.png"
        alt=""
        width={size}
        height={size}
        draggable={false}
        style={{ display: "block", width: size, height: size, pointerEvents: "none" }}
      />
      {showPupils && (
        <>
          <span className="bb-pupil bb-pupil-l" style={{
            position: "absolute", left: "34.5%", top: "40%",
            width: pw, height: ph, borderRadius: "50%",
            background: "#15243a", opacity: 0, pointerEvents: "none", transition: "opacity 0.2s",
          }} />
          <span className="bb-pupil bb-pupil-r" style={{
            position: "absolute", left: "53%", top: "40%",
            width: pw, height: ph, borderRadius: "50%",
            background: "#15243a", opacity: 0, pointerEvents: "none", transition: "opacity 0.2s",
          }} />
        </>
      )}
      <style>{`
        .bb-logo:hover .bb-pupil { opacity: 1 !important; animation: bbPupilDrift 1.6s ease-in-out infinite alternate; }
        .bb-logo:hover .bb-pupil-r { animation-delay: 0.08s; }
        @keyframes bbPupilDrift { 0% { transform: translate(0, 0); } 30% { transform: translate(20%, -15%); } 70% { transform: translate(-15%, 10%); } 100% { transform: translate(10%, -5%); } }
        @media (prefers-reduced-motion: reduce) { .bb-logo:hover .bb-pupil { animation: none !important; transform: translate(0, 0) !important; } }
      `}</style>
    </span>
  );
}
