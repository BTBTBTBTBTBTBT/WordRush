import { describe, expect, it } from 'vitest';
import {
  SHARE_VARIANT_SUBTITLES, shareVariantCopy, starsweepShareModel, sudociousShareModel, crosswordShareModel, kindredShareModel,
  spyglassShareModel, hubbubShareModel, muddleShareModel, ladderShareModel, codebreakerShareModel, codebreakerShape,
} from './share-spoilers';
import { generateRegions, regionColorSlots } from './games/regions';
import { generateSudoku } from './games/sudoku';
import { wordsearchCells } from './games/wordsearch';

/** The answer strings a clean card must never carry, checked against the model's whole JSON. */
const leaks = (model: unknown, answers: string[]) => {
  const json = JSON.stringify(model);
  return answers.filter((a) => a.length > 0 && json.includes(a));
};

describe('shareVariantCopy', () => {
  it('names the puzzle-game subtitles and keeps the word-game rule for everything else', () => {
    expect(shareVariantCopy('regions')).toEqual({ clean: { title: 'No spoilers', subtitle: 'Regions only' }, full: { title: 'Full results', subtitle: 'Stars revealed' } });
    expect(shareVariantCopy('practice')).toEqual({ clean: { title: 'No spoilers', subtitle: 'Colors only' }, full: { title: 'Full results', subtitle: 'Letters revealed' } });
    expect(shareVariantCopy('nope').clean.subtitle).toBe('Colors only');
    for (const mode of ['regions', 'sudoku', 'crossword', 'groups', 'wordsearch', 'hub', 'scramble', 'ladder', 'cryptogram']) {
      expect(Object.keys(SHARE_VARIANT_SUBTITLES)).toContain(mode);
      const c = shareVariantCopy(mode);
      expect(c.clean.subtitle).not.toBe(c.full.subtitle);
    }
  });
});

describe('Starsweep', () => {
  const p = generateRegions('share-spoilers-regions', 7)!;
  const n = p.n;
  const starCell = (r: number) => r * n + (p.solution.charCodeAt(r) - 48);
  const won = Array.from({ length: n * n }, (_, i) => (Array.from({ length: n }, (_, r) => starCell(r)).includes(i) ? '*' : i % 3 === 0 ? 'x' : '.')).join('');
  it('clean carries regions + colors but no stars or crosses', () => {
    const m = starsweepShareModel({ n, regions: p.regions, solution: p.solution, board: won }, 'clean');
    expect(m).toMatchObject({ kind: 'starsweep', n, regions: p.regions, slots: regionColorSlots(n, p.regions), solved: true, stars: null, crosses: null });
    expect(leaks(m, [won])).toEqual([]);
  });
  it('full lists the star and cross cells', () => {
    const m = starsweepShareModel({ n, regions: p.regions, solution: p.solution, board: won }, 'full');
    expect(m.stars).toEqual(Array.from({ length: n }, (_, r) => starCell(r)).sort((a, b) => a - b));
    expect(m.crosses!.length).toBe([...won].filter((c) => c === 'x').length);
  });
  it('a loss is not solved', () => {
    const lost = won.replace('*', '.');
    expect(starsweepShareModel({ n, regions: p.regions, solution: p.solution, board: lost }, 'full').solved).toBe(false);
  });
});

describe('Sudocious', () => {
  const p = generateSudoku('share-spoilers-sudoku');
  const firstEmpty = p.givens.indexOf('0');
  const board = p.solution;
  const wrongDigit = p.solution[firstEmpty] === '1' ? '2' : '1';
  const lostBoard = board.slice(0, firstEmpty) + wrongDigit + board.slice(firstEmpty + 1);
  it('clean shows givens and a mask only', () => {
    const m = sudociousShareModel({ givens: p.givens, solution: p.solution, board }, 'clean');
    expect(m.board).toBeNull();
    expect(m.solved).toBe(true);
    expect(m.cells).toMatch(/^[gf]{81}$/);
    expect([...m.cells].filter((c) => c === 'g').length).toBe([...p.givens].filter((c) => c !== '0').length);
    expect(leaks(m, [p.solution])).toEqual([]);
    expect(m.givens).toBe(p.givens);
  });
  it('full carries the board; a wrong cell is marked w', () => {
    const m = sudociousShareModel({ givens: p.givens, solution: p.solution, board: lostBoard }, 'full');
    expect(m.board).toBe(lostBoard);
    expect(m.solved).toBe(false);
    expect(m.cells[firstEmpty]).toBe('w');
    const empty = sudociousShareModel({ givens: p.givens, solution: p.solution, board: p.givens }, 'clean');
    expect(empty.cells[firstEmpty]).toBe('.');
  });
});

