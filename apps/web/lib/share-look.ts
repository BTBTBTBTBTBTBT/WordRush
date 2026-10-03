// The share cards' finishing look (docs/FINISH_SPEC.md E1, A2, A7;
// finishing-touches mockup `.sharecard`): pure tables and helpers the canvas
// renderers (lib/share-image.ts, lib/vs-share-image.ts) draw from — which
// wallpaper and title art a card wears, the glossy tile palettes, the three
// tinted stat windows, the date line and the compact info line (S2), and the
// site line under the cast wordmark (S3). No DOM, no canvas: unit-tested in
// share-look.test.ts.

import {
  GAME_TITLE_ART_IDS, gameTitleArt,
  type GameTitleArtName, type PageTint, type TitleArtName, type WallArtName,
} from './art';
import { GAME_HOSTS, PAGE_HOSTS, type MascotId } from './mascots';
import { MODES } from './modes.generated';
import { computeScoreBreakdown, formatScore } from './composite-scoring';
import { darken, softMix } from './soft-surface';
import type { ShareDailySweepInput, ShareImageInput, ShareLeaderboardInput, ShareMode, TileStateString } from './share-image';

// ── Glossy tiles (the game kit tile recipe) ─────────────────────────────────

/** A glossy tile's four stops: face gradient light → base (70%) → bottom, and the darker lip. */
export interface GlossPalette {
  light: string;
  base: string;
  bot: string;
  edge: string;
}

/** The game kit's tile colors (globals.css `--gt-c/p/a-*`): purple correct, gold present, slate absent. */
export const TILE_GLOSS: Record<Exclude<TileStateString, 'EMPTY'>, GlossPalette> = {
  CORRECT: { light: '#a66bff', base: '#7c3aed', bot: '#6a2bd6', edge: '#4c1d95' },
  PRESENT: { light: '#ffd166', base: '#f5a524', bot: '#e8901a', edge: '#b0650b' },
  ABSENT: { light: '#8d99b0', base: '#6b7891', bot: '#5d6981', edge: '#3f4a5e' },
};

/** The frosted empty tile (never white): translucent face, lilac lip, faint violet ring. */
export const FROSTED_TILE = {
  edge: 'rgba(216, 200, 243, 0.55)',
  face: 'rgba(255, 255, 255, 0.62)',
  ring: 'rgba(124, 58, 237, 0.14)',
  gloss: 0.35,
} as const;

/** Any accent as a glossy palette (lighter top, darker bottom, deep lip), e.g. a Ladder rung or a region tint. */
export function glossFrom(hex: string): GlossPalette {
  return {
    light: softMix('#ffffff', 0.32, hex),
    base: hex,
    bot: darken(hex, 0.1),
    edge: darken(hex, 0.38),
  };
}

// ── The three stat windows ──────────────────────────────────────────────────

export type StatTone = 'purple' | 'blue' | 'gold';

/** The mockup's `.sc-stats` windows: tint, border, 2-stop top bar, label color. */
export const STAT_TONES: Record<StatTone, { tint: string; line: string; bar: readonly [string, string]; label: string }> = {
  purple: { tint: '#f5eeff', line: '#e2d3ff', bar: ['#7c3aed', '#a855f7'], label: '#6d28d9' },
  blue: { tint: '#eaf2ff', line: '#cfe0ff', bar: ['#0a6cff', '#60a5fa'], label: '#2456a8' },
  gold: { tint: '#fff5df', line: '#f8e2b4', bar: ['#f5a524', '#ffd166'], label: '#a2560c' },
};

/** Soft numbers (A2): Nunito Black in this dark purple. */
export const SOFT_INK = '#3b1a78';

export interface StatWindow {
  value: string;
  label: string;
  tone: StatTone;
}

