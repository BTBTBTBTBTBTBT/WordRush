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
