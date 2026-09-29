import {
  reconstructSudoku, reconstructRegions, reconstructLadder, reconstructHub, reconstructCryptogram, reconstructGroups, reconstructCrossword, reconstructScramble, reconstructWordsearch,
  createHubState, createCrosswordState, createScrambleState, createWordsearchState, hubBoardsSolved, cryptogramCodeLetters, scrambleTarget,
  HUB_TOTAL_BOARDS, CRYPTOGRAM_TOTAL_BOARDS, GROUPS_TOTAL_BOARDS, CROSSWORD_TOTAL_BOARDS, SCRAMBLE_TOTAL_BOARDS, CROSSWORD_BLOCK, CROSSWORD_EMPTY,
  type SudokuState, type RegionsState, type LadderState, type HubState, type HubPuzzle, type CryptogramState, type GroupsGroup,
  type CrosswordState, type CrosswordPuzzle, type ScrambleState, type ScramblePuzzle, type WordsearchState, type WordsearchPuzzle,
} from '@wordle-duel/core';
import type { SolvedDailyRow } from '@/lib/daily-service';
import { rebuildPNRow } from '@/components/propernoundle/reconstruct';
import { normalizeString } from '@/components/propernoundle/game-logic';
import type { Guess } from '@/components/propernoundle/types';

// Founder, 2026-09-28: "make it exact everywhere." When a More Games daily was
// finished on another device, the web card recomputes the score breakdown from
// (completed, guessCount, timeSeconds, boardsSolved, totalBoards, hintsUsed).
// daily_results carries the first three; the last three live only in the
// matches row (solutions + event log + hints_used). Spyglass already rebuilt
// them; this module does it for the other nine titles, deriving EXACTLY the
// inputs each game's own recordGameResult(...) call passed when it finished
// locally, so the card's total equals the recorded composite_score on a loss
// as well as a win. hints_used is preferred over the replayed log (it IS the
// state.hintsUsed the composite was scored with; Crosswordocious' log folds
// every word reveal into one +2, so the two can differ); the log is the
// fallback for rows written before the column was populated.
//
// Where the finished board can be rebuilt cheaply, each helper also returns a
// render-ready state for the game's own board component.

export interface ElsewhereProgress {
  boardsSolved: number;
  totalBoards: number;
  hintsUsed: number;
  /** PROPERNOUNDLE only: most green tiles in any recorded row (near-miss credit on a loss). */
  bestCorrectLetters?: number;
}

/** What daily_results already told us about today's finish. */
export interface ElsewhereDaily {
  seed: string;
  won: boolean;
  /** daily_results.guess_count — Sudocious / Starsweep read mistakes + 1 back out of it. */
  guessCount: number;
}

const hintsFrom = (row: SolvedDailyRow, replayed: number) => (row.hintsUsed > 0 ? row.hintsUsed : replayed);
const ones = (mask: string) => { let n = 0; for (const ch of mask) if (ch === '1') n++; return n; };
const status = (won: boolean): 'won' | 'lost' => (won ? 'won' : 'lost');

// ── Sudocious: boards 1/1, guess_count = mistakes + 1, hints from the row ──
export function sudokuElsewhere(row: SolvedDailyRow, d: ElsewhereDaily): { progress: ElsewhereProgress; state: SudokuState | null } {
  const r = reconstructSudoku(row.solutions, row.guesses);
  const progress = { boardsSolved: d.won ? 1 : 0, totalBoards: 1, hintsUsed: hintsFrom(row, r ? ones(r.hintMask) : 0) };
  if (!r) return { progress, state: null };
  let wrongMask = '';
  for (let i = 0; i < 81; i++) wrongMask += r.board[i] !== '0' && r.board[i] !== r.solution[i] ? '1' : '0';
  const state: SudokuState = {
    seed: d.seed, difficulty: 'medium', givens: r.givens, solution: r.solution, board: r.board, notes: new Array<number>(81).fill(0),
    hintMask: r.hintMask, wrongMask, mistakes: Math.max(0, d.guessCount - 1), hintsUsed: progress.hintsUsed,
    notesMode: false, autoClearNotes: true, status: status(d.won), history: [], startTime: 0, endTime: 0,
  };
  return { progress, state };
}

