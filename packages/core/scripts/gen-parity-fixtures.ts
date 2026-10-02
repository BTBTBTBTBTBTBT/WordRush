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
import { bankIndexForDay, bankIndexForSeed, bankDayIndex, holidayKeyForDay, holidayOccurrence, bankHolidayPick, type HolidayTable } from '../src/bank';
import { scramblePuzzleForDay, scramblePuzzleForSeed, scrambleDailyNumber, scrambleFinalLetters, scrambleFinalTray, scrambleRemaining, scrambleTarget, createScrambleState, scrambleReduce, scrambleMatchRow, reconstructScramble, scrambleGuessCount, scrambleBoardsSolved, scrambleActiveRow, scrambleFinalOpen, type ScrambleBank, type ScrambleAction } from '../src/games/scramble';
import { crosswordPuzzleForDay, crosswordPuzzleForSeed, crosswordDailyNumber, crosswordSolution, crosswordEntryCells, createCrosswordState, crosswordReduce, crosswordMatchRow, reconstructCrossword, crosswordGuessCount, crosswordCorrectCount, crosswordLetterCount, type CrosswordBank, type CrosswordAction } from '../src/games/crossword';
import { groupsPuzzleForDay, groupsPuzzleForSeed, groupsDailyNumber, groupsTileOrder, createGroupsState, groupsReduce, groupsMatchRow, reconstructGroups, groupsGuessCount, groupsBoardsSolved, groupsLabelTarget, groupsPairTarget, type GroupsBank, type GroupsAction } from '../src/games/groups';
import { cryptogramPuzzleForDay, cryptogramPuzzleForSeed, cryptogramDailyNumber, cryptogramEncipher, cryptogramCodeLetters, cryptogramFrequencies, cryptogramHintTarget, cryptogramGuessCount, cryptogramConflicts, cryptogramCorrectCount, createCryptogramState, cryptogramReduce, cryptogramMatchRow, reconstructCryptogram, type CryptogramBank, type CryptogramAction } from '../src/games/cryptogram';
import { generateRegions, createRegionsState, regionsReduce, regionsMatchRow, reconstructRegions, countRegionsSolutions, regionsSizeForDay, regionsRuledOut, type RegionsAction } from '../src/games/regions';
import { generateSudoku, createSudokuState, sudokuReduce, sudokuMatchRow, reconstructSudoku, countSudokuSolutions, sudokuSolvableBySingles, type SudokuAction, type SudokuDifficulty } from '../src/games/sudoku';
import { ladderPuzzleForDay, ladderPuzzleForSeed, ladderDailyNumber, createLadderState, ladderReduce, ladderMatchRow, reconstructLadder, ladderNextStep, ladderNeighbours, ladderGuessCount, type LadderBank, type LadderAction } from '../src/games/ladder';
import { wordsearchPuzzleForDay, wordsearchPuzzleForSeed, wordsearchDailyNumber, createWordsearchState, wordsearchReduce, wordsearchMatchRow, reconstructWordsearch, wordsearchCells, wordsearchLine, wordsearchNearWord, type WordsearchBank, type WordsearchAction } from '../src/games/wordsearch';
import { bannerHeadline, bannerClockLine, groupStatus, groupTier, dayStreaks, dayRunTotals, type GroupProgress } from '../src/home-banner';
import { newFriendlyState, applyFriendlyMove, friendlyCardLine, friendlyHeadline, friendlyWinner, whoseTurn, tttLine, presenceLine, isOnline, friendStreak, friendsBannerHeadline, friendsBannerClockLine, type FriendlyState, type FriendsBannerInput } from '../src/friendly-games';
import { leaderboardTitle } from '../src/leaderboard-title';
import { AVATAR_BACKDROPS, AVATAR_COLORS, castPreset, defaultAvatar, enforceAvatarPro, nearestAvatarColor, validateAvatar } from '../src/avatar-config';
import { PUSH_COPY, PUSH_TITLE, pushCopy, type PushKind } from '../src/push-copy';
import { currentSeason, levelTier, levelTierLabel } from '../src/level-season';
import { SHARE_CAPTIONS, SHARE_TOASTS, captionHash, shareCaption, shareCaptionIndex, type ShareCaptionKind } from '../src/share-captions';
import { BOT_CAST, botSolveLine, canonicalBotId, migrateLegacyLadderCleared, botOfTheDay } from '../src/bot-cast';
import { vsBannerHeadline, vsBannerClockLine, vsTodayStatus, vsRecordLine, vsOutcome, vsMargin, challengeHeadline, ladderAfterGame, ladderRungs, type VsBannerInput, type VsDayResult, type VsRun } from '../src/vs-lobby';
import { hubPuzzleForDay, hubPuzzleForSeed, hubDailyNumber, createHubState, hubReduce, hubMatchRow, reconstructHub, hubRankIndex, hubRankThreshold, hubWordScore, hubBoardsSolved, hubGuessCount, type HubBank, type HubAction } from '../src/games/hub';

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
  // Holidays (§20): the shared calendar is data; these cases pin key lookup, the
  // occurrence count (k-th outing) and the pick into a 3-entry holiday list.
  const table = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'holiday-days.json'), 'utf8')) as HolidayTable;
  const three = { christmas: ['c0', 'c1', 'c2'], halloween: ['h0', 'h1', 'h2'], mlkday: ['m0', 'm1', 'm2'] };
  const holidayDays = ['2026-09-23', '2026-12-24', '2026-12-25', '2026-12-26', '2027-12-25', '2028-12-26', '2026-10-30', '2026-10-31', '2027-10-31', '2026-01-19', '2027-01-18', '2026-07-04', '2030-12-31', '2031-01-01', 'nope']
    .map((day) => { const pick = bankHolidayPick(day, table, three); return { day, key: holidayKeyForDay(day, table), occurrence: holidayKeyForDay(day, table) ? holidayOccurrence(day, holidayKeyForDay(day, table)!, table) : 0, pick: pick ? { key: pick.key, index: pick.index, entry: pick.entry } : null }; });
  return {
    epoch: BANK_EPOCH,
    days: BANK_DAY_CASES.map(([day, n]) => ({ day, n, dayIndex: bankDayIndex(day, BANK_EPOCH), index: bankIndexForDay(day, n, BANK_EPOCH) })),
    seeds: BANK_SEED_CASES.map(([seed, n, avoid]) => ({ seed, n, avoid: avoid ?? null, index: bankIndexForSeed(seed, n, avoid) })),
    holidayTable: { version: table.version, from: table.from, to: table.to, dayCount: Object.keys(table.days).length },
    holidayDays,
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
      // Tap = black star, COMMIT (double tap) = play it, tap black = ×, tap × = clear (founder, 2026-09-28 afternoon).
      { type: 'TAP', cell: star(0) }, { type: 'COMMIT', cell: star(0) },          // black → purple (auto-cross)
      { type: 'TAP', cell: wrongIn(3) },                                           // black star, crosses drawn
      { type: 'COMMIT', cell: wrongIn(3) },                                        // red → mistake, its crosses go
      { type: 'TAP', cell: wrongIn(3) },                                           // → × (mistake stands)
      { type: 'TAP', cell: wrongIn(3) },                                           // → clear
      { type: 'TAP', cell: wrongIn(5) }, { type: 'TAP', cell: wrongIn(5) },        // black → × (crosses lift)
      { type: 'TAP', cell: star(2) }, { type: 'ERASE', cell: star(2) },            // black star erased with its crosses
      { type: 'HINT', cell: star(5) }, { type: 'UNDO' }, { type: 'HINT' },        // hint row 5, undo, hint first missing row
      { type: 'TAP', cell: star(0) }, { type: 'TAP', cell: star(0) },              // purple star → × → clear
      { type: 'ERASE', cell: 1 }, { type: 'SET_AUTO_CROSS', value: false }, { type: 'TAP', cell: star(7) },
      { type: 'COMMIT', cell: star(6) },                                           // play from empty, no auto-cross
    ] },
    { name: 'loss', actions: [
      { type: 'TAP', cell: star(1) },                                              // a black star left on the board
      { type: 'COMMIT', cell: wrongIn(0) },
      { type: 'TAP', cell: wrongIn(2) }, { type: 'COMMIT', cell: wrongIn(2) },
      { type: 'COMMIT', cell: wrongIn(4) },
      { type: 'COMMIT', cell: star(6) },
    ] },
    { name: 'win', actions: Array.from({ length: n }, (_, r): RegionsAction => ({ type: 'COMMIT', cell: star(r) })) },
    { name: 'win-with-red', actions: [{ type: 'COMMIT', cell: wrongIn(2) } as RegionsAction, ...Array.from({ length: n }, (_, r): RegionsAction => ({ type: 'COMMIT', cell: star(r) }))] },
    { name: 'noops', actions: [
      { type: 'UNDO' }, { type: 'ERASE', cell: 0 }, { type: 'TAP', cell: 99 }, { type: 'COMMIT', cell: 99 }, { type: 'HINT', cell: 0 }, { type: 'TAP', cell: star(0) }, { type: 'COMMIT', cell: star(0) }, { type: 'ERASE', cell: star(0) },
    ] },
  ];
  const reducer = scripts.map((sc) => {
    let s = createRegionsState(base, 0);
    for (const a of sc.actions) s = regionsReduce(s, a, 1000);
    const row = regionsMatchRow(s);
    return {
      name: sc.name, seed: base.seed, n, actions: sc.actions,
      expect: { board: s.board, hintMask: s.hintMask, wrongMask: s.wrongMask, autoMask: s.autoMask, mistakes: s.mistakes, hintsUsed: s.hintsUsed, status: s.status, autoCross: s.autoCross, historyLength: s.history.length, endTime: s.endTime },
      row, reconstruct: reconstructRegions(row.solutions, row.guesses),
    };
  });
  const ruledOut = [0, 9, 27, 63].map((cell) => ({ cell, cells: regionsRuledOut(n, base.regions, cell) }));
  const sizes = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', 'nope'].map((day) => ({ day, n: regionsSizeForDay(day) }));
  return { generation, reducer, ruledOut, sizes, malformed: reconstructRegions(['nope'], []) };
}

