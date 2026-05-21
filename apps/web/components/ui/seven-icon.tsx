interface SevenIconProps {
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

export function SevenIcon({ className, size = 20, style }: SevenIconProps) {
  // Darker lime for strokes/number (base accent is #84cc16)
  const dark = '#4d7c0f';
  const light = '#84cc161a';

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
      {/* Left-facing open hand — palm faces viewer, thumb on right */}
      <path
        d="M8 13V6C8 5.17 8.67 4.5 9.5 4.5S11 5.17 11 6V11"
        stroke={dark}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 5V3.5C11 2.67 11.67 2 12.5 2S14 2.67 14 3.5V11"
        stroke={dark}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 4V3C14 2.17 14.67 1.5 15.5 1.5S17 2.17 17 3V11"
        stroke={dark}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 4.5V4C17 3.17 17.67 2.5 18.5 2.5S20 3.17 20 4V14C20 19.52 15.52 24 10 24C7.24 24 5 21.76 5 19V13C5 12.17 5.67 11.5 6.5 11.5S8 12.17 8 13"
        stroke={dark}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Number badge */}
      <circle cx="12.5" cy="17" r="5.5" fill={light} />
      <text
        x="12.5"
        y="20.5"
        textAnchor="middle"
        fontWeight="900"
        fontSize="10"
        fill={dark}
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        7
      </text>
    </svg>
  );
}
