/**
 * BridgeBotLogo — SVG mark: two overlapping chat bubbles with robot eyes.
 *
 * Designed to be legible at every size from 16px to 64px+.
 * The left bubble is blue, the right is cyan, with prominent white eyes
 * centred in the overlap zone.
 *
 * Props:
 *   size   — outer px dimension (default 24)
 *   style  — optional inline styles on the <svg>
 */
export default function BridgeBotLogo({ size = 24, style, className }) {
  // Unique gradient id per instance (avoids SVG id collisions)
  const id = `bb_${Math.random().toString(36).slice(2, 7)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#83ADFF" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>

      {/* Left bubble — blue gradient */}
      <path
        d="M4,10 C4,4.5 8.5,0 14,0 H34 C39.5,0 44,4.5 44,10 V26 C44,31.5 39.5,36 34,36 H20 L10,46 L13,36 H14 C8.5,36 4,31.5 4,26 Z"
        fill={`url(#${id})`}
      />

      {/* Right bubble — solid cyan */}
      <path
        d="M20,16 C20,10.5 24.5,6 30,6 H50 C55.5,6 60,10.5 60,16 V34 C60,39.5 55.5,44 50,44 H47 L54,54 L42,44 H30 C24.5,44 20,39.5 20,34 Z"
        fill="#63E2EE"
      />

      {/* Left eye */}
      <ellipse cx="31" cy="26" rx="3.5" ry="4.5" fill="white" />

      {/* Right eye */}
      <ellipse cx="44" cy="26" rx="3.5" ry="4.5" fill="white" />

      {/* Pupils (visible at ≥ 28px) */}
      <ellipse cx="32" cy="27" rx="1.5" ry="2" fill="#1a2540" />
      <ellipse cx="45" cy="27" rx="1.5" ry="2" fill="#1a2540" />
    </svg>
  );
}
