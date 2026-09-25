/**
 * Per-mode stats registry (More Games §18, Stage 3b + the per-game profiles).
 *
 * One pure, fixture-pinned mechanism instead of a hand-built panel per game:
 * every mode declares which stat lines its detail page shows (the 4×2 grid)
 * and which cards below the grid apply. The DEFAULT profile reproduces the
 * word modes' eight cells byte-for-byte; each custom game has ONE profile row
 * here whose cells are derived from the user_stats totals AND from a pure
 * aggregate over that mode's matches rows (`modeAggregates`).
 *
 * Mirrored 1:1 in ModeStats.swift and ModeStats.kt; mode-stats-fixtures.json
 * pins all three. Keep this file dependency-free apart from ./format so the
 * fixture generator can import it standalone.
 *
 * ── Fixture shape (lib/__fixtures__/mode-stats-fixtures.json, one entry per case) ──
 *   {
 *     dbKey:      "SUDOKU",                 // registry key (matches.game_mode / user_stats.game_mode)
 *     semantics:  "mistakes",               // catalog guessSemantics
 *     guessBase:  1,                        // catalog guessBase (the perfect guess_count)
 *     totals:     { wins, losses, totalGames, bestScore, fastestTime, streak, bestStreak },
 *     matches:    [ MatchRow, … ],          // the player's rows for this mode (may be empty)
 *     aggregates: ModeAggregates,           // == modeAggregates(dbKey, matches)
 *     lines:      [ { label, value } × 8 ], // == statLines(dbKey, totals, semantics, guessBase, aggregates)
 *     panels:     StatPanels                // == statPanels(dbKey, semantics)
 *   }
 *   MatchRow = { guess_count, completed, time_seconds, hints_used, boards_solved (int | null),
 *                total_boards (int | null), player1_guesses: string[], solutions: string[], seed? }
 *   A null boards_solved/total_boards means "not stored on this row" — the aggregate rebuilds
 *   them from the event log (matches has no boards columns; daily_results does).
 *   Every aggregate is an integer or a string so the three ports compare exactly.
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

/**
 * One matches row as the aggregate reads it. The web maps matches columns onto
 * these names (player1_score → guess_count, winner_id → completed,
 * player1_time → time_seconds); daily_results rows already carry them.
 */
export interface MatchRow {
  guess_count: number;
  completed: boolean;
  time_seconds: number;
  hints_used: number;
  boards_solved?: number | null;
  total_boards?: number | null;
  player1_guesses: string[];
  solutions: string[];
  seed?: string;
}

/** Pure sums over a mode's matches rows — every field an integer or a string. */
export interface ModeAggregates {
  games: number;
  wins: number;
  /** Wins at the perfect guess_count with no hints — "Clean" / "Perfect". */
  cleanWins: number;
  /** Wins at the perfect guess_count, hints or not — Par Rate, Spyglass "Clean". */
  perfectWins: number;
  noHintWins: number;
  /** Sum of guess_count over wins; a line divides by wins and subtracts guessBase. */
  winGuessTotal: number;
  /** Sum of time_seconds over wins with a positive time, and how many such wins. */
  winTimeTotal: number;
  timedWins: number;
  /** Fastest win at the perfect guess_count (seconds; 0 = none). */
  fastestPerfect: number;
  /** Sums of boards_solved and total_boards over every game (stored or rebuilt). */
  boardsSolved: number;
  boardsTotal: number;
  /** Kindred: games whose first solved group was the tier-4 (hardest) one. */
  hardestFirst: number;
  /** Hubbub: scored words using all seven letters, across every game. */
  pangrams: number;
  /** Hubbub: the longest word the player entered ("" = none). */
  longestWord: string;
}

export const EMPTY_AGGREGATES: ModeAggregates = {
  games: 0, wins: 0, cleanWins: 0, perfectWins: 0, noHintWins: 0, winGuessTotal: 0,
  winTimeTotal: 0, timedWins: 0, fastestPerfect: 0, boardsSolved: 0, boardsTotal: 0,
  hardestFirst: 0, pangrams: 0, longestWord: '',
};

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

const pct = (n: number, d: number): string => `${d > 0 ? Math.round((n / d) * 100) : 0}%`;