// Same fixture dirs the composite-scoring generator writes (web has no copy of
// these two — they exist for the native ports).
// Home redesign (founder, 2026-10-01): the banner's words and streak runs, so
// iOS and Android print exactly what the web prints.
export function renderHomeBannerFixtures() {
  const g = (played: number, won: number, total: number): GroupProgress => ({ played, won, total });
  const pairs: Array<[GroupProgress, GroupProgress]> = [
    [g(0, 0, 8), g(0, 0, 10)], [g(2, 2, 8), g(1, 1, 10)], [g(3, 3, 8), g(4, 4, 10)], [g(5, 4, 8), g(6, 6, 10)],
    [g(6, 5, 8), g(8, 8, 10)], [g(8, 8, 8), g(6, 5, 10)], [g(8, 7, 8), g(0, 0, 10)], [g(7, 7, 8), g(10, 9, 10)],
    [g(4, 4, 8), g(10, 10, 10)], [g(8, 8, 8), g(10, 8, 10)], [g(8, 7, 8), g(10, 10, 10)], [g(8, 7, 8), g(10, 8, 10)],
    [g(8, 8, 8), g(10, 10, 10)], [g(8, 8, 8), g(9, 9, 10)],
  ];
  const opts = [{ hour: 0, name: 'BMT' }, { hour: 11, name: 'BMT' }, { hour: 12, name: 'doug' }, { hour: 16, name: '' }, { hour: 17, name: 'BMT' }, { hour: 23, name: 'BMT' }];
  const headlines = pairs.flatMap(([word, puzzles]) => opts.map((o) => ({
    word, puzzles, hour: o.hour, name: o.name, unlimited: false, headline: bannerHeadline(word, puzzles, o),
  })));
  headlines.push({ word: g(3, 3, 8), puzzles: g(4, 4, 10), hour: 10, name: 'BMT', unlimited: true,
    headline: bannerHeadline(g(3, 3, 8), g(4, 4, 10), { hour: 10, name: 'BMT', unlimited: true }) });
  const clocks = pairs.map(([word, puzzles]) => ({ word, puzzles, clock: '07:12:40', unlimited: false, line: bannerClockLine(word, puzzles, '07:12:40') }));
  clocks.push({ word: g(0, 0, 8), puzzles: g(0, 0, 10), clock: '07:12:40', unlimited: true, line: bannerClockLine(g(0, 0, 8), g(0, 0, 10), '07:12:40', true) });
  const groups = [g(0, 0, 8), g(3, 2, 8), g(8, 7, 8), g(8, 8, 8), g(10, 8, 10), g(10, 10, 10), g(0, 0, 0)]
    .map((x) => ({ group: x, tier: groupTier(x), status: groupStatus(x) }));
  const full = { played: 10, won: 10 }, swept = { played: 10, won: 8 }, part = { played: 4, won: 4 };
  const history = { '2026-10-01': part, '2026-09-30': full, '2026-09-29': swept, '2026-09-28': full, '2026-09-26': full,
    '2026-03-01': full, '2026-02-28': full, '2025-12-31': swept, '2026-01-01': full };
  const todays = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-03-01', '2026-03-02', '2026-01-01', '2026-01-02'];
  const streaks = todays.map((today) => ({ days: history, total: 10, today, ...dayStreaks(history, 10, today) }));
  const quiz = { '2026-10-01': { played: 1, won: 1 }, '2026-09-30': { played: 1, won: 1 }, '2026-09-29': { played: 1, won: 0 } };
  streaks.push({ days: quiz, total: 1, today: '2026-10-01', ...dayStreaks(quiz, 1, '2026-10-01') });
  // Founder, 2026-10-01 stats audit: lifetime sweep/flawless days and best runs.
  const totals = [
    { days: history, total: 10, ...dayRunTotals(history, 10) },
    { days: quiz, total: 1, ...dayRunTotals(quiz, 1) },
    { days: {}, total: 10, ...dayRunTotals({}, 10) },
  ];
  return { headlines, clocks, groups, streaks, totals };
}

// VS overhaul (founder, 2026-10-01): the VS banner words, the challenge
// outcome rule, and the bot ladder, pinned for the Swift/Kotlin ports.
export function renderVsLobbyFixtures() {
  const R: VsDayResult[] = ['open', 'won', 'lost', 'draw'];
  const banners: Array<VsBannerInput & { free: boolean; headline: string; clock: string; status: string }> = [];
  for (const battle of R) for (const botOfDay of R) for (const streak of [0, 3]) {
    const i: VsBannerInput = { name: 'BT', battle, botOfDay, incomingFrom: null, streak };
    banners.push({ ...i, free: false, headline: vsBannerHeadline(i), clock: vsBannerClockLine(i, '07:12:40'), status: vsTodayStatus(i) });
  }
  for (const i of [
    { name: '', battle: 'open', botOfDay: 'open', incomingFrom: null, streak: 0 },
    { name: 'doug', battle: 'won', botOfDay: 'open', incomingFrom: 'johnnyauer', streak: 5 },
  ] as VsBannerInput[]) {
    banners.push({ ...i, free: true, headline: vsBannerHeadline(i), clock: vsBannerClockLine(i, '07:12:40', { free: true, challengeLeft: '17H' }), status: vsTodayStatus(i) });
  }
  const records = [
    [{ wins: 12, losses: 7 }, { wins: 31, losses: 9 }, 2], [{ wins: 0, losses: 0 }, { wins: 4, losses: 2 }, null],
    [{ wins: 1, losses: 0 }, { wins: 1, losses: 0 }, 10], [{ wins: 3, losses: 3 }, { wins: 0, losses: 1 }, 0],
  ].map(([people, bots, ladder]) => ({ people, bots, ladder, line: vsRecordLine(people as any, bots as any, ladder as number | null) }));
  const run = (solved: boolean, boardsSolved: number, guesses: number, timeMs: number): VsRun => ({ solved, boardsSolved, guesses, timeMs });
  const pairs: Array<[VsRun, VsRun]> = [
    [run(true, 1, 3, 100000), run(true, 1, 4, 112000)], [run(true, 1, 4, 30000), run(true, 1, 3, 120000)],
    [run(false, 0, 6, 60000), run(true, 1, 6, 300000)], [run(true, 1, 4, 60000), run(true, 1, 4, 60000)],
    [run(false, 3, 9, 1000), run(false, 2, 9, 1000)], [run(false, 2, 9, 1000), run(false, 2, 9, 900000)],
    [run(true, 1, 3, 100000), run(true, 1, 3, 112000)], [run(true, 1, 5, 100000), run(true, 1, 3, 90000)],
    [run(true, 4, 7, 200000), run(true, 4, 7, 200400)], [run(true, 21, 30, 600000), run(true, 21, 31, 500000)],
  ];
  const outcomes = pairs.map(([me, them]) => ({ me, them, outcome: vsOutcome(me, them), margin: vsMargin(me, them), headline: challengeHeadline(vsOutcome(me, them), 'doug') }));
  // FINISH_SPEC D1: the ten-bot cast ladder; 'rook' (an old id) counts as ivy.
  const games: Array<[string, boolean]> = [['rip', true], ['dewey', false], ['rip', true], ['rip', true], ['ivy', true], ['ivy', false], ['rook', true], ['ivy', true], ['ivy', true], ['ollie', true], ['ollie', true], ['ollie', true], ['opal', true], ['opal', true], ['opal', true], ['cosmo', true], ['cosmo', true], ['cosmo', true], ['umi', true], ['umi', true], ['umi', true], ['ozzy', true], ['ozzy', true], ['ozzy', true], ['dewey', true], ['dewey', true], ['dewey', true], ['scoot', true], ['scoot', true], ['scoot', true], ['webster', true], ['webster', true], ['webster', true], ['webster', true]];
  let s = { cleared: 0, run: 0 };
  const ladder = games.map(([bot, won]) => { s = ladderAfterGame(s, bot, won); return { bot, won, after: s, rungs: ladderRungs(s) }; });
  // The cast table + Bot of the Day (bot-cast.ts), pinned for the ports.
  const cast = BOT_CAST.map((b) => ({ ...b, solveLine: botSolveLine(b) }));
  const legacy = ['rook', 'lexi', 'nova', 'adapt', 'ghost', 'daily', 'webster'].map((id) => ({ id, canonical: canonicalBotId(id) }));
  const legacyCleared = [0, 1, 2, 3, 4].map((n) => ({ old: n, cleared: migrateLegacyLadderCleared(n) }));
  const botOfDay = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2027-01-01'].map((day) => ({ day, id: botOfTheDay(day).id }));
  return { banners, records, outcomes, ladder, cast, legacy, legacyCleared, botOfDay };
}

