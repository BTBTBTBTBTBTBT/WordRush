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

// ProperNoundle's clue has NO slot on the play screen (founder 10-05: no empty space):
// it opens as a card hung from the header (components/propernoundle/clue-slot.tsx
// ClueCard) when the Clue hint lands, and the used Clue pill reopens it, so the hint
// never resizes the board.

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
