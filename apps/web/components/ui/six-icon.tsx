interface SixIconProps {
  className?: string;
  size?: number;
}

export function SixIcon({ className, size = 20 }: SixIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Left-facing open hand (palm out, fingers up) */}
      <path
        d="M8 14.5V7.5C8 6.67 8.67 6 9.5 6S11 6.67 11 7.5V12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 6.5V5C11 4.17 11.67 3.5 12.5 3.5S14 4.17 14 5V12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 5.5V4.5C14 3.67 14.67 3 15.5 3S17 3.67 17 4.5V12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 6V5.5C17 4.67 17.67 4 18.5 4S20 4.67 20 5.5V14C20 18.42 16.42 22 12 22H11C7.69 22 5 19.31 5 16V14.5C5 13.67 5.67 13 6.5 13S8 13.67 8 14.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bold "6" */}
      <circle cx="13" cy="14" r="5.5" fill="currentColor" fillOpacity="0.15" />
      <text
        x="13"
        y="17.5"
        textAnchor="middle"
        fontWeight="900"
        fontSize="10"
        fill="currentColor"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        6
      </text>
    </svg>
  );
}