// Friends overhaul (founder, 2026-10-01): the server runs the pocket games, so
// the ports only need the WORDS (card lines, headlines), whose-turn, the
// Tic-Tac-Tile line, presence and friend streaks, and the banner.
export function renderFriendlyFixtures() {
  // Ghost / Word Chain replay against this small embedded list (`words` in the
  // fixture) so the ports can rebuild the same isWord / hasPrefix checks.
  const WORDS = ['GHOST', 'GHOSTS', 'GHOUL', 'APPLE', 'EAGLE', 'EAGLES', 'SALAD', 'DOUGH', 'HOUSE', 'CRANE'];
  const wordCtx = { isWord: (w: string) => WORDS.includes(w), hasPrefix: (f: string) => WORDS.some((w) => w.startsWith(f)) };
  const scripts: Array<{ kind: 'rps' | 'ttt' | 'coin' | 'pass' | 'ghost' | 'chain'; moves: Array<[string, any]>; ctx?: any }> = [
    { kind: 'rps', moves: [['a', { kind: 'rps', pick: 'paper' }], ['b', { kind: 'rps', pick: 'rock' }], ['b', { kind: 'rps', pick: 'scissors' }], ['a', { kind: 'rps', pick: 'scissors' }], ['a', { kind: 'rps', pick: 'rock' }], ['b', { kind: 'rps', pick: 'scissors' }]] },
    { kind: 'ttt', moves: [['a', { kind: 'ttt', cell: 0 }], ['b', { kind: 'ttt', cell: 4 }], ['a', { kind: 'ttt', cell: 1 }], ['b', { kind: 'ttt', cell: 2 }], ['a', { kind: 'ttt', cell: 6 }], ['b', { kind: 'ttt', cell: 3 }], ['a', { kind: 'ttt', cell: 5 }], ['b', { kind: 'ttt', cell: 7 }], ['a', { kind: 'ttt', cell: 8 }], ['b', { kind: 'ttt', cell: 0 }], ['a', { kind: 'ttt', cell: 4 }]] },
    { kind: 'coin', moves: [['a', { kind: 'coin', call: 'heads' }], ['b', { kind: 'coin', call: 'heads' }], ['a', { kind: 'coin', call: 'tails' }], ['b', { kind: 'coin', call: 'tails' }], ['a', { kind: 'coin', call: 'heads' }]], ctx: { flips: [0.1, 0.1, 0.1, 0.7, 0.3] } },
    { kind: 'pass', moves: [['a', { kind: 'pass', word: 'CRANE' }], ['b', { kind: 'pass', word: 'ROUTS' }], ['a', { kind: 'pass', word: 'RISKY' }], ['b', { kind: 'pass', word: 'RISKS' }]], ctx: { solution: 'RISKS' } },
    { kind: 'ghost', moves: [['a', { kind: 'ghost', letter: 'G' }], ['b', { kind: 'ghost', letter: 'H' }], ['a', { kind: 'ghost', letter: 'O' }], ['b', { kind: 'ghost', letter: 'S' }], ['a', { kind: 'ghost', letter: 'T' }], ['a', { kind: 'ghost', letter: 'Q' }], ['b', { kind: 'ghost', letter: 'Q' }], ['b', { kind: 'ghost', letter: 'E' }], ['a', { kind: 'ghost', letter: 'A' }], ['b', { kind: 'ghost', letter: 'X' }]], ctx: { words: true } },
    { kind: 'chain', moves: [['a', { kind: 'chain', word: 'CRANE' }], ['b', { kind: 'chain', word: 'APPLE' }], ['b', { kind: 'chain', word: 'EAGLES' }], ['a', { kind: 'chain', word: 'SALAD' }], ['b', { kind: 'chain', word: 'DOUGH' }], ['a', { kind: 'chain', word: 'HOUSE' }], ['b', { kind: 'chain', word: 'EAGLE' }], ['a', { kind: 'chain', word: 'CRANE' }]], ctx: { words: true } },
  ];
  const games = scripts.map((sc) => {
    let s: FriendlyState = newFriendlyState(sc.kind);
    const flips = [...(sc.ctx?.flips ?? [])];
    const steps = sc.moves.map(([by, mv]) => {
      const r = applyFriendlyMove(s, by as any, mv, { random: () => flips.shift() ?? 0.1, solution: sc.ctx?.solution, ...(sc.ctx?.words ? wordCtx : {}) });
      if (r.ok) s = r.state;
      return {
        by, move: mv, ok: r.ok, error: r.ok ? null : r.error, state: s, turn: whoseTurn(s), winner: friendlyWinner(s),
        headlineA: friendlyHeadline(s, 'a'), headlineB: friendlyHeadline(s, 'b'),
        cardA: friendlyCardLine({ kind: sc.kind, state: s, me: 'a', them: 'Doug', minutesAgo: 4 }),
        cardB: friendlyCardLine({ kind: sc.kind, state: s, me: 'b', them: 'BT', minutesAgo: 75 }),
      };
    });
    return { kind: sc.kind, steps };
  });
  const boards = [['a', 'a', 'a', '', '', '', '', '', ''], ['b', '', '', 'b', '', '', 'b', '', ''], ['a', 'b', 'a', 'b', 'a', 'b', 'b', 'a', 'b'], ['', '', 'a', '', 'a', '', 'a', '', '']]
    .map((board) => ({ board, line: tttLine(board as any) }));
  const now = Date.parse('2026-10-01T20:00:00Z');
  const presence = [[30_000, 'Muddle'], [90_000, null], [119_000, 'Classic'], [121_000, null], [12 * 60_000, null], [59 * 60_000, null], [3 * 3600_000, 'Muddle'], [30 * 3600_000, null], [null, null]]
    .map(([ago, activity]) => ({ lastSeenMs: ago === null ? null : now - (ago as number), activity, nowMs: now, online: isOnline(ago === null ? null : now - (ago as number), now), line: presenceLine(ago === null ? null : now - (ago as number), activity as string | null, now) }));
  const me = ['2026-10-01', '2026-09-30', '2026-09-29', '2026-09-27', '2026-02-28', '2026-03-01'];
  const them = ['2026-09-30', '2026-09-29', '2026-09-28', '2026-09-27', '2026-02-28', '2026-03-01'];
  const streaks = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-03-01', '2026-03-02'].map((today) => ({ mine: me, theirs: them, today, streak: friendStreak(me, them, today) }));
  const base: FriendsBannerInput = { friendCount: 4, online: ['Doug', 'Kate', 'Mike'], myRank: 2, myPoints: 1180, leaderName: 'Kate', leaderPoints: 1240, nextPoints: 960 };
  const banners = [base, { ...base, online: ['doug'] }, { ...base, online: [], myRank: 1, myPoints: 1380, nextPoints: 1240 }, { ...base, online: [] },
    { ...base, online: [], leaderPoints: 0, myPoints: 0 }, { ...base, friendCount: 0, online: [] }, { ...base, online: [], myRank: 11, myPoints: 0, leaderPoints: 2500 }, { ...base, online: [], myRank: 22, myPoints: 10, leaderPoints: 12000 }, { ...base, online: [], myRank: 3, myPoints: 5, leaderPoints: 9 }]
    .map((i) => ({ input: i, headline: friendsBannerHeadline(i), clock: friendsBannerClockLine(i, '04:12:08') }));
  return { words: WORDS, games, boards, presence, streaks, banners };
}

