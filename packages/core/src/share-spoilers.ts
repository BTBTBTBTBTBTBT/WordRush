// ============================================================
// Share cards: spoiler-free models for the puzzle games (share-cards-1016/SPEC.md "Spoilers")
// ============================================================
// Every puzzle game offers the chooser (`No spoilers` / `Full results`). These pure functions turn a FINISHED game
// (the matches-row reconstruction, or the state where the fields line up) into a small, serializable model that each
// platform's renderer just draws. The `clean` variant never carries the answer: no digits, letters, words, stars or
// quote text; only shapes, masks, colors and counts. The `full` variant adds the answer fields; in `clean` those same
// fields are null, so a renderer branches on null, never on the variant. Ported to Swift / Kotlin from
// share-spoilers-fixtures.json.

import { regionColorSlots } from './games/regions';
import { hubIsPangram, hubRankIndex, HUB_RANKS } from './games/hub';
import { wordsearchCells } from './games/wordsearch';
import type { GroupsGroup } from './games/groups';
import type { WordsearchPlacement } from './games/wordsearch';

export type ShareVariant = 'clean' | 'full';

export interface ShareVariantCopy {
  clean: { title: 'No spoilers'; subtitle: string };
  full: { title: 'Full results'; subtitle: string };
}

/** Chooser subtitles per catalog mode id; anything else (the word games) keeps the colors / letters rule. */
export const SHARE_VARIANT_SUBTITLES: Readonly<Record<string, readonly [clean: string, full: string]>> = {
  regions: ['Regions only', 'Stars revealed'],
  sudoku: ['Givens only', 'Digits revealed'],
  crossword: ['Grid only', 'Letters revealed'],
  groups: ['Colors only', 'Words revealed'],
  wordsearch: ['Paths only', 'Letters revealed'],
  hub: ['Rank only', 'Words revealed'],
  scramble: ['Stats only', 'Answer revealed'],
  ladder: ['Rungs only', 'Words revealed'],
  cryptogram: ['Shape only', 'Quote revealed'],
};

export const SHARE_VARIANT_DEFAULT_SUBTITLES: readonly [clean: string, full: string] = ['Colors only', 'Letters revealed'];

export function shareVariantCopy(mode: string): ShareVariantCopy {
  const [clean, full] = SHARE_VARIANT_SUBTITLES[mode] ?? SHARE_VARIANT_DEFAULT_SUBTITLES;
  return { clean: { title: 'No spoilers', subtitle: clean }, full: { title: 'Full results', subtitle: full } };
}

const only = <T>(variant: ShareVariant, value: T): T | null => (variant === 'full' ? value : null);

// ── Starsweep (regions) ───────────────────────────────────────────────────

export interface StarsweepShareModel {
  kind: 'starsweep';
  n: number;
  /** One digit per cell (row-major): the region index. */
  regions: string;
  /** Palette slot per region index (regionColorSlots). */
  slots: number[];
  solved: boolean;
  /** Cells holding a committed star; full only. */
  stars: number[] | null;
  /** Cells crossed out; full only. */
  crosses: number[] | null;
}

export function starsweepShareModel(g: { n: number; regions: string; solution: string; board: string }, variant: ShareVariant): StarsweepShareModel {
  const stars: number[] = [], crosses: number[] = [];
  for (let i = 0; i < g.board.length; i++) { if (g.board[i] === '*') stars.push(i); else if (g.board[i] === 'x') crosses.push(i); }
  let solved = true;
  for (let r = 0; r < g.n; r++) if (g.board[r * g.n + (g.solution.charCodeAt(r) - 48)] !== '*') solved = false;
  return { kind: 'starsweep', n: g.n, regions: g.regions, slots: regionColorSlots(g.n, g.regions), solved, stars: only(variant, stars), crosses: only(variant, crosses) };
}

// ── Sudocious (sudoku) ────────────────────────────────────────────────────

export interface SudociousShareModel {
  kind: 'sudocious';
  /** 81 chars, '0' empty: the given digits (the puzzle, shown in both variants). */
  givens: string;
  /** 81 chars: 'g' given, 'f' filled right, 'w' filled wrong, '.' empty. */
  cells: string;
  solved: boolean;
  /** 81 chars, the player's board; full only. */
  board: string | null;
}

