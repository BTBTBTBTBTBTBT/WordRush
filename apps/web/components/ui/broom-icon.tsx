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
      <path d="M19 4.5 L9.5 14" />
      {/* Binding band (crosses the handle base) */}
      <path d="M6.5 11 L12.5 17" />
      {/* Fanned bristles splaying out below the band */}
      <path d="M9.5 14 L4 20" />
      <path d="M6.7 12.8 L5 20.5" />
      <path d="M8.4 14.5 L8 21" />
      <path d="M10.2 16.2 L11 20.8" />
      <path d="M11.6 15.6 L13.6 19.6" />
    </svg>
  );
}
