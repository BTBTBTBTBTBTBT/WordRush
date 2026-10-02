// The spongy press (docs/FINISH_SPEC.md A9), as data so it's testable and the
// same on every element: components/ui/squish-host.tsx plays these frames.
// `down` is held while the finger is down; on release the element springs
// through `over` (past 1) and settles at `rest`.

export type SquishKind = 'press' | 'icon' | 'key' | 'candy' | 'card';

export const SQUISH_FRAMES: Record<SquishKind, { down: string; over: string; rest: string; downMs: number; upMs: number }> = {
  /** Buttons, chips, segmented options, cards, list rows, game tiles: ~.92 → ~1.05 → 1. */
  press: { down: 'scale(0.92)', over: 'scale(1.05)', rest: 'scale(1)', downMs: 90, upMs: 260 },
  /** Bare 3D icons (header controls, tab icons): .86 / .80 → 1.08 → 1. */
  icon: { down: 'scale(0.86, 0.8)', over: 'scale(1.08)', rest: 'scale(1)', downMs: 80, upMs: 260 },
  /** Keyboard keys sink 2 px into their lip, then spring back. */
  key: { down: 'translateY(2px) scale(0.94)', over: 'translateY(0) scale(1.04)', rest: 'translateY(0) scale(1)', downMs: 60, upMs: 220 },
  /** Home game cards / tiles (FINISH_SPEC AK): .95 with a spring, back through 1.02. */
  card: { down: 'scale(0.95)', over: 'scale(1.02)', rest: 'scale(1)', downMs: 90, upMs: 280 },
  /** Candy buttons: scale .92 while the lip compresses (globals.css .candy-pressed). */
  candy: { down: 'translateY(2px) scale(0.92)', over: 'translateY(0) scale(1.05)', rest: 'translateY(0) scale(1)', downMs: 80, upMs: 280 },
};

/** Which press an element gets, from its classes and tag. */
export function squishKind(className: string, _tagName = '', dataSquish: string | null = null): SquishKind {
  const cls = ` ${className} `;
  if (dataSquish === 'card' || cls.includes(' squish-card ')) return 'card';
  if (cls.includes(' candy ')) return 'candy';
  if (cls.includes(' kkey ')) return 'key';
  if (cls.includes(' hdr-glyph ') || cls.includes(' tab-squish ') || cls.includes(' squish-icon ')) return 'icon';
  return 'press';
}

/**
 * FINISH_SPEC AK: a transform on a display:inline element does nothing (a Next
 * <Link> wrapping a block card renders an inline <a>), so the squish moves to
 * its first element child instead.
 */
export function squishTargetIsChild(display: string, hasChild: boolean): boolean {
  return hasChild && (display === 'inline' || display === 'contents');
}
