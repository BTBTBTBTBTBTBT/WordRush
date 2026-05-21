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
      viewBox="0 0 24 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      {/* Right-facing open hand — palm faces viewer, thumb on left */}
      <path
        d="M16 13V6C16 5.17 15.33 4.5 14.5 4.5S13 5.17 13 6V11"
        stroke={dark}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 5V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V11"
        stroke={dark}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 4V3C10 2.17 9.33 1.5 8.5 1.5S7 2.17 7 3V11"
        stroke={dark}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 4.5V4C7 3.17 6.33 2.5 5.5 2.5S4 3.17 4 4V14C4 19.52 8.48 24 14 24C16.76 24 19 21.76 19 19V13C19 12.17 18.33 11.5 17.5 11.5S16 12.17 16 13"
        stroke={dark}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Number badge */}
      <circle cx="11.5" cy="17" r="5.5" fill={light} />
      <text
        x="11.5"
        y="20.5"
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