// The Leaderboard's day title (founder, 2026-10-01): weekday wordplay + holidays.
export function renderLeaderboardTitleFixtures() {
  const days = ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2027-01-01', '2028-02-29'];
  const titles = days.map((day) => ({ day, holiday: null as string | null, title: leaderboardTitle(day) }));
  for (const [day, holiday] of [['2026-10-31', 'Halloween'], ['2026-12-25', 'Christmas'], ['2026-11-26', 'Thanksgiving'], ['2026-10-31', '']]) {
    titles.push({ day, holiday, title: leaderboardTitle(day, holiday) });
  }
  return { titles };
}

const TARGET_DIRS = [
  join(repo, 'apps', 'ios', 'Tests', 'Fixtures'),
  join(repo, 'apps', 'android', 'core', 'src', 'test', 'resources', 'fixtures'),
];

// More Games §15: Letter Ladder. Bank lookups use the REAL shipped bank (the
// natives load their bundled copy, sha-guarded to be identical); reducer
// scripts run over a small allowed set embedded in the fixture so they need no
// dictionary; `dictHints` pin the BFS hint over the full allowed.json.
export function renderLadderFixtures() {
  const bank = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'ladder-puzzles.json'), 'utf8')) as LadderBank;
  const allowedFull = new Set<string>((JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'allowed.json'), 'utf8')) as string[])
    .map((w) => w.toUpperCase()).filter((w) => w.length === 5));
  const days = ['2026-09-23', '2026-09-24', '2026-10-05', '2027-01-01', '2028-02-29', '2026-09-22', 'nope']
    .map((day) => ({ day, id: ladderPuzzleForDay(bank, day)?.id ?? null, number: ladderDailyNumber(day) }));
  const seeds = ['unlimited-LADDER-1', 'unlimited-LADDER-1758578400000', 'x'].map((seed) => ({ seed, id: ladderPuzzleForSeed(bank, seed)?.id ?? null }));

  // Mini dictionary: the first daily's path plus every full-list neighbour of each rung.
  const p = bank.daily[0];
  const mini = new Set<string>(p.path);
  for (const w of p.path) for (const n of ladderNeighbours(w, allowedFull)) mini.add(n);
  const allowed = [...mini].sort();
  const cur = (s: ReturnType<typeof createLadderState>) => s.words[s.words.length - 1];
  const scripts: Array<{ name: string; actions: LadderAction[] }> = [
    { name: 'win-along-path', actions: p.path.slice(1).map((w) => ({ type: 'SUBMIT', word: w }) as LadderAction) },
    { name: 'rejections-are-free', actions: [
      { type: 'SUBMIT', word: 'ab' }, { type: 'SUBMIT', word: 'ZZZZZ' }, { type: 'SUBMIT', word: p.start },
      { type: 'SUBMIT', word: p.path[1].toLowerCase() }, { type: 'SUBMIT', word: p.start }, { type: 'UNDO' }, { type: 'UNDO' },
      { type: 'SUBMIT', word: p.path[1] },
    ] },
    { name: 'hint-undo-hint', actions: [{ type: 'HINT' }, { type: 'UNDO' }, { type: 'HINT' }, { type: 'HINT' }, { type: 'FINISH' }] },
    { name: 'hints-to-the-end', actions: Array.from({ length: p.par + 1 }, () => ({ type: 'HINT' }) as LadderAction) },
    { name: 'loss-by-budget', actions: Array.from({ length: p.par + 5 }, (_, i) => (i % 2 === 0 ? { type: 'SUBMIT', word: p.path[1] } : { type: 'UNDO' }) as LadderAction)
      .flatMap((a, i, arr) => (i === arr.length - 1 && a.type === 'UNDO' ? [] : [a])) },
  ];
  // 'loss-by-budget' alternates submit/undo so every submit is a fresh move; pad with submits until the budget is spent.
  const loss = scripts.find((s) => s.name === 'loss-by-budget')!;
  { let s = createLadderState(p, 'fixture', 0);
    for (const a of loss.actions) s = ladderReduce(s, a, mini, 1000);
    while (s.status === 'playing') { const a: LadderAction = cur(s) === p.path[1] ? { type: 'UNDO' } : { type: 'SUBMIT', word: p.path[1] }; loss.actions.push(a); s = ladderReduce(s, a, mini, 1000); } }
  const reducer = scripts.map((sc) => {
    let s = createLadderState(p, 'fixture', 0);
    for (const a of sc.actions) s = ladderReduce(s, a, mini, 1000);
    const row = ladderMatchRow(s);
    return {
      name: sc.name, id: p.id, actions: sc.actions,
      expect: { words: s.words, hintMask: s.hintMask, moves: s.moves, hintsUsed: s.hintsUsed, events: s.events, status: s.status, reject: s.reject, endTime: s.endTime, guessCount: ladderGuessCount(s) },
      row, reconstruct: reconstructLadder(row.solutions, row.guesses),
    };
  });
  const dictHints = bank.daily.slice(0, 6).map((q) => ({ id: q.id, from: q.start, end: q.end, next: ladderNextStep(q.start, q.end, allowedFull, new Set([q.start])) }))
    .concat(bank.daily.slice(0, 3).map((q) => ({ id: q.id, from: q.path[1], end: q.end, next: ladderNextStep(q.path[1], q.end, allowedFull, new Set(q.path.slice(0, 2))) })));
  const neighbours = [p.start, p.end].map((w) => ({ word: w, neighbours: ladderNeighbours(w, allowedFull) }));
  return { epoch: bank.epoch, dailyCount: bank.daily.length, extraCount: bank.extra.length, days, seeds, allowed, puzzle: p, reducer, dictHints, neighbours, malformed: reconstructLadder(['nope'], []) };
}

// More Games §17: Spyglass. Bank lookups use the REAL shipped bank; reducer
// scripts replay concrete selections on the first daily (forward, backward,
// crooked, short, miss, hint, reveal, full clear); geometry cases pin the line
// and placement helpers.
export function renderWordsearchFixtures() {
  const bank = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'wordsearch-puzzles.json'), 'utf8')) as WordsearchBank;
  const days = ['2026-09-23', '2026-09-24', '2026-10-05', '2027-01-01', '2026-09-22', 'nope']
    .map((day) => ({ day, id: wordsearchPuzzleForDay(bank, day)?.id ?? null, number: wordsearchDailyNumber(day) }));
  const seeds = ['unlimited-WORDSEARCH-1', 'unlimited-WORDSEARCH-1758578400000', 'x'].map((seed) => ({ seed, id: wordsearchPuzzleForSeed(bank, seed)?.id ?? null }));
  const p = bank.daily[0];
  const n = 10;
  const cellsOf = (i: number) => wordsearchCells(n, p.words[i]);
  const ends = (i: number) => { const c = cellsOf(i); return { from: c[0], to: c[c.length - 1] }; };
  // A straight ≥4-cell line that spells no list word: scan rows for one.
  const missLine = (() => {
    for (let r = 0; r < n; r++) for (let c = 0; c + 3 < n; c++) {
      const from = r * n + c, to = r * n + c + 3;
      const letters = wordsearchLine(n, from, to)!.map((i) => p.grid[i]).join('');
      if (!p.words.some((w) => w.w === letters || w.w === letters.split('').reverse().join(''))) return { from, to };
    }
    return { from: 0, to: 3 };
  })();
  const scripts: Array<{ name: string; actions: WordsearchAction[] }> = [
    { name: 'mixed', actions: [
      { type: 'SELECT', ...ends(0) },                                    // forward find
      { type: 'SELECT', from: ends(1).to, to: ends(1).from },            // backward find
      { type: 'SELECT', ...ends(0) },                                    // already found
      { type: 'SELECT', from: 0, to: 12 },                               // crooked — free
      { type: 'SELECT', from: 88, to: 89 },                              // 2 cells — free
      { type: 'SELECT', ...missLine },                                   // miss
      { type: 'HINT' }, { type: 'HINT' },
    ] },
    { name: 'reveal', actions: [{ type: 'SELECT', ...ends(2) }, { type: 'SELECT', ...missLine }, { type: 'REVEAL' }, { type: 'SELECT', ...ends(3) }, { type: 'FINISH' }] },
    { name: 'clear', actions: p.words.map((_, i) => ({ type: 'SELECT', ...ends(i) }) as WordsearchAction) },
    { name: 'hints-exhaust', actions: Array.from({ length: 12 }, () => ({ type: 'HINT' }) as WordsearchAction) },
    // Show words (2026-09-26): finds after "=" are late finds and count like misses.
    { name: 'show-words', actions: [{ type: 'SELECT', ...ends(0) }, { type: 'SHOW' }, { type: 'SHOW' }, { type: 'SELECT', ...ends(1) }, { type: 'SELECT', ...missLine }, { type: 'SELECT', ...ends(2) }] },
    { name: 'show-then-clear', actions: [{ type: 'SHOW' }, ...p.words.map((_, i) => ({ type: 'SELECT', ...ends(i) }) as WordsearchAction)] },
  ];
  const reducer = scripts.map((sc) => {
    let s = createWordsearchState(p, 'fixture', 0);
    for (const a of sc.actions) s = wordsearchReduce(s, a, 1000);
    const row = wordsearchMatchRow(s);
    return {
      name: sc.name, id: p.id, actions: sc.actions,
      expect: { found: s.found, misses: s.misses, hintsUsed: s.hintsUsed, hinted: s.hinted, wordsShown: s.wordsShown, lateFinds: s.lateFinds, events: s.events, status: s.status, endTime: s.endTime, guessCount: Math.min(15, 10 + s.misses + s.lateFinds) },
      row, reconstruct: reconstructWordsearch(row.solutions, row.guesses),
    };
  });
  const geometry = [[0, 4], [4, 0], [0, 33], [90, 63], [0, 12], [7, 7], [0, 100]].map(([from, to]) => ({ from, to, line: wordsearchLine(n, from, to) }));
  const placements = p.words.map((w) => ({ ...w, cells: wordsearchCells(n, w) }));
  // Close calls (founder, 2026-09-30): Night Sky (ws0008) hides STAR/STARS in its filler (col 8, rows 9 → 5).
  const ns = bank.daily.find((q) => q.id === 'ws0008')!;
  const nearCases = [{ from: 98, to: 58 }, { from: 58, to: 98 }, { from: 98, to: 68 }, { from: 0, to: 3 }]
    .map((c) => ({ ...c, word: wordsearchNearWord(createWordsearchState(ns, 'fixture', 0), c.from, c.to) }));
  let nsState = createWordsearchState(ns, 'fixture', 0);
  const nearActions: WordsearchAction[] = [{ type: 'SELECT', from: 98, to: 58 }, { type: 'SELECT', from: 98, to: 68 }, { type: 'SELECT', from: 0, to: 3 }];
  for (const a of nearActions) nsState = wordsearchReduce(nsState, a, 1000);
  const near = { id: ns.id, list: ns.near ?? [], cases: nearCases, actions: nearActions, expect: { misses: nsState.misses, events: nsState.events, found: nsState.found } };
  return { epoch: bank.epoch, dailyCount: bank.daily.length, extraCount: bank.extra.length, days, seeds, puzzle: p, reducer, geometry, placements, malformed: reconstructWordsearch(['nope'], []), near };
}

