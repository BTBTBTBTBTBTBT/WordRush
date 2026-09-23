import { bankIndexForDay, bankIndexForSeed, bankDayIndex, bankHolidayPick, type HolidayTable } from '../bank';

/**
 * Muddle — the newspaper scramble (More Games §5; catalog id `scramble`). Four
 * scrambled 5/6-letter words; the CIRCLED letters of their answers, in word
 * order, are exactly the letters of a pun that completes the caption under the
 * cartoon. Unscramble the four, then spell the punchline.
 *
 * Play: letters are placed one at a time into the active word (tap a tile or
 * type — either way a letter must still be in that word's tray). When a word
 * is full it checks itself: right → it locks and its circled letters fly to the
 * punchline row; wrong → the row shakes, the letters go back, and a MISTAKE is
 * counted. Every check counts (guess_count = checks, perfect 5 = four words and
 * the punchline); thirteen checks lose. The punchline row opens once all four
 * words are solved and checks the same way. Hints never count as checks:
 * REVEAL_LETTER (1 hint, 75) places the next correct letter, SOLVE_WORD (2
 * hints, 150) fills the word. boards_solved = words solved + punchline (0–5).
 * Event sigils (§11): "i✓WORD" solved, "i✗TRY" wrong, "ih<mask>" letter hint,
 * "iH" word solved by hint — i is 0–3 for the words, 4 for the punchline.
 *
 * Banks (apps/web/data/scramble-puzzles.json) carry { daily, extra, holiday }.
 * `cartoon` is null until the founder's image batch runs; the apps show the
 * bundled placeholder panel and the caption meanwhile.
 *
 * Parity-critical: Scramble.swift / Scramble.kt reproduce this exactly;
 * scramble-fixtures.json pins all three.
 */

export const SCRAMBLE_DAILY_EPOCH = '2026-09-23';
export const SCRAMBLE_MAX_CHECKS = 13;
export const SCRAMBLE_TOTAL_BOARDS = 5;
export const SCRAMBLE_WORDS = 4;
export const SCRAMBLE_FINAL = 4;

export interface ScrambleWord { answer: string; scramble: string; circled: number[] }
export interface ScramblePuzzle {
  id: string;
  words: ScrambleWord[];
  final: { answer: string; pattern: number[] };
  caption: string;
  altText: string;
  cartoon: string | null;
  holiday?: string;
}
export interface ScrambleBank { version: number; epoch: string; daily: ScramblePuzzle[]; extra: ScramblePuzzle[]; holiday?: Record<string, ScramblePuzzle[]> }

export function scramblePuzzleForDay(bank: ScrambleBank, day: string, holidays?: HolidayTable | null): ScramblePuzzle | null {
  const pick = bankHolidayPick(day, holidays, bank.holiday);
  if (pick) return pick.entry;
  if (!bank.daily.length) return null;
  return bank.daily[bankIndexForDay(day, bank.daily.length, bank.epoch)] ?? null;
}
export function scramblePuzzleForSeed(bank: ScrambleBank, seed: string): ScramblePuzzle | null {
  const pool = bank.extra.length ? bank.extra : bank.daily;
  if (!pool.length) return null;
  return pool[bankIndexForSeed(seed, pool.length)] ?? null;
}
export function scrambleDailyNumber(day: string): number {
  const idx = bankDayIndex(day, SCRAMBLE_DAILY_EPOCH);
  return idx === null ? 1 : Math.max(1, idx + 1);
}

/** The punchline's letters, no spaces. */
export function scrambleFinalLetters(p: { final: { answer: string } }): string { return p.final.answer.replace(/[^A-Z]/g, ''); }
/** The punchline tray: the circled letters in word order (what the player spells from). */
export function scrambleFinalTray(p: { words: ScrambleWord[] }): string {
  return p.words.map((w) => w.circled.map((i) => w.answer[i]).join('')).join('');
}
/** Letters of `pool` not yet used by `entry` (multiset difference), in pool order. */
export function scrambleRemaining(pool: string, entry: string): string {
  const left = [...pool];
  for (const ch of entry) { const k = left.indexOf(ch); if (k >= 0) left.splice(k, 1); }
  return left.join('');
}

// ── Reducer ────────────────────────────────────────────────────────────────

export type ScrambleStatus = 'playing' | 'won' | 'lost';
export type ScrambleResult = 'correct' | 'wrong' | null;

export interface ScrambleState {
  seed: string;
  id: string;
  words: ScrambleWord[];
  final: { answer: string; pattern: number[] };
  caption: string;
  /** Letters placed so far in each word (index 0–3) and the punchline (index 4). */
  entries: string[];
  /** Words solved (0–3) and the punchline (4). */
  solved: boolean[];
  /** Positions filled by REVEAL_LETTER per row, as a mask of "_" / letter. */
  revealed: string[];
  checks: number;
  mistakes: number;
  hintsUsed: number;
  /** The row the last check judged and how (for the shake / fly animation). */
  lastRow: number | null;
  lastResult: ScrambleResult;
  events: string[];
  status: ScrambleStatus;
  ended: boolean;
  startTime: number;
  endTime: number | null;
}