export function sudociousShareModel(g: { givens: string; solution: string; board: string }, variant: ShareVariant): SudociousShareModel {
  let cells = '';
  for (let i = 0; i < 81; i++) {
    const given = g.givens[i] ?? '0', b = g.board[i] ?? '0';
    cells += given !== '0' ? 'g' : b === '0' ? '.' : b === g.solution[i] ? 'f' : 'w';
  }
  return { kind: 'sudocious', givens: g.givens, cells, solved: g.board === g.solution, board: only(variant, g.board) };
}

// ── Crosswordocious (crossword) ───────────────────────────────────────────

export interface CrosswordShareModel {
  kind: 'crossword';
  w: number;
  h: number;
  /** w*h chars: '.' block, '#' filled right, 'x' filled wrong, '_' empty. */
  cells: string;
  solved: boolean;
  /** w*h chars, the player's fill ('.' block, '_' empty); full only. */
  letters: string | null;
}

export function crosswordShareModel(g: { w: number; h: number; solution: string; fill: string }, variant: ShareVariant): CrosswordShareModel {
  let cells = '', solved = true;
  for (let i = 0; i < g.solution.length; i++) {
    const s = g.solution[i], f = g.fill[i] ?? '_';
    if (s === '.') cells += '.';
    else if (f === '_' || f === '.') { cells += '_'; solved = false; }
    else if (f === s) cells += '#';
    else { cells += 'x'; solved = false; }
  }
  return { kind: 'crossword', w: g.w, h: g.h, cells, solved, letters: only(variant, g.fill) };
}

// ── Kindred (groups) ──────────────────────────────────────────────────────

export interface KindredShareRow {
  tier: number;
  solved: boolean;
  /** The group's label; full only. */
  label: string | null;
  /** The four words; full only. */
  words: string[] | null;
}

export interface KindredShareModel {
  kind: 'kindred';
  /** Solved groups in the order solved, then the unsolved ones by tier. */
  rows: KindredShareRow[];
  mistakes: number;
  solved: boolean;
}

export function kindredShareModel(g: { groups: GroupsGroup[]; solvedTiers: number[]; mistakes: number }, variant: ShareVariant): KindredShareModel {
  const byTier = (t: number) => g.groups.find((x) => x.tier === t);
  const order = [...g.solvedTiers, ...g.groups.map((x) => x.tier).filter((t) => !g.solvedTiers.includes(t)).sort((a, b) => a - b)];
  const rows: KindredShareRow[] = [];
  for (const tier of order) {
    const grp = byTier(tier);
    if (!grp) continue;
    rows.push({ tier, solved: g.solvedTiers.includes(tier), label: only(variant, grp.label), words: only(variant, [...grp.words]) });
  }
  return { kind: 'kindred', rows, mistakes: g.mistakes, solved: rows.length > 0 && rows.every((r) => r.solved) };
}

// ── Spyglass (wordsearch) ─────────────────────────────────────────────────

export interface SpyglassSharePath {
  /** Grid cells the stroke runs through, first letter first. */
  cells: number[];
  /** The word on the stroke; full only. */
  word: string | null;
}

export interface SpyglassShareModel {
  kind: 'spyglass';
  n: number;
  /** One stroke per found word, in the order found. */
  paths: SpyglassSharePath[];
  found: number;
  total: number;
  solved: boolean;
  /** n*n letters; full only. */
  letters: string | null;
}

export function spyglassShareModel(g: { grid: string; words: WordsearchPlacement[]; found: string[] }, variant: ShareVariant): SpyglassShareModel {
  const n = Math.round(Math.sqrt(g.grid.length));
  const paths: SpyglassSharePath[] = [];
  for (const w of g.found) {
    const p = g.words.find((x) => x.w === w);
    if (p) paths.push({ cells: wordsearchCells(n, p), word: only(variant, p.w) });
  }
  return { kind: 'spyglass', n, paths, found: paths.length, total: g.words.length, solved: g.words.length > 0 && paths.length === g.words.length, letters: only(variant, g.grid) };
}

// ── Hubbub (hub) ──────────────────────────────────────────────────────────

export interface HubbubShareModel {
  kind: 'hubbub';
  /** The seven letters, center first (the puzzle, shown in both variants). */
  letters: string;
  rank: number;
  rankName: string;
  points: number;
  max: number;
  found: number;
  total: number;
  pangrams: number;
  pangramTotal: number;
  /** The found scoring words in the order found; full only. */
  words: string[] | null;
}

