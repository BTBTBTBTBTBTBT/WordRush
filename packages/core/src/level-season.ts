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

export type Season = 'halloween';

/**
 * The cast's seasonal skin for a LOCAL calendar date (YYYY-MM-DD or a Date
 * read in local time): Halloween runs Oct 24 – Nov 1 inclusive, any year.
 * Null otherwise.
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
  if ((m === 10 && d >= 24) || (m === 11 && d <= 1)) return 'halloween';
  return null;
}
