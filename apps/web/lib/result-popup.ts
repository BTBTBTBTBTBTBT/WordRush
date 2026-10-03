// The win / lose popup (docs/FINISH_SPEC.md R1). Pure helpers.

/** M:SS past a minute, else "48s" ("35m 17s" used to wrap in the stat cell). */
export function popupFormatTime(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

/**
 * The answer tiles' side (px): ~26 for one or a few words, smaller as the
 * board count grows so the tray never overflows the card (2 columns up to 8
 * words, 3 past that), and smaller still for long words.
 */
export function answerTileSize(words: string[]): number {
  const n = words.length;
  // A phrase answer (ProperNoundle) is drawn one word per row: its longest word counts.
  const longest = words.reduce((m, w) => Math.max(m, ...answerRows(w).map((r) => r.length), 0), 0);
  let s = n <= 1 ? 30 : n <= 4 ? 24 : n <= 8 ? 20 : 15;
  if (longest > 6) s = Math.round(s * (n <= 1 ? 0.85 : 0.8));
  return s;
}

/** An answer's tile rows (founder 10-02): one row per word, split at spaces — no space tiles. */
export function answerRows(answer: string): string[] {
  return answer.toUpperCase().split(/\s+/).filter(Boolean);
}

/** The gap between answer tiles (px). */
export function answerTileGap(tile: number): number {
  return Math.max(2, Math.round(tile / 10));
}

/** The gap between the answer columns (multi-board), px. */
export const ANSWER_COLUMN_GAP = 12;

/** The smallest answer tile (px) the popup will draw. */
export const ANSWER_TILE_MIN = 12;

/**
 * Founder 10-02 (ProperNoundle's "HUBBLE SPACE TELESCOPE" ran off the card):
 * the answer tile side that fits every row inside the tray's measured inner
 * `width` — per column on the multi-board layouts, leaving room for the check
 * badge — capped at answerTileSize, never under ANSWER_TILE_MIN. Unmeasured
 * (null) → the cap.
 */
export function fitAnswerTile(words: string[], width: number | null, cols: number, badge: boolean): number {
  const cap = answerTileSize(words);
  if (!width || width <= 0) return cap;
  const longest = words.reduce((m, w) => Math.max(m, ...answerRows(w).map((r) => r.length), 0), 0);
  if (!longest) return cap;
  const colWidth = (width - (Math.max(1, cols) - 1) * ANSWER_COLUMN_GAP) / Math.max(1, cols);
  for (let t = cap; t > ANSWER_TILE_MIN; t--) {
    const badgeRoom = badge ? Math.max(12, Math.round(t * 0.6)) + 4 : 0;
    if (longest * t + (longest - 1) * answerTileGap(t) + badgeRoom <= colWidth) return t;
  }
  return ANSWER_TILE_MIN;
}

/** The points count-up: ease-out from 0 to `target` over t ∈ [0, 1]. */
export function countUpValue(target: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return Math.round(target * (1 - Math.pow(1 - k, 3)));
}
