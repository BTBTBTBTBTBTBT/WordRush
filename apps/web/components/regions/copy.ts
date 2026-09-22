// Starsweep player-facing strings (More Games §18b wording guard). "Sweep"
// already means the Daily Sweep in Wordocious and Starsweep does NOT count
// toward it, so the game is always "Starsweep" (one word), its win copy never
// says "Sweep!", and scripts/regions-copy.test.ts greps these strings for a
// bare "sweep". Keep every string a player can read about this game here.

export const REGIONS_ACCENT = '#ca8a04';
export const REGIONS_TITLE = 'Starsweep';
export const REGIONS_HEADER = 'STARSWEEP';
export const REGIONS_WIN_TITLE = 'Board cleared';
export const REGIONS_WIN_SHORT = 'Starsweep solved';
export const REGIONS_LOSS_TITLE = 'Out of mistakes';
export const REGIONS_TAP_HINT = 'Tap a cell: × first, then a star';
export const REGIONS_SIZE_LABEL: Record<number, string> = { 7: '7 × 7', 8: '8 × 8', 9: '9 × 9' };
export const REGIONS_ALL_COPY: string[] = [
  REGIONS_TITLE, REGIONS_HEADER, REGIONS_WIN_TITLE, REGIONS_WIN_SHORT, REGIONS_LOSS_TITLE, REGIONS_TAP_HINT,
  ...Object.values(REGIONS_SIZE_LABEL),
];
