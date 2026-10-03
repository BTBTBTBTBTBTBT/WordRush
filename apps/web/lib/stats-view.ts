import { SWEEP_KEY, type PickerRows } from './game-picker';

// The Stats tab's page key ↔ the shared game picker (docs/FINISH_SPEC.md C3).
// The page shows ONE view at a time: Today (landing), All-time, the Daily
// Sweep view, or one game's page (keyed by its db key). The picker header's
// Today | All-time toggle picks the first two (no tile selected); a tile picks
// a game page, and the Sweep broom tile picks the Sweep view. `?view=` keeps the
// view on reload (/records redirects to `?view=all-time`). Pure — no React.

export const VIEW_TODAY = 'today';
export const VIEW_ALL = 'all';
/** The Daily Sweep view (the picker's broom tile). */
export const VIEW_SWEEP = 'sweep';
/** Legacy: the old rail's VS chip; VS now lives at the bottom of All-time. */
export const VIEW_VS = 'vs';

export const VIEW_PARAM = 'view';

/** Parse `?view=`: all-time / sweep / a known game key; 'vs' → All-time; anything else → Today. */
export function parseViewParam(v: string | null | undefined, isGameKey: (k: string) => boolean): string {
  if (!v) return VIEW_TODAY;
  if (v === 'all-time' || v === VIEW_ALL || v === VIEW_VS) return VIEW_ALL;
  if (v === VIEW_SWEEP || v === SWEEP_KEY) return VIEW_SWEEP;
  return isGameKey(v) ? v : VIEW_TODAY;
}

/** The URL for a view: Today is the bare page. */
export function viewUrl(view: string): string {
  if (view === VIEW_TODAY) return '/stats';
  return `/stats?${VIEW_PARAM}=${view === VIEW_ALL ? 'all-time' : view}`;
}

/** The view a picker tile opens: the broom → the Sweep view, a game key → that game's page. */
export function viewForPickerKey(key: string): string {
  return key === SWEEP_KEY ? VIEW_SWEEP : key;
}

/** The picker tile a view highlights; Today and All-time select no tile (null). */
export function pickerKeyForView(view: string): string | null {
  if (view === VIEW_TODAY || view === VIEW_ALL) return null;
  return view === VIEW_SWEEP ? SWEEP_KEY : view;
}

/** Swipe order: Today · All-time · the WORDOCIOUS row (Sweep last) · the PUZZLES row — the picker's reading order. */
export function swipeOrder(rows: PickerRows): string[] {
  return [VIEW_TODAY, VIEW_ALL, ...rows.wordocious.map((t) => viewForPickerKey(t.key)), ...rows.puzzles.map((t) => viewForPickerKey(t.key))];
}

/** The neighbor one swipe away (dir +1 = next, −1 = previous), or null at either end / for an unknown view. */
export function swipeNeighbor(order: string[], view: string, dir: 1 | -1): string | null {
  const i = order.indexOf(view);
  if (i < 0) return null;
  return order[i + dir] ?? null;
}

export type TodayBadge = { kind: 'won' | 'lost' | 'done' };

/**
 * Today's W / L per picker tile (purple W, slate L). The broom tile gets a
 * check once every sweep game is done today, and a W on a Flawless day.
 */
export function todayBadges(
  rows: PickerRows,
  today: ReadonlyMap<string, { won: boolean }>,
  sweepKeys: readonly string[],
): Record<string, TodayBadge> {
  const out: Record<string, TodayBadge> = {};
  for (const t of [...rows.wordocious, ...rows.puzzles]) {
    if (t.key === SWEEP_KEY) continue;
    const r = today.get(t.key);
    if (r) out[t.key] = { kind: r.won ? 'won' : 'lost' };
  }
  if (sweepKeys.length > 0 && sweepKeys.every((k) => today.has(k))) {
    out[SWEEP_KEY] = { kind: sweepKeys.every((k) => today.get(k)?.won) ? 'won' : 'done' };
  }
  return out;
}

/**
 * A finger move that should flip the Stats page: clearly sideways (≥ 70 px and
 * at least twice as wide as tall). A diagonal scroll — common while scrolling
 * past the achievements — used to pass the old |dy| ≤ 50 test, swap the page
 * under the finger, and snap the page back up to the picker (founder 10-02).
 */
export function isPageSwipe(dx: number, dy: number): boolean {
  return Math.abs(dx) >= 70 && Math.abs(dx) >= 2 * Math.abs(dy);
}

// ── FINISH_SPEC BJ1: ONE scroll per game — TODAY first, ALL-TIME beneath ─────
// (founder 10-03, replacing BG's Today | All-time toggle: "each game should populate
// their daily stats first and all time beneath, no more toggle"). The only
// selection is the GAME (null = Overview, the Sweep, or one game from the picker);
// every view shows both sections, Today then All-time. Re-tapping the picked game
// returns to Overview. URL: ?view=<game key | sweep> (the legacy ?scope= is ignored).

export interface StatsState { game: string | null }
/** What a view's two sections show, top to bottom. */
export type StatsSection = 'today-overview' | 'today-game' | 'today-sweep' | 'all-overview' | 'all-game' | 'all-sweep';

export const DEFAULT_STATS: StatsState = { game: null };

/** The two sections of a view — Today first, All-time beneath. Always both. */
export function statsSections(s: StatsState): [StatsSection, StatsSection] {
  const kind = s.game === null ? 'overview' : s.game === VIEW_SWEEP ? 'sweep' : 'game';
  return [`today-${kind}`, `all-${kind}`] as [StatsSection, StatsSection];
}

/** A picker tap (a view key: a game db key or VIEW_SWEEP); tapping the picked game again → Overview. */
export function pickStatsGame(s: StatsState, game: string): StatsState {
  return { game: s.game === game ? null : game };
}

/** Jump straight to a game (a Today row, a link) — never toggles off. */
export function openStatsGame(s: StatsState, game: string | null): StatsState {
  return s.game === game ? s : { game };
}

/** Read ?view= (a game key, sweep, or the legacy all-time / vs / today — all Overview now). */
export function parseStatsParams(view: string | null | undefined, isGameKey: (k: string) => boolean): StatsState {
  const v = parseViewParam(view, isGameKey);
  return { game: v === VIEW_TODAY || v === VIEW_ALL ? null : v };
}

/** The URL for a state (Overview is the bare page). */
export function statsUrl(s: StatsState): string {
  return s.game ? `/stats?${VIEW_PARAM}=${s.game}` : '/stats';
}

/** Swipe order for the GAME: Overview, the WORDOCIOUS row (Sweep last), the PUZZLES row. */
export function gameSwipeOrder(rows: PickerRows): Array<string | null> {
  return [null, ...rows.wordocious.map((t) => viewForPickerKey(t.key)), ...rows.puzzles.map((t) => viewForPickerKey(t.key))];
}

/** The game one swipe away (dir +1 next, −1 previous); undefined at either end. */
export function gameSwipeNeighbor(order: Array<string | null>, game: string | null, dir: 1 | -1): string | null | undefined {
  const i = order.indexOf(game);
  if (i < 0) return undefined;
  const j = i + dir;
  return j >= 0 && j < order.length ? order[j] : undefined;
}
