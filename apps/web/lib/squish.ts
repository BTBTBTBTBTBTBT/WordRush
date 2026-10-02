// The spongy press (docs/FINISH_SPEC.md A9), as data so it's testable and the
// same on every element: components/ui/squish-host.tsx plays these frames.
// `down` is held while the finger is down; on release the element springs
// through `over` (past 1) and settles at `rest`.

export type SquishKind = 'press' | 'icon' | 'key' | 'candy';

export const SQUISH_FRAMES: Record<SquishKind, { down: string; over: string; rest: string; downMs: number; upMs: number }> = {
  /** Buttons, chips, segmented options, cards, list rows, game tiles: ~.92 → ~1.05 → 1. */
  press: { down: 'scale(0.92)', over: 'scale(1.05)', rest: 'scale(1)', downMs: 90, upMs: 260 },
  /** Bare 3D icons (header controls, tab icons): .86 / .80 → 1.08 → 1. */
  icon: { down: 'scale(0.86, 0.8)', over: 'scale(1.08)', rest: 'scale(1)', downMs: 80, upMs: 260 },
  /** Keyboard keys sink 2 px into their lip, then spring back. */
  key: { down: 'translateY(2px) scale(0.94)', over: 'translateY(0) scale(1.04)', rest: 'translateY(0) scale(1)', downMs: 60, upMs: 220 },
  /** Candy buttons: scale .92 while the lip compresses (globals.css .candy-pressed). */
  candy: { down: 'translateY(2px) scale(0.92)', over: 'translateY(0) scale(1.05)', rest: 'translateY(0) scale(1)', downMs: 80, upMs: 280 },
};

/** Which press an element gets, from its classes and tag. */
export function squishKind(className: string, _tagName = ''): SquishKind {
  const cls = ` ${className} `;
  if (cls.includes(' candy ')) return 'candy';
  if (cls.includes(' kkey ')) return 'key';
  if (cls.includes(' hdr-glyph ') || cls.includes(' tab-squish ') || cls.includes(' squish-icon ')) return 'icon';
  return 'press';
}
