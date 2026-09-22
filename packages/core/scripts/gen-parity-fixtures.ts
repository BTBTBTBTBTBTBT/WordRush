// Regenerates the cross-platform ENGINE PARITY fixtures (seed-fixtures.json,
// prefill-fixtures.json) from the TS core — the source of truth — using the
// canonical word lists in apps/web/data. The Swift (EngineParityTests) and
// Kotlin (SeedFixtureTest/PrefillFixtureTest) ports assert byte-identical
// output against these files.
//
// WHY THIS EXISTS (2026-07-24): these fixtures were hand-generated once in
// Phase 0 and never regenerated, so the word-list curation silently made them
// stale — every platform's engine agreed with each other (QUEST) while the
// fixture still said the pre-curation word (SENNA). Undated seeds resolve to
// the CURATED pool by design (date-gate: only pre-cutover daily dates pin the
// legacy list), so any curation changes undated-seed outputs and requires a
// regen. packages/core/src/parity-fixtures.test.ts fails when this file's
// output drifts from the committed fixtures.
//
//   Regenerate:  apps/server/node_modules/.bin/tsx packages/core/scripts/gen-parity-fixtures.ts
//   Check only:  … gen-parity-fixtures.ts --check   (exit 1 + path on drift)
//
// daily-seed-fixtures.json is intentionally NOT generated here: its cases are
// dated (legacy-pinned or curated-stable) and don't drift with curation.

import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDictionary, initDictionaryForLength, getSolutionPoolForDate, _setTodayForTests } from '../src/dictionary';
import { generateSolutionsFromSeed, generateSolutionsFromSeedForLength } from '../src/seed';
import { generatePrefillWords, generatePrefillGuesses } from '../src/prefill';
import { bankIndexForDay, bankIndexForSeed, bankDayIndex } from '../src/bank';
import { generateRegions, createRegionsState, regionsReduce, regionsMatchRow, reconstructRegions, countRegionsSolutions, regionsSizeForDay, regionsRuledOut, type RegionsAction } from '../src/games/regions';
import { generateSudoku, createSudokuState, sudokuReduce, sudokuMatchRow, reconstructSudoku, countSudokuSolutions, sudokuSolvableBySingles, type SudokuAction, type SudokuDifficulty } from '../src/games/sudoku';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const load = (n: string): string[] =>
  JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', `${n}.json`), 'utf8'));

const allowed = load('allowed');
initDictionary(allowed, load('solutions'), load('solutions-legacy'));
initDictionaryForLength(6, load('allowed-6'), load('solutions-6'), load('solutions-6-legacy'));
initDictionaryForLength(7, load('allowed-7'), load('solutions-7'), load('solutions-7-legacy'));

// §222: undated seeds resolve their pool from wall-clock "today". Pin it
// post-growth so the fixtures mean the same thing before and after the
// cutover day — the Swift/Kotlin parity tests pin the identical date.
_setTodayForTests('2026-09-01');