describe('Crosswordocious', () => {
  const solution = 'CAT.AREA..TEN';
  const fill = 'CAT.AREA..TEX';
  it('clean is a block / filled / wrong mask', () => {
    const m = crosswordShareModel({ w: 13, h: 1, solution, fill }, 'clean');
    expect(m).toEqual({ kind: 'crossword', w: 13, h: 1, cells: '###.####..##x', solved: false, letters: null });
    expect(leaks(m, [solution, fill, 'CAT', 'AREA', 'TEN'])).toEqual([]);
  });
  it('full carries the fill; empties and a solved grid', () => {
    expect(crosswordShareModel({ w: 13, h: 1, solution, fill: solution }, 'full')).toEqual({ kind: 'crossword', w: 13, h: 1, cells: '###.####..###', solved: true, letters: solution });
    expect(crosswordShareModel({ w: 13, h: 1, solution, fill: 'CAT.____..___' }, 'clean').cells).toBe('###.____..___');
  });
});

describe('Kindred', () => {
  const groups = [
    { tier: 1, label: 'Fruit', words: ['APPLE', 'PEAR', 'PLUM', 'FIG'] },
    { tier: 2, label: 'Colors', words: ['RED', 'BLUE', 'TEAL', 'GOLD'] },
    { tier: 3, label: 'Birds', words: ['WREN', 'LARK', 'CROW', 'DOVE'] },
    { tier: 4, label: 'Tools', words: ['SAW', 'AXE', 'FILE', 'RASP'] },
  ];
  const answers = groups.flatMap((g) => [g.label, ...g.words]);
  it('clean is color rows in solved order, unsolved after', () => {
    const m = kindredShareModel({ groups, solvedTiers: [3, 1], mistakes: 2 }, 'clean');
    expect(m.rows.map((r) => [r.tier, r.solved])).toEqual([[3, true], [1, true], [2, false], [4, false]]);
    expect(m.rows.every((r) => r.label === null && r.words === null)).toBe(true);
    expect(m).toMatchObject({ mistakes: 2, solved: false });
    expect(leaks(m, answers)).toEqual([]);
  });
  it('full carries labels and words', () => {
    const m = kindredShareModel({ groups, solvedTiers: [4, 3, 2, 1], mistakes: 0 }, 'full');
    expect(m.solved).toBe(true);
    expect(m.rows[0]).toEqual({ tier: 4, solved: true, label: 'Tools', words: ['SAW', 'AXE', 'FILE', 'RASP'] });
  });
});

describe('Spyglass', () => {
  const n = 4;
  const grid = 'CATSXXXXDOGSXXXX';
  const words = [{ w: 'CATS', r: 0, c: 0, d: 'E' }, { w: 'DOGS', r: 2, c: 0, d: 'E' }, { w: 'CXDX', r: 0, c: 0, d: 'S' }];
  it('clean has strokes without letters', () => {
    const m = spyglassShareModel({ grid, words, found: ['DOGS', 'CATS'] }, 'clean');
    expect(m).toMatchObject({ kind: 'spyglass', n, found: 2, total: 3, solved: false, letters: null });
    expect(m.paths).toEqual([{ cells: wordsearchCells(n, words[1]), word: null }, { cells: wordsearchCells(n, words[0]), word: null }]);
    expect(leaks(m, [grid, 'CATS', 'DOGS', 'CXDX'])).toEqual([]);
  });
  it('full carries the grid and each stroke word; unknown finds are skipped', () => {
    const m = spyglassShareModel({ grid, words, found: ['CATS', 'DOGS', 'CXDX', 'NOPE'] }, 'full');
    expect(m.letters).toBe(grid);
    expect(m.paths.map((p) => p.word)).toEqual(['CATS', 'DOGS', 'CXDX']);
    expect(m.solved).toBe(true);
  });
});