// More Games §12: Hubbub. Bank lookups use the REAL shipped bank; scoring
// cases pin the integer rank maths; reducer scripts replay concrete entries on
// the first daily (rejections, scoring, bonus, hints, End before and after the win).
export function renderHubFixtures() {
  const bank = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'hub-puzzles.json'), 'utf8')) as HubBank;
  const days = ['2026-09-23', '2026-09-24', '2026-10-05', '2027-01-01', '2026-09-22', 'nope']
    .map((day) => ({ day, id: hubPuzzleForDay(bank, day)?.id ?? null, number: hubDailyNumber(day) }));
  const seeds = ['unlimited-HUB-1', 'unlimited-HUB-1758578400000', 'x'].map((seed) => ({ seed, id: hubPuzzleForSeed(bank, seed)?.id ?? null }));
  const p = bank.daily[0];
  const scoring = [[0, 81], [40, 81], [41, 81], [81, 81], [57, 81], [7, 144], [144, 144], [0, 0]].map(([points, max]) => ({
    points, max, rank: hubRankIndex(points, max), guessCount: hubGuessCount(hubRankIndex(points, max)), boards: hubBoardsSolved(points, max),
  }));
  const thresholds = Array.from({ length: 10 }, (_, r) => hubRankThreshold(r, p.max));
  const scores = p.words.slice(0, 8).map((w) => ({ w, score: hubWordScore(w, p.letters) }));
  // Enough scoring words to reach Hubbub, in list order.
  const toHubbub: HubAction[] = [];
  { let s = createHubState(p, 'fixture', 0); for (const w of p.words) { if (s.status !== 'playing') break; toHubbub.push({ type: 'SUBMIT', word: w }); s = hubReduce(s, toHubbub[toHubbub.length - 1], 1000); } }
  const scripts: Array<{ name: string; actions: HubAction[] }> = [
    { name: 'rejections-and-first-points', actions: [
      { type: 'SUBMIT', word: 'DUE' }, { type: 'SUBMIT', word: 'MELD' }, { type: 'SUBMIT', word: 'DUES' }, { type: 'SUBMIT', word: 'UUUU' },
      { type: 'SUBMIT', word: p.words[0].toLowerCase() }, { type: 'SUBMIT', word: p.words[0] }, { type: 'SUBMIT', word: p.bonus[0] }, { type: 'SUBMIT', word: p.bonus[0] },
    ] },
    { name: 'hints', actions: [{ type: 'HINT_START' }, { type: 'HINT_START' }, { type: 'HINT_REVEAL' }, { type: 'HINT_START' }] },
    { name: 'end-below-hubbub', actions: [{ type: 'SUBMIT', word: p.words[0] }, { type: 'END' }, { type: 'SUBMIT', word: p.words[1] }, { type: 'HINT_START' }, { type: 'FINISH' }] },
    { name: 'win-then-keep-going', actions: [...toHubbub, { type: 'SUBMIT', word: p.words[p.words.length - 1] }, { type: 'END' }] },
    { name: 'all-words', actions: p.words.map((w) => ({ type: 'SUBMIT', word: w }) as HubAction) },
    // Founder (2026-09-25): every accepted word scores — rarer words earn points and can win the puzzle on their own.
    { name: 'rare-words-score-in-full', actions: [...p.bonus.slice(0, 6), p.words[0]].map((w) => ({ type: 'SUBMIT', word: w }) as HubAction) },
  ];
  const reducer = scripts.map((sc) => {
    let s = createHubState(p, 'fixture', 0);
    for (const a of sc.actions) s = hubReduce(s, a, 1000);
    const row = hubMatchRow(s);
    return {
      name: sc.name, id: p.id, actions: sc.actions,
      expect: { found: s.found, bonusFound: s.bonusFound, revealed: s.revealed, hinted: s.hinted, points: s.points, hintsUsed: s.hintsUsed, events: s.events, status: s.status, ended: s.ended, reject: s.reject, endTime: s.endTime, rank: hubRankIndex(s.points, s.max), guessCount: hubGuessCount(hubRankIndex(s.points, s.max)), boardsSolved: hubBoardsSolved(s.points, s.max) },
      row, reconstruct: reconstructHub(row.solutions, row.guesses),
    };
  });
  return { epoch: bank.epoch, dailyCount: bank.daily.length, extraCount: bank.extra.length, days, seeds, puzzle: p, scoring, thresholds, scores, reducer, malformed: reconstructHub(['x', 'ABC', '1'], []) };
}

