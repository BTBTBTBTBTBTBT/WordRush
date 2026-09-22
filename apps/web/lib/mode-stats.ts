/**
 * Per-mode stats registry (More Games §18, Stage 3b).
 *
 * One pure, fixture-pinned mechanism instead of a hand-built panel per game:
 * every mode declares which stat lines its detail page shows (the 4×2 grid)
 * and which cards below the grid apply. The DEFAULT profile reproduces
 * today's eight cells byte-for-byte for the word modes — landing it is a
 * zero-visual-change PR — and each custom game adds ONE profile row here (plus
 * fixture cases) when it lands, never a new panel component.
 *
 * Mirrored 1:1 in ModeStats.swift and ModeStats.kt; mode-stats-fixtures.json
 * pins all three. Keep this file dependency-free apart from ./format so the
 * fixture generator can import it standalone.
 */
import { formatGuessStat } from './format';

export interface StatTotals {
  wins: number;
  losses: number;
  totalGames: number;
  /** Best (lowest) guess_count; 0 = none yet. */
  bestScore: number;
  /** Fastest win in seconds; 0 = none yet. */
  fastestTime: number;
  /** Current and best win streak for this mode + play type. */
  streak: number;
  bestStreak: number;
}

export interface StatLine { label: string; value: string }

/** Which cards below the grid apply to a mode. */
export interface StatPanels {
  guessDistribution: boolean;
  solveTime: boolean;
  topWords: boolean;
  openerYield: boolean;
  positionAccuracy: boolean;
  stageBreakdown: boolean;
}

/** "-" for none, "45s", "2m", "2m 5s" — the grid's own compact time (never "0s"). */
export function statTime(seconds: number): string {
  if (seconds <= 0) return '-';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function winRatePct(wins: number, totalGames: number): number {
  return totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
}

/** The eight cells every mode shows today: Wins · Losses · Games · Win Rate · Best · Fastest · Streak · Best Streak. */
function defaultLines(t: StatTotals, semantics: string, guessBase: number): StatLine[] {
  // "Best" is the best guess_count, read through the mode's semantics: "4 guesses"
  // stays a bare number for the word modes (today's display), but a Sudoku best
  // of guess_count 1 must read "0 mistakes", never "1".
  const best = t.bestScore > 0 ? (semantics === 'guesses' ? String(t.bestScore) : formatGuessStat(semantics, guessBase, t.bestScore)) : '-';
  return [
    { label: 'Wins', value: String(t.wins) },
    { label: 'Losses', value: String(t.losses) },
    { label: 'Games', value: String(t.totalGames) },
    { label: 'Win Rate', value: `${winRatePct(t.wins, t.totalGames)}%` },
    { label: 'Best', value: best },
    { label: 'Fastest', value: statTime(t.fastestTime) },
    { label: 'Streak', value: String(t.streak) },
    { label: 'Best Streak', value: String(t.bestStreak) },
  ];
}

const WORD_PANELS: StatPanels = { guessDistribution: true, solveTime: true, topWords: true, openerYield: true, positionAccuracy: true, stageBreakdown: false };

interface StatProfile {
  lines: (t: StatTotals, semantics: string, guessBase: number) => StatLine[];
  panels: StatPanels;
}

/**
 * Registry keyed by dbKey. Missing = the default word profile. Per-game rows
 * (SUDOKU, SCRAMBLE, HUB, …) are added by their game's stage with fixture
 * cases; until then a custom mode gets the default lines and the word-only
 * cards switched off.
 */
const PROFILES: Record<string, StatProfile> = {
  GAUNTLET: { lines: defaultLines, panels: { ...WORD_PANELS, guessDistribution: false, stageBreakdown: true } },
};

const CUSTOM_PANELS: StatPanels = { guessDistribution: false, solveTime: true, topWords: false, openerYield: false, positionAccuracy: false, stageBreakdown: false };

export function statLines(dbKey: string, totals: StatTotals, semantics = 'guesses', guessBase = 1): StatLine[] {
  return (PROFILES[dbKey]?.lines ?? defaultLines)(totals, semantics, guessBase);
}

export function statPanels(dbKey: string, semantics = 'guesses'): StatPanels {
  const p = PROFILES[dbKey];
  if (p) return p.panels;
  // A mode whose guess_count is not "guesses" is a custom engine: no word-only cards.
  return semantics === 'guesses' ? WORD_PANELS : CUSTOM_PANELS;
}
