/**
 * §260: what a human can actually do. Scores are client-reported, so the
 * floor lives in three places: here (web write path + integrity cron), the
 * iOS/Android write paths (Plausibility.swift / Plausibility.kt — same
 * numbers), and the daily_results trigger in
 * supabase/manual-migrations/20260911000001_plausibility_guards.sql.
 *
 * A completed puzzle needs at least one guess, and every guess after the
 * first costs at least a second — typing a word and pressing Enter in under
 * a second, repeatedly, is not play. Ceilings match the admin Ops watchlist.
 */
export const MIN_SECONDS_PER_EXTRA_GUESS = 1;
export const MAX_TIME_SECONDS = 172_800; // two days
export const MAX_GUESSES = 200;
export const MAX_BOARDS = 21; // Gauntlet: 1 + 4 + 8 + 4 + 4 across its five stages

export function isPlausibleDailyResult(completed: boolean, guessCount: number, timeSeconds: number, totalBoards: number): boolean {
  if (guessCount < 0 || timeSeconds < 0) return false;
  if (guessCount >= MAX_GUESSES || timeSeconds >= MAX_TIME_SECONDS || totalBoards > MAX_BOARDS || totalBoards < 1) return false;
  if (!completed) return true;
  if (guessCount < 1) return false;
  return timeSeconds >= (guessCount - 1) * MIN_SECONDS_PER_EXTRA_GUESS;
}
