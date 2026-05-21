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
      {/* Rightward cupped hand silhouette (mirrored) */}
      <path
        d="M18 18c1.5-1 2.5-3 2.5-5.5C20.5 9 18.5 6 15 5c-1-.3-2-.3-3 0-.8.2-1.5.7-2 1.3-.3.4-.5.8-.6 1.2-.2.8-.1 1.5.2 2.2.4.8 1 1.4 1.8 1.8 1 .5 2 .6 3.2.4.9-.2 1.4-.9 1.4-1.9 0-.8-.5-1.5-1.2-1.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M9.5 8c-.5-.2-1.2-.1-1.6.3-.5.5-.6 1.2-.4 1.8l1 3M7.5 8.3c-.5-.3-1.2-.2-1.6.2-.4.5-.5 1.1-.3 1.7l.8 2.5M5.6 9c-.5-.2-1-.1-1.4.3-.3.4-.4 1-.2 1.5l.5 1.8M10 13.5c.5 1.5.5 3-.2 4.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Bold "7" overlay */}
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontWeight="900"
        fontSize="11"
        fill="currentColor"
        fontFamily="system-ui, sans-serif"
      >
        7
      </text>
    </svg>
  );
}
