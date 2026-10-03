// Calmer top (docs/FINISH_SPEC.md N1): one cast per screen — the living cast
// row is the only whole-cast art, and page titles (art-title-*, re-shipped as
// lettering only) are smaller centered headlines: ≈62% of the content width,
// at most 300 px wide and 64 px tall. The Home section titles (DAILIES /
// PUZZLES / WORD OF THE DAY) follow the same rule. The Leaderboard day title
// keeps its single host and is capped at ≈58% width / 150 px tall. Pure.

export interface HeadlineRule {
  /** Share of the content width (%). */
  widthPct: number;
  /** Widest it draws (px). */
  maxWidth: number;
  /** Tallest it draws (px). */
  maxHeight: number;
}

/** Page / section titles. */
export const HEADLINE: HeadlineRule = { widthPct: 62, maxWidth: 300, maxHeight: 64 };
/** The Leaderboard day title (one host drawn in). */
/** AU2 + BB3: ≤ 90 tall (was 150) so the podium shows on arrival under the two-row picker. */
export const DAY_HEADLINE: HeadlineRule = { widthPct: 58, maxWidth: 360, maxHeight: 90 };

/** The widest an art of `w`×`h` may draw under a rule: the width cap, or the width at which it hits the height cap. */
export function headlineMaxWidth(w: number, h: number, rule: HeadlineRule = HEADLINE): number {
  return Math.max(1, Math.min(rule.maxWidth, Math.round((rule.maxHeight * w) / h)));
}
