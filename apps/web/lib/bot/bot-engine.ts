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
  TileState,
} from '@wordle-duel/core';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
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
};

export function boardCountForMode(mode: GameMode): number {
  return MODE_BOARD_COUNT[mode] ?? 1;
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
function realWordPath(solution: string, steps: number, willSolve: boolean): string[] {
  const len = solution.length;
  const pool = getAllowedWords()
    .map((w) => w.toUpperCase())
    .filter((w) => w.length === len && w !== solution);
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
  /** Opponent's ordered guess words, revealed only at match end. */
  guessLog: { boardIndex: number; guess: string }[];
  solutions: string[];
}

export interface BuildOpts {
  targetGuesses?: number;
  forceSolve?: boolean;
  adaptive?: AdaptiveHint;
}

/** Tiles (color-only string states) for a guess against a solution. */
function tilesFor(solution: string, guess: string): string[] {
  return evaluateGuess(solution, guess).tiles.map((t) => t.state as TileState);
}

/**
 * Build a full bot plan for a match. Currently produces a per-board schedule:
 * each board is solved over its own increasing-greens path, with board solves
 * spread across the run. Single-board modes reduce to one path.
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
  const solutions = state.boards.map((b) => b.solution.toUpperCase());

  // Decide overall outcome + per-board guess budgets.
  const willSolveAll = opts.forceSolve ? true : Math.random() > params.failChance;

  const events: BotProgressEvent[] = [];
  const guessLog: { boardIndex: number; guess: string }[] = [];
  let cumulativeAttempts = 0;
  let boardsSolved = 0;
  let lastAtMs = 0;

  for (let bi = 0; bi < totalBoards; bi++) {
    const solution = solutions[bi];
    const steps = opts.targetGuesses ?? randInt(params.minGuesses, params.maxGuesses);
    // The last board may be the one the bot fails (if it fails at all).
    const boardSolves = willSolveAll ? true : bi < totalBoards - 1;
    const path = mode === GameMode.PROPERNOUNDLE
      ? fabricatedPath(solution, steps, boardSolves)
      : realWordPath(solution, steps, boardSolves);

    let atMs = lastAtMs;
    for (let i = 0; i < path.length; i++) {
      const word = path[i];
      const dwell = rand(params.perGuessMinMs, params.perGuessMaxMs);
      atMs += dwell;
      cumulativeAttempts += 1;
      const isSolvingRow = boardSolves && i === path.length - 1;
      if (isSolvingRow) boardsSolved += 1;

      // Typing ping ~1.1s before the guess lands.
      events.push({ atMs: Math.max(0, atMs - 1100), typing: true });
      events.push({
        atMs,
        progress: {
          attempts: cumulativeAttempts,
          solved: boardsSolved >= totalBoards,
          boardsSolved,
          totalBoards,
          latestGuess: { boardIndex: bi, tiles: tilesFor(solution, word) },
        },
      });
      guessLog.push({ boardIndex: bi, guess: word });
    }
    lastAtMs = atMs;
  }

  events.sort((a, b) => a.atMs - b.atMs);
  return {
    totalBoards,
    solved: boardsSolved >= totalBoards,
    boardsSolved,
    finishAtMs: lastAtMs,
    totalGuesses: cumulativeAttempts,
    events,
    guessLog,
    solutions,
  };
}
