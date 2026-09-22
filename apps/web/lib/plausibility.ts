/**
 * §260: what a human can actually do. Scores are client-reported, so the
 * floor lives in four places: here (web write path + integrity cron), the
 * iOS/Android write paths (Plausibility.swift / Plausibility.kt — same
 * numbers), and the daily_results trigger in
 * supabase/manual-migrations/20260911000001_plausibility_guards.sql (mode-aware
 * version: 20260922000001_plausibility_mode_floors.sql).
 *
 * A completed puzzle needs at least one guess, and every guess after the
 * first costs at least a second — typing a word and pressing Enter in under
 * a second, repeatedly, is not play. Ceilings match the admin Ops watchlist.
 *
 * More Games (§11) adds PER-MODE floors for a WIN, because the guess bonus has
 * no upper clamp: a forged guess_count below the perfect run over-scores. The
 * minimum winning guess_count is the perfect run (QuadWord needs 4 guesses for
 * 4 boards; Hubbub's rank position is at least 1), and each game has a minimum
 * plausible solve time. Modes missing from the tables keep the generic rule.
 */
export const MIN_SECONDS_PER_EXTRA_GUESS = 1;
export const MAX_TIME_SECONDS = 172_800; // two days
export const MAX_GUESSES = 200;
export const MAX_BOARDS = 21; // Gauntlet: 1 + 4 + 8 + 4 + 4 across its five stages

/** Lowest guess_count a completed result can carry, per mode (the perfect run). */
export const MIN_WIN_GUESSES: Record<string, number> = {
  DUEL: 1, DUEL_6: 1, DUEL_7: 1, PROPERNOUNDLE: 1,
  QUORDLE: 4, OCTORDLE: 8, SEQUENCE: 4, RESCUE: 4, GAUNTLET: 21,
  SUDOKU: 1, REGIONS: 1, LADDER: 1, CROSSWORD: 1, CRYPTOGRAM: 1, HUB: 1,
  SCRAMBLE: 5, GROUPS: 4, WORDSEARCH: 10,
};

/** Fewest seconds a human has ever needed to finish, per mode. Word modes stay on the generic rule. */
export const MIN_WIN_SECONDS: Record<string, number> = {
  SUDOKU: 60, REGIONS: 15, LADDER: 8, SCRAMBLE: 12, WORDSEARCH: 15,
  CROSSWORD: 25, CRYPTOGRAM: 15, GROUPS: 5, HUB: 8,
};

export function isPlausibleDailyResult(completed: boolean, guessCount: number, timeSeconds: number, totalBoards: number, gameMode?: string): boolean {
  if (guessCount < 0 || timeSeconds < 0) return false;
  if (guessCount >= MAX_GUESSES || timeSeconds >= MAX_TIME_SECONDS || totalBoards > MAX_BOARDS || totalBoards < 1) return false;
  if (!completed) return true;
  if (guessCount < 1) return false;
  if (timeSeconds < (guessCount - 1) * MIN_SECONDS_PER_EXTRA_GUESS) return false;
  if (gameMode) {
    const minGuesses = MIN_WIN_GUESSES[gameMode];
    if (minGuesses !== undefined && guessCount < minGuesses) return false;
    const minSeconds = MIN_WIN_SECONDS[gameMode];
    if (minSeconds !== undefined && timeSeconds < minSeconds) return false;
  }
  return true;
}