// Case INPUTS are the contract with the Swift/Kotlin tests — keep in lockstep
// with EngineParityTests.swift / SeedFixtureTest.kt / PrefillFixtureTest.kt.
const SEED_CASES = {
  standard: [
    ['test', 1], ['test', 4], ['test', 8],
    ['daily-2026-01-15-DUEL', 1], ['daily-2026-01-15-QUORDLE', 4],
    ['daily-2026-01-15-OCTORDLE', 8], ['daily-2026-01-15-SEQUENCE', 4],
    ['daily-2026-01-15-RESCUE', 4],
    ['daily-2026-08-01-DUEL', 1], ['daily-2026-08-01-QUORDLE', 4],
    ['daily-2026-08-01-OCTORDLE', 8],
    ['gauntlet-abc-123', 21], ['match-seed-xyz', 1], ['match-seed-xyz', 2],
    // Post-DECK_CUTOVER_DATE dailies exercise the §215 deck path (epoch 0 on
    // the cutover day, epoch 1 at 2026-10-15, and the epoch-0 boundary day
    // 2026-10-02); the suffixed + wrong-count cases pin the hash fallback.
    ['daily-2026-08-24-DUEL', 1], ['daily-2026-08-24-QUORDLE', 4],
    ['daily-2026-08-24-OCTORDLE', 8], ['daily-2026-08-24-SEQUENCE', 4],
    ['daily-2026-08-24-RESCUE', 4], ['daily-2026-08-24-GAUNTLET', 21],
    ['daily-2026-08-24-DUEL_VS', 1],
    ['daily-2026-10-02-OCTORDLE', 8], ['daily-2026-10-15-DUEL', 1],
    ['daily-2026-10-15-GAUNTLET', 21],
    ['daily-2026-08-24-GAUNTLET-blackout-1', 1], ['daily-2026-08-24-DUEL', 2],
  ],
  sixLetter: [
    ['test', 1], ['daily-2026-01-15-DUEL_6', 1], ['match-6-abc', 1], ['daily-2026-08-01-DUEL_6', 1],
    ['daily-2026-08-24-DUEL_6', 1], ['daily-2026-10-15-DUEL_6', 1],
  ],
  sevenLetter: [
    ['test', 1], ['daily-2026-01-15-DUEL_7', 1], ['match-7-abc', 1], ['daily-2026-08-01-DUEL_7', 1],
    ['daily-2026-08-24-DUEL_7', 1], ['daily-2026-10-15-DUEL_7', 1],
  ],
} as const;

const PREFILL_CASES: Array<[string, number]> = [['test', 4], ['daily-2026-01-15-RESCUE', 4]];

export function renderSeedFixtures() {
  return {
    standard: SEED_CASES.standard.map(([seed, count]) => ({
      seed, count, solutions: generateSolutionsFromSeed(seed, count),
    })),
    sixLetter: SEED_CASES.sixLetter.map(([seed, count]) => ({
      seed, count, solutions: generateSolutionsFromSeedForLength(seed, count, 6),
    })),
    sevenLetter: SEED_CASES.sevenLetter.map(([seed, count]) => ({
      seed, count, solutions: generateSolutionsFromSeedForLength(seed, count, 7),
    })),
  };
}

// More Games §11: epoch-indexed banks. Cases cover the epoch day, mid-bank, the
// last unplayed entry, past-the-end and pre-epoch fallbacks, an unparseable
// day, and seed indexing with and without an avoided entry.
const BANK_EPOCH = '2026-10-05';
const BANK_DAY_CASES: Array<[string, number]> = [
  ['2026-10-05', 400], ['2026-10-06', 400], ['2027-02-13', 400], ['2027-11-08', 400], ['2027-11-09', 400],
  ['2028-05-01', 400], ['2026-10-04', 400], ['2026-01-01', 400], ['not-a-day', 400], ['2026-12-25', 1], ['2026-12-25', 0],
];
const BANK_SEED_CASES: Array<[string, number, number | undefined]> = [
  ['unlimited-SUDOKU-1727000000000', 400, undefined], ['unlimited-SCRAMBLE-1727000000001', 120, undefined],
  ['unlimited-HUB-42', 800, undefined], ['unlimited-GROUPS-7', 1, undefined], ['unlimited-REGIONS-9', 0, undefined],
  ['unlimited-LADDER-1', 1000, undefined], ['avoid-me', 5, undefined], ['avoid-me', 5, 3], ['avoid-me', 5, 4], ['avoid-me', 1, 0],
];
export function renderBankFixtures() {
  return {
    epoch: BANK_EPOCH,
    days: BANK_DAY_CASES.map(([day, n]) => ({ day, n, dayIndex: bankDayIndex(day, BANK_EPOCH), index: bankIndexForDay(day, n, BANK_EPOCH) })),
    seeds: BANK_SEED_CASES.map(([seed, n, avoid]) => ({ seed, n, avoid: avoid ?? null, index: bankIndexForSeed(seed, n, avoid) })),
  };
}