export function renderCryptogramFixtures() {
  const bank = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'cryptogram-puzzles.json'), 'utf8')) as CryptogramBank;
  const table = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'holiday-days.json'), 'utf8')) as HolidayTable;
  const days = ['2026-09-23', '2026-09-24', '2026-10-05', '2027-01-01', '2026-09-22', 'nope', '2026-12-25', '2026-12-24', '2027-12-25', '2026-11-26', '2026-01-19', '2027-07-04']
    .map((day) => ({ day, id: cryptogramPuzzleForDay(bank, day, table)?.id ?? null, plainId: cryptogramPuzzleForDay(bank, day, null)?.id ?? null, number: cryptogramDailyNumber(day) }));
  const seeds = ['unlimited-CRYPTOGRAM-1', 'unlimited-CRYPTOGRAM-1758578400000', 'x'].map((seed) => ({ seed, id: cryptogramPuzzleForSeed(bank, seed)?.id ?? null }));
  const p = bank.daily[0];
  const cipher = cryptogramEncipher(p.text, p.key);
  const codes = cryptogramCodeLetters(cipher);
  const init = createCryptogramState(p, 'fixture', 0);
  const truth = (code: string) => CRYPTOGRAM_ALPHABET_LOCAL[p.key.indexOf(code)];
  const free = codes.filter((c) => !init.locked.includes(c));
  // Scripts: pencil right and wrong, clear, a check that locks and clears, hints, a solve, a reveal, and no-ops on locked/ended letters.
  const solveAll: CryptogramAction[] = free.map((c) => ({ type: 'SET', code: c, plain: truth(c) }));
  const scripts: Array<{ name: string; actions: CryptogramAction[] }> = [
    { name: 'pencil-and-clear', actions: [
      { type: 'SET', code: free[0], plain: truth(free[0]) }, { type: 'SET', code: free[1], plain: truth(free[0]) }, { type: 'SET', code: free[1], plain: null },
      { type: 'SET', code: init.locked[0], plain: 'Q' }, { type: 'SET', code: free[2], plain: 'z' }, { type: 'SET', code: '1', plain: 'A' }, { type: 'SET', code: free[2], plain: null }, { type: 'SET', code: free[2], plain: null },
    ] },
    { name: 'check-locks-and-clears', actions: [
      { type: 'SET', code: free[0], plain: truth(free[0]) }, { type: 'SET', code: free[1], plain: truth(free[1]) === 'Z' ? 'Y' : 'Z' }, { type: 'CHECK' }, { type: 'SET', code: free[0], plain: 'A' }, { type: 'CHECK' }, { type: 'CHECK' }, { type: 'CHECK' },
    ] },
    { name: 'hints', actions: [{ type: 'HINT' }, { type: 'HINT' }, { type: 'SET', code: free[3] ?? free[0], plain: 'Q' }, { type: 'HINT' }] },
    { name: 'solve', actions: [...solveAll, { type: 'SET', code: free[0], plain: 'Q' }, { type: 'CHECK' }, { type: 'FINISH' }] },
    { name: 'solve-with-a-check', actions: [{ type: 'CHECK' }, ...solveAll] },
    { name: 'reveal', actions: [{ type: 'SET', code: free[0], plain: truth(free[0]) }, { type: 'REVEAL' }, { type: 'HINT' }, { type: 'SET', code: free[1], plain: 'Q' }, { type: 'FINISH' }] },
    { name: 'hint-everything', actions: Array.from({ length: codes.length + 1 }, () => ({ type: 'HINT' }) as CryptogramAction) },
  ];
  const reducer = scripts.map((sc) => {
    let s = createCryptogramState(p, 'fixture', 0);
    for (const a of sc.actions) s = cryptogramReduce(s, a, 1000);
    const row = cryptogramMatchRow(s);
    return {
      name: sc.name, id: p.id, actions: sc.actions,
      expect: { mapping: s.mapping, locked: s.locked, hinted: s.hinted, hintsUsed: s.hintsUsed, checks: s.checks, lastWrong: s.lastWrong, events: s.events, status: s.status, ended: s.ended, endTime: s.endTime, guessCount: cryptogramGuessCount(s.checks), conflicts: cryptogramConflicts(s.mapping), correct: cryptogramCorrectCount(s), hintTarget: cryptogramHintTarget(s) },
      row, reconstruct: reconstructCryptogram(row.solutions, row.guesses),
    };
  });
  return {
    epoch: bank.epoch, dailyCount: bank.daily.length, extraCount: bank.extra.length, holidayKeys: Object.keys(bank.holiday ?? {}), days, seeds,
    puzzle: p, cipher, codes, frequencies: cryptogramFrequencies(cipher), initial: { mapping: init.mapping, locked: init.locked, hintTarget: cryptogramHintTarget(init) },
    guessCounts: [0, 1, 2, 3, 4, 9].map((c) => ({ checks: c, guessCount: cryptogramGuessCount(c) })),
    reducer, malformed: [reconstructCryptogram(['x', 'ABC'], []), reconstructCryptogram(['Hi there.', 'AABCDEFGHIJKLMNOPQRSTUVWXY', 'id'], [])],
  };
}
const CRYPTOGRAM_ALPHABET_LOCAL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function renderScrambleFixtures() {
  const bank = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'scramble-puzzles.json'), 'utf8')) as ScrambleBank;
  const table = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'holiday-days.json'), 'utf8')) as HolidayTable;
  const days = ['2026-09-23', '2026-09-24', '2026-10-05', '2027-01-01', '2026-09-22', 'nope', '2026-12-25', '2026-11-26', '2026-01-19', '2027-07-04']
    .map((day) => ({ day, id: scramblePuzzleForDay(bank, day, table)?.id ?? null, plainId: scramblePuzzleForDay(bank, day, null)?.id ?? null, number: scrambleDailyNumber(day) }));
  const seeds = ['unlimited-SCRAMBLE-1', 'unlimited-SCRAMBLE-1758578400000', 'x'].map((seed) => ({ seed, id: scramblePuzzleForSeed(bank, seed)?.id ?? null }));
  const p = bank.daily[0];
  const s0 = createScrambleState(p, 'fixture', 0);
  const type = (row: number, word: string): ScrambleAction[] => [...word].map((ch) => ({ type: 'TYPE', row, letter: ch }) as ScrambleAction);
  const wrongFor = (row: number) => { const w = s0.words[row]; const rev = [...w.answer].reverse().join(''); return rev === w.answer ? w.scramble : rev; };
  const finalLetters = scrambleFinalLetters(p);
  const scripts: Array<{ name: string; actions: ScrambleAction[] }> = [
    { name: 'tray-rules', actions: [{ type: 'TYPE', row: 4, letter: finalLetters[0] }, { type: 'TYPE', row: 0, letter: '1' }, { type: 'TYPE', row: 0, letter: s0.words[0].scramble[0].toLowerCase() }, { type: 'TYPE', row: 0, letter: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((c) => !s0.words[0].scramble.includes(c))! }, { type: 'BACK', row: 0 }, { type: 'BACK', row: 0 }, { type: 'CLEAR', row: 0 }, { type: 'TYPE', row: 9, letter: 'A' }] },
    { name: 'wrong-then-right', actions: [...type(0, wrongFor(0)), ...type(0, s0.words[0].answer.slice(0, 2)), { type: 'BACK', row: 0 }, { type: 'CLEAR', row: 0 }, ...type(0, s0.words[0].answer)] },
    { name: 'hints', actions: [{ type: 'REVEAL_LETTER', row: 0 }, { type: 'BACK', row: 0 }, { type: 'TYPE', row: 0, letter: 'Q' }, { type: 'REVEAL_LETTER', row: 0 }, { type: 'SOLVE_WORD', row: 1 }, { type: 'SOLVE_WORD', row: 1 }, { type: 'REVEAL_LETTER', row: 4 }] },
    { name: 'reveal-all-letters-of-a-word', actions: Array.from({ length: s0.words[2].answer.length + 1 }, () => ({ type: 'REVEAL_LETTER', row: 2 }) as ScrambleAction) },
    { name: 'win', actions: [...type(0, s0.words[0].answer), ...type(1, s0.words[1].answer), ...type(2, s0.words[2].answer), ...type(3, s0.words[3].answer), ...type(4, finalLetters), { type: 'TYPE', row: 0, letter: 'A' }, { type: 'FINISH' }] },
    { name: 'win-with-mistakes-and-hints', actions: [...type(0, wrongFor(0)), ...type(0, s0.words[0].answer), { type: 'SOLVE_WORD', row: 1 }, ...type(2, s0.words[2].answer), { type: 'REVEAL_LETTER', row: 3 }, ...type(3, s0.words[3].answer.slice(1)), ...type(4, finalLetters.slice(0, 3)), ...type(4, finalLetters.slice(3).split('').reverse().join('')), ...type(4, finalLetters), { type: 'FINISH' }] },
    { name: 'lose', actions: [...type(0, s0.words[0].answer), ...Array.from({ length: 13 }, () => type(1, wrongFor(1))).flat(), { type: 'TYPE', row: 2, letter: s0.words[2].scramble[0] }, { type: 'FINISH' }] },
  ];
  const reducer = scripts.map((sc) => {
    let s = createScrambleState(p, 'fixture', 0);
    for (const a of sc.actions) s = scrambleReduce(s, a, 1000);
    const row = scrambleMatchRow(s);
    return {
      name: sc.name, id: p.id, actions: sc.actions,
      expect: { entries: s.entries, solved: s.solved, revealed: s.revealed, checks: s.checks, mistakes: s.mistakes, hintsUsed: s.hintsUsed, lastRow: s.lastRow, lastResult: s.lastResult, events: s.events, status: s.status, ended: s.ended, endTime: s.endTime, guessCount: scrambleGuessCount(s), boardsSolved: scrambleBoardsSolved(s), activeRow: scrambleActiveRow(s), finalOpen: scrambleFinalOpen(s) },
      row, reconstruct: reconstructScramble(row.solutions, row.guesses),
    };
  });
  return {
    epoch: bank.epoch, dailyCount: bank.daily.length, extraCount: bank.extra.length, holidayKeys: Object.keys(bank.holiday ?? {}), days, seeds,
    puzzle: p, finalLetters, finalTray: scrambleFinalTray(p), targets: [0, 1, 2, 3, 4].map((r) => scrambleTarget(s0, r)),
    remaining: [['ABCA', 'A'], ['ABCA', 'AA'], ['ABC', 'Z'], ['ABC', '']].map(([pool, entry]) => ({ pool, entry, left: scrambleRemaining(pool, entry) })),
    reducer, malformed: [reconstructScramble(['A', 'B'], []), reconstructScramble(['ABCDE', 'ABCDE', 'ABCDE', 'ABCDE', 'ab'], []), reconstructScramble(['MOTOR', 'EXILED', 'BATTEN', 'FRAUD', 'ABOUT TIME'], ['0✓MOTOR', '1✗XXXXXX', '2h__T___', '3H', '4✓ABOUTTIME', 'junk'])],
  };
}

