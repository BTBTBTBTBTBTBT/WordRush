// ============================================================
// Composite Score Calculation — dependency-free
// ============================================================
// Pure scoring math, intentionally free of any runtime imports so the
// cross-platform fixture guard (scripts/check-composite-scoring.mjs) can run it
// in isolation under plain Node, and so it stays the single source of truth that
// the iOS (DailyScoring.swift) and Android (DailyScoring.kt) ports mirror 1:1.
// If you change a number here, regenerate the shared fixtures:
//   node scripts/gen-composite-scoring-fixtures.mjs

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

export const MODE_SCORE_CONFIG: Record<string, ScoreConfig> = {
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

// Loss-credit tuning. A loss never approaches a win (wins are 1,200+); these
// just let progress show through on the leaderboard among players who lost.
//   • GAUNTLET: a depth ladder for each fully-cleared stage + a small per-board
//     tiebreak for boards solved inside the failed stage.
//   • Single-board modes (totalBoards === 1): a near-miss credit per green
//     (correct-position) letter in the player's best guess.
// Other multi-board losses keep the existing (boardsSolved / totalBoards) × 200.
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
): ScoreBreakdown {
  const config = MODE_SCORE_CONFIG[gameMode];
  if (!config) {
    return {
      basePoints: 0, guessBonus: 0, timeBonus: 0, completionBonus: 0,
      hintPenalty: 0, hasHints: false, total: 0,
      maxGuesses: 0, timeCap: 0, guessWeight: 0, hintCost: 0,
    };
  }
  const hasHints = config.hintCost !== undefined;
  const basePoints = completed ? 1000 : 0;
  // Guess bonus applies ONLY to hint-bearing modes (Six / Seven /
  // ProperNoundle). For every other mode it's omitted entirely — those
  // modes score on win + time (+ completion) alone.
  const guessBonus = completed && hasHints
    ? Math.max(0, config.maxGuesses - guessCount) * config.guessWeight
    : 0;
  const timeBonus = completed
    ? Math.max(0, config.timeCap - timeSeconds)
    : 0;
  // Completion / progress bonus. Wins (and all non-Gauntlet multi-board losses)
  // use the proportional boards bonus. Losses in Gauntlet and single-board modes
  // use the new progress-aware credit.
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
    hintPenalty, hasHints, total,
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
): number {
  return computeScoreBreakdown(
    gameMode, completed, guessCount, timeSeconds, boardsSolved, totalBoards, hintsUsed,
    stagesCompleted, bestCorrectLetters,
  ).total;
}