describe('Hubbub', () => {
  const letters = 'ABCDEFG';
  const found = ['DEAF', 'GABDECF', 'BADGE'];
  const base = { letters, found, points: 1 + 14 + 5, max: 40, wordCount: 12, pangramCount: 1 };
  it('clean is rank + counts, no words', () => {
    const m = hubbubShareModel(base, 'clean');
    expect(m).toEqual({ kind: 'hubbub', letters, rank: 6, rankName: 'Hubbub', points: 20, max: 40, found: 3, total: 12, pangrams: 1, pangramTotal: 1, words: null });
    expect(leaks(m, found)).toEqual([]);
  });
  it('full lists the found words', () => {
    expect(hubbubShareModel(base, 'full').words).toEqual(found);
    expect(hubbubShareModel({ ...base, points: 0, found: [] }, 'full')).toMatchObject({ rank: 0, rankName: 'Hush', pangrams: 0, words: [] });
  });
});

describe('Muddle', () => {
  const g = { words: ['TABLE', 'CHAIR', 'STOOLS', 'BENCH'], final: 'SIT DOWN', solved: [true, true, false, true, false], checks: 6, mistakes: 2, hintsUsed: 1 };
  it('clean is lengths + stats, no answer or caption', () => {
    const m = muddleShareModel(g, 'clean', 'Where the family gathers');
    expect(m).toEqual({ kind: 'muddle', lengths: [5, 5, 6, 5, 7], solved: g.solved, boardsSolved: 3, checks: 6, mistakes: 2, hintsUsed: 1, won: false, answers: null, caption: null });
    expect(leaks(m, [...g.words, g.final, 'Where the family gathers'])).toEqual([]);
  });
  it('full carries the answers and the caption', () => {
    const m = muddleShareModel({ ...g, solved: [true, true, true, true, true] }, 'full', 'Where the family gathers');
    expect(m).toMatchObject({ won: true, boardsSolved: 5, answers: ['TABLE', 'CHAIR', 'STOOLS', 'BENCH', 'SIT DOWN'], caption: 'Where the family gathers' });
    expect(muddleShareModel(g, 'full').caption).toBeNull();
  });
});

describe('Letter Ladder', () => {
  const g = { start: 'COLD', end: 'WARM', words: ['COLD', 'CORD', 'CARD', 'WARD', 'WARM'], hintMask: '00100', par: 4, moves: 4 };
  it('clean is colored rungs without words', () => {
    const m = ladderShareModel(g, 'clean');
    expect(m).toEqual({ kind: 'ladder', rungs: [{ color: 'start', word: null }, { color: 'step', word: null }, { color: 'hint', word: null }, { color: 'step', word: null }, { color: 'end', word: null }], rungCount: 5, par: 4, moves: 4, solved: true });
    expect(leaks(m, g.words)).toEqual([]);
  });
  it('full carries the words; an unfinished ladder has no end rung', () => {
    expect(ladderShareModel(g, 'full').rungs.map((r) => r.word)).toEqual(g.words);
    const lost = ladderShareModel({ ...g, words: g.words.slice(0, 3), hintMask: '001', moves: 9 }, 'full');
    expect(lost.solved).toBe(false);
    expect(lost.rungs.map((r) => r.color)).toEqual(['start', 'step', 'hint']);
  });
});

describe('Codebreaker', () => {
  const text = "Don't count the days, make the days count.";
  it('shapes the quote as word letter counts', () => {
    expect(codebreakerShape(text)).toEqual([4, 5, 3, 4, 4, 3, 4, 5]);
    expect(codebreakerShape('  a -- b  ')).toEqual([1, 1]);
  });
  it('clean is the shape only', () => {
    const m = codebreakerShareModel({ text, correct: 30, total: 32, checks: 2, solved: false }, 'clean');
    expect(m).toEqual({ kind: 'codebreaker', shape: [4, 5, 3, 4, 4, 3, 4, 5], correct: 30, total: 32, checks: 2, solved: false, text: null });
    expect(leaks(m, [text, 'count', 'days'])).toEqual([]);
  });
  it('full carries the quote', () => {
    expect(codebreakerShareModel({ text, correct: 32, total: 32, checks: 1, solved: true }, 'full').text).toBe(text);
  });
});
