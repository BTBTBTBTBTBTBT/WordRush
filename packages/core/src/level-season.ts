// Level tiers (FINISH_SPEC V) and seasonal cast skins (FINISH_SPEC X). Shared
// by web, iOS and Android; pinned by level-season-fixtures.json.

export type LevelTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

/**
 * The level tier (the thresholds web Stats already used): Bronze 1–10 ·
 * Silver 11–25 · Gold 26–50 · Platinum 51–99 · Diamond 100+. Levels below 1
 * count as Bronze.
 */
export function levelTier(level: number): LevelTier {
  if (level >= 100) return 'diamond';
  if (level >= 51) return 'platinum';
  if (level >= 26) return 'gold';
  if (level >= 11) return 'silver';
  return 'bronze';
}

/** The tier's display name ("Gold"). */
export function levelTierLabel(tier: LevelTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/**
 * The season registry's date windows (docs/design/brand/seasons/README.md "How to add a
 * season"): one row per season, LOCAL calendar dates, inclusive, every year. A window may
 * wrap the new year (start after end). The art slots + palette per season live in
 * season-registry.json (shared by web, iOS and Android). The Swift (LevelSeason.swift) and
 * Kotlin (Season.kt) ports carry the same rows; level-season-fixtures.json pins them.
 */
export const SEASON_WINDOWS = [
  { id: 'halloween', start: [10, 17], end: [11, 1] },
] as const satisfies readonly { id: string; start: readonly [number, number]; end: readonly [number, number] }[];

export type Season = (typeof SEASON_WINDOWS)[number]['id'];

/** Every registry season id, in calendar order. */
export const SEASON_IDS: readonly Season[] = SEASON_WINDOWS.map((w) => w.id);

/** Is month/day inside [start, end] (inclusive; wraps past Dec 31 when start > end)? */
function inWindow(m: number, d: number, start: readonly [number, number], end: readonly [number, number]): boolean {
  const k = m * 100 + d;
  const a = start[0] * 100 + start[1];
  const b = end[0] * 100 + end[1];
  return a <= b ? k >= a && k <= b : k >= a || k <= b;
}

/**
 * The season for a LOCAL calendar date (YYYY-MM-DD or a Date read in local
 * time): Halloween runs Oct 17 – Nov 1 inclusive, any year. Null otherwise.
 */
export function currentSeason(date: string | Date): Season | null {
  let m: number;
  let d: number;
  if (typeof date === 'string') {
    const parts = date.split('-').map(Number);
    m = parts[1];
    d = parts[2];
  } else {
    m = date.getMonth() + 1;
    d = date.getDate();
  }
  if (!Number.isFinite(m) || !Number.isFinite(d)) return null;
  for (const w of SEASON_WINDOWS) if (inWindow(m, d, w.start, w.end)) return w.id;
  return null;
}
