import { describe, it, expect } from 'vitest';
import {
  generateSudoku, countSudokuSolutions, sudokuSolvableBySingles, SUDOKU_CLUES,
  createSudokuState, sudokuReduce, sudokuMatchRow, reconstructSudoku, sudokuDifficultyForSeed, sudokuRemaining,
} from './sudoku';

const cells = (s: string) => Array.from(s, (ch) => ch.charCodeAt(0) - 48);
const validGrid = (g: string) => {
  const v = cells(g);
  for (let u = 0; u < 9; u++) {
    const row = new Set<number>(), col = new Set<number>(), box = new Set<number>();
    for (let k = 0; k < 9; k++) {
      row.add(v[u * 9 + k]); col.add(v[k * 9 + u]);
      box.add(v[(Math.floor(u / 3) * 3 + Math.floor(k / 3)) * 9 + (u % 3) * 3 + (k % 3)]);
    }
    if (row.size !== 9 || col.size !== 9 || box.size !== 9) return false;
  }
  return true;
};

describe('Sudoku generator', () => {
  it('is deterministic and produces a valid grid with a unique solution', () => {
    const a = generateSudoku('daily-2026-09-23-SUDOKU');
    const b = generateSudoku('daily-2026-09-23-SUDOKU');
    expect(a).toEqual(b);
    expect(a.difficulty).toBe('medium');
    expect(validGrid(a.solution)).toBe(true);
    expect(a.givens.length).toBe(81);
    for (let i = 0; i < 81; i++) if (a.givens[i] !== '0') expect(a.givens[i]).toBe(a.solution[i]);
    expect(countSudokuSolutions(cells(a.givens), 2)).toBe(1);
    expect(a.clues).toBeLessThanOrEqual(SUDOKU_CLUES.medium + 4);
  });

  it('different seeds give different puzzles', () => {
    expect(generateSudoku('daily-2026-09-23-SUDOKU').givens).not.toBe(generateSudoku('daily-2026-09-24-SUDOKU').givens);
  });

  it('easy solves by singles alone; hard does not', () => {
    for (const seed of ['test', 'unlimited-SUDOKU-1-easy']) {
      const e = generateSudoku(seed, 'easy');
      expect(sudokuSolvableBySingles(cells(e.givens))).toBe(true);
      expect(countSudokuSolutions(cells(e.givens), 2)).toBe(1);
    }
    for (const seed of ['test', 'unlimited-SUDOKU-1-hard']) {
      const h = generateSudoku(seed, 'hard');
      expect(sudokuSolvableBySingles(cells(h.givens))).toBe(false);
      expect(countSudokuSolutions(cells(h.givens), 2)).toBe(1);
      expect(h.clues).toBeLessThanOrEqual(SUDOKU_CLUES.hard + 6);
    }
  });

  it('reads the difficulty off an Unlimited seed and defaults the daily to medium', () => {
    expect(sudokuDifficultyForSeed('unlimited-SUDOKU-17-hard')).toBe('hard');
    expect(sudokuDifficultyForSeed('unlimited-SUDOKU-17-easy')).toBe('easy');
    expect(sudokuDifficultyForSeed('daily-2026-09-23-SUDOKU')).toBe('medium');
  });

  it('a full solution has exactly one solution and a contradiction has none', () => {
    const p = generateSudoku('test');
    expect(countSudokuSolutions(cells(p.solution))).toBe(1);
    const bad = cells(p.givens); bad[0] = bad[1] = 5;
    expect(countSudokuSolutions(bad)).toBe(0);
  });
});