// ── Starsweep: the Sudocious scoring row ──
export function regionsElsewhere(row: SolvedDailyRow, d: ElsewhereDaily): { progress: ElsewhereProgress; state: RegionsState | null } {
  const r = reconstructRegions(row.solutions, row.guesses);
  const progress = { boardsSolved: d.won ? 1 : 0, totalBoards: 1, hintsUsed: hintsFrom(row, r ? ones(r.hintMask) : 0) };
  if (!r) return { progress, state: null };
  const n = r.n;
  let wrongMask = '';
  for (let i = 0; i < n * n; i++) {
    const isStar = r.solution.charCodeAt(Math.floor(i / n)) - 48 === i % n;
    wrongMask += r.board[i] === '*' && !isStar ? '1' : '0';
  }
  const state: RegionsState = {
    seed: d.seed, n, regions: r.regions, solution: r.solution, board: r.board.replace(/o/g, '.'), hintMask: r.hintMask, wrongMask, autoMask: '0'.repeat(n * n),
    mistakes: Math.max(0, d.guessCount - 1), hintsUsed: progress.hintsUsed, autoCross: true, status: status(d.won), history: [], startTime: 0, endTime: 0,
  };
  return { progress, state };
}

// ── Letter Ladder: boards 1/1; the rungs replay from the event log ──
export function ladderElsewhere(row: SolvedDailyRow, d: ElsewhereDaily, puzzleId = ''): { progress: ElsewhereProgress; state: LadderState | null } {
  const r = reconstructLadder(row.solutions, row.guesses);
  const progress = { boardsSolved: d.won ? 1 : 0, totalBoards: 1, hintsUsed: hintsFrom(row, r?.hintsUsed ?? 0) };
  if (!r) return { progress, state: null };
  const state: LadderState = {
    seed: d.seed, id: puzzleId, start: r.start, end: r.end, par: r.par, path: r.path, words: r.words, hintMask: r.hintMask, moves: r.moves,
    hintsUsed: progress.hintsUsed, events: [...row.guesses], status: status(d.won), reject: null, startTime: 0, endTime: 0,
  };
  return { progress, state };
}

// ── Hubbub: boards = score fraction over 20, from the replayed points ──
export function hubElsewhere(row: SolvedDailyRow, d: ElsewhereDaily, puzzle: HubPuzzle | null): { progress: ElsewhereProgress | null; state: HubState | null } {
  const r = reconstructHub(row.solutions, row.guesses);
  if (!r) return { progress: null, state: null };
  const progress = { boardsSolved: hubBoardsSolved(r.points, r.max), totalBoards: HUB_TOTAL_BOARDS, hintsUsed: hintsFrom(row, r.hintsUsed) };
  if (!puzzle || puzzle.letters !== r.letters) return { progress, state: null };
  const state: HubState = {
    ...createHubState(puzzle, d.seed, 0),
    found: r.found, bonusFound: r.bonusFound, revealed: r.revealed, points: r.points, hintsUsed: progress.hintsUsed,
    events: [...row.guesses], status: status(d.won), ended: true, endTime: 0,
  };
  return { progress, state };
}

// ── Codebreaker: boards 1/1; the cipher, mapping and hinted letters replay ──
export function cryptogramElsewhere(row: SolvedDailyRow, d: ElsewhereDaily): { progress: ElsewhereProgress; state: CryptogramState | null } {
  const r = reconstructCryptogram(row.solutions, row.guesses);
  const progress = { boardsSolved: d.won ? 1 : 0, totalBoards: CRYPTOGRAM_TOTAL_BOARDS, hintsUsed: hintsFrom(row, r?.hinted.length ?? 0) };
  if (!r) return { progress, state: null };
  const state: CryptogramState = {
    seed: d.seed, id: r.id, text: r.text, key: r.key, cipher: r.cipher, given: r.given, mapping: r.mapping,
    locked: [...cryptogramCodeLetters(r.cipher)].sort(), hinted: r.hinted, hintsUsed: progress.hintsUsed, checks: r.checks,
    lastWrong: [], events: [...row.guesses], status: status(d.won), ended: true, startTime: 0, endTime: 0,
  };
  return { progress, state };
}

// ── Kindred: boards = groups found (the loss credit), from the event log ──
export function groupsElsewhere(row: SolvedDailyRow, d: ElsewhereDaily): { progress: ElsewhereProgress; solved: GroupsGroup[]; unsolved: GroupsGroup[] } {
  const r = reconstructGroups(row.solutions, row.guesses);
  if (!r) return { progress: { boardsSolved: d.won ? GROUPS_TOTAL_BOARDS : 0, totalBoards: GROUPS_TOTAL_BOARDS, hintsUsed: row.hintsUsed }, solved: [], unsolved: [] };
  const solved = r.solvedTiers.map((t) => r.groups.find((g) => g.tier === t)).filter((g): g is GroupsGroup => !!g);
  const unsolved = r.groups.filter((g) => !r.solvedTiers.includes(g.tier));
  return { progress: { boardsSolved: r.solvedTiers.length, totalBoards: GROUPS_TOTAL_BOARDS, hintsUsed: hintsFrom(row, r.hintsUsed) }, solved, unsolved };
}

