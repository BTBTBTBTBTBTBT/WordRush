// ============================================================
// More Games sheet — pure helpers (More Games §18, Stage 5)
// ============================================================
// The sheet's sections and the home tile's subtitle come from the catalog
// alone: which modes are enabled, which category each belongs to, and which
// of them the player has already recorded today. Nothing here is a literal
// count — add a game to modes.json and every number below follows.
// Mirrored by the Swift/Kotlin sheets (MoreGamesSheet.swift / .kt).

import { MORE_CATEGORIES, MORE_GAME_MODES, type ModeMeta, type MoreCategory } from './modes.generated';

export interface MoreSection {
  key: string;
  title: string;
  modes: ModeMeta[];
}

/**
 * The sheet's sections in catalog order, non-empty ones only. A mode whose
 * category is not in the catalog's list (or is null) falls into a trailing
 * "Other" section rather than vanishing.
 */
export function moreSections(modes: ModeMeta[] = MORE_GAME_MODES, categories: MoreCategory[] = MORE_CATEGORIES): MoreSection[] {
  const sections: MoreSection[] = categories.map((c) => ({ key: c.key, title: c.title, modes: [] }));
  const known = new Set(categories.map((c) => c.key));
  const other: MoreSection = { key: 'other', title: 'Other', modes: [] };
  for (const m of modes) {
    if (m.category && known.has(m.category)) sections.find((s) => s.key === m.category)!.modes.push(m);
    else other.modes.push(m);
  }
  if (other.modes.length) sections.push(other);
  return sections.filter((s) => s.modes.length > 0);
}

/** The daily-recordable More Games titles — what "N of M played" counts over. */
export function moreDailyModes(modes: ModeMeta[] = MORE_GAME_MODES): ModeMeta[] {
  return modes.filter((m) => m.dailyEligible && m.dbKey);
}

/** How many of the More Games dailies are on the books today. */
export function morePlayedCount(todayKeys: Iterable<string>, modes: ModeMeta[] = MORE_GAME_MODES): { played: number; total: number } {
  const daily = moreDailyModes(modes);
  const keys = new Set(todayKeys);
  return { played: daily.filter((m) => keys.has(m.dbKey as string)).length, total: daily.length };
}

/** The More Games tile subtitle in Daily mode: "2 of 10 played". */
export function morePlayedText(played: number, total: number): string {
  return `${played} of ${total} played`;
}

/**
 * Where "Home" goes from inside a More Games title: the home page with the
 * sheet already open (founder + JP, 2026-09-26 — "a way to go right back to
 * the more games menu"). The sheet reads `?more=1` on mount.
 */
export const MORE_HOME_HREF = '/?more=1';

export type MoreSweepTier = 'sweep' | 'flawless';

/**
 * More Games Sweep / Flawless (founder, 2026-09-26): a purely visual tier
 * derived from today's completions — every More Games daily played = 'sweep',
 * every one of them won = 'flawless', otherwise null. It never touches the
 * Daily Sweep: no bonus row, no XP, no leaderboard, no sweep dots. The band
 * and the sheet header change color; that is all.
 */
export function moreSweepTier(
  today: ReadonlyMap<string, { won: boolean }>,
  modes: ModeMeta[] = MORE_GAME_MODES,
): MoreSweepTier | null {
  const daily = moreDailyModes(modes);
  if (daily.length === 0) return null;
  const rows = daily.map((m) => today.get(m.dbKey as string));
  if (rows.some((r) => !r)) return null;
  return rows.every((r) => r!.won) ? 'flawless' : 'sweep';
}

export interface MoreTotals { completed: number; won: number; total: number; totalTimeSeconds: number; totalScore: number }

/** Sums over the More Games dailies only — the celebration and share card read these. */
export function computeMoreTotals(
  today: ReadonlyMap<string, { won: boolean; timeSeconds: number; score: number }>,
  modes: ModeMeta[] = MORE_GAME_MODES,
): MoreTotals {
  const daily = moreDailyModes(modes);
  let completed = 0, won = 0, totalTimeSeconds = 0, totalScore = 0;
  for (const m of daily) {
    const c = today.get(m.dbKey as string);
    if (!c) continue;
    completed += 1; if (c.won) won += 1; totalTimeSeconds += c.timeSeconds; totalScore += c.score;
  }
  return { completed, won, total: daily.length, totalTimeSeconds, totalScore };
}

/** The band / sheet header wording for a tier. Never the Daily Sweep strings. */
export const MORE_SWEEP_COPY: Record<MoreSweepTier, { title: string; short: string }> = {
  sweep: { title: 'MORE GAMES SWEEP!', short: 'More Games Sweep' },
  flawless: { title: 'FLAWLESS MORE GAMES!', short: 'Flawless More Games' },
};
