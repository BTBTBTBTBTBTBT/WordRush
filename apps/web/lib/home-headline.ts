// FINISH_SPEC BJ6 round 4 (founder 10-03: the greeting is personal — "GOOD AFTERNOON, BMT!" — and a
// long username must never shrink, scroll or clip): the web mapping of core's headline layout.
// The slot's width (measured once per resize) → ONE lettering size for the device (the longest
// fixed greeting line fits, capped at 38) → the lines at exactly that size, the player's name on
// its own gold line(s) when the greeting doesn't fit on one. Pure; the look lives in
// components/home/home-banner.tsx.

import { MIN_FIT_SCALE, bubbleFit, headlineFontSize, homeHeadlineFit, type HeadlineLayout } from '@wordle-duel/core';

/** A LiveHeadline line box in em: .lh line-height 1.12 + its 0.08 / 0.16 em padding (globals.css). */
export const HEADLINE_LINE_EM = 1.36;
/** The gold sparkle (14) + its gap (6) on EACH side of line 1. */
export const HEADLINE_SPARKLE_ROOM = 20;
/** Before the first measure (server render): a 390 phone's slot (358 card − 2 × 12). */
export const HEADLINE_DEFAULT_SLOT = 334;

export interface HomeHeadlineLayout extends HeadlineLayout {
  /** The lettering size (px), the same for every line. */
  size: number;
  /** One line's box height (px). */
  lineHeight: number;
  /** The text column (the slot minus the sparkles' room), px. */
  textWidth: number;
}

/** The lettering width available in a headline slot `slotWidth` px wide. */
export function headlineTextWidth(slotWidth: number): number {
  const w = slotWidth > 0 ? slotWidth : HEADLINE_DEFAULT_SLOT;
  return Math.max(60, w - 2 * HEADLINE_SPARKLE_ROOM);
}

/**
 * One headline laid out for a slot `slotWidth` px wide (the size never shrinks for a long name). `pool` = a line from
 * the headline pool (home_headlines_v2): it was picked to fit two lines at >= MIN_FIT_SCALE of the device's size, so
 * it wraps at that floor (maxLines 2) instead of shrinking the way a legacy line may (the same rule as core's
 * headlineFitsSlot, so the words shown are the words checked).
 */
export function homeHeadlineLayout(slotWidth: number, headline: string, name: string, pool = false): HomeHeadlineLayout {
  const textWidth = headlineTextWidth(slotWidth);
  // 2.8 item 6: core's bubble-text fit — the name keeps its stacked gold lines; every other
  // headline that is too long wraps in balanced lines (never a shrink-and-clip, never "…").
  let fit = homeHeadlineFit(headline, name, textWidth);
  if (pool && fit.nameLines.length === 0) {
    const full = headlineFontSize(textWidth);
    const minSize = Math.ceil(full * MIN_FIT_SCALE);
    if (fit.wrapped || fit.size < minSize) fit = { ...bubbleFit(headline, textWidth, { maxSize: full, minSize, maxLines: 2 }), nameLines: [] };
  }
  return { lines: fit.lines, nameLines: fit.nameLines, size: fit.size, lineHeight: Math.ceil(fit.size * HEADLINE_LINE_EM), textWidth };
}

/**
 * Z: the headline row is as tall as the TALLER of the two modes' headlines (Daily / Unlimited),
 * so the switch never moves anything; it grows exactly by the extra lines.
 */
export function headlineRowHeight(layouts: readonly HomeHeadlineLayout[]): number {
  return Math.max(...layouts.map((l) => l.lines.length * l.lineHeight));
}

/**
 * Founder 10-15 (TestFlight recording): the headline changes on launch as the streaks arrive, and a row sized to the CURRENT
 * lines dropped the switch, clock and trio when the new headline took another line count / size. The row always reserves TWO
 * lines at the largest size this slot allows (a short line fits at full size), so a new headline never moves anything.
 */
export function headlineReserveHeight(slotWidth: number): number {
  return 2 * homeHeadlineLayout(slotWidth, 'W', '').lineHeight;
}
