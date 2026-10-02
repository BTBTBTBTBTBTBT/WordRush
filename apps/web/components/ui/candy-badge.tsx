import { badgeText } from '@/lib/friends-badge';

// The candy count badge (docs/FINISH_SPEC.md M): hot pink → coral
// (#ff5fa2 → #f0435f), a 1.5 px gold outline, a white top gloss, a darker
// lip, a white Nunito Black count (1–9, then "9+"); min 18 px round, a pill
// for two digits. `pop` springs it in; `pulse` breathes its glow every ~4 s
// (both off with Reduce Motion; globals.css `.candy-badge`). Used on the
// Friends tab and on the waiting rows inside Friends. No hooks: server-safe.

export function CandyBadge({ count, size = 18, pop = false, pulse = false, className = '', style, label }: {
  count: number;
  size?: number;
  /** Spring in (scale 0 → 1.15 → 1). */
  pop?: boolean;
  /** Soft glow pulse while unseen. */
  pulse?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Accessible text; omit when the parent already says it (the tab label). */
  label?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={`candy-badge ${pop ? 'candy-badge-pop' : ''} ${pulse ? 'candy-badge-pulse' : ''} ${className}`}
      style={{ minWidth: size, height: size, fontSize: Math.round(size * 0.58), ...style }}
      {...(label ? { role: 'status', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {badgeText(count)}
    </span>
  );
}
