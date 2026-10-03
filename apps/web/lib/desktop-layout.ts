// The desktop website layout (founder 10-02: "format it better to look like a
// website version of this"). Three layout tiers, all CSS (app/globals.css):
//
// - phone   (< 900 px): the phone app, untouched.
// - wide    (900–1023 px): FINISH_SPEC AG — the 560 px game column, two-column
//   tab pages up to 1100 px, the docked tab bar centered in the column.
// - desktop (≥ 1024 px): the website — a sticky top bar (the cast wordmark on
//   the left, Home / Leaderboard / Stats / Friends as candy pill tabs in the
//   middle, streak / shields / help / settings on the right) in place of the
//   bottom tab bar on the tab pages; Home as a dashboard (a wide hero, the
//   DAILIES and PUZZLES grids in 3–4 columns); Leaderboard and Friends in three
//   columns from 1200 px (two below), Stats in two; tab-page content up to 1180 px.
//
// Game screens keep the 560 px column at every width (the board never
// stretches); popups stay capped at 440 px. Pure numbers + helpers so the test
// can hold the stylesheet to them.

/** The AG wide tier starts here (px). */
export const WIDE_MIN = 900;
/** The desktop website tier starts here (px). */
export const DESKTOP_MIN = 1024;
/** Leaderboard and Friends go to three columns here (px) — every column at least phone-width. */
export const DESKTOP_3COL_MIN = 1200;
/** Home's game grids go from three to four columns here (px). */
export const DESKTOP_XL_MIN = 1280;
/** The desktop content box (px): tab pages and the top bar's content. */
export const DESKTOP_MAX = 1180;

export type LayoutTier = 'phone' | 'wide' | 'desktop';

/** The layout tier for a viewport width (CSS px). */
export function layoutTier(width: number): LayoutTier {
  if (!(width >= WIDE_MIN)) return 'phone';
  return width >= DESKTOP_MIN ? 'desktop' : 'wide';
}

/** Columns of Home mode cards (per section: DAILIES, PUZZLES) at a viewport width. */
export function homeCardColumns(width: number): 2 | 3 | 4 {
  if (layoutTier(width) !== 'desktop') return 2;
  return width >= DESKTOP_XL_MIN ? 4 : 3;
}

/** Columns of a tab page at a viewport width (the side columns stay phone-width cards). */
export function tabPageColumns(page: 'home' | 'leaderboard' | 'stats' | 'friends', width: number): 1 | 2 | 3 {
  const tier = layoutTier(width);
  if (tier === 'phone') return 1;
  if (tier === 'wide') return 2;
  return (page === 'leaderboard' || page === 'friends') && width >= DESKTOP_3COL_MIN ? 3 : 2;
}

/** Whether the bottom tab bar shows (the desktop tab pages carry the tabs in the top bar instead). */
export function showsBottomTabs(width: number, pageHasTopBar: boolean): boolean {
  return !(pageHasTopBar && layoutTier(width) === 'desktop');
}

/** The media query for a tier's lower bound. */
export function minWidthQuery(px: number): string {
  return `(min-width: ${px}px)`;
}