export function renderCrosswordFixtures() {
  const bank = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'crossword-puzzles.json'), 'utf8')) as CrosswordBank;
  const table = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'holiday-days.json'), 'utf8')) as HolidayTable;
  const days = ['2026-09-23', '2026-09-24', '2026-10-05', '2027-01-01', '2026-09-22', 'nope', '2026-12-25', '2026-11-26', '2026-01-19', '2027-07-04']
    .map((day) => ({ day, id: crosswordPuzzleForDay(bank, day, table)?.id ?? null, plainId: crosswordPuzzleForDay(bank, day, null)?.id ?? null, number: crosswordDailyNumber(day) }));
  const seeds = ['unlimited-CROSSWORD-1', 'unlimited-CROSSWORD-1758578400000', 'x'].map((seed) => ({ seed, id: crosswordPuzzleForSeed(bank, seed)?.id ?? null }));
  const p = bank.daily[0];
  const sol = crosswordSolution(p);
  const cellsOf = (i: number) => crosswordEntryCells(p, p.entries[i]);
  const e0 = p.entries[0], e1 = p.entries[1], e2 = p.entries[2];
  const c0 = cellsOf(0), c1 = cellsOf(1);
  const wrongLetter = (ch: string) => (ch === 'Z' ? 'Y' : 'Z');
  const fillAll: CrosswordAction[] = []; for (let i = 0; i < sol.length; i++) if (sol[i] !== '.') fillAll.push({ type: 'SET', cell: i, letter: sol[i] });
  const scripts: Array<{ name: string; actions: CrosswordAction[] }> = [
    { name: 'set-clear-noops', actions: [{ type: 'SET', cell: c0[0], letter: e0.answer[0].toLowerCase() }, { type: 'SET', cell: c0[0], letter: e0.answer[0] }, { type: 'SET', cell: c0[1], letter: '1' }, { type: 'SET', cell: -1, letter: 'A' }, { type: 'SET', cell: 9999, letter: 'A' }, { type: 'CLEAR', cell: c0[1] }, { type: 'SET', cell: c0[1], letter: wrongLetter(e0.answer[1]) }, { type: 'CLEAR', cell: c0[1] }] },
    { name: 'check', actions: [{ type: 'SET', cell: c0[0], letter: e0.answer[0] }, { type: 'SET', cell: c0[1], letter: wrongLetter(e0.answer[1]) }, { type: 'SET', cell: c1[c1.length - 1], letter: e1.answer[e1.answer.length - 1] }, { type: 'CHECK' }, { type: 'CLEAR', cell: c0[0] }, { type: 'CHECK' }] },
    { name: 'reveals', actions: [{ type: 'REVEAL_LETTER', cell: c0[0] }, { type: 'REVEAL_LETTER', cell: c0[0] }, { type: 'REVEAL_LETTER', cell: 0 }, { type: 'REVEAL_WORD', n: e1.n, dir: e1.dir }, { type: 'REVEAL_WORD', n: e1.n, dir: e1.dir }, { type: 'REVEAL_WORD', n: 99, dir: 'A' }, { type: 'REVEAL_LETTER', cell: cellsOf(2)[0] }] },
    { name: 'solve', actions: [...fillAll, { type: 'SET', cell: c0[0], letter: 'Q' }, { type: 'CHECK' }, { type: 'FINISH' }] },
    { name: 'solve-after-a-check', actions: [{ type: 'SET', cell: c0[0], letter: wrongLetter(e0.answer[0]) }, { type: 'CHECK' }, ...fillAll] },
    { name: 'reveal-puzzle', actions: [{ type: 'SET', cell: c0[0], letter: e0.answer[0] }, { type: 'REVEAL_WORD', n: e2.n, dir: e2.dir }, { type: 'REVEAL_PUZZLE' }, { type: 'SET', cell: c1[0], letter: 'Q' }, { type: 'FINISH' }] },
  ];
  const reducer = scripts.map((sc) => {
    let s = createCrosswordState(p, 'fixture', 0);
    for (const a of sc.actions) s = crosswordReduce(s, a, 1000);
    const row = crosswordMatchRow(s);
    return {
      name: sc.name, id: p.id, actions: sc.actions,
      expect: { fill: s.fill, locked: s.locked, revealed: s.revealed, checks: s.checks, hintsUsed: s.hintsUsed, lastWrong: s.lastWrong, events: s.events, status: s.status, ended: s.ended, endTime: s.endTime, guessCount: crosswordGuessCount(s.checks), correct: crosswordCorrectCount(s), total: crosswordLetterCount(s) },
      row, reconstruct: reconstructCrossword(row.solutions, row.guesses),
    };
  });
  return {
    epoch: bank.epoch, dailyCount: bank.daily.length, extraCount: bank.extra.length, holidayKeys: Object.keys(bank.holiday ?? {}), days, seeds,
    puzzle: p, solution: sol, entryCells: p.entries.map((e) => ({ n: e.n, dir: e.dir, cells: crosswordEntryCells(p, e) })),
    guessCounts: [0, 1, 2, 5, 6, 98, 99, 500].map((c) => ({ checks: c, guessCount: crosswordGuessCount(c) })),
    reducer, malformed: [reconstructCrossword(['x|y', 'ABC'], []), reconstructCrossword(['x|y|2x2', 'ABC', 'AB'], []), reconstructCrossword(['x|y|1x2', 'AB', 'AB'], ['=A_', 'hl.', 'c2'])],
  };
}

export function renderGroupsFixtures() {
  const bank = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'groups-puzzles.json'), 'utf8')) as GroupsBank;
  const table = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'holiday-days.json'), 'utf8')) as HolidayTable;
  const days = ['2026-09-23', '2026-09-24', '2026-10-05', '2027-01-01', '2026-09-22', 'nope', '2026-12-25', '2026-11-26', '2026-01-19', '2027-07-04']
    .map((day) => ({ day, id: groupsPuzzleForDay(bank, day, table)?.id ?? null, plainId: groupsPuzzleForDay(bank, day, null)?.id ?? null, number: groupsDailyNumber(day) }));
  const seeds = ['unlimited-GROUPS-1', 'unlimited-GROUPS-1758578400000', 'x'].map((seed) => ({ seed, id: groupsPuzzleForSeed(bank, seed)?.id ?? null }));
  const p = bank.daily[0];
  const orders = ['daily-2026-09-23-GROUPS', 'fixture', 'unlimited-GROUPS-1'].map((seed) => ({ seed, tiles: groupsTileOrder(p, seed) }));
  const g = (t: number) => p.groups.find((x) => x.tier === t)!;
  const pick = (words: string[]): GroupsAction[] => [{ type: 'DESELECT' }, ...words.map((w) => ({ type: 'TOGGLE', word: w }) as GroupsAction), { type: 'SUBMIT' }];
  const scripts: Array<{ name: string; actions: GroupsAction[] }> = [
    { name: 'select-limits-and-short', actions: [{ type: 'SUBMIT' }, { type: 'TOGGLE', word: g(1).words[0] }, { type: 'TOGGLE', word: g(1).words[0] }, { type: 'TOGGLE', word: 'NOTATILE' }, ...g(1).words.map((w) => ({ type: 'TOGGLE', word: w.toLowerCase() }) as GroupsAction), { type: 'TOGGLE', word: g(2).words[0] }, { type: 'SUBMIT' }] },
    { name: 'one-away-repeat-miss', actions: [...pick([...g(2).words.slice(0, 3), g(3).words[0]]), { type: 'SUBMIT' }, ...pick([...g(2).words.slice(0, 2), ...g(3).words.slice(0, 2)])] },
    { name: 'hints-and-shuffle', actions: [{ type: 'HINT_LABEL' }, { type: 'HINT_PAIR' }, { type: 'SHUFFLE' }, { type: 'HINT_LABEL' }, { type: 'HINT_PAIR' }, { type: 'SHUFFLE' }] },
    { name: 'win-with-two-mistakes', actions: [...pick(g(1).words), ...pick([...g(2).words.slice(0, 3), g(4).words[0]]), ...pick([...g(3).words.slice(0, 2), ...g(4).words.slice(0, 2)]), ...pick(g(4).words), ...pick(g(2).words), ...pick(g(3).words), { type: 'TOGGLE', word: g(1).words[0] }, { type: 'FINISH' }] },
    { name: 'perfect', actions: [...pick(g(4).words), ...pick(g(3).words), ...pick(g(2).words), ...pick(g(1).words)] },
    { name: 'lose', actions: [...pick(g(1).words), ...pick([...g(2).words.slice(0, 2), ...g(3).words.slice(0, 2)]), ...pick([...g(2).words.slice(0, 2), ...g(4).words.slice(0, 2)]), ...pick([...g(3).words.slice(0, 2), ...g(4).words.slice(0, 2)]), ...pick([g(2).words[0], g(3).words[0], g(4).words[0], g(2).words[3]]), ...pick(g(2).words), { type: 'HINT_LABEL' }, { type: 'FINISH' }] },
    { name: 'hint-everything', actions: Array.from({ length: 10 }, (_, i) => ({ type: i % 2 ? 'HINT_PAIR' : 'HINT_LABEL' }) as GroupsAction) },
  ];
  const reducer = scripts.map((sc) => {
    let s = createGroupsState(p, 'fixture', 0);
    for (const a of sc.actions) s = groupsReduce(s, a, 1000);
    const row = groupsMatchRow(s);
    return {
      name: sc.name, id: p.id, actions: sc.actions,
      expect: { tiles: s.tiles, solvedTiers: s.solved.map((x) => x.tier), selected: s.selected, mistakes: s.mistakes, submissions: s.submissions, hintsUsed: s.hintsUsed, revealedTiers: s.revealedTiers, pairs: s.pairs, wrongSets: s.wrongSets, shuffles: s.shuffles, lastResult: s.lastResult, events: s.events, status: s.status, ended: s.ended, endTime: s.endTime, guessCount: groupsGuessCount(s), boardsSolved: groupsBoardsSolved(s), labelTarget: groupsLabelTarget(s)?.tier ?? null, pairTarget: groupsPairTarget(s) },
      row, reconstruct: reconstructGroups(row.solutions, row.guesses),
    };
  });
  return { epoch: bank.epoch, dailyCount: bank.daily.length, extraCount: bank.extra.length, holidayKeys: Object.keys(bank.holiday ?? {}), days, seeds, puzzle: p, orders, reducer, malformed: [reconstructGroups(['1|a|A,B,C'], []), reconstructGroups(['1|a|A,B,C,D', '2|b|E,F,G,H', '3|c|I,J,K,L'], [])] };
}

