// Soft numbers (docs/FINISH_SPEC.md A2): every big number — streaks, points,
// ranks, timers, stat tiles — in Nunito Black, dark purple #3b1a78,
// tabular-nums, with a soft white text shadow on light backgrounds (globals.css
// `.soft-num`). Never the gradient / gold digit art. No hooks: renders anywhere.

export function SoftNum({ children, size, className = '', style, as: Tag = 'span' }: {
  children: React.ReactNode;
  /** Font size in px. */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  as?: 'span' | 'b' | 'div';
}) {
  return (
    <Tag className={`soft-num ${className}`} style={{ fontSize: size, ...style }}>
      {children}
    </Tag>
  );
}