export function renderPrefillFixtures() {
  // The pool MUST match what the reducers actually pass in production: the
  // curated solutions bank, NOT the allowed guess list. The fixtures were
  // generated with `allowed` for a while — which meant they certified a
  // configuration no platform runs, and the first-ever growth of the
  // 5-letter allowed list (ANTSY et al.) broke them while real prefill
  // boards were untouched. Solutions-bank prefill is also what makes
  // dictionary growth gameplay-safe: pool changes only on a deliberate
  // solutions curation, never on a guess-word addition.
  const pool = getSolutionPoolForDate(null);
  return PREFILL_CASES.map(([seed, count]) => {
    const solutions = generateSolutionsFromSeed(seed, count);
    const prefillWords = generatePrefillWords(seed, solutions, pool);
    return {
      seed,
      solutions,
      prefillWords,
      boardPrefills: solutions.map((solution) => ({
        solution,
        prefillGuesses: generatePrefillGuesses(prefillWords, solution),
      })),
    };
  });
}

// More Games §4: Sudoku. Generation cases pin seed → givens/solution (and the
// re-roll count, so a gate change is visible); reducer scripts replay CONCRETE
// actions computed here from the puzzle (first empty cells, a digit known to
// be wrong) and pin the resulting board/notes/masks/mistakes/status; the
// reconstruction cases pin the matches-row round trip.
const SUDOKU_GEN_CASES: Array<[string, SudokuDifficulty]> = [
  ['daily-2026-09-23-SUDOKU', 'medium'], ['daily-2026-10-05-SUDOKU', 'medium'], ['daily-2027-01-01-SUDOKU', 'medium'],
  ['unlimited-SUDOKU-1727000000000-easy', 'easy'], ['unlimited-SUDOKU-1727000000000-hard', 'hard'],
  ['test', 'easy'], ['test', 'medium'], ['test', 'hard'],
];
export function renderSudokuFixtures() {
  const generation = SUDOKU_GEN_CASES.map(([seed, difficulty]) => {
    const p = generateSudoku(seed, difficulty);
    const givens = Array.from(p.givens, (ch) => ch.charCodeAt(0) - 48);
    return { ...p, unique: countSudokuSolutions(givens, 2) === 1, singles: sudokuSolvableBySingles(givens) };
  });
  const base = generateSudoku('daily-2026-09-23-SUDOKU', 'medium');
  const empties: number[] = [];
  for (let i = 0; i < 81; i++) if (base.givens[i] === '0') empties.push(i);
  const correct = (i: number) => base.solution.charCodeAt(i) - 48;
  const wrong = (i: number) => (correct(i) % 9) + 1;
  const givenCell = base.givens.indexOf(base.givens.split('').find((c) => c !== '0') as string);
  const [e0, e1, e2, e3, e4] = empties;
  const scripts: Array<{ name: string; actions: SudokuAction[] }> = [
    { name: 'mixed', actions: [
      { type: 'PLACE', cell: e0, digit: correct(e0) }, { type: 'PLACE', cell: e1, digit: wrong(e1) },
      { type: 'NOTE_TOGGLE', cell: e2, digit: 5 }, { type: 'NOTE_TOGGLE', cell: e2, digit: 7 }, { type: 'NOTE_TOGGLE', cell: e3, digit: correct(e4) },
      { type: 'TOGGLE_NOTES' }, { type: 'PLACE', cell: e3, digit: 3 }, { type: 'TOGGLE_NOTES' },
      { type: 'HINT', cell: e2 }, { type: 'UNDO' }, { type: 'ERASE', cell: e1 },
      { type: 'PLACE', cell: e4, digit: correct(e4) }, { type: 'HINT' },
    ] },
    { name: 'loss', actions: [
      { type: 'PLACE', cell: e0, digit: wrong(e0) }, { type: 'PLACE', cell: e0, digit: correct(e0) },
      { type: 'PLACE', cell: e1, digit: wrong(e1) }, { type: 'PLACE', cell: e2, digit: wrong(e2) },
      { type: 'PLACE', cell: e3, digit: correct(e3) },
    ] },
    { name: 'win', actions: empties.map((i): SudokuAction => ({ type: 'PLACE', cell: i, digit: correct(i) })) },
    { name: 'noops', actions: [
      { type: 'PLACE', cell: givenCell, digit: 1 }, { type: 'UNDO' }, { type: 'ERASE', cell: e0 }, { type: 'NOTE_TOGGLE', cell: givenCell, digit: 2 },
      { type: 'SET_AUTO_CLEAR', value: false }, { type: 'NOTE_TOGGLE', cell: e1, digit: correct(e0) },
      { type: 'PLACE', cell: e0, digit: correct(e0) }, { type: 'PLACE', cell: e0, digit: correct(e0) }, { type: 'HINT', cell: givenCell },
    ] },
  ];
  const reducer = scripts.map((sc) => {
    let s = createSudokuState(base, 0);
    for (const a of sc.actions) s = sudokuReduce(s, a, 1000);
    const row = sudokuMatchRow(s);
    return {
      name: sc.name, seed: base.seed, difficulty: base.difficulty, actions: sc.actions,
      expect: { board: s.board, notes: s.notes, hintMask: s.hintMask, wrongMask: s.wrongMask, mistakes: s.mistakes, hintsUsed: s.hintsUsed, status: s.status, notesMode: s.notesMode, historyLength: s.history.length, endTime: s.endTime },
      row, reconstruct: reconstructSudoku(row.solutions, row.guesses),
    };
  });
  return { generation, reducer, malformed: reconstructSudoku(['nope'], []) };
}

