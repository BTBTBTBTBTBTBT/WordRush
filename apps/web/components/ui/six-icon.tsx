interface SixIconProps {
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

export function SixIcon({ className, size = 20, style }: SixIconProps) {
  // Darker cyan for strokes/number (base accent is #06b6d4)
  const dark = '#0e7490';
  const light = '#06b6d41a';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      {/* Right-facing open hand — palm faces viewer, thumb on left */}
      <path
        d="M16 13V6.5C16 5.67 15.33 5 14.5 5S13 5.67 13 6.5V11"
        stroke={dark}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 5.5V4C13 3.17 12.33 2.5 11.5 2.5S10 3.17 10 4V11"
        stroke={dark}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 4.5V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5V11"
        stroke={dark}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 5V4.5C7 3.67 6.33 3 5.5 3S4 3.67 4 4.5V13C4 17.97 8.03 22 13 22C16.31 22 19 19.31 19 16V13C19 12.17 18.33 11.5 17.5 11.5S16 12.17 16 13"
        stroke={dark}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Number badge */}
      <circle cx="11.5" cy="15" r="5" fill={light} />
      <text
        x="11.5"
        y="18.2"
        textAnchor="middle"
        fontWeight="900"
        fontSize="10"
        fill={dark}
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        6
      </text>
    </svg>
  );
}