export type ScrambleAction =
  | { type: 'TYPE'; row: number; letter: string }
  | { type: 'BACK'; row: number }
  | { type: 'CLEAR'; row: number }
  | { type: 'REVEAL_LETTER'; row: number }
  | { type: 'SOLVE_WORD'; row: number }
  | { type: 'FINISH' };

const blankMask = (n: number) => '_'.repeat(n);

export function createScrambleState(p: ScramblePuzzle, seed: string, startTime: number): ScrambleState {
  const words = p.words.map((w) => ({ answer: w.answer.toUpperCase(), scramble: w.scramble.toUpperCase(), circled: [...w.circled] }));
  const final = { answer: p.final.answer.toUpperCase(), pattern: [...p.final.pattern] };
  return {
    seed, id: p.id, words, final, caption: p.caption,
    entries: ['', '', '', '', ''], solved: [false, false, false, false, false],
    revealed: [...words.map((w) => blankMask(w.answer.length)), blankMask(scrambleFinalLetters({ final }).length)],
    checks: 0, mistakes: 0, hintsUsed: 0, lastRow: null, lastResult: null, events: [], status: 'playing', ended: false, startTime, endTime: null,
  };
}

/** The answer letters for a row (words: the answer; punchline: letters without spaces). */
export function scrambleTarget(s: { words: ScrambleWord[]; final: { answer: string } }, row: number): string {
  return row < SCRAMBLE_FINAL ? s.words[row].answer : scrambleFinalLetters(s);
}
/** The tray a row draws from (words: the scramble; punchline: the circled letters in word order). */
export function scrambleTray(s: { words: ScrambleWord[] }, row: number): string {
  return row < SCRAMBLE_FINAL ? s.words[row].scramble : scrambleFinalTray(s);
}
/** True when the punchline row may be played (all four words solved). */
export function scrambleFinalOpen(s: ScrambleState): boolean { return s.solved.slice(0, SCRAMBLE_FINAL).every(Boolean); }
/** The row the player should be working on: the first unsolved word, then the punchline. */
export function scrambleActiveRow(s: ScrambleState): number | null {
  for (let i = 0; i < SCRAMBLE_FINAL; i++) if (!s.solved[i]) return i;
  return s.solved[SCRAMBLE_FINAL] ? null : SCRAMBLE_FINAL;
}
export function scrambleGuessCount(s: { checks: number; status: ScrambleStatus }): number {
  return s.status === 'lost' ? SCRAMBLE_MAX_CHECKS : Math.max(1, s.checks);
}
export function scrambleBoardsSolved(s: { solved: boolean[] }): number { return s.solved.filter(Boolean).length; }

const rowOk = (s: ScrambleState, row: number) => Number.isInteger(row) && row >= 0 && row <= SCRAMBLE_FINAL && !s.solved[row] && (row < SCRAMBLE_FINAL || scrambleFinalOpen(s));
const setAt = (arr: string[], i: number, v: string) => arr.map((x, k) => (k === i ? v : x));
/** The mask's revealed letters, which a placed entry must keep at their positions. */
const entryWithRevealed = (entry: string, mask: string) => { let out = ''; for (let i = 0; i < mask.length; i++) { if (mask[i] !== '_') out += mask[i]; else if (entry.length > out.length - 0 && i < entry.length) out += entry[i]; } return out; };

function judge(s: ScrambleState, row: number, now: number): ScrambleState {
  const entry = s.entries[row], target = scrambleTarget(s, row);
  if (entry.length !== target.length) return s;
  const checks = s.checks + 1;
  if (entry === target) {
    const solved = s.solved.map((x, i) => (i === row ? true : x));
    const won = solved[SCRAMBLE_FINAL];
    return { ...s, solved, checks, lastRow: row, lastResult: 'correct', events: [...s.events, `${row}✓${target}`], status: won ? 'won' : s.status, ended: won, endTime: won ? now : s.endTime };
  }
  const mistakes = s.mistakes + 1;
  const lost = checks >= SCRAMBLE_MAX_CHECKS;
  // The wrong letters go back to the tray; revealed letters stay.
  const kept = [...s.revealed[row]].filter((ch) => ch !== '_').join('');
  return { ...s, entries: setAt(s.entries, row, lost ? entry : kept), checks, mistakes, lastRow: row, lastResult: 'wrong', events: [...s.events, `${row}✗${entry}`], status: lost ? 'lost' : s.status, ended: lost, endTime: lost ? now : s.endTime };
}

