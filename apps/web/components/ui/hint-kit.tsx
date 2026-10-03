import type { CSSProperties } from 'react';
import { hintCountText } from '@/lib/hint-layout';

// Hint-control pieces that never move the layout (lib/hint-layout.ts). No hooks: server-safe.

const COUNT_BADGE: CSSProperties = {
  // Inline `position` beats globals.css `.candy > * { position: relative }`.
  position: 'absolute',
  top: -7,
  right: -5,
  zIndex: 1,
  minWidth: 17,
  height: 17,
  fontSize: 10,
  letterSpacing: 0,
  // A small gold coin (the hint gold), not the pink "unseen" badge.
  background: 'linear-gradient(#ffe27a, #f5a524)',
  boxShadow: 'inset 0 0 0 1.5px #ffffff, 0 2px 0 #b45309, 0 3px 6px rgba(245, 165, 36, 0.35)',
  color: '#7a3d00',
  textShadow: '0 1px 0 rgba(255, 255, 255, 0.55)',
};

/**
 * The used-count on a hint / check candy button: a gold coin on the button's
 * top-right corner, absolutely placed, so the label (and the row) never changes
 * width when the count appears or grows. Renders nothing at 0.
 */
export function HintCountBadge({ count }: { count: number }) {
  const text = hintCountText(count);
  if (!text) return null;
  return <span aria-hidden="true" className="candy-badge pointer-events-none" style={COUNT_BADGE}>{text}</span>;
}

/**
 * A label that keeps the width of its widest variant: every variant is stacked
 * in one grid cell and only `value` is visible, so "Reveal · 4:59" → "Reveal"
 * or "Show words" → "Words shown" never resizes the button. Digits are tabular.
 */
export function StableLabel({ value, reserve }: { value: string; reserve: readonly string[] }) {
  const ghosts = reserve.filter((r) => r !== value);
  return (
    <span className="inline-grid justify-items-center" style={{ fontVariantNumeric: 'tabular-nums' }}>
      <span style={{ gridArea: '1 / 1' }}>{value}</span>
      {ghosts.map((g) => <span key={g} aria-hidden="true" style={{ gridArea: '1 / 1', visibility: 'hidden' }}>{g}</span>)}
    </span>
  );
}
