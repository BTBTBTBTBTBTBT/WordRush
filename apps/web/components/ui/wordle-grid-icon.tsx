/** A tiny 5×6 grid icon representing a classic Wordle board. */
export function WordleGridIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 5 columns × 6 rows of rounded squares */}
      {[0, 1, 2, 3, 4, 5].map((row) =>
        [0, 1, 2, 3, 4].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={col * 4}
            y={row * 4}
            width="3.2"
            height="3.2"
            rx="0.6"
            fill="currentColor"
            opacity={0.85}
          />
        ))
      )}
    </svg>
  );
}
