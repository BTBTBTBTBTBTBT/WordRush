/**
 * Bot engine — turns (seed, mode, difficulty) into a believable opponent
 * "trajectory": a schedule of progress updates (tile colors + board solves)
 * and a revealed guess log, ending in a solve or a fail. It runs entirely on
 * the client and never contacts the server; `LocalBotMatchService` replays the
 * plan on timers, driving the exact same `opponent_progress` / `match_ended`
 * contract a real socket opponent would.
 *
 * For standard word modes it uses a light solver over the real dictionary so
 * the words revealed at match end are legit and their tile colors match. For
 * ProperNoundle (proper-noun answers not in the dictionary) it fabricates a
 * plausible converging path — the opponent only sees colors live, and the
 * final reveal is the answer itself.
 */
import {
  GameMode,
  createInitialState,
  evaluateGuess,
  getAllowedWords,
  generateSolutionsFromSeed,
  GAUNTLET_STAGES,
  GAUNTLET_TOTAL_SOLUTIONS,
  TileState,
} from '@wordle-duel/core';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
import { getPuzzleForSeed } from '@/components/propernoundle/puzzle-service';
import { normalizeString } from '@/components/propernoundle/game-logic';
import type { BotDifficulty, BotTier } from './bot-personas';

/** Boards per mode (mirrors apps/server MODE_BOARD_COUNT). */
const MODE_BOARD_COUNT: Partial<Record<GameMode, number>> = {
  [GameMode.DUEL]: 1,
  [GameMode.DUEL_6]: 1,
  [GameMode.DUEL_7]: 1,
  [GameMode.PROPERNOUNDLE]: 1,
  [GameMode.QUORDLE]: 4,
  [GameMode.SEQUENCE]: 4,
  [GameMode.RESCUE]: 4,
  [GameMode.OCTORDLE]: 8,
  [GameMode.MULTI_DUEL]: 2,
  [GameMode.GAUNTLET]: GAUNTLET_TOTAL_SOLUTIONS, // 21 boards across 5 stages
};

export function boardCountForMode(mode: GameMode): number {
  return MODE_BOARD_COUNT[mode] ?? 1;
}

/** Real per-mode guess cap (mirrors packages/core createInitialState). */
const MODE_MAX_GUESSES: Partial<Record<GameMode, number>> = {
  [GameMode.DUEL]: 6,
  [GameMode.DUEL_6]: 7,
  [GameMode.DUEL_7]: 8,
  [GameMode.PROPERNOUNDLE]: 6,
  [GameMode.QUORDLE]: 9,
  [GameMode.OCTORDLE]: 13,
  [GameMode.SEQUENCE]: 10,
  [GameMode.RESCUE]: 6,
  [GameMode.MULTI_DUEL]: 6,
};

function maxGuessesForMode(mode: GameMode): number {
  return MODE_MAX_GUESSES[mode] ?? 6;
}

interface DiffParams {
  perGuessMinMs: number;
  perGuessMaxMs: number;
  minGuesses: number;
  maxGuesses: number;
  failChance: number;
}

const PARAMS: Record<BotTier, DiffParams> = {
  easy: { perGuessMinMs: 12000, perGuessMaxMs: 20000, minGuesses: 5, maxGuesses: 6, failChance: 0.3 },
  medium: { perGuessMinMs: 7000, perGuessMaxMs: 12000, minGuesses: 4, maxGuesses: 5, failChance: 0.1 },
  hard: { perGuessMinMs: 3000, perGuessMaxMs: 6000, minGuesses: 2, maxGuesses: 4, failChance: 0.02 },
};

/** Adaptive params derived from the player's recent CPU form (win rate + avg guesses). */
export interface AdaptiveHint {
  /** Player's recent CPU win rate 0..1 (higher → make the bot tougher). */
  winRate: number;
  /** Player's typical winning guess count for this mode (undefined if unknown). */
  avgGuesses?: number;
}

