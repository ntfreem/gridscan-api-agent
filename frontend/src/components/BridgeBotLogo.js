/**
 * BridgeBotLogo — Interlocking stroked speech bubbles with robot eyes.
 *
 * Matches the official logo: blue bubble (left, tail bottom-left) interlinks
 * with cyan bubble (right, tail bottom-right). Blue goes OVER cyan at the top,
 * cyan goes OVER blue at the bottom. Subtle white oval eyes in center.
 *
 * Props:
 *   size  — outer px dimension (default 24)
 *   glow  — adds a neon drop-shadow when true
 */
export default function BridgeBotLogo({ size = 24, glow, style, className }) {
  const uid = `bb_${Math.random().toString(36).slice(2, 7)}`;
  const sw = 7.5; // stroke width

  // The two bubble paths
  const bluePath =
    "M 16,62 L 9,74 L 19,64 C 11,62 5,52 5,41 C 5,26 17,15 33,15 L 61,15 C 75,15 83,24 83,36 C 83,46 77,54 67,57 L 31,61 Z";
  const cyanPath =
    "M 84,68 L 91,80 L 81,70 C 89,68 95,58 95,48 C 95,33 83,22 67,22 L 39,22 C 25,22 17,31 17,43 C 17,53 23,61 33,64 L 69,68 Z";

  const filterStyle = glow
    ? { filter: `drop-shadow(0 0 ${size * 0.15}px rgba(91,158,245,0.6)) drop-shadow(0 0 ${size * 0.08}px rgba(60,219,211,0.4))` }
    : {};

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ ...filterStyle, ...style }}
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Clip to reveal only the TOP of the blue path (for interlocking) */}
        <clipPath id={`${uid}_top`}>
          <rect x="0" y="0" width="100" height="40" />
        </clipPath>
        <linearGradient id={`${uid}_bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6BAAFF" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id={`${uid}_cg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5DE8DA" />
          <stop offset="100%" stopColor="#3CDBD3" />
        </linearGradient>
      </defs>

      {/* Layer 1: Blue bubble — full, behind everything */}
      <path
        d={bluePath}
        stroke={`url(#${uid}_bg)`}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Layer 2: Cyan bubble — full, covers blue at the bottom (natural overlap) */}
      <path
        d={cyanPath}
        stroke={`url(#${uid}_cg)`}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Layer 3: Blue bubble TOP portion re-drawn ON TOP of cyan (creates interlocking) */}
      <path
        d={bluePath}
        stroke={`url(#${uid}_bg)`}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        clipPath={`url(#${uid}_top)`}
      />

      {/* Robot eyes — subtle white ovals */}
      <ellipse cx="43" cy="44" rx="4" ry="5.5" fill="white" opacity="0.22" />
      <ellipse cx="59" cy="44" rx="4" ry="5.5" fill="white" opacity="0.22" />
    </svg>
  );
}
