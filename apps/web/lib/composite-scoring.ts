// ============================================================
// Composite Score Calculation — dependency-free
// ============================================================
// Pure scoring math, intentionally free of any runtime imports so the
// cross-platform fixture guard (scripts/check-composite-scoring.mjs) can run it
// in isolation under plain Node, and so it stays the single source of truth that
// the iOS (DailyScoring.swift) and Android (DailyScoring.kt) ports mirror 1:1.
// If you change a number here, regenerate the shared fixtures:
//   node scripts/gen-composite-scoring-fixtures.mjs
//
// FORMULA V2 (guess-first) — days >= SCORING_CUTOVER_DATE.
// Rule: "Fewer guesses always wins. Speed breaks ties."
//   • Guess bonus applies to EVERY mode: (maxGuesses - guessCount) × guessWeight.
//   • Speed bonus is a FRACTION of one guess-step, capped at 80% of guessWeight:
//     (secondsRemaining / timeCap) × 0.8 × guessWeight — so no time gap can ever
//     overcome even a single saved guess, in any mode.
//   • Hint penalties softened (a hint already consumes a board row, which now
//     costs a full guess-step of bonus — the flat penalty on top shrinks).
// V1 (legacy) is kept verbatim and selected by dateKey so every pre-cutover
// day's leaderboard + breakdown card recompute exactly what was recorded.

/** Days (YYYY-MM-DD, local) before this date score with the V1 formula.
 *  The gate keys off the PUZZLE's day (from its daily seed), never wall
 *  clock — same pattern as SOLUTIONS_CUTOVER_DATE. */
export const SCORING_CUTOVER_DATE = '2026-07-14';

interface ScoreConfig {
  maxGuesses: number;
  guessWeight: number;
  timeCap: number;
  totalBoards: number;
  /**
   * Points deducted per hint the player used. Only set for modes that
   * expose hint buttons (Six, Seven, ProperNoundle); undefined elsewhere
   * means hints don't apply and the breakdown UI omits the row.
   */
  hintCost?: number;
}

/** V2 config (current). guessWeight = V1 × 3; speed max = 0.8 × guessWeight. */
export const MODE_SCORE_CONFIG: Record<string, ScoreConfig> = {
  DUEL:          { maxGuesses: 6,  guessWeight: 300, timeCap: 300,  totalBoards: 1 },
  QUORDLE:       { maxGuesses: 9,  guessWeight: 150, timeCap: 600,  totalBoards: 4 },
  OCTORDLE:      { maxGuesses: 13, guessWeight: 90,  timeCap: 900,  totalBoards: 8 },
  SEQUENCE:      { maxGuesses: 10, guessWeight: 180, timeCap: 480,  totalBoards: 4 },
  RESCUE:        { maxGuesses: 6,  guessWeight: 240, timeCap: 480,  totalBoards: 4 },
  GAUNTLET:      { maxGuesses: 44, guessWeight: 60,  timeCap: 1800, totalBoards: 21 },
  PROPERNOUNDLE: { maxGuesses: 6,  guessWeight: 300, timeCap: 300,  totalBoards: 1, hintCost: 60 },
  DUEL_6:        { maxGuesses: 7,  guessWeight: 270, timeCap: 360,  totalBoards: 1, hintCost: 75 },
  DUEL_7:        { maxGuesses: 8,  guessWeight: 240, timeCap: 420,  totalBoards: 1, hintCost: 75 },
};

/** V1 config (frozen forever — pre-cutover replays/breakdowns only). */
export const MODE_SCORE_CONFIG_V1: Record<string, ScoreConfig> = {
  DUEL:          { maxGuesses: 6,  guessWeight: 100, timeCap: 300,  totalBoards: 1 },
  QUORDLE:       { maxGuesses: 9,  guessWeight: 50,  timeCap: 600,  totalBoards: 4 },
  OCTORDLE:      { maxGuesses: 13, guessWeight: 30,  timeCap: 900,  totalBoards: 8 },
  SEQUENCE:      { maxGuesses: 10, guessWeight: 60,  timeCap: 480,  totalBoards: 4 },
  RESCUE:        { maxGuesses: 6,  guessWeight: 80,  timeCap: 480,  totalBoards: 4 },
  GAUNTLET:      { maxGuesses: 44, guessWeight: 20,  timeCap: 1800, totalBoards: 21 },
  PROPERNOUNDLE: { maxGuesses: 6,  guessWeight: 100, timeCap: 300,  totalBoards: 1, hintCost: 120 },
  DUEL_6:        { maxGuesses: 7,  guessWeight: 90,  timeCap: 360,  totalBoards: 1, hintCost: 150 },
  DUEL_7:        { maxGuesses: 8,  guessWeight: 80,  timeCap: 420,  totalBoards: 1, hintCost: 150 },
};

