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
  const longest = words.reduce((m, w) => Math.max(m, w.length), 0);
  let s = n <= 1 ? 30 : n <= 4 ? 24 : n <= 8 ? 20 : 15;
  if (longest > 6) s = Math.round(s * (n <= 1 ? 0.85 : 0.8));
  return s;
}

/** The points count-up: ease-out from 0 to `target` over t ∈ [0, 1]. */
export function countUpValue(target: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return Math.round(target * (1 - Math.pow(1 - k, 3)));
}