// ── Crosswordocious: boards 1/1; the grid needs the bank puzzle for its clues ──
export function crosswordElsewhere(row: SolvedDailyRow, d: ElsewhereDaily, puzzle: CrosswordPuzzle | null): { progress: ElsewhereProgress; state: CrosswordState | null } {
  const r = reconstructCrossword(row.solutions, row.guesses);
  const progress = { boardsSolved: d.won ? 1 : 0, totalBoards: CROSSWORD_TOTAL_BOARDS, hintsUsed: hintsFrom(row, r?.hintsUsed ?? 0) };
  if (!r || !puzzle) return { progress, state: null };
  const base = createCrosswordState(puzzle, d.seed, 0);
  if (base.solution !== r.solution) return { progress, state: null };
  const locked = [...r.fill].map((ch, i) => (ch === CROSSWORD_BLOCK ? '.' : ch !== CROSSWORD_EMPTY && ch === r.solution[i] ? '1' : '0')).join('');
  const state: CrosswordState = {
    ...base, fill: r.fill, locked, revealed: r.revealed, checks: r.checks, hintsUsed: progress.hintsUsed,
    events: [...row.guesses], status: status(d.won), ended: true, endTime: 0,
  };
  return { progress, state };
}

// ── Muddle: boards = rows solved out of 5, from the event log ──
export function scrambleElsewhere(row: SolvedDailyRow, d: ElsewhereDaily, puzzle: ScramblePuzzle | null): { progress: ElsewhereProgress; state: ScrambleState | null } {
  const r = reconstructScramble(row.solutions, row.guesses);
  if (!r) return { progress: { boardsSolved: d.won ? SCRAMBLE_TOTAL_BOARDS : 0, totalBoards: SCRAMBLE_TOTAL_BOARDS, hintsUsed: row.hintsUsed }, state: null };
  const progress = { boardsSolved: r.boardsSolved, totalBoards: SCRAMBLE_TOTAL_BOARDS, hintsUsed: hintsFrom(row, r.hintsUsed) };
  if (!puzzle || puzzle.words.length !== r.words.length || puzzle.words.some((w, i) => w.answer !== r.words[i]) || puzzle.final.answer !== r.final) return { progress, state: null };
  const base = createScrambleState(puzzle, d.seed, 0);
  const targets = base.solved.map((_, i) => scrambleTarget(base, i));
  const state: ScrambleState = {
    ...base, entries: targets.map((t, i) => (r.solved[i] ? t : '')), solved: r.solved, revealed: targets.map((t, i) => (r.solved[i] ? t : base.revealed[i])),
    checks: r.checks, mistakes: r.mistakes, hintsUsed: progress.hintsUsed, lastRow: null, lastResult: null,
    events: [...row.guesses], status: status(d.won), ended: true, endTime: 0,
  };
  return { progress, state };
}

// ── Spyglass: the day's bank grid with the found words replayed from the log ──
/** A missing row still draws the grid: every word found on a win, none on a loss. */
export function wordsearchElsewhere(row: SolvedDailyRow | null, d: ElsewhereDaily, puzzle: WordsearchPuzzle): WordsearchState {
  const base = createWordsearchState(puzzle, d.seed, 0);
  const r = row ? reconstructWordsearch(row.solutions, row.guesses) : null;
  const listed = new Set(base.words.map((w) => w.w));
  const found = r ? r.found.filter((w) => listed.has(w)) : (d.won ? base.words.map((w) => w.w) : []);
  return {
    ...base, found, misses: r?.misses ?? 0, hintsUsed: r?.hintsUsed ?? row?.hintsUsed ?? 0,
    wordsShown: r?.wordsShown ?? false, lateFinds: r?.lateFinds ?? 0,
    status: status(d.won), endTime: 0,
  };
}

// ── ProperNoundle: boards 1/1 plus the near-miss credit the loss formula reads ──
/** Recorded hint rows: "" (clue), or the answer's length with positional placeholders (vowel / consonant). */
const isPNHintRow = (word: string) => word.length === 0 || /[ _]/.test(word);

export function propernoundleElsewhere(row: SolvedDailyRow, d: ElsewhereDaily): { progress: ElsewhereProgress; rows: Guess[]; answer: string } | null {
  const answer = row.solutions[0];
  if (!answer) return null;
  const rows = row.guesses.map((w) => rebuildPNRow(w, answer));
  // Mirror of the game's own reduce over guesses[].tiles: a vowel/consonant hint
  // row carries its revealed letter as 'correct', exactly as use-hints builds it.
  const bestCorrectLetters = rows.reduce((best, g) => Math.max(best, g.tiles.filter((t) => t === 'correct').length), 0);
  const hintRows = row.guesses.filter(isPNHintRow).length;
  return {
    progress: { boardsSolved: d.won ? 1 : 0, totalBoards: 1, hintsUsed: hintsFrom(row, hintRows), bestCorrectLetters },
    rows,
    answer: normalizeString(answer),
  };
}
