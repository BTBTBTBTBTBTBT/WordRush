// FINISH_SPEC BJ12 (founder 10-03): "Make sure the games all tie to stats and
// the Moments part too, so the recent history is always up to date … with all
// new games." The rules every platform must agree on for a finished game to
// reach Stats (Today, All-time, recent matches) and the Friends Moments feed —
// written once here, driven by the mode catalog (packages/core/modes.json), and
// pinned on iOS and Android by mode-coverage-fixtures.json.
//
// The gap that prompted it: iOS and Android awarded the Perfect medal (the
// Moments "played a perfect …" row) from a hand-typed switch of the nine word
// modes, so no More Games puzzle ever earned one on a phone (web read the
// catalog). A catalog rule here means a new game is covered the day it lands.

/** The catalog fields the coverage rules read (a subset of the generated ModeMeta). */
export interface CoverageModeMeta {
  dbKey: string | null;
  group: string;          // 'core' | 'more'
  guessBase: number;
  guessSemantics: string;
  dailyEligible: boolean;
  enabled: boolean;
}

/**
 * The word modes' explicit Perfect rules (the shipped table, unchanged): one-word
 * modes solve in one guess; the multi-board modes solve every board in the
 * minimum; Gauntlet clears all 21 boards.
 */
const WORD_PERFECT: Record<string, (guessCount: number, boardsSolved: number) => boolean> = {
  DUEL: (g) => g === 1,
  PROPERNOUNDLE: (g) => g === 1,
  DUEL_6: (g) => g === 1,
  DUEL_7: (g) => g === 1,
  QUORDLE: (g, b) => b === 4 && g <= 4,
  OCTORDLE: (g, b) => b === 8 && g <= 8,
  SEQUENCE: (g, b) => b === 4 && g <= 4,
  RESCUE: (g, b) => b === 4 && g <= 4,
  GAUNTLET: (_g, b) => b === 21,
};

/**
 * Does a finished solo daily earn the Perfect medal? The word modes use their
 * explicit rule; every More Games title (the group, so a new puzzle is covered
 * with no code change) is perfect at the catalog's guessBase with every board
 * solved — "0 mistakes", "Par", "Pandemonium", "0 misses"…
 */