// More Games §18b: Starsweep (regions). Generation cases pin seed+size →
// regions/solution/sizes/rerolls (the Phase 0 sample seeds included, so the
// port is provably the same generator); reducer scripts replay concrete taps.
const REGIONS_GEN_CASES: Array<[string, number]> = [
  ['daily-2026-10-01-REGIONS', 7], ['daily-2026-10-02-REGIONS', 7], ['daily-2026-10-03-REGIONS', 8],
  ['daily-2026-10-04-REGIONS', 8], ['daily-2026-10-05-REGIONS', 8], ['unlimited-REGIONS-1-hard', 9],
  ['daily-2026-09-23-REGIONS', regionsSizeForDay('daily-2026-09-23-REGIONS'.slice(6, 16))], ['test', 7], ['test', 8], ['test', 9],
];
export function renderRegionsFixtures() {
  const generation = REGIONS_GEN_CASES.map(([seed, n]) => {
    const p = generateRegions(seed, n)!;
    const reg = Array.from(p.regions, (ch) => ch.charCodeAt(0) - 48);
    return { ...p, unique: countRegionsSolutions(n, reg, 2) === 1 };
  });
  const base = generateRegions('daily-2026-10-03-REGIONS', 8)!;
  const n = base.n;
  const star = (r: number) => r * n + (base.solution.charCodeAt(r) - 48);
  // A cell that is NOT a star in row 1 and not adjacent to row 0/1 stars: pick the first such column.
  const wrongIn = (r: number) => { for (let c = 0; c < n; c++) { const i = r * n + c; if (i !== star(r)) return i; } return -1; };
  const scripts: Array<{ name: string; actions: RegionsAction[] }> = [
    { name: 'mixed', actions: [
      { type: 'TAP', cell: star(0) }, { type: 'TAP', cell: star(0) },                 // cross then star (correct, auto-cross)
      { type: 'TAP', cell: wrongIn(3) }, { type: 'TAP', cell: wrongIn(3) },           // wrong star → mistake
      { type: 'TAP', cell: wrongIn(3) },                                            // clear it (mistake stands)
      { type: 'HINT', cell: star(5) }, { type: 'UNDO' }, { type: 'HINT' },        // hint row 5, undo, hint first missing row
      { type: 'TAP', cell: star(0) },                                              // clearing a placed star
      { type: 'ERASE', cell: 1 }, { type: 'SET_AUTO_CROSS', value: false }, { type: 'TAP', cell: star(7) }, { type: 'TAP', cell: star(7) },
    ] },
    { name: 'loss', actions: [
      { type: 'TAP', cell: wrongIn(0) }, { type: 'TAP', cell: wrongIn(0) },
      { type: 'TAP', cell: wrongIn(2) }, { type: 'TAP', cell: wrongIn(2) },
      { type: 'TAP', cell: wrongIn(4) }, { type: 'TAP', cell: wrongIn(4) },
      { type: 'TAP', cell: star(6) },
    ] },
    { name: 'win', actions: Array.from({ length: n }, (_, r): RegionsAction[] => [{ type: 'TAP', cell: star(r) }, { type: 'TAP', cell: star(r) }]).flat() },
    { name: 'noops', actions: [
      { type: 'UNDO' }, { type: 'ERASE', cell: 0 }, { type: 'TAP', cell: 99 }, { type: 'HINT', cell: 0 }, { type: 'TAP', cell: star(0) }, { type: 'ERASE', cell: star(0) },
    ] },
  ];
  const reducer = scripts.map((sc) => {
    let s = createRegionsState(base, 0);
    for (const a of sc.actions) s = regionsReduce(s, a, 1000);
    const row = regionsMatchRow(s);
    return {
      name: sc.name, seed: base.seed, n, actions: sc.actions,
      expect: { board: s.board, hintMask: s.hintMask, wrongMask: s.wrongMask, mistakes: s.mistakes, hintsUsed: s.hintsUsed, status: s.status, autoCross: s.autoCross, historyLength: s.history.length, endTime: s.endTime },
      row, reconstruct: reconstructRegions(row.solutions, row.guesses),
    };
  });
  const ruledOut = [0, 9, 27, 63].map((cell) => ({ cell, cells: regionsRuledOut(n, base.regions, cell) }));
  const sizes = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', 'nope'].map((day) => ({ day, n: regionsSizeForDay(day) }));
  return { generation, reducer, ruledOut, sizes, malformed: reconstructRegions(['nope'], []) };
}

