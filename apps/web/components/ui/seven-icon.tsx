interface SevenIconProps {
  className?: string;
  size?: number;
}

export function SevenIcon({ className, size = 20 }: SevenIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Right-facing open hand (mirrored palm out, fingers up) */}
      <path
        d="M16 14.5V7.5C16 6.67 15.33 6 14.5 6S13 6.67 13 7.5V12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 6.5V5C13 4.17 12.33 3.5 11.5 3.5S10 4.17 10 5V12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 5.5V4.5C10 3.67 9.33 3 8.5 3S7 3.67 7 4.5V12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 6V5.5C7 4.67 6.33 4 5.5 4S4 4.67 4 5.5V14C4 18.42 7.58 22 12 22H13C16.31 22 19 19.31 19 16V14.5C19 13.67 18.33 13 17.5 13S16 13.67 16 14.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bold "7" */}
      <circle cx="11" cy="14" r="5.5" fill="currentColor" fillOpacity="0.15" />
      <text
        x="11"
        y="17.5"
        textAnchor="middle"
        fontWeight="900"
        fontSize="10"
        fill="currentColor"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        7
      </text>
    </svg>
  );
}
