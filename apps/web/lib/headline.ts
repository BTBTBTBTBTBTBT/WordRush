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
/**
 * BJ7 (founder 10-03: "I like the crisp look"): a page's TOP title (PageHeadline,
 * the art page headers, the footer pages) caps at 52 tall. The Home section titles
 * (DAILIES / PUZZLES / WORD OF THE DAY / VS BATTLE) keep HEADLINE. iOS PageHeadline
 * .page / Android HeadlineSize.PAGE_TITLE_H carry the same 52.
 */
export const PAGE_HEADLINE: HeadlineRule = { ...HEADLINE, maxHeight: 52 };
/** The Leaderboard day title (one host drawn in). */
/** AU2 + BB3: ≤ 90 tall (was 150) so the podium shows on arrival under the two-row picker; BJ7: ≤ 78. */
/** Founder 10-05 ("still is very small … fill out the space beautifully"): ≤ 124 tall, up to 88% wide. iOS LeaderboardArt.dayCap / Android LB_TITLE_MAX match. */
export const DAY_HEADLINE: HeadlineRule = { widthPct: 88, maxWidth: 360, maxHeight: 124 };

/** The Halloween day-title props: ONE per side (never a lone prop), each this wide (px). */
export const DAY_PROP_SIZE = 50;

/** The pair of season props for a day (two different ones, by day of the year) — mirrors iOS CastSkin.dayProps. */
export function dayPropPair<T>(props: readonly T[], dayOfYear: number): [T, T] | null {
  if (props.length < 2) return null;
  return [props[dayOfYear % props.length], props[(dayOfYear + 1) % props.length]];
}

/** The widest an art of `w`×`h` may draw under a rule: the width cap, or the width at which it hits the height cap. */
export function headlineMaxWidth(w: number, h: number, rule: HeadlineRule = HEADLINE): number {
  return Math.max(1, Math.min(rule.maxWidth, Math.round((rule.maxHeight * w) / h)));
}
