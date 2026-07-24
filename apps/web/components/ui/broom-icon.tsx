interface BroomIconProps {
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

export function BroomIcon({ className, size = 20, style }: BroomIconProps) {
  // Line-art broom (angled handle + fanned bristles), sized/styled to sit
  // alongside the lucide icons: 24×24, currentColor stroke, rounded caps.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {/* Handle */}
      <path d="M20 3 L11 12" />
      {/* Brush head band */}
      <path d="M8.5 9.5 L14.5 15.5" />
      {/* Fanned bristles */}
      <path d="M8.5 9.5 L4 18 L14.5 15.5" />
      <path d="M7 14 L10 17" />
      <path d="M9.5 12.5 L12 15" />
    </svg>
  );
}