/** Fraction of one guess-step the speed bonus can reach (V2). Strictly < 1 so
 *  time can NEVER outweigh a guess. */
const SPEED_FRACTION = 0.8;

// Loss-credit tuning. A loss never approaches a win (wins are 1,200+); these
// just let progress show through on the leaderboard among players who lost.
//   • GAUNTLET: a depth ladder for each fully-cleared stage + a small per-board
//     tiebreak for boards solved inside the failed stage.
//   • Single-board modes (totalBoards === 1): a near-miss credit per green
//     (correct-position) letter in the player's best guess.
// Other multi-board losses keep the existing (boardsSolved / totalBoards) × 200.
// Identical in V1 and V2 (losses have no guess/time bonus in either).
const GAUNTLET_STAGE_LADDER = [0, 25, 55, 95, 150]; // index = stages fully cleared (0–4)
const GAUNTLET_STAGE_BOARDS = [1, 4, 4, 4, 8];      // boards per Gauntlet stage
const SINGLE_BOARD_GREEN_VALUE = 12;                // points per green letter on a single-board loss

export interface ScoreBreakdown {
  basePoints: number;
  guessBonus: number;
  timeBonus: number;
  completionBonus: number;
  hintPenalty: number;
  /** Mode supports hints (so the breakdown row is meaningful). */
  hasHints: boolean;
  /** Whether the guess-bonus row applies (V2: all modes; V1: hint modes only). */
  guessBonusApplies: boolean;
  /** Max speed bonus (V2: 0.8 × guessWeight; V1: timeCap) — for the UI detail. */
  speedMax: number;
  total: number;
  /** Echoed back from config so the UI can render "(maxGuesses - X)". */
  maxGuesses: number;
  timeCap: number;
  guessWeight: number;
  hintCost: number;
}

/**
 * Compute the full per-component score breakdown so the post-game UI
 * can render each line item. Keeping this here (not duplicated in the
 * UI layer) means the leaderboard and the breakdown card can never
 * drift out of sync.
 *
 * `dateKey` (YYYY-MM-DD) is the PUZZLE's day. Days before
 * SCORING_CUTOVER_DATE use the frozen V1 formula so historical
 * leaderboards/breakdowns keep matching their recorded scores. Omitted
 * (practice, VS recap, non-dated callers) → current V2 formula.
 */
