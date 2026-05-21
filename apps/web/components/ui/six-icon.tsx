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
      {/* Leftward cupped hand silhouette */}
      <path
        d="M6 18c-1.5-1-2.5-3-2.5-5.5C3.5 9 5.5 6 9 5c1-.3 2-.3 3 0 .8.2 1.5.7 2 1.3.3.4.5.8.6 1.2.2.8.1 1.5-.2 2.2-.4.8-1 1.4-1.8 1.8-1 .5-2 .6-3.2.4C8.5 11.7 8 11 8 10c0-.8.5-1.5 1.2-1.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M14.5 8c.5-.2 1.2-.1 1.6.3.5.5.6 1.2.4 1.8l-1 3M16.5 8.3c.5-.3 1.2-.2 1.6.2.4.5.5 1.1.3 1.7l-.8 2.5M18.4 9c.5-.2 1-.1 1.4.3.3.4.4 1 .2 1.5l-.5 1.8M14 13.5c-.5 1.5-.5 3 .2 4.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Bold "6" overlay */}
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontWeight="900"
        fontSize="11"
        fill="currentColor"
        fontFamily="system-ui, sans-serif"
      >
        6
      </text>
    </svg>
  );
}