/**
 * One-decimal average with integer maths: (total − sub·n) / n rounded to
 * tenths, "-" when n is 0. 13 mistakes over 5 wins → "2.6"; 5 over 5 → "1.0".
 */
export function avg1(total: number, n: number, sub = 0): string {
  if (n <= 0) return '-';
  const tenths = Math.max(0, Math.round(((total - sub * n) * 10) / n));
  return `${Math.floor(tenths / 10)}.${tenths % 10}`;
}

// ── The perfect guess_count and board count per custom mode ───────────────
// guessBase is passed in from the catalog; the board counts are the engines'
// constants (SCRAMBLE_TOTAL_BOARDS, HUB_TOTAL_BOARDS, GROUPS_TOTAL_BOARDS,
// Spyglass's ten words), repeated here so this file stays dependency-free.
const TOTAL_BOARDS: Record<string, number> = { SCRAMBLE: 5, HUB: 20, GROUPS: 4, WORDSEARCH: 10 };
const WORDSEARCH_WORDS = 10;

/** Hubbub word score (hub.ts hubWordScore): 4 letters = 1, longer = length, pangram +7. */
function hubScore(word: string, letters: string): number {
  return (word.length === 4 ? 1 : word.length) + (isPangram(word, letters) ? 7 : 0);
}
function isPangram(word: string, letters: string): boolean {
  if (!letters) return false;
  for (const ch of letters) if (!word.includes(ch)) return false;
  return true;
}

/**
 * boards_solved for a row that did not store it, rebuilt from the event log
 * exactly as the game's finalizer computed it. Anything unrecognised: the win
 * flag over one board.
 */
export function boardsFromEvents(dbKey: string, row: MatchRow): number {
  const ev = Array.isArray(row.player1_guesses) ? row.player1_guesses : [];
  switch (dbKey) {
    case 'SCRAMBLE': // "i✓WORD" solved by the player, "iH" solved by hint — i is 0–3 words, 4 punchline
      return Math.min(TOTAL_BOARDS.SCRAMBLE, ev.filter((e) => /^[0-4](✓|H)/.test(e)).length);
    case 'GROUPS': // "+t:W1,W2,W3,W4" solved tier t
      return Math.min(TOTAL_BOARDS.GROUPS, ev.filter((e) => e.startsWith('+')).length);
    case 'WORDSEARCH': // "+WORD" found (hinted words arrive as "?WORD" then "+WORD")
      return Math.min(TOTAL_BOARDS.WORDSEARCH, ev.filter((e) => e.startsWith('+')).length);
    case 'HUB': { // floor(points × 20 / max); "+WORD" scored, "!WORD" revealed (also scored)
      const letters = row.solutions?.[1] ?? '';
      const max = Number(row.solutions?.[2]) || 0;
      if (max <= 0) return 0;
      let points = 0;
      for (const e of ev) if (e[0] === '+' || e[0] === '!') points += hubScore(e.slice(1), letters);
      return Math.min(TOTAL_BOARDS.HUB, Math.floor((points * TOTAL_BOARDS.HUB) / max));
    }
    default:
      return row.completed ? 1 : 0;
  }
}

/**
 * The pure aggregate over a mode's matches rows. Order-independent (the one
 * string field breaks ties alphabetically) so the newest-first web slice and a
 * native cache in any order agree. Unknown modes still get the generic sums.
 */
