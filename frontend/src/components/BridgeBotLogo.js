/**
 * BitBot Pro Logo — renders the actual logo PNG with animated pupils.
 *
 * Uses /assets/bridgebot-logo.png (1000×1000 transparent PNG of two
 * interlocking blue/cyan speech bubbles with white eye areas).
 *
 * On hover, two dark pupils appear inside the white eyes and drift
 * subtly, giving the logo a playful "alive" personality.
 *
 * Props:
 *   size  — outer px dimension (default 24)
 *   glow  — adds neon drop-shadow when true
 */
import { useId } from "react";

export default function BridgeBotLogo({ size = 36, glow, style, className }) {
  const id = useId();

  // Pupils are only rendered and visible at ≥22 px
  const showPupils = size >= 22;

  // Pupil proportions relative to logo size
  const pw = Math.max(2, size * 0.065);  // pupil width
  const ph = Math.max(2.5, size * 0.08); // pupil height

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

      {/* Animated pupils — appear inside the white eye ovals on hover */}
      {showPupils && (
        <>
          <span
            className="bb-pupil bb-pupil-l"
            style={{
              position: "absolute",
              left: "34.5%",
              top: "40%",
              width: pw,
              height: ph,
              borderRadius: "50%",
              background: "#15243a",
              opacity: 0,
              pointerEvents: "none",
              transition: "opacity 0.2s",
            }}
          />
          <span
            className="bb-pupil bb-pupil-r"
            style={{
              position: "absolute",
              left: "53%",
              top: "40%",
              width: pw,
              height: ph,
              borderRadius: "50%",
              background: "#15243a",
              opacity: 0,
              pointerEvents: "none",
              transition: "opacity 0.2s",
            }}
          />
        </>
      )}

      {/* Inject keyframes + hover rules once */}
      <style>{`
        .bb-logo:hover .bb-pupil {
          opacity: 1 !important;
          animation: bbPupilDrift 1.6s ease-in-out infinite alternate;
        }
        .bb-logo:hover .bb-pupil-r {
          animation-delay: 0.08s;
        }
        @keyframes bbPupilDrift {
          0%   { transform: translate(0, 0); }
          30%  { transform: translate(20%, -15%); }
          70%  { transform: translate(-15%, 10%); }
          100% { transform: translate(10%, -5%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bb-logo:hover .bb-pupil {
            animation: none !important;
            transform: translate(0, 0) !important;
          }
        }
      `}</style>
    </span>
  );
}