export function scrambleReduce(s: ScrambleState, a: ScrambleAction, now = 0): ScrambleState {
  if (a.type === 'FINISH') return s.status === 'playing' ? s : { ...s, endTime: s.endTime ?? now };
  if (s.ended) return s;

  switch (a.type) {
    case 'TYPE': {
      if (!rowOk(s, a.row)) return s;
      const letter = a.letter.toUpperCase();
      if (!/^[A-Z]$/.test(letter)) return s;
      const entry = s.entries[a.row], target = scrambleTarget(s, a.row);
      if (entry.length >= target.length) return s;
      // The next position may be pinned by a revealed letter; only that letter fits there.
      const mask = s.revealed[a.row];
      const pinned = mask[entry.length];
      if (pinned !== '_' && pinned !== letter) return s;
      if (pinned === '_' && !scrambleRemaining(scrambleTray(s, a.row), entry).includes(letter)) return s;
      return judge({ ...s, entries: setAt(s.entries, a.row, entry + letter), lastRow: null, lastResult: null }, a.row, now);
    }
    case 'BACK': {
      if (!rowOk(s, a.row) || !s.entries[a.row].length) return s;
      const entry = s.entries[a.row], mask = s.revealed[a.row];
      // Step back over pinned (revealed) letters to the last letter the player placed.
      let k = entry.length - 1;
      while (k >= 0 && mask[k] !== '_') k--;
      if (k < 0) return s;
      return { ...s, entries: setAt(s.entries, a.row, entry.slice(0, k)), lastRow: null, lastResult: null };
    }
    case 'CLEAR': {
      if (!rowOk(s, a.row) || !s.entries[a.row].length) return s;
      const kept = [...s.revealed[a.row]].filter((ch) => ch !== '_').join('');
      return { ...s, entries: setAt(s.entries, a.row, kept), lastRow: null, lastResult: null };
    }
    case 'REVEAL_LETTER': {
      if (!rowOk(s, a.row)) return s;
      const target = scrambleTarget(s, a.row), mask = s.revealed[a.row];
      const pos = [...mask].findIndex((ch) => ch === '_');
      if (pos < 0) return s;
      const newMask = mask.slice(0, pos) + target[pos] + mask.slice(pos + 1);
      // Rebuild the entry as the revealed prefix: everything typed after a wrong spot is returned to the tray.
      let entry = '';
      for (let i = 0; i < target.length; i++) { if (newMask[i] !== '_') entry += newMask[i]; else break; }
      const next = { ...s, revealed: setAt(s.revealed, a.row, newMask), entries: setAt(s.entries, a.row, entry), hintsUsed: s.hintsUsed + 1, lastRow: null, lastResult: null, events: [...s.events, `${a.row}h${newMask}`] };
      return judge(next, a.row, now);
    }
    case 'SOLVE_WORD': {
      if (!rowOk(s, a.row)) return s;
      const target = scrambleTarget(s, a.row);
      const solved = s.solved.map((x, i) => (i === a.row ? true : x));
      const won = solved[SCRAMBLE_FINAL];
      return {
        ...s, entries: setAt(s.entries, a.row, target), revealed: setAt(s.revealed, a.row, target), solved, hintsUsed: s.hintsUsed + 2,
        lastRow: a.row, lastResult: 'correct', events: [...s.events, `${a.row}H`], status: won ? 'won' : s.status, ended: won, endTime: won ? now : s.endTime,
      };
    }
    default:
      return s;
  }
}
void entryWithRevealed;

// ── Matches row ↔ state ────────────────────────────────────────────────────

/** solutions = [W1, W2, W3, W4, PUNCHLINE]; guesses = the event log. */
export function scrambleMatchRow(s: ScrambleState): { solutions: string[]; guesses: string[] } {
  return { solutions: [...s.words.map((w) => w.answer), s.final.answer], guesses: [...s.events] };
}

export interface ScrambleReconstruction {
  words: string[]; final: string; solved: boolean[]; checks: number; mistakes: number; hintsUsed: number; solvedByHint: number[]; boardsSolved: number; lost: boolean; won: boolean;
}

export function reconstructScramble(solutions: string[] | null | undefined, guesses: string[] | null | undefined): ScrambleReconstruction | null {
  if (!solutions || solutions.length !== 5) return null;
  const words = solutions.slice(0, 4), final = solutions[4];
  if (!words.every((w) => /^[A-Z]{5,6}$/.test(w)) || !/^[A-Z ]+$/.test(final)) return null;
  const solved = [false, false, false, false, false], solvedByHint: number[] = [];
  let checks = 0, mistakes = 0, hintsUsed = 0;
  for (const ev of guesses ?? []) {
    const row = Number(ev[0]); if (!(row >= 0 && row <= 4)) continue;
    const sig = ev[1];
    if (sig === '✓') { solved[row] = true; checks++; }
    else if (sig === '✗') { checks++; mistakes++; }
    else if (sig === 'h') hintsUsed += 1;
    else if (sig === 'H') { solved[row] = true; hintsUsed += 2; solvedByHint.push(row); }
  }
  const won = solved[4], lost = !won && checks >= SCRAMBLE_MAX_CHECKS;
  return { words, final, solved, checks, mistakes, hintsUsed, solvedByHint, boardsSolved: solved.filter(Boolean).length, lost, won };
}