export function modeAggregates(dbKey: string, matches: MatchRow[], guessBase = 1): ModeAggregates {
  const a: ModeAggregates = { ...EMPTY_AGGREGATES };
  for (const row of matches) {
    const won = !!row.completed;
    const g = Math.max(0, Math.floor(row.guess_count || 0));
    const t = Math.max(0, Math.floor(row.time_seconds || 0));
    const hints = Math.max(0, Math.floor(row.hints_used || 0));
    const ev = Array.isArray(row.player1_guesses) ? row.player1_guesses : [];
    a.games++;
    if (won) {
      a.wins++;
      a.winGuessTotal += g;
      if (hints === 0) a.noHintWins++;
      if (g === guessBase) {
        a.perfectWins++;
        if (hints === 0) a.cleanWins++;
        if (t > 0 && (a.fastestPerfect === 0 || t < a.fastestPerfect)) a.fastestPerfect = t;
      }
      if (t > 0) { a.winTimeTotal += t; a.timedWins++; }
    }
    const total = row.total_boards != null && row.total_boards > 0 ? row.total_boards : (TOTAL_BOARDS[dbKey] ?? 1);
    const solved = row.boards_solved != null ? Math.max(0, Math.min(total, row.boards_solved)) : boardsFromEvents(dbKey, row);
    a.boardsSolved += solved;
    a.boardsTotal += total;

    if (dbKey === 'GROUPS') {
      const first = ev.find((e) => e.startsWith('+'));
      if (first && first.startsWith('+4:')) a.hardestFirst++;
    }
    if (dbKey === 'HUB') {
      const letters = row.solutions?.[1] ?? '';
      for (const e of ev) {
        const sigil = e[0], word = e.slice(1);
        if ((sigil !== '+' && sigil !== '=') || !/^[A-Z]{4,}$/.test(word)) continue;
        if (sigil === '+' && isPangram(word, letters)) a.pangrams++;
        if (word.length > a.longestWord.length || (word.length === a.longestWord.length && word < a.longestWord)) a.longestWord = word;
      }
    }
  }
  return a;
}

// ── Profiles ───────────────────────────────────────────────────────────────

type Lines = (t: StatTotals, semantics: string, guessBase: number, a: ModeAggregates) => StatLine[];

