// The puzzle games' one-screen finished screen (docs/FINISH_SPEC.md R2) —
// pure helpers for components/puzzles/finished-screen.tsx (Sudocious, Muddle,
// Hubbub, Crosswordocious, Kindred, Letter Ladder, Codebreaker, Spyglass,
// Starsweep).

import { formatGuessStat } from './format';

/**
 * The "More" disclosure's summary row peeking under the action dock (px):
 * MoreDisclosure's summary is py-2 (16) around a ~22 px pill. The one-screen
 * column ends this far above the tab bar so the row is visible without
 * scrolling; opening it scrolls the extras into view below.
 */
export const MORE_PEEK = 40;

/**
 * Splits a mode's guess stat (lib/format.ts formatGuessStat: "2 mistakes",
 * "Par", "+2", "Hubbub") into the result strip chip's value + small label.
 * One-word stats (Par / +2 / a Hubbub rank) keep the whole word as the value
 * and take the semantics' short label.
 */
export function guessStatParts(semantics: string, guessBase: number, guessCount: number): { value: string; label: string } {
  const text = formatGuessStat(semantics, guessBase, guessCount);
  const space = text.indexOf(' ');
  if (space > 0) return { value: text.slice(0, space), label: text.slice(space + 1) };
  return { value: text, label: semantics === 'overPar' ? 'par' : semantics === 'rank' ? 'rank' : '' };
}

/** The strip's time: 0:48, 1:05, 12:30. */
export function clockTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

/** The fixed parts of a finished screen, CSS px (see finishedBoardRoom). */
export interface FinishedChrome {
  /** Viewport height (667 on an iPhone SE). */
  viewport: number;
  /** The game header: corner-button row + title art + status line(s) + padding. */
  header: number;
  /** The result strip (+ any line under it). */
  strip: number;
  /** The action dock: share / primary candy row, plus the Unlimited card for Pro. */
  dock: number;
  /** The docked tab bar (--bottom-nav-h), safe area included. */
  tabBar: number;
  /** The More summary row peeking below the dock (0 when the game has no extras). */
  peek: number;
}

/** The height the FitBox (the board) gets: whatever the header, strip, dock, More row and tab bar leave. */
export function finishedBoardRoom(c: FinishedChrome): number {
  return c.viewport - c.header - c.strip - c.dock - c.tabBar - c.peek;
}
