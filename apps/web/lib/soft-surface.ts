import type { CSSProperties } from 'react';

// No plain white (docs/FINISH_SPEC.md A1; docs/WHITE_AUDIT.md). Every card,
// tile, chip, pill, popover, sheet and row takes a soft wash of its accent:
// background ≈ mix(accent 12–14%, white), a 1.5 px border ≈ mix(accent
// 30–35%, white); cards add the game-card top bar; icon tiles are mini game
// cards (tint + border + a 4 px accent top bar + a soft accent shadow).
//
// The washes are drawn as the accent at an alpha laid over
// `var(--color-card-base)` (white in the light themes, the dark surface in the
// dark theme), so ONE helper gives the light wash and keeps dark mode on its
// existing dark surfaces. Pure, no hooks: server components can use it.

/** The finishing-build wash strengths (share of the accent over white). */
export const SOFT = {
  /** Cards, pills, chips, rows: accent at 12–14%. */
  tint: 0.13,
  /** A selected chip / tile: a stronger wash. */
  strong: 0.24,
  /** The border's effective share of the accent (30–35%). */
  line: 0.32,
  /** The game-card top bar on cards (px). */
  bar: 10,
  /** The top bar on icon tiles and pills (px). */
  iconBar: 4,
} as const;

function hexRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** `#rrggbb` (or `#rgb`) with an alpha byte: alphaHex('#7c3aed', 0.13) → '#7c3aed21'. */
export function alphaHex(hex: string, alpha: number): string {
  const [r, g, b] = hexRgb(hex);
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  return `#${[r, g, b, a].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** `hex` darkened by `amount` (0–1) toward black: darken('#6d28d9', 0.35) → '#471a8d' (A8's button lip). */
export function darken(hex: string, amount: number): string {
  const k = 1 - Math.max(0, Math.min(1, amount));
  return `#${hexRgb(hex).map((c) => Math.round(c * k).toString(16).padStart(2, '0')).join('')}`;
}

/** The opaque mix of `accent` at `share` over `base`, as #rrggbb: softMix('#7c3aed', 0.13) → '#eee5fd'. */
export function softMix(accent: string, share: number, base = '#ffffff'): string {
  const a = hexRgb(accent);
  const b = hexRgb(base);
  return `#${a.map((c, i) => Math.round(c * share + b[i] * (1 - share)).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The alpha a border needs, drawn over a background that already carries the
 * accent at `under`, so the two together read as the accent at `total`:
 * 1 − (1 − total) / (1 − under). (A border paints over its own background.)
 */
export function overAlpha(total: number, under: number): number {
  if (under >= 1) return 0;
  return Math.max(0, 1 - (1 - total) / (1 - under));
}

/** The wash layer: the accent at `share` over the card base (white light / dark surface dark). */
export function softBackground(accent: string, share: number = SOFT.tint): string {
  const a = alphaHex(accent, share);
  return `linear-gradient(${a}, ${a}), var(--color-card-base, #ffffff)`;
}

/** The 1.5 px soft border for a wash of `share`. */
export function softBorder(accent: string, share: number = SOFT.tint, width = 1.5): string {
  return `${width}px solid ${alphaHex(accent, overAlpha(SOFT.line, share))}`;
}

/** A soft accent shadow (the accent at 11–20%). */
export function softShadow(accent: string, alpha = 0.14, blur = 14, y = 5): string {
  return `0 ${y}px ${blur}px ${alphaHex(accent, alpha)}`;
}

/**
 * A tinted card (A1): the accent's wash, its soft border, rounded. Pair with
 * <SoftCardBar/> (or `cardBarStyle`) for the 10 px game-card top bar; the card
 * needs `overflow: hidden` so the bar follows its corners.
 */
export function softCard(accent: string, { radius = 18, selected = false, shadow = true }: { radius?: number; selected?: boolean; shadow?: boolean } = {}): CSSProperties {
  const share = selected ? SOFT.strong : SOFT.tint;
  return {
    background: softBackground(accent, share),
    border: selected ? `2px solid ${accent}` : softBorder(accent, share),
    borderRadius: radius,
    boxShadow: shadow ? softShadow(accent, 0.11) : undefined,
  };
}

/** The game-card top bar in the accent (a gradient toward a lighter tail). */
export function cardBarStyle(accent: string, height: number = SOFT.bar): CSSProperties {
  return { height, background: `linear-gradient(90deg, ${accent}, ${alphaHex(accent, 0.8)})` };
}

/**
 * An icon tile as a mini game card (A1: pickers, rails, sweep rows): the wash,
 * the border, a 4 px accent top bar drawn as an inset shadow (no extra
 * element), and a soft accent shadow. `selected` = a stronger wash + an accent
 * ring.
 */
export function softIconTile(accent: string, { selected = false, radius = 12 }: { selected?: boolean; radius?: number } = {}): CSSProperties {
  const share = selected ? SOFT.strong : SOFT.tint;
  return {
    background: softBackground(accent, share),
    border: selected ? `2px solid ${accent}` : softBorder(accent, share),
    borderRadius: radius,
    boxShadow: selected
      ? `inset 0 ${SOFT.iconBar}px 0 ${accent}, 0 0 0 3px ${alphaHex(accent, 0.22)}`
      : `inset 0 ${SOFT.iconBar}px 0 ${accent}, 0 3px 8px ${alphaHex(accent, 0.2)}`,
  };
}

/** A tinted pill (result pills, popup stat tiles): wash + border + a 4 px accent top bar. */
export function softPill(accent: string, { radius = 999, bar = true }: { radius?: number; bar?: boolean } = {}): CSSProperties {
  return {
    background: softBackground(accent, 0.12),
    border: softBorder(accent, 0.12),
    borderRadius: radius,
    boxShadow: bar ? `inset 0 ${SOFT.iconBar}px 0 ${accent}, 0 4px 10px ${alphaHex(accent, 0.1)}` : `0 4px 10px ${alphaHex(accent, 0.1)}`,
  };
}

/** The brand purple every page card without a game falls back to. */
export const BRAND_ACCENT = '#7c3aed';