export function computeScoreBreakdown(
  gameMode: string,
  completed: boolean,
  guessCount: number,
  timeSeconds: number,
  boardsSolved: number,
  totalBoards: number,
  hintsUsed: number = 0,
  // Loss-only progress inputs (optional — when omitted the loss falls back to
  // the legacy (boardsSolved / totalBoards) × 200 so VS / replay / legacy
  // callers never regress).
  stagesCompleted?: number,    // GAUNTLET: count of fully-cleared stages
  bestCorrectLetters?: number, // single-board: max green letters in any guess
  dateKey?: string,            // puzzle day — pre-cutover days score with V1
): ScoreBreakdown {
  const v2 = !dateKey || dateKey >= SCORING_CUTOVER_DATE;
  const config = (v2 ? MODE_SCORE_CONFIG : MODE_SCORE_CONFIG_V1)[gameMode];
  if (!config) {
    return {
      basePoints: 0, guessBonus: 0, timeBonus: 0, completionBonus: 0,
      hintPenalty: 0, hasHints: false, guessBonusApplies: false, speedMax: 0, total: 0,
      maxGuesses: 0, timeCap: 0, guessWeight: 0, hintCost: 0,
    };
  }
  const hasHints = config.hintCost !== undefined;
  const basePoints = completed ? 1000 : 0;
  // V2: guess bonus applies to EVERY mode — guesses dominate the ranking.
  // V1 (legacy): only hint-bearing modes (Six / Seven / ProperNoundle) had it.
  const guessBonusApplies = v2 || hasHints;
  const guessBonus = completed && guessBonusApplies
    ? Math.max(0, config.maxGuesses - guessCount) * config.guessWeight
    : 0;
  // V2: speed bonus = fraction of remaining time × 80% of ONE guess-step
  // (2-decimal precision so second-level differences still rank). V1: one
  // point per second under the cap.
  const speedMax = v2 ? SPEED_FRACTION * config.guessWeight : config.timeCap;
  const timeBonus = completed
    ? (v2
      ? Math.round((Math.max(0, config.timeCap - timeSeconds) / config.timeCap) * speedMax * 100) / 100
      : Math.max(0, config.timeCap - timeSeconds))
    : 0;
  // Completion / progress bonus. Wins (and all non-Gauntlet multi-board losses)
  // use the proportional boards bonus. Losses in Gauntlet and single-board modes
  // use the progress-aware credit.
  let completionBonus: number;
  if (completed) {
    completionBonus = (boardsSolved / Math.max(1, totalBoards)) * 200;
  } else if (gameMode === 'GAUNTLET') {
    const sc = Math.max(0, Math.min(GAUNTLET_STAGE_LADDER.length - 1, stagesCompleted ?? 0));
    const clearedBoards = GAUNTLET_STAGE_BOARDS.slice(0, sc).reduce((a, b) => a + b, 0);
    const failedStageBoards = Math.max(0, boardsSolved - clearedBoards);
    completionBonus = GAUNTLET_STAGE_LADDER[sc] + 6 * failedStageBoards;
  } else if (totalBoards === 1) {
    completionBonus = SINGLE_BOARD_GREEN_VALUE * Math.max(0, bestCorrectLetters ?? 0);
  } else {
    completionBonus = (boardsSolved / Math.max(1, totalBoards)) * 200;
  }
  const hintPenalty = hasHints ? hintsUsed * (config.hintCost ?? 0) : 0;
  // Floor at 0 so a winning game with a heavy hint stack can't dip
  // negative on the leaderboard — the leaderboard sort still places
  // it below faster/cleaner wins, but it never reads as a penalty
  // score the player would interpret as "I would have been better
  // off losing".
  const total =
    Math.round(Math.max(0, basePoints + guessBonus + timeBonus + completionBonus - hintPenalty) * 100) / 100;
  return {
    basePoints, guessBonus, timeBonus, completionBonus,
    hintPenalty, hasHints, guessBonusApplies, speedMax, total,
    maxGuesses: config.maxGuesses,
    timeCap: config.timeCap,
    guessWeight: config.guessWeight,
    hintCost: config.hintCost ?? 0,
  };
}

/** Modes that expose hint buttons — the only ones where hints_used is meaningful. */
export const HINT_BEARING_MODES = new Set(['DUEL_6', 'DUEL_7', 'PROPERNOUNDLE']);

/**
 * Short hint label for leaderboard/summary rows. Returns null for modes
 * without hints so callers can omit the segment entirely. A clean win
 * reads "No hints" to flag the full-credit (no penalty) result.
 */
export function formatHintsLabel(gameMode: string, hintsUsed: number): string | null {
  if (!HINT_BEARING_MODES.has(gameMode)) return null;
  if (hintsUsed <= 0) return 'No hints';
  return `${hintsUsed} hint${hintsUsed === 1 ? '' : 's'}`;
}

export function calculateCompositeScore(
  gameMode: string,
  completed: boolean,
  guessCount: number,
  timeSeconds: number,
  boardsSolved: number,
  totalBoards: number,
  hintsUsed: number = 0,
  stagesCompleted?: number,
  bestCorrectLetters?: number,
  dateKey?: string,
): number {
  return computeScoreBreakdown(
    gameMode, completed, guessCount, timeSeconds, boardsSolved, totalBoards, hintsUsed,
    stagesCompleted, bestCorrectLetters, dateKey,
  ).total;
}