// FINISH_SPEC S4: the share caption bank + its deterministic pick (FNV-1a over `${date}|${game}`).
export function renderShareCaptionFixtures() {
  const hashes = ['', 'a', 'foobar', '2026-10-02|QuadWord', '2026-10-02|Classic', '2027-01-01|Gauntlet'].map((key) => ({ key, hash: captionHash(key) }));
  const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-12-25', '2027-01-01'];
  const games = ['Classic', 'QuadWord', 'OctoWord', 'Gauntlet', 'Sudocious'];
  const kinds = Object.keys(SHARE_CAPTIONS) as ShareCaptionKind[];
  const picks = kinds.flatMap((kind) => days.flatMap((date) => games.map((game) => ({ kind, date, game, index: shareCaptionIndex(kind, date, game) }))));
  const vars = { n: 9, t: '3:12', b: 4, k: 3, opp: 'Doug', url: 'https://wordocious.com/join/AB12CD' };
  const filled = kinds.flatMap((kind) => [undefined, 2, 3, 12].map((d) => ({ kind, date: '2026-10-02', game: 'QuadWord', ...vars, d: d ?? null, text: shareCaption(kind, { date: '2026-10-02', game: 'QuadWord', ...vars, d }) })));
  return { bank: SHARE_CAPTIONS, toasts: SHARE_TOASTS, hashes, picks, filled };
}

// FINISH_SPEC V + X: level tiers and the seasonal skin window.
export function renderLevelSeasonFixtures() {
  const levels = [0, 1, 5, 10, 11, 25, 26, 50, 51, 99, 100, 101, 500].map((level) => ({ level, tier: levelTier(level), label: levelTierLabel(levelTier(level)) }));
  const days = ['2026-10-01', '2026-10-23', '2026-10-24', '2026-10-31', '2026-11-01', '2026-11-02', '2026-12-25', '2027-10-24'].map((date) => ({ date, season: currentSeason(date) }));
  return { levels, days };
}

// FINISH_SPEC AE: the push copy bank, filled.
export function renderPushCopyFixtures() {
  const kinds = Object.keys(PUSH_COPY) as PushKind[];
  const filled = kinds.flatMap((kind) => [{}, { name: 'Oliver', game: 'QuadWord', days: 12 }, { name: '  ', game: '', days: 3 }].map((v) => ({ kind, ...v, text: pushCopy(kind, v) })));
  return { title: PUSH_TITLE, bank: PUSH_COPY, filled };
}

// FINISH_SPEC AN3: avatar defaults, validation, Pro enforcement, presets.
export function renderAvatarConfigFixtures() {
  // Seeds are lowercased usernames (defaultAvatar(username.toLowerCase(), ...)); '' = guest.
  const users = ['', 'guest', 'bmt', 'doug', 'oliver_22', 'johnnyauer'];
  const accents = [null, '#7c3aed', '#ec4899', '#22c55e', '#f59e0b', 'bogus'];
  const defaults = users.flatMap((u) => accents.map((a) => ({ seed: u, accent: a, config: defaultAvatar(u, a) })));
  const withPhoto = users.map((u) => ({ seed: u, accent: '#7c3aed', hasPhoto: true, config: defaultAvatar(u, '#7c3aed', true) }));
  const fbPhoto = defaultAvatar('fixture', '#2563eb', true);
  const display = [{}, { display: 'mascot' }, { display: 'photo' }, { display: 'selfie' }].flatMap((raw) => [
    { raw, hasPhoto: true, result: validateAvatar(raw, fbPhoto).display },
    { raw, hasPhoto: false, result: validateAvatar(raw, defaultAvatar('fixture', '#2563eb', false)).display },
  ]);
  const nearest = ['#7c3aed', '#ec4899', '#0ea5e9', '#123456', '#ffffff', '#000000', 'bogus'].map((hex) => ({ hex, id: nearestAvatarColor(hex) }));
  const fb = defaultAvatar('fixture', '#2563eb');
  const validate = [
    null, [1], 'x', {}, { body: 'tall', color: 'neon', eyes: 'laser', head: 'wizard', frame: 'gold' },
    { v: 1, body: 'star', color: 'mint', pattern: 'dots', patternColor: 'pink', eyes: 'cyclops', nose: 'freckles', mouth: 'gasp', head: 'crown', face: 'mustache', neck: 'cape', frame: 'pro', bg: 'galaxy' },
    { bg: 'lava', neck: 'flower', head: 'tiara' },
  ].map((raw) => ({ raw, result: validateAvatar(raw, fb) }));
  const pro = [true, false].map((isPro) => ({ isPro, result: enforceAvatarPro({ ...fb, head: 'crown', frame: 'diamond', neck: 'wings', bg: 'aurora' }, isPro) }));
  const presets = ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's'].map((id) => ({ castId: id, config: castPreset(id) }));
  return { colors: AVATAR_COLORS, backdrops: AVATAR_BACKDROPS, defaults, withPhoto, display, nearest, fallback: fb, validate, pro, presets };
}

const FILES: Array<[string, unknown]> = [
  ['seed-fixtures.json', renderSeedFixtures()],
  ['prefill-fixtures.json', renderPrefillFixtures()],
  ['bank-fixtures.json', renderBankFixtures()],
  ['sudoku-fixtures.json', renderSudokuFixtures()],
  ['regions-fixtures.json', renderRegionsFixtures()],
  ['ladder-fixtures.json', renderLadderFixtures()],
  ['wordsearch-fixtures.json', renderWordsearchFixtures()],
  ['hub-fixtures.json', renderHubFixtures()],
  ['cryptogram-fixtures.json', renderCryptogramFixtures()],
  ['groups-fixtures.json', renderGroupsFixtures()],
  ['crossword-fixtures.json', renderCrosswordFixtures()],
  ['scramble-fixtures.json', renderScrambleFixtures()],
  ['home-banner-fixtures.json', renderHomeBannerFixtures()],
  ['vs-lobby-fixtures.json', renderVsLobbyFixtures()],
  ['friendly-games-fixtures.json', renderFriendlyFixtures()],
  ['leaderboard-title-fixtures.json', renderLeaderboardTitleFixtures()],
  ['share-captions-fixtures.json', renderShareCaptionFixtures()],
  ['level-season-fixtures.json', renderLevelSeasonFixtures()],
  ['push-copy-fixtures.json', renderPushCopyFixtures()],
  ['avatar-config-fixtures.json', renderAvatarConfigFixtures()],
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
