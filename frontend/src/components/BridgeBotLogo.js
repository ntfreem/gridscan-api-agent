/**
 * BridgeBotLogo — SVG logo mark (overlapping chat bubbles with robot eyes).
 * Replaces the lucide-react <Bot> icon across the entire app.
 *
 * Props:
 *   size  — outer dimension in px (default 24)
 *   color — optional override; when set, renders a flat single-colour icon
 *           instead of the blue→cyan gradient (useful for muted / monochrome contexts)
 */
export default function BridgeBotLogo({ size = 24, color, style, className }) {
  const id = `bbg_${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      className={className}
    >
      {!color && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#83ADFF" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
      )}
      {/* Left bubble */}
      <path
        d="M3,7 C3,3.1 6.1,0 10,0 H26 C29.9,0 33,3.1 33,7 V17 C33,20.9 29.9,24 26,24 H14 L7,31 L9,24 C5.1,24 3,20.9 3,17 Z"
        fill={color || `url(#${id})`}
      />
      {/* Right bubble */}
      <path
        d="M15,12 C15,8.1 18.1,5 22,5 H38 C41.9,5 45,8.1 45,12 V24 C45,27.9 41.9,31 38,31 H36 L41,38 L32,31 H22 C18.1,31 15,27.9 15,24 Z"
        fill={color ? color : "#63E2EE"}
      />
      {/* Eyes */}
      <ellipse cx="24.5" cy="19" rx="2.2" ry="2.7" fill="white" />
      <ellipse cx="33.5" cy="19" rx="2.2" ry="2.7" fill="white" />
    </svg>
  );
}