// Same fixture dirs the composite-scoring generator writes (web has no copy of
// these two — they exist for the native ports).
const TARGET_DIRS = [
  join(repo, 'apps', 'ios', 'Tests', 'Fixtures'),
  join(repo, 'apps', 'android', 'core', 'src', 'test', 'resources', 'fixtures'),
];

const FILES: Array<[string, unknown]> = [
  ['seed-fixtures.json', renderSeedFixtures()],
  ['prefill-fixtures.json', renderPrefillFixtures()],
  ['bank-fixtures.json', renderBankFixtures()],
  ['sudoku-fixtures.json', renderSudokuFixtures()],
  ['regions-fixtures.json', renderRegionsFixtures()],
];

// Only write/check when executed directly — parity-fixtures.test.ts imports
// the render functions and must never trigger a rewrite from inside vitest.
const isMain = process.argv[1]?.endsWith('gen-parity-fixtures.ts') ?? false;
if (isMain) {
  const checkOnly = process.argv.includes('--check');
  let drift = false;
  for (const [name, value] of FILES) {
    const rendered = JSON.stringify(value, null, 2) + '\n';
    for (const dir of TARGET_DIRS) {
      const target = join(dir, name);
      const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
      if (current !== rendered) {
        drift = true;
        if (checkOnly) {
          console.error(`STALE: ${target} — regenerate with gen-parity-fixtures.ts`);
        } else {
          fs.writeFileSync(target, rendered);
          console.log(`wrote ${target}`);
        }
      }
    }
  }
  if (checkOnly) {
    console.log(drift ? 'parity fixtures STALE' : 'parity fixtures up to date');
    process.exit(drift ? 1 : 0);
  }
  if (!drift) console.log('parity fixtures already up to date');
}