/** m:ss, the timer style the cards always used. */
export function shareClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The catalog entry behind a share mode ('QuadWord' → quordle / QUORDLE), or null (Sweep, boards, brags). */
export function shareModeMeta(mode: ShareMode): { id: string; dbKey: string } | null {
  const m = MODES.find((x) => x.dbKey && x.title === mode);
  return m && m.dbKey ? { id: m.id, dbKey: m.dbKey } : null;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The card's points when the caller didn't pass them: the composite score
 * recomputed from what the card already carries, for the word modes without
 * hints only (Classic, QuadWord, OctoWord, Succession, Deliverance) — a mode
 * with hints can't be recomputed without the hint count, so it gets null and
 * the window shows the result instead.
 */
export function fallbackSharePoints(input: ShareImageInput, dateKey?: string): number | null {
  if (input.layout !== 'single' && input.layout !== 'multi') return null;
  const meta = shareModeMeta(input.mode);
  if (!meta) return null;
  const total = input.layout === 'multi' ? input.totalBoards : 1;
  const solved = input.layout === 'multi' ? input.boardsSolved : input.won ? 1 : 0;
  const bestGreens = input.layout === 'single'
    ? Math.max(0, ...input.grid.map((row) => row.filter((s) => s === 'CORRECT').length))
    : undefined;
  const b = computeScoreBreakdown(
    meta.dbKey, input.won, input.guesses, input.timeSeconds, solved, total, 0,
    undefined, bestGreens, dateKey,
  );
  if (b.hasHints || b.maxGuesses === 0) return null;
  return b.total;
}

/**
 * The three windows under a result card's board: purple = the game's own
 * "guesses" measure (guesses, stages, mistakes, moves, words, checks…), blue =
 * time, gold = points (or the result when the points aren't known).
 */
export function shareStatWindows(input: ShareImageInput, points: number | null | undefined): [StatWindow, StatWindow, StatWindow] {
  const time: StatWindow = { value: shareClock('timeSeconds' in input ? input.timeSeconds : 0), label: 'TIME', tone: 'blue' };
  const won = 'won' in input ? input.won : true;
  const third: StatWindow = typeof points === 'number' && Number.isFinite(points)
    ? { value: formatScore(points), label: 'POINTS', tone: 'gold' }
    : { value: won ? 'Win' : 'Loss', label: 'RESULT', tone: 'gold' };
  let first: StatWindow;
  switch (input.layout) {
    case 'single':
    case 'multi':
      first = { value: `${input.won ? input.guesses : 'X'}/${input.maxGuesses}`, label: 'GUESSES', tone: 'purple' };
      break;
    case 'gauntlet':
      first = { value: `${input.stagesCompleted}/${input.totalStages}`, label: 'STAGES', tone: 'purple' };
      break;
    case 'sudoku':
    case 'regions':
      first = { value: String(input.mistakes), label: input.mistakes === 1 ? 'MISTAKE' : 'MISTAKES', tone: 'purple' };
      break;
    case 'ladder':
      first = { value: String(input.moves), label: input.moves === 1 ? 'MOVE' : 'MOVES', tone: 'purple' };
      break;
    case 'wordsearch':
      first = { value: `${input.found.length}/${input.words.length}`, label: 'FOUND', tone: 'purple' };
      break;
    case 'hub':
      first = { value: String(input.wordsFound), label: input.wordsFound === 1 ? 'WORD' : 'WORDS', tone: 'purple' };
      // Hubbub has no clock on its card: the blue window carries the % of the maximum.
      return [first, { value: `${input.pct}%`, label: 'OF MAX', tone: 'blue' }, third];
    case 'cryptogram':
    case 'crossword':
      first = { value: String(input.checks), label: input.checks === 1 ? 'CHECK' : 'CHECKS', tone: 'purple' };
      break;
    case 'groups':
      first = { value: `${input.solvedTiers.length}/4`, label: 'GROUPS', tone: 'purple' };
      break;
    case 'scramble':
      first = { value: `${input.solvedCount}/5`, label: 'SOLVED', tone: 'purple' };
      break;
    case 'daily-sweep':
      first = { value: `${input.won}/${input.total}`, label: 'WON', tone: 'purple' };
      return [first, { value: shareClock(input.totalTimeSeconds), label: 'TIME', tone: 'blue' }, { value: formatScore(input.totalScore), label: 'POINTS', tone: 'gold' }];
    default:
      first = { value: '—', label: 'GUESSES', tone: 'purple' };
  }
  return [first, time, third];
}

/** The small extras after the date on a result card (puzzle number, size, par, boards, mistakes…). */
export function shareDetailBits(input: ShareImageInput): string[] {
  const num = 'puzzleNumber' in input && input.puzzleNumber ? `#${input.puzzleNumber}` : null;
  switch (input.layout) {
    case 'single':
      return input.category ? [input.category] : [];
    case 'multi':
      return [`${input.boardsSolved}/${input.totalBoards} boards`];
    case 'gauntlet':
      return [plural(input.guesses, 'guess', 'guesses')];
    case 'sudoku':
      return [num, input.difficulty].filter(Boolean) as string[];
    case 'regions':
      return [num, input.sizeLabel].filter(Boolean) as string[];
    case 'ladder':
      return [num, `Par ${input.par}`].filter(Boolean) as string[];
    case 'wordsearch':
      return [num, plural(input.misses, 'miss', 'misses')].filter(Boolean) as string[];
    case 'hub':
      return [num, input.rankName, plural(input.pangramsFound, 'pangram')].filter(Boolean) as string[];
    case 'groups':
      return [num, plural(input.mistakes, 'mistake')].filter(Boolean) as string[];
    case 'scramble':
      return [num, plural(input.checks, 'check')].filter(Boolean) as string[];
    case 'cryptogram':
    case 'crossword':
      return [num].filter(Boolean) as string[];
    default:
      return [];
  }
}

// ── Date line ───────────────────────────────────────────────────────────────

/** The local YYYY-MM-DD of a date (seeds the footer character for the day). */
export function shareDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "FRIDAY, OCT 2 · #217 · HARD" — the mockup's letterspaced date line. */
export function shareDateLine(d: Date, extras: ReadonlyArray<string | null | undefined | false> = []): string {
  const day = d.toLocaleDateString('en-US', { weekday: 'long' });
  const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return [`${day}, ${md}`, ...extras.filter((x): x is string => typeof x === 'string' && x.length > 0)]
    .join(' · ')
    .toUpperCase();
}

// ── The compact info line (S2) ──────────────────────────────────────────────

/** "FRI, OCT 2" — the info line's short date. */
export function shareShortDate(d: Date): string {
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${day}, ${md}`.toUpperCase();
}

/** The info line: one letterspaced line plus a W / L badge (null = no badge). */
export interface ShareInfo {
  text: string;
  badge: 'W' | 'L' | null;
}

/** What names the puzzle on the info line (counts live in the measure / stat windows). */
function infoExtras(input: ShareImageInput): string[] {
  const num = 'puzzleNumber' in input && input.puzzleNumber ? `#${input.puzzleNumber}` : null;
  switch (input.layout) {
    case 'single':
      return input.category ? [input.category] : [];
    case 'multi':
      return [`${input.boardsSolved}/${input.totalBoards} boards`];
    case 'sudoku':
      return [num, input.difficulty].filter(Boolean) as string[];
    case 'regions':
      return [num, input.sizeLabel].filter(Boolean) as string[];
    case 'ladder':
      return [num, `Par ${input.par}`].filter(Boolean) as string[];
    case 'wordsearch':
    case 'hub':
    case 'groups':
    case 'scramble':
    case 'cryptogram':
    case 'crossword':
      return num ? [num] : [];
    default:
      return [];
  }
}

/**
 * S2's one compact line under the title art: date · what names the puzzle ·
 * the game's measure · time, with a W (won) or L badge after it.
 * "FRI, OCT 2 · 4/6 GUESSES · 0:48" + W.
 */
export function shareInfoLine(input: ShareImageInput, d: Date): ShareInfo {
  if (input.layout === 'daily-sweep') return shareSweepInfo(input, d);
  const [first, second] = shareStatWindows(input, null);
  const measure = `${first.value} ${first.label}`;
  const time = second.label === 'TIME' ? second.value : `${second.value} ${second.label}`;
  const won = 'won' in input && typeof input.won === 'boolean' ? input.won : true;
  return {
    text: [shareShortDate(d), ...infoExtras(input), measure, time].join(' · ').toUpperCase(),
    badge: input.layout === 'profile' || input.layout === 'leaderboard' ? null : won ? 'W' : 'L',
  };
}

/** The Sweep card's info line: date · (More Games) · won/total WON · total time; W only when flawless. */
export function shareSweepInfo(input: ShareDailySweepInput, d: Date): ShareInfo {
  return {
    text: [shareShortDate(d), input.title ?? null, `${input.won}/${input.total} won`, shareClock(input.totalTimeSeconds)]
      .filter((x): x is string => !!x)
      .join(' · ')
      .toUpperCase(),
    badge: input.total > 0 && input.won === input.total ? 'W' : null,
  };
}

// ── Art per card ────────────────────────────────────────────────────────────

const TITLE_IDS: ReadonlySet<string> = new Set(GAME_TITLE_ART_IDS);

/** A result card's art: the game's wallpaper + title art, and its host. */
export function gameShareArt(mode: ShareMode): { wall: WallArtName; title: GameTitleArtName | null; host: MascotId | null } {
  const meta = shareModeMeta(mode);
  const id = meta && TITLE_IDS.has(meta.id) ? meta.id : null;
  return {
    wall: id ? (`art-wall-game-${id}` as WallArtName) : 'art-wall-home',
    title: gameTitleArt(id),
    host: meta ? GAME_HOSTS[meta.dbKey] ?? null : null,
  };
}

/**
 * The leaderboard card's art per variant: page wallpaper, whole-cast page
 * title, page host, and the page name lettered when the title art didn't load
 * (never a WORDOCIOUS wordmark: the cast row at the bottom is the only one, S3).
 */
export const LEADERBOARD_SHARE_ART: Record<ShareLeaderboardInput['variant'], { wall: PageTint; title: TitleArtName; host: MascotId; label: string }> = {
  solo: { wall: 'leaderboard', title: 'art-titlecast-leaderboard', host: PAGE_HOSTS.leaderboard, label: 'LEADERBOARD' },
  podium: { wall: 'leaderboard', title: 'art-titlecast-leaderboard', host: PAGE_HOSTS.leaderboard, label: 'LEADERBOARD' },
  sweep: { wall: 'leaderboard', title: 'art-titlecast-leaderboard', host: PAGE_HOSTS.leaderboard, label: 'LEADERBOARD' },
  sweepPodium: { wall: 'leaderboard', title: 'art-titlecast-leaderboard', host: PAGE_HOSTS.leaderboard, label: 'LEADERBOARD' },
  vs: { wall: 'vs', title: 'art-title-vs', host: PAGE_HOSTS.vs, label: 'VS BATTLE' },
  friends: { wall: 'friends', title: 'art-titlecast-friends', host: PAGE_HOSTS.friends, label: 'FRIENDS' },
  friendsPodium: { wall: 'friends', title: 'art-titlecast-friends', host: PAGE_HOSTS.friends, label: 'FRIENDS' },
  weeklyRace: { wall: 'friends', title: 'art-titlecast-friends', host: PAGE_HOSTS.friends, label: 'FRIENDS' },
  flawlessStreak: { wall: 'leaderboard', title: 'art-titlecast-records', host: PAGE_HOSTS.records, label: 'RECORDS' },
  trophyCase: { wall: 'leaderboard', title: 'art-titlecast-records', host: PAGE_HOSTS.records, label: 'RECORDS' },
};

// ── The cast wordmark's line (S3) ───────────────────────────────────────────

/** The one tiny line under the cast wordmark: where to play (the share carries no link). */
export const SHARE_SITE = 'wordocious.com';
