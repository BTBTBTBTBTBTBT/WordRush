// Letter Ladder's mode icon — lucide has no ladder, so this is drawn in the
// lucide idiom (24-box, 2px round strokes) like WordleGridIcon/SixIcon. Two
// rails and three rungs; the same shape ships as ic_ladder.xml on Android and
// as the "ladder" template image on iOS.
export function LadderIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 3v18" />
      <path d="M17 3v18" />
      <path d="M7 8h10" />
      <path d="M7 13h10" />
      <path d="M7 18h10" />
    </svg>
  );
}
