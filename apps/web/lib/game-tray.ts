import type { CSSProperties } from 'react';
import { alphaHex, darken, overAlpha, softBackground } from './soft-surface';

// The game tray (docs/FINISH_SPEC.md L): every board container — the panel
// the tiles sit on — is ONE shared tray drawn in code: rounded 20–22 px, a
// soft wash of the game's accent (≈11% over the card base, never plain
// white; dark mode keeps its dark surface under the wash), a 1.5 px accent
// border (≈30%), a 4 px darker lip at the bottom, a faint inner top gloss, a
// soft accent drop shadow and 10–12 px inner padding. The active / zoomed
// board takes a stronger tint + an accent ring; a solved board takes a
// gentle purple (won) or slate (lost) wash. No black grid lines anywhere:
// seams inside a tray (Sudocious boxes, crossword blocks) use `traySeam`.

/** Purple (won) and slate (lost) — the B1 tile colors. */
export const TRAY_WON = '#7c3aed';
export const TRAY_LOST = '#6b7891';

export type TrayState = 'playing' | 'won' | 'lost';

export const TRAY = {
  radius: 21,
  padding: 11,
  /** The wash's share of the accent. */
  tint: 0.11,
  /** Active / zoomed board. */
  strong: 0.2,
  /** Bottom lip height. */
  lip: 4,
} as const;

/** The color a tray washes in: the game accent while playing, purple once won, slate once lost. */
export function trayColor(accent: string, state: TrayState = 'playing'): string {
  return state === 'won' ? TRAY_WON : state === 'lost' ? TRAY_LOST : accent;
}

/** The tray's style (background, border, lip, gloss, shadow, radius, padding). */
export function gameTrayStyle(
  accent: string,
  { state = 'playing', active = false, radius = TRAY.radius, padding = TRAY.padding }: { state?: TrayState; active?: boolean; radius?: number; padding?: number | string } = {},
): CSSProperties {
  const c = trayColor(accent, state);
  const share = active ? TRAY.strong : state === 'playing' ? TRAY.tint : 0.14;
  const lip = darken(c, 0.35);
  return {
    background: softBackground(c, share),
    border: active ? `2px solid ${c}` : `1.5px solid ${alphaHex(c, overAlpha(0.3, share))}`,
    borderRadius: radius,
    padding,
    boxShadow: [
      `inset 0 -${TRAY.lip}px 0 ${alphaHex(lip, 0.28)}`,
      'inset 0 10px 14px -10px rgba(255, 255, 255, 0.55)',
      active ? `0 0 0 3px ${alphaHex(c, 0.22)}` : null,
      `0 6px 16px ${alphaHex(c, 0.16)}`,
    ].filter(Boolean).join(', '),
    paddingBottom: typeof padding === 'number' ? padding + TRAY.lip : `calc(${padding} + ${TRAY.lip}px)`,
  };
}

/** A soft seam inside a tray (Sudocious 3×3 boxes, block edges): the accent darkened, never black. */
export function traySeam(accent: string, alpha = 0.32): string {
  return alphaHex(darken(accent, 0.25), alpha);
}

