// Hint layout rule (founder 10-03: "hitting the hint button caused one of the
// puzzle games to shrink a bit"): pressing a hint, check or reveal — or any
// feedback toast or hint message appearing — must NEVER change a board's size
// or move the layout. So:
//  · a hint/check count is a corner badge on its button (components/ui/hint-kit.tsx),
//    never "Hint · 2" in the label (a wider label wrapped the action row on
//    375-430 px phones and the flex-1 board above it shrank);
//  · a hint's result text sits in a slot that is ALWAYS present at a fixed
//    height (empty when idle), or in a flow that already scrolls;
//  · toasts are absolute over a `position: relative` anchor (FeedbackToast).

/** The text on a hint/check count badge: '' (no badge) at 0, then 1…99, then "99+". */
export function hintCountText(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '';
  return count > 99 ? '99+' : String(Math.floor(count));
}

/**
 * ProperNoundle's clue slot (solo + VS): always present under the header, three
 * lines of the 13 px clue (17 px line height) plus 4 px padding top and bottom.
 * The clue is clamped to three lines; tapping it opens the whole clue as an overlay.
 * (Doug 10-05: two lines cut a Wikipedia clue at "His…"; the board gives up the
 * extra line for good, so revealing the clue still never resizes it.)
 */
export const CLUE_SLOT = { fontPx: 13, linePx: 17, lines: 3, padY: 4 } as const;
export const CLUE_SLOT_PX = CLUE_SLOT.linePx * CLUE_SLOT.lines + CLUE_SLOT.padY * 2;

/** The slot height for a clue (or none): the same either way, so the board never resizes. */
export function clueSlotHeight(_clue: string | null | undefined): number {
  return CLUE_SLOT_PX;
}

/** Kindred's named-category chip row above the grid: one fixed-height line, always present. */
export const KINDRED_LABEL_SLOT_PX = 24;

/**
 * Hubbub's hexagon side: the column height left after the fixed rows (rank bar,
 * entry line, controls, found-words header, End), / 3.3, capped by width / 3.6,
 * clamped 72…100. Pending "Starts with…" hint chips are NOT a fixed row — they
 * render inside the found-words flow, which already scrolls.
 */
export function hubTileSize(colHeight: number, colWidth: number, fixedRows: readonly number[]): number {
  const fixed = fixedRows.reduce((sum, h) => sum + h, 0);
  const free = colHeight - fixed;
  return Math.round(Math.max(72, Math.min(100, free / 3.3, colWidth / 3.6)));
}