/** The eight cells every word mode shows: Wins · Losses · Games · Win Rate · Best · Fastest · Streak · Best Streak. */
function defaultLines(t: StatTotals, semantics: string, guessBase: number): StatLine[] {
  // "Best" is the best guess_count, read through the mode's semantics: "4 guesses"
  // stays a bare number for the word modes (today's display), but a Sudocious best
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

/** Sudocious, Starsweep: Wins · Losses · Win Rate · Clean · Avg Mistakes · Fastest · No-hint Wins · Streak. */
const mistakesLines: Lines = (t, _s, base, a) => [
  { label: 'Wins', value: String(t.wins) },
  { label: 'Losses', value: String(t.losses) },
  { label: 'Win Rate', value: pct(t.wins, t.totalGames) },
  { label: 'Clean', value: String(a.cleanWins) },
  { label: 'Avg Mistakes', value: avg1(a.winGuessTotal, a.wins, base) },
  { label: 'Fastest', value: statTime(t.fastestTime) },
  { label: 'No-hint Wins', value: String(a.noHintWins) },
  { label: 'Streak', value: String(t.streak) },
];

/** Letter Ladder: Wins · Losses · Par Rate · Avg Over Par · Fastest Par · No-hint Wins · Streak · Best Streak. */
const ladderLines: Lines = (t, _s, base, a) => [
  { label: 'Wins', value: String(t.wins) },
  { label: 'Losses', value: String(t.losses) },
  { label: 'Par Rate', value: pct(a.perfectWins, a.wins) },
  { label: 'Avg Over Par', value: avg1(a.winGuessTotal, a.wins, base) },
  { label: 'Fastest Par', value: statTime(a.fastestPerfect) },
  { label: 'No-hint Wins', value: String(a.noHintWins) },
  { label: 'Streak', value: String(t.streak) },
  { label: 'Best Streak', value: String(t.bestStreak) },
];

/** Muddle: Wins · Losses · Win Rate · Clean · Avg Checks · Fastest · Words Solved · Streak. */
const scrambleLines: Lines = (t, _s, _base, a) => [
  { label: 'Wins', value: String(t.wins) },
  { label: 'Losses', value: String(t.losses) },
  { label: 'Win Rate', value: pct(t.wins, t.totalGames) },
  { label: 'Clean', value: String(a.cleanWins) },
  { label: 'Avg Checks', value: avg1(a.winGuessTotal, a.wins) },
  { label: 'Fastest', value: statTime(t.fastestTime) },
  { label: 'Words Solved', value: String(a.boardsSolved) },
  { label: 'Streak', value: String(t.streak) },
];

/** Spyglass: Cleared · Losses · Win Rate · Clean · Fastest · Avg Time · Sec / Word · Streak. */
const wordsearchLines: Lines = (t, _s, _base, a) => {
  const tenths = a.timedWins > 0 ? Math.round((a.winTimeTotal * 10) / (a.timedWins * WORDSEARCH_WORDS)) : 0;
  return [
    { label: 'Cleared', value: String(t.wins) },
    { label: 'Losses', value: String(t.losses) },
    { label: 'Win Rate', value: pct(t.wins, t.totalGames) },
    { label: 'Clean', value: String(a.perfectWins) },
    { label: 'Fastest', value: statTime(t.fastestTime) },
    { label: 'Avg Time', value: statTime(a.timedWins > 0 ? Math.round(a.winTimeTotal / a.timedWins) : 0) },
    { label: 'Sec / Word', value: tenths > 0 ? `${Math.floor(tenths / 10)}.${tenths % 10}s` : '-' },
    { label: 'Streak', value: String(t.streak) },
  ];
};

/** Hubbub: Days Played · Hubbub+ · Pandemonium · Best Rank · Avg % Max · Pangrams · Longest Word · Streak. */
const hubLines: Lines = (t, _s, base, a) => [
  { label: 'Days Played', value: String(t.totalGames) },
  { label: 'Hubbub+', value: String(t.wins) },
  { label: 'Pandemonium', value: String(a.perfectWins) },
  { label: 'Best Rank', value: t.bestScore > 0 ? formatGuessStat('rank', base, t.bestScore) : '-' },
  { label: 'Avg % Max', value: pct(a.boardsSolved, a.boardsTotal) },
  { label: 'Pangrams', value: String(a.pangrams) },
  { label: 'Longest Word', value: a.longestWord || '-' },
  { label: 'Streak', value: String(t.streak) },
];

/** Crosswordocious, Codebreaker: Wins · Losses · Win Rate · Clean · No-hint Wins · Fastest · Avg Time · Streak. */
const checksLines: Lines = (t, _s, _base, a) => [
  { label: 'Wins', value: String(t.wins) },
  { label: 'Losses', value: String(t.losses) },
  { label: 'Win Rate', value: pct(t.wins, t.totalGames) },
  { label: 'Clean', value: String(a.cleanWins) },
  { label: 'No-hint Wins', value: String(a.noHintWins) },
  { label: 'Fastest', value: statTime(t.fastestTime) },
  { label: 'Avg Time', value: statTime(a.timedWins > 0 ? Math.round(a.winTimeTotal / a.timedWins) : 0) },
  { label: 'Streak', value: String(t.streak) },
];

/** Kindred: Wins · Losses · Win Rate · Perfect · Avg Mistakes · Hardest 1st · Fastest · Streak. */
const groupsLines: Lines = (t, _s, base, a) => [
  { label: 'Wins', value: String(t.wins) },
  { label: 'Losses', value: String(t.losses) },
  { label: 'Win Rate', value: pct(t.wins, t.totalGames) },
  { label: 'Perfect', value: String(a.cleanWins) },
  { label: 'Avg Mistakes', value: avg1(a.winGuessTotal, a.wins, base) },
  { label: 'Hardest 1st', value: String(a.hardestFirst) },
  { label: 'Fastest', value: statTime(t.fastestTime) },
  { label: 'Streak', value: String(t.streak) },
];

const WORD_PANELS: StatPanels = { guessDistribution: true, solveTime: true, topWords: true, openerYield: true, positionAccuracy: true, stageBreakdown: false };
/** Custom engines: solve-time trend only — no word rows, so no word-only cards. */
const CUSTOM_PANELS: StatPanels = { guessDistribution: false, solveTime: true, topWords: false, openerYield: false, positionAccuracy: false, stageBreakdown: false };
/** Kindred (4–7 submissions) and Muddle (5–13 checks) have a histogram worth drawing. */
const CUSTOM_DIST_PANELS: StatPanels = { ...CUSTOM_PANELS, guessDistribution: true };

interface StatProfile {
  lines: Lines;
  panels: StatPanels;
}

/**
 * Registry keyed by dbKey. Missing = the default word profile (word-only
 * cards on for "guesses" semantics, off for any other).
 */
const PROFILES: Record<string, StatProfile> = {
  GAUNTLET: { lines: defaultLines, panels: { ...WORD_PANELS, guessDistribution: false, stageBreakdown: true } },
  // ProperNoundle guesses names, not words: the word grid + distribution apply,
  // but "Top words" / opener yield / position accuracy would be noise.
  PROPERNOUNDLE: { lines: defaultLines, panels: { ...CUSTOM_PANELS, guessDistribution: true } },
  SUDOKU: { lines: mistakesLines, panels: CUSTOM_PANELS },
  REGIONS: { lines: mistakesLines, panels: CUSTOM_PANELS },
  LADDER: { lines: ladderLines, panels: CUSTOM_PANELS },
  SCRAMBLE: { lines: scrambleLines, panels: CUSTOM_DIST_PANELS },
  WORDSEARCH: { lines: wordsearchLines, panels: CUSTOM_PANELS },
  HUB: { lines: hubLines, panels: CUSTOM_PANELS },
  CROSSWORD: { lines: checksLines, panels: CUSTOM_PANELS },
  CRYPTOGRAM: { lines: checksLines, panels: CUSTOM_PANELS },
  GROUPS: { lines: groupsLines, panels: CUSTOM_DIST_PANELS },
};

/**
 * The 4×2 grid for a mode. `aggregates` is `modeAggregates(dbKey, matches)`;
 * omitted (or no rows yet) every matches-derived cell reads "-", "0" or "0%".
 */
export function statLines(dbKey: string, totals: StatTotals, semantics = 'guesses', guessBase = 1, aggregates?: ModeAggregates): StatLine[] {
  return (PROFILES[dbKey]?.lines ?? defaultLines)(totals, semantics, guessBase, aggregates ?? EMPTY_AGGREGATES);
}

export function statPanels(dbKey: string, semantics = 'guesses'): StatPanels {
  const p = PROFILES[dbKey];
  if (p) return p.panels;
  // A mode whose guess_count is not "guesses" is a custom engine: no word-only cards.
  return semantics === 'guesses' ? WORD_PANELS : CUSTOM_PANELS;
}

// ── Guess-distribution card ────────────────────────────────────────────────

/**
 * The histogram's bucket range for the custom games that draw one — Kindred
 * 4–7 submissions, Muddle 5–13 checks. Null = the word modes' own table.
 */
export function guessDistributionRange(dbKey: string): { min: number; max: number } | null {
  if (dbKey === 'GROUPS') return { min: 4, max: 7 };
  if (dbKey === 'SCRAMBLE') return { min: 5, max: 13 };
  return null;
}

/** The unit the histogram counts, singular and plural: guess / check / mistake / miss. */
export function guessNoun(semantics: string): { one: string; many: string } {
  switch (semantics) {
    case 'checks': return { one: 'check', many: 'checks' };
    case 'mistakes': return { one: 'mistake', many: 'mistakes' };
    case 'misses': return { one: 'miss', many: 'misses' };
    default: return { one: 'guess', many: 'guesses' };
  }
}

// ── Leaderboard / records labels through the semantics ─────────────────────

/**
 * A leaderboard row's guess stat, title-cased the way the rows read today
 * ("4 Guesses · 1:23"): "0 Mistakes", "5 Checks", "2 Misses", "Par",
 * "+2 over par", "Hubbub".
 */
export function guessRowLabel(semantics: string, guessBase: number, guessCount: number): string {
  const s = formatGuessStat(semantics, guessBase, guessCount);
  if (semantics === 'rank') return s;
  if (semantics === 'overPar') return s === 'Par' ? s : `${s} over par`;
  const sp = s.indexOf(' ');
  return sp < 0 ? s : `${s.slice(0, sp + 1)}${s[sp + 1].toUpperCase()}${s.slice(sp + 2)}`;
}

/** The "fewest_guesses" record's title for a mode: what a low guess_count means there. */
export function fewestRecordLabel(semantics: string): string {
  switch (semantics) {
    case 'mistakes': return 'Fewest Mistakes';
    case 'checks': return 'Fewest Checks';
    case 'overPar': return 'Best vs Par';
    case 'misses': return 'Fewest Misses';
    case 'rank': return 'Best Rank';
    default: return 'Fewest Guesses';
  }
}