export function isPerfectDailyResult(
  gameMode: string,
  meta: Pick<CoverageModeMeta, 'group' | 'guessBase'> | null | undefined,
  guessCount: number,
  boardsSolved: number,
  totalBoards: number,
  completed: boolean,
): boolean {
  if (!completed) return false;
  const rule = WORD_PERFECT[gameMode];
  if (rule) return rule(guessCount, boardsSolved);
  if (meta?.group === 'more') return guessCount >= 1 && guessCount <= meta.guessBase && boardsSolved >= totalBoards;
  return false;
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

/** "ten" for 10 — the Moments copy spells small counts out. */
export function countWord(n: number): string {
  return n >= 0 && n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : String(n);
}

/**
 * The More Games Sweep moment (every More Games daily played on one day). The
 * count comes from the catalog — it read "all ten" as a literal, which a new
 * puzzle would have made wrong on every platform.
 */
export function moreSweepMomentText(who: string, flawless: boolean, total: number): string {
  return flawless
    ? `${who} — Puzzles Flawless, all ${countWord(total)} won`
    : `${who} — Puzzles Sweep, all ${countWord(total)} played`;
}

/** The More Games daily set the Sweep moment counts: enabled, daily, with a dbKey. */
export function moreSweepModeKeys(modes: readonly CoverageModeMeta[]): string[] {
  return modes.filter((m) => m.enabled && m.group === 'more' && m.dailyEligible && m.dbKey).map((m) => m.dbKey as string);
}

/** The "fewest_guesses" record's title through the mode's guess semantics (web mode-stats.ts parity). */
export function fewestRecordTitle(semantics: string): string {
  switch (semantics) {
    case 'mistakes': return 'Fewest Mistakes';
    case 'checks': return 'Fewest Checks';
    case 'overPar': return 'Best vs Par';
    case 'misses': return 'Fewest Misses';
    case 'rank': return 'Best Rank';
    default: return 'Fewest Guesses';
  }
}

const HUB_RANKS = ['Pandemonium', 'Thunder', 'Uproar', 'Hubbub', 'Racket', 'Clamor', 'Banter', 'Chatter', 'Murmur', 'Hush'];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A guess_count through the mode's semantics — web lib/format.ts formatGuessStat (pinned equal by a web test). */
export function guessStatText(semantics: string, guessBase: number, guessCount: number): string {
  const g = Math.max(0, Math.floor(guessCount));
  switch (semantics) {
    case 'mistakes': return plural(Math.max(0, g - guessBase), 'mistake', 'mistakes');
    case 'checks': return plural(guessBase === 1 ? Math.max(0, g - 1) : g, 'check', 'checks');
    case 'overPar': { const d = g - 1; return d <= 0 ? 'Par' : `+${d}`; }
    case 'misses': return plural(Math.max(0, g - guessBase), 'miss', 'misses');
    case 'rank': return HUB_RANKS[Math.min(HUB_RANKS.length, Math.max(1, g)) - 1];
    default: return plural(g, 'guess', 'guesses');
  }
}

/** A record's value: the RECORD_LABELS formats, "fewest_guesses" read through the mode. */
export function recordValueText(recordType: string, value: number, semantics?: string | null, guessBase = 1): string {
  const v = Math.round(value);
  switch (recordType) {
    case 'fastest_win': return v < 60 ? `${v}s` : `${Math.floor(v / 60)}m ${v % 60}s`;
    // "1 guess", never "1 guesses" (a one-guess Classic record is real).
    case 'fewest_guesses': return guessStatText(semantics ?? 'guesses', guessBase, v);
    case 'most_games_played': return `${v} games`;
    case 'longest_streak': return `${v} wins`;
    case 'most_gold_medals': return `${v} golds`;
    case 'highest_level': return `Level ${v}`;
    case 'most_daily_completions': return `${v} dailies`;
    default: return String(v);
  }
}

/** A record moment's label: "Fastest Win", or the fewest record read through the mode ("Fewest Mistakes" for Sudocious). */
export function recordMomentLabel(recordType: string, semantics: string | null | undefined): string {
  switch (recordType) {
    case 'fastest_win': return 'Fastest Win';
    case 'fewest_guesses': return fewestRecordTitle(semantics ?? 'guesses');
    case 'longest_streak': return 'Longest Win Streak';
    case 'most_games_played': return 'Most Games Played';
    default: return recordType;
  }
}

/** The moment fields a game-bearing headline reads (a subset of the feed's FeedEvent). */
export interface ModeMomentLike {
  type: string;           // 'medal' | 'record'
  me: boolean;
  username: string;
  kind?: string | null;   // medal_type / record_type
  gameMode?: string | null;
  gameTitle?: string | null;
}

/**
 * The Moments headline for a game-bearing event — medals (podium, perfect,
 * streak) and all-time records — identical on every platform: "Doug took gold
 * in Sudocious", "You played a perfect Letter Ladder", "Amy set the all-time
 * Sudocious Fewest Mistakes · 0 mistakes". `valueText` is the record's
 * formatted value (recordValueText); null for anything else.
 */
export function modeMomentHeadline(e: ModeMomentLike, semantics: string | null | undefined, valueText: string | null): string {
  const who = e.me ? 'You' : e.username;
  const game = e.gameTitle ?? e.gameMode ?? '';
  if (e.type === 'record') {
    const label = e.kind ? recordMomentLabel(e.kind, semantics) : 'record';
    return `${who} set the all-time ${e.gameTitle ? `${e.gameTitle} ` : ''}${label}${valueText ? ` · ${valueText}` : ''}`;
  }
  const k = e.kind ?? '';
  if (k === 'gold' || k === 'silver' || k === 'bronze') return `${who} took ${k} in ${game}`;
  if (k === 'perfect') return `${who} played a perfect ${game}`;
  if (k.startsWith('streak_')) return `${who} hit a ${k.slice(7)}-day streak`;
  return `${who} earned a medal in ${game}`;
}