function resolveParams(difficulty: BotDifficulty, hint?: AdaptiveHint): DiffParams {
  if (difficulty !== 'adaptive') return PARAMS[difficulty];
  // Aim to shadow the player: the more they win, the sharper the bot.
  const wr = hint?.winRate ?? 0.5;
  const target = hint?.avgGuesses ?? 4;
  const minGuesses = Math.max(2, Math.round(target - 1));
  const maxGuesses = Math.max(minGuesses + 1, Math.round(target + 1));
  // Faster cadence when the player is winning a lot; slower when they struggle.
  const speed = 1 - Math.min(1, Math.max(0, wr)); // 0 (crushing) .. 1 (losing)
  const perGuessMinMs = 4000 + speed * 8000;
  const perGuessMaxMs = perGuessMinMs + 5000;
  const failChance = 0.05 + speed * 0.2;
  return { perGuessMinMs, perGuessMaxMs, minGuesses, maxGuesses, failChance };
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** How many positions match between two equal-length uppercase words. */
function greens(word: string, solution: string): number {
  let n = 0;
  for (let i = 0; i < solution.length; i++) if (word[i] === solution[i]) n++;
  return n;
}

/**
 * Build a believable increasing-greens word path toward `solution` using real
 * dictionary words. `steps` words long; the final word equals the solution
 * when `willSolve`, otherwise a near-miss (len-1 greens) so it looks like the
 * bot ran out of guesses one letter short.
 */
function realWordPath(solution: string, steps: number, willSolve: boolean, exclude?: string[]): string[] {
  const len = solution.length;
  // `exclude` (restat B3): shared-guess fillers must never equal ANOTHER
  // board's solution — post-filtering shrank the sequence below the intended
  // budget, making the bot slightly stronger than its difficulty tuning.
  const ex = new Set((exclude ?? []).map((w) => w.toUpperCase()));
  const pool = getAllowedWords()
    .map((w) => w.toUpperCase())
    .filter((w) => w.length === len && w !== solution && !ex.has(w));
  if (pool.length === 0) return fabricatedPath(solution, steps, willSolve);

  const path: string[] = [];
  const used = new Set<string>();
  const solvingIndex = willSolve ? steps - 1 : -1;
  for (let i = 0; i < steps; i++) {
    if (i === solvingIndex) {
      path.push(solution);
      break;
    }
    // Ramp target greens from ~0 up toward len-1 across the earlier rows.
    const frac = steps > 1 ? i / (steps - 1) : 0;
    const targetGreens = Math.min(len - 1, Math.round(frac * (len - 1)));
    let best: string | null = null;
    let bestDelta = Infinity;
    // Sample a slice of the pool for a word closest to the target green count.
    for (let t = 0; t < 60; t++) {
      const cand = pool[randInt(0, pool.length - 1)];
      if (used.has(cand)) continue;
      const delta = Math.abs(greens(cand, solution) - targetGreens);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = cand;
        if (delta === 0) break;
      }
    }
    const word = best ?? pick(pool);
    used.add(word);
    path.push(word);
  }
  return path;
}

/**
 * Fabricated converging path for ProperNoundle / any mode without a matching
 * dictionary. Each row reveals the solution with its first `k` letters kept and
 * the rest scrambled, so greens ramp up; the final row is the exact answer.
 */
function fabricatedPath(solution: string, steps: number, willSolve: boolean): string[] {
  const bare = solution.replace(/\s+/g, '');
  const len = bare.length;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const path: string[] = [];
  const solvingIndex = willSolve ? steps - 1 : -1;
  for (let i = 0; i < steps; i++) {
    if (i === solvingIndex) {
      path.push(bare);
      break;
    }
    const frac = steps > 1 ? i / (steps - 1) : 0;
    const keep = Math.min(len - 1, Math.round(frac * (len - 1)));
    let w = '';
    for (let p = 0; p < len; p++) {
      w += p < keep ? bare[p] : letters[Math.floor(Math.random() * 26)];
    }
    path.push(w);
  }
  return path;
}

export interface BotProgressEvent {
  /** Offset in ms from match start when this event fires. */
  atMs: number;
  /** When true this is just a "typing" ping (no progress payload). */
  typing?: boolean;
  progress?: {
    attempts: number;
    solved: boolean;
    boardsSolved: number;
    totalBoards: number;
    latestGuess?: { boardIndex: number; tiles: string[] };
    latestGuesses?: { boardIndex: number; tiles: string[] }[];
  };
}

export interface BotPlan {
  totalBoards: number;
  solved: boolean;
  /** Boards the bot ends up solving (== totalBoards when solved). */
  boardsSolved: number;
  finishAtMs: number;
  totalGuesses: number;
  /** Ordered progress/typing events to replay on timers. */
  events: BotProgressEvent[];
  /** Gauntlet: when the opponent clears each stage (drives the 5-node stepper). */
  stageEvents: { atMs: number; stageIndex: number }[];
  /** Opponent's ordered guess words, revealed only at match end. */
  guessLog: { boardIndex: number; guess: string }[];
  solutions: string[];
}

export interface BuildOpts {
  targetGuesses?: number;
  /** Pin the bot's total solve time (ms) — used by ghost races to replay a pace. */
  targetSolveMs?: number;
  forceSolve?: boolean;
  adaptive?: AdaptiveHint;
}