export function hubbubShareModel(g: { letters: string; found: string[]; points: number; max: number; wordCount: number; pangramCount: number }, variant: ShareVariant): HubbubShareModel {
  const rank = hubRankIndex(g.points, g.max);
  return {
    kind: 'hubbub', letters: g.letters, rank, rankName: HUB_RANKS[rank].name, points: g.points, max: g.max,
    found: g.found.length, total: g.wordCount, pangrams: g.found.filter((w) => hubIsPangram(w, g.letters)).length, pangramTotal: g.pangramCount,
    words: only(variant, [...g.found]),
  };
}

// ── Muddle (scramble) ─────────────────────────────────────────────────────

export interface MuddleShareModel {
  kind: 'muddle';
  /** Letter counts of the four words and the punchline (spaces dropped), for blank tiles. */
  lengths: number[];
  /** Which of the five rows were solved. */
  solved: boolean[];
  boardsSolved: number;
  checks: number;
  mistakes: number;
  hintsUsed: number;
  won: boolean;
  /** The four words and the punchline; full only. */
  answers: string[] | null;
  /** The cartoon's caption; full only (null when the game has none). */
  caption: string | null;
}

export function muddleShareModel(
  g: { words: string[]; final: string; solved: boolean[]; checks: number; mistakes: number; hintsUsed: number },
  variant: ShareVariant,
  caption?: string | null,
): MuddleShareModel {
  const answers = [...g.words, g.final];
  const solved = Array.from({ length: 5 }, (_, i) => g.solved[i] === true);
  return {
    kind: 'muddle', lengths: answers.map((a) => a.replace(/[^A-Z]/g, '').length), solved, boardsSolved: solved.filter(Boolean).length,
    checks: g.checks, mistakes: g.mistakes, hintsUsed: g.hintsUsed, won: solved[4],
    answers: only(variant, answers), caption: variant === 'full' && caption ? caption : null,
  };
}

// ── Letter Ladder (ladder) ────────────────────────────────────────────────

export type LadderRungColor = 'start' | 'step' | 'hint' | 'end';

export interface LadderShareRung {
  color: LadderRungColor;
  /** The rung's word; full only. */
  word: string | null;
}

export interface LadderShareModel {
  kind: 'ladder';
  rungs: LadderShareRung[];
  rungCount: number;
  par: number;
  moves: number;
  solved: boolean;
}

export function ladderShareModel(g: { start: string; end: string; words: string[]; hintMask: string; par: number; moves: number }, variant: ShareVariant): LadderShareModel {
  const last = g.words.length - 1;
  const solved = last >= 0 && g.words[last] === g.end;
  const rungs = g.words.map((w, i): LadderShareRung => {
    const color: LadderRungColor = i === 0 ? 'start' : solved && i === last ? 'end' : g.hintMask[i] === '1' ? 'hint' : 'step';
    return { color, word: only(variant, w) };
  });
  return { kind: 'ladder', rungs, rungCount: rungs.length, par: g.par, moves: g.moves, solved };
}

// ── Codebreaker (cryptogram) ──────────────────────────────────────────────

export interface CodebreakerShareModel {
  kind: 'codebreaker';
  /** Letter count per word of the quote, in reading order (punctuation dropped, zero-letter tokens skipped). */
  shape: number[];
  correct: number;
  total: number;
  checks: number;
  solved: boolean;
  /** The quote as displayed; full only. */
  text: string | null;
}

export function codebreakerShape(text: string): number[] {
  return text.split(/\s+/).map((tok) => tok.replace(/[^A-Za-z]/g, '').length).filter((n) => n > 0);
}

export function codebreakerShareModel(g: { text: string; correct: number; total: number; checks: number; solved: boolean }, variant: ShareVariant): CodebreakerShareModel {
  return { kind: 'codebreaker', shape: codebreakerShape(g.text), correct: g.correct, total: g.total, checks: g.checks, solved: g.solved, text: only(variant, g.text) };
}

export type PuzzleShareModel =
  | StarsweepShareModel | SudociousShareModel | CrosswordShareModel | KindredShareModel | SpyglassShareModel
  | HubbubShareModel | MuddleShareModel | LadderShareModel | CodebreakerShareModel;
