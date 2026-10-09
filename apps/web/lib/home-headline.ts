// FINISH_SPEC BJ6 round 4 (founder 10-03: the greeting is personal — "GOOD AFTERNOON, BMT!" — and a
// long username must never shrink, scroll or clip): the web mapping of core's headline layout.
// The slot's width (measured once per resize) → ONE lettering size for the device (the longest
// fixed greeting line fits, capped at 38) → the lines at exactly that size, the player's name on
// its own gold line(s) when the greeting doesn't fit on one. Pure; the look lives in
// components/home/home-banner.tsx.

import { homeHeadlineFit, type HeadlineLayout } from '@wordle-duel/core';

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

/** One headline laid out for a slot `slotWidth` px wide (the size never shrinks for a long name). */
export function homeHeadlineLayout(slotWidth: number, headline: string, name: string): HomeHeadlineLayout {
  const textWidth = headlineTextWidth(slotWidth);
  // 2.8 item 6: core's bubble-text fit — the name keeps its stacked gold lines; every other
  // headline that is too long wraps in balanced lines (never a shrink-and-clip, never "…").
  const fit = homeHeadlineFit(headline, name, textWidth);
  return { lines: fit.lines, nameLines: fit.nameLines, size: fit.size, lineHeight: Math.ceil(fit.size * HEADLINE_LINE_EM), textWidth };
}

/**
 * Z: the headline row is as tall as the TALLER of the two modes' headlines (Daily / Unlimited),
 * so the switch never moves anything; it grows exactly by the extra lines.
 */
export function headlineRowHeight(layouts: readonly HomeHeadlineLayout[]): number {
  return Math.max(...layouts.map((l) => l.lines.length * l.lineHeight));
}