/** Tiles (color-only string states) for a guess against a solution. */
function tilesFor(solution: string, guess: string): string[] {
  return evaluateGuess(solution, guess).tiles.map((t) => t.state as TileState);
}

/**
 * Build a full bot plan for a match. The bot plays by the REAL rules:
 * shared-guess modes (QuadWord/OctoWord/Deliverance, and multi-board Gauntlet
 * stages) get ONE submission sequence capped at the mode's max — each
 * submission applies to every unsolved board. Succession is sequential within
 * one shared budget. The old per-board-independent model reported impossible
 * guess counts (43 in a 13-max OctoWord), which skewed scores and produced
 * garbage when the log was replayed on the recap.
 */
export function buildBotPlan(
  seed: string,
  mode: GameMode,
  difficulty: BotDifficulty,
  opts: BuildOpts = {},
): BotPlan {
  ensureDictionaryInitialized();
  const state = createInitialState(seed, mode);
  const totalBoards = boardCountForMode(mode);
  const params = resolveParams(difficulty, opts.adaptive);
  // Gauntlet's createInitialState boards hold only the CURRENT stage; the full
  // 21-board run comes from the seed directly (reducer parity).
  let solutions: string[];
  if (mode === GameMode.GAUNTLET) {
    solutions = generateSolutionsFromSeed(seed, GAUNTLET_TOTAL_SOLUTIONS).map((s) => s.toUpperCase());
  } else if (mode === GameMode.PROPERNOUNDLE) {
    // ProperNoundle's answer comes from its OWN puzzle set, not the shared
    // engine (which seeds PN with a dictionary word) — the bot was literally
    // playing a different answer than the player, so the result screen showed
    // the wrong solution and marked the real winner "Not solved" (iOS build-89
    // parity).
    const pn = getPuzzleForSeed(seed);
    solutions = [pn ? normalizeString(pn.answer).toUpperCase() : (state.boards[0]?.solution.toUpperCase() ?? '')];
  } else {
    solutions = state.boards.map((b) => b.solution.toUpperCase());
  }

  // Decide the overall outcome up front.
  const willSolveAll = opts.forceSolve ? true : Math.random() > params.failChance;

  const events: BotProgressEvent[] = [];
  const stageEvents: { atMs: number; stageIndex: number }[] = [];
  const guessLog: { boardIndex: number; guess: string }[] = [];
  let cumulativeAttempts = 0;
  let boardsSolved = 0;
  let lastAtMs = 0;

  type LatestGuess = { boardIndex: number; tiles: string[] };

  const emit = (word: string, entries: LatestGuess[], logBoard: number, single?: LatestGuess) => {
    lastAtMs += rand(params.perGuessMinMs, params.perGuessMaxMs);
    cumulativeAttempts += 1;
    // Typing ping ~1.1s before the guess lands.
    events.push({ atMs: Math.max(0, lastAtMs - 1100), typing: true });
    events.push({
      atMs: lastAtMs,
      progress: {
        attempts: cumulativeAttempts,
        solved: boardsSolved >= totalBoards,
        boardsSolved,
        totalBoards,
        latestGuess: single,
        latestGuesses: single ? undefined : entries,
      },
    });
    guessLog.push({ boardIndex: logBoard, guess: word });
  };

  /** Shared-guess group (applyToAll): info-gathering fillers, then the
   *  solutions one per submission. `budget` = the real max guesses. */
  const sharedSegment = (offset: number, sols: string[], budget: number, solveAll: boolean, stageIndex?: number) => {
    const n = sols.length;
    const solveCount = solveAll ? n : Math.max(0, n - 1);
    let fillerCount: number;
    if (opts.targetGuesses != null) {
      fillerCount = Math.max(0, Math.min(budget, opts.targetGuesses) - solveCount);
    } else if (!solveAll) {
      fillerCount = Math.max(0, budget - solveCount); // failed run burns the budget
    } else {
      fillerCount = Math.max(0, Math.min(
        budget - solveCount,
        randInt(Math.max(0, params.minGuesses - 2), Math.max(1, params.maxGuesses - 2)),
      ));
    }
    // Fillers must not accidentally solve a board they weren't credited for.
    const fillers = fillerCount > 0
      ? realWordPath(sols[n - 1], fillerCount, false, sols)
      : [];
    const solvedLocal = new Set<number>();
    const solveOrder = shuffle([...Array(n).keys()]).slice(0, solveCount);
    const sequence: { word: string; solves: number | null }[] = [
      ...fillers.map((w) => ({ word: w, solves: null as number | null })),
      ...solveOrder.map((i) => ({ word: sols[i], solves: i as number | null })),
    ];
    for (const { word, solves } of sequence) {
      if (solves != null) { solvedLocal.add(solves); boardsSolved += 1; }
      const entries: LatestGuess[] = [];
      for (let li = 0; li < n; li++) {
        if (!solvedLocal.has(li) || solves === li) {
          entries.push({ boardIndex: offset + li, tiles: tilesFor(sols[li], word) });
        }
      }
      emit(word, entries, offset + (solves ?? 0));
    }
    if (stageIndex != null && solveAll) stageEvents.push({ atMs: lastAtMs, stageIndex });
  };

  /** Sequential group (Succession / sequential Gauntlet stages): boards in
   *  order, one at a time, sharing one guess budget. */
  const sequentialSegment = (offset: number, sols: string[], budget: number, solveAll: boolean, stageIndex?: number) => {
    let remaining = budget;
    for (let li = 0; li < sols.length; li++) {
      if (remaining <= 0) return;
      const sol = sols[li];
      const isLast = li === sols.length - 1;
      const fails = !solveAll && isLast;
      const reserve = sols.length - 1 - li; // ≥1 guess for each later board
      const steps = fails
        ? remaining
        : Math.max(1, Math.min(remaining - reserve, randInt(1, Math.max(1, Math.min(3, params.maxGuesses - 2)))));
      const path = realWordPath(sol, steps, !fails);
      for (let i = 0; i < path.length; i++) {
        const solving = !fails && i === path.length - 1;
        if (solving) boardsSolved += 1;
        emit(path[i], [], offset + li, { boardIndex: offset + li, tiles: tilesFor(sol, path[i]) });
      }
      remaining -= path.length;
      if (fails) return;
    }
    if (stageIndex != null && solveAll) stageEvents.push({ atMs: lastAtMs, stageIndex });
  };

  switch (mode) {
    case GameMode.QUORDLE:
    case GameMode.OCTORDLE:
    case GameMode.RESCUE:
    case GameMode.MULTI_DUEL:
      sharedSegment(0, solutions, maxGuessesForMode(mode), willSolveAll);
      break;
    case GameMode.SEQUENCE:
      sequentialSegment(0, solutions, maxGuessesForMode(mode), willSolveAll);
      break;
    case GameMode.GAUNTLET: {
      let offset = 0;
      for (let si = 0; si < GAUNTLET_STAGES.length; si++) {
        const stage = GAUNTLET_STAGES[si];
        const sols = solutions.slice(offset, Math.min(solutions.length, offset + stage.boardCount));
        if (sols.length === 0) break;
        const lastStage = si === GAUNTLET_STAGES.length - 1;
        const stageSolves = willSolveAll || !lastStage;
        if (stage.boardCount === 1 || stage.sequential) {
          sequentialSegment(offset, sols, stage.maxGuesses, stageSolves, si);
        } else {
          sharedSegment(offset, sols, stage.maxGuesses, stageSolves, si);
        }
        offset += stage.boardCount;
        if (!stageSolves) break; // a failed stage ends the run
      }
      break;
    }
    default: {
      // Single-board modes (Classic/Six/Seven/ProperNoundle).
      const solution = solutions[0] ?? '';
      const cap = maxGuessesForMode(mode);
      const steps = Math.min(cap, opts.targetGuesses ?? randInt(params.minGuesses, params.maxGuesses));
      const path = mode === GameMode.PROPERNOUNDLE
        ? fabricatedPath(solution, willSolveAll ? steps : cap, willSolveAll)
        : realWordPath(solution, willSolveAll ? steps : cap, willSolveAll);
      for (let i = 0; i < path.length; i++) {
        if (willSolveAll && i === path.length - 1) boardsSolved += 1;
        emit(path[i], [], 0, { boardIndex: 0, tiles: tilesFor(solution, path[i]) });
      }
    }
  }

  // Ghost pacing: rescale the whole timeline to hit a target total solve time.
  if (opts.targetSolveMs && lastAtMs > 0) {
    const scale = opts.targetSolveMs / lastAtMs;
    for (const ev of events) ev.atMs = Math.max(0, ev.atMs * scale);
    for (const ev of stageEvents) ev.atMs = Math.max(0, ev.atMs * scale);
    lastAtMs = opts.targetSolveMs;
  }

  events.sort((a, b) => a.atMs - b.atMs);
  return {
    totalBoards,
    solved: boardsSolved >= totalBoards,
    boardsSolved,
    finishAtMs: lastAtMs,
    totalGuesses: cumulativeAttempts,
    events,
    stageEvents,
    guessLog,
    solutions,
  };
}
