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
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      {/* Left-facing open hand — palm faces viewer, thumb on right */}
      <path
        d="M8 13V6.5C8 5.67 8.67 5 9.5 5S11 5.67 11 6.5V11"
        stroke={dark}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 5.5V4C11 3.17 11.67 2.5 12.5 2.5S14 3.17 14 4V11"
        stroke={dark}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 4.5V3.5C14 2.67 14.67 2 15.5 2S17 2.67 17 3.5V11"
        stroke={dark}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 5V4.5C17 3.67 17.67 3 18.5 3S20 3.67 20 4.5V13C20 17.97 15.97 22 11 22C7.69 22 5 19.31 5 16V13C5 12.17 5.67 11.5 6.5 11.5S8 12.17 8 13"
        stroke={dark}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Number badge */}
      <circle cx="12.5" cy="15" r="5" fill={light} />
      <text
        x="12.5"
        y="18.2"
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