describe('Sudoku reducer', () => {
  const p = generateSudoku('daily-2026-09-23-SUDOKU');
  const empties = Array.from(p.givens).map((c, i) => (c === '0' ? i : -1)).filter((i) => i >= 0);
  const correct = (i: number) => p.solution.charCodeAt(i) - 48;
  const wrong = (i: number) => (correct(i) % 9) + 1;

  it('correct digits fill, wrong digits count, the third wrong ends the game', () => {
    let s = createSudokuState(p, 0);
    s = sudokuReduce(s, { type: 'PLACE', cell: empties[0], digit: correct(empties[0]) });
    expect(s.mistakes).toBe(0); expect(s.board[empties[0]]).toBe(String(correct(empties[0])));
    s = sudokuReduce(s, { type: 'PLACE', cell: empties[1], digit: wrong(empties[1]) });
    expect(s.mistakes).toBe(1); expect(s.wrongMask[empties[1]]).toBe('1');
    s = sudokuReduce(s, { type: 'PLACE', cell: empties[1], digit: correct(empties[1]) });
    expect(s.wrongMask[empties[1]]).toBe('0'); expect(s.mistakes).toBe(1);
    s = sudokuReduce(s, { type: 'PLACE', cell: empties[2], digit: wrong(empties[2]) });
    s = sudokuReduce(s, { type: 'PLACE', cell: empties[3], digit: wrong(empties[3]) }, 777);
    expect(s.status).toBe('lost'); expect(s.mistakes).toBe(3); expect(s.endTime).toBe(777);
    expect(sudokuReduce(s, { type: 'PLACE', cell: empties[4], digit: correct(empties[4]) })).toBe(s);
  });

  it('givens are immutable and no-ops leave the state untouched', () => {
    const s = createSudokuState(p, 0);
    const given = p.givens.split('').findIndex((c) => c !== '0');
    expect(sudokuReduce(s, { type: 'PLACE', cell: given, digit: 1 })).toBe(s);
    expect(sudokuReduce(s, { type: 'ERASE', cell: given })).toBe(s);
    expect(sudokuReduce(s, { type: 'UNDO' })).toBe(s);
    expect(sudokuReduce(s, { type: 'HINT', cell: given }).hintsUsed).toBe(1); // falls through to the first eligible cell
  });

  it('notes: toggled per digit, cleared by a placement, auto-cleared from peers, kept when auto-clear is off', () => {
    let s = createSudokuState(p, 0);
    const [a, b] = empties;
    s = sudokuReduce(s, { type: 'NOTE_TOGGLE', cell: a, digit: 4 });
    s = sudokuReduce(s, { type: 'NOTE_TOGGLE', cell: a, digit: 9 });
    expect(s.notes[a]).toBe((1 << 3) | (1 << 8));
    s = sudokuReduce(s, { type: 'NOTE_TOGGLE', cell: a, digit: 4 });
    expect(s.notes[a]).toBe(1 << 8);
    // Notes mode routes PLACE to NOTE_TOGGLE.
    s = sudokuReduce(s, { type: 'TOGGLE_NOTES' });
    s = sudokuReduce(s, { type: 'PLACE', cell: b, digit: correct(a) });
    expect(s.board[b]).toBe('0'); expect(s.notes[b]).toBe(1 << (correct(a) - 1));
    s = sudokuReduce(s, { type: 'TOGGLE_NOTES' });
    // a and b share a row (first two empties are usually on row 0; if not, the peer rule is simply not exercised here).
    const peersOf = Math.floor(a / 9) === Math.floor(b / 9) || a % 9 === b % 9;
    s = sudokuReduce(s, { type: 'PLACE', cell: a, digit: correct(a) });
    expect(s.notes[a]).toBe(0);
    if (peersOf) expect(s.notes[b]).toBe(0);
    // Auto-clear off: a placement leaves peer notes alone.
    let t = createSudokuState(p, 0);
    t = sudokuReduce(t, { type: 'SET_AUTO_CLEAR', value: false });
    t = sudokuReduce(t, { type: 'NOTE_TOGGLE', cell: b, digit: correct(a) });
    t = sudokuReduce(t, { type: 'PLACE', cell: a, digit: correct(a) });
    expect(t.notes[b]).toBe(1 << (correct(a) - 1));
  });

  it('undo restores the board and notes but never refunds a mistake or a hint', () => {
    let s = createSudokuState(p, 0);
    s = sudokuReduce(s, { type: 'PLACE', cell: empties[0], digit: wrong(empties[0]) });
    s = sudokuReduce(s, { type: 'HINT', cell: empties[1] });
    expect(s.hintsUsed).toBe(1); expect(s.hintMask[empties[1]]).toBe('1');
    s = sudokuReduce(s, { type: 'UNDO' });
    expect(s.board[empties[1]]).toBe('0'); expect(s.hintMask[empties[1]]).toBe('0'); expect(s.hintsUsed).toBe(1);
    s = sudokuReduce(s, { type: 'UNDO' });
    expect(s.board).toBe(p.givens); expect(s.mistakes).toBe(1);
    expect(s.history).toEqual([]);
  });

  it('filling every cell wins, clears history, and round-trips through the matches row', () => {
    let s = createSudokuState(p, 0);
    for (const i of empties) s = sudokuReduce(s, { type: 'PLACE', cell: i, digit: correct(i) }, 555);
    expect(s.status).toBe('won'); expect(s.endTime).toBe(555); expect(sudokuRemaining(s)).toBe(0);
    const row = sudokuMatchRow(s);
    expect(row.solutions).toEqual([p.solution, p.givens]);
    expect(row.guesses[0]).toBe(p.solution);
    const r = reconstructSudoku(row.solutions, row.guesses);
    expect(r?.solved).toBe(true);
    expect(reconstructSudoku(['x'], [])).toBeNull();
    expect(reconstructSudoku([p.solution, p.givens], null)?.board).toBe(p.givens);
  });
});
