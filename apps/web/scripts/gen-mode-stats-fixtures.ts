// Generates the shared mode-stats fixtures from the web source of truth
// (lib/mode-stats.ts) and writes an identical copy into each platform's
// test-resource dir. ModeStats.swift and ModeStats.kt load the same JSON and
// assert byte-identical lines and panels — the per-mode stats half of the
// parity guard (More Games §18).
//
// Each case carries the FULL inputs — user_stats totals AND the matches rows —
// plus the pure aggregate over those rows, the eight grid cells and the panel
// flags (shape documented at the top of lib/mode-stats.ts). Word modes stay on
// the default profile (their rows are irrelevant to the grid, so `matches` is
// empty); every custom game has an empty case and a realistic set of rows that
// exercises each of its aggregates.
//
//   Regenerate after any registry change:  apps/server/node_modules/.bin/tsx scripts/gen-mode-stats-fixtures.ts
//   (tsx, like packages/core/scripts/gen-parity-fixtures.ts: the registry imports ./format without an extension)
//

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { statLines, statPanels, modeAggregates, type StatTotals, type MatchRow } from '../lib/mode-stats';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

const ZERO: StatTotals = { wins: 0, losses: 0, totalGames: 0, bestScore: 0, fastestTime: 0, streak: 0, bestStreak: 0 };

/** A matches row with the web's column mapping already applied; boards default to "not stored". */
const row = (r: Partial<MatchRow> & Pick<MatchRow, 'guess_count' | 'completed' | 'time_seconds'>): MatchRow => ({
  hints_used: 0, boards_solved: null, total_boards: null, player1_guesses: [], solutions: [], ...r,
});

// ── Realistic rows per engine (event formats from packages/core/src/games/*.ts) ──

// Sudocious / Starsweep: solutions = [solution, givens]; guesses = [board, hintMask]. guess_count = mistakes + 1.
const sudokuRows: MatchRow[] = [
  row({ guess_count: 1, completed: true, time_seconds: 238, hints_used: 0, player1_guesses: ['<board81>', '<hintMask81>'], solutions: ['<solution81>', '<givens81>'], seed: 'daily-2026-09-23-SUDOKU' }),
  row({ guess_count: 1, completed: true, time_seconds: 402, hints_used: 2, player1_guesses: ['<board81>', '<hintMask81>'], solutions: ['<solution81>', '<givens81>'], seed: 'daily-2026-09-24-SUDOKU' }),
  row({ guess_count: 3, completed: true, time_seconds: 611, hints_used: 0, player1_guesses: ['<board81>', '<hintMask81>'], solutions: ['<solution81>', '<givens81>'], seed: 'daily-2026-09-25-SUDOKU' }),
  row({ guess_count: 2, completed: true, time_seconds: 0, hints_used: 1, player1_guesses: ['<board81>', '<hintMask81>'], solutions: ['<solution81>', '<givens81>'], seed: 'daily-2026-09-26-SUDOKU' }),
  row({ guess_count: 4, completed: false, time_seconds: 300, hints_used: 0, player1_guesses: ['<board81>', '<hintMask81>'], solutions: ['<solution81>', '<givens81>'], seed: 'daily-2026-09-27-SUDOKU' }),
];
const regionsRows: MatchRow[] = [
  row({ guess_count: 1, completed: true, time_seconds: 130, hints_used: 0, player1_guesses: ['<board49>', '<hintMask49>'], solutions: ['<regions49>', '<solution7>'], seed: 'daily-2026-09-23-REGIONS' }),
  row({ guess_count: 2, completed: true, time_seconds: 190, hints_used: 0, player1_guesses: ['<board49>', '<hintMask49>'], solutions: ['<regions49>', '<solution7>'], seed: 'daily-2026-09-24-REGIONS' }),
  row({ guess_count: 4, completed: false, time_seconds: 95, hints_used: 1, player1_guesses: ['<board64>', '<hintMask64>'], solutions: ['<regions64>', '<solution8>'], seed: 'daily-2026-09-25-REGIONS' }),
];

// Letter Ladder: solutions = [START, END, "par:N", "path:…"]; events "+WORD" / "?WORD" hint / "-" undo. guess_count = moves − par + 1.
const ladderRows: MatchRow[] = [
  row({ guess_count: 1, completed: true, time_seconds: 75, hints_used: 0, player1_guesses: ['+CORD', '+CARD', '+WARD', '+WARM'], solutions: ['COLD', 'WARM', 'par:4', 'path:CORD,CARD,WARD,WARM'], seed: 'daily-2026-09-23-LADDER' }),
  row({ guess_count: 1, completed: true, time_seconds: 140, hints_used: 1, player1_guesses: ['+HEAT', '?HEAD', '+HERD', '+HARD'], solutions: ['BEAT', 'HARD', 'par:4', 'path:HEAT,HEAD,HERD,HARD'], seed: 'daily-2026-09-24-LADDER' }),
  row({ guess_count: 3, completed: true, time_seconds: 260, hints_used: 0, player1_guesses: ['+SLAT', '+SLIT', '-', '+SPAT', '+SPIT', '+SPIN', '+SHIN', '+SHIP'], solutions: ['SLAM', 'SHIP', 'par:5', 'path:SLAT,SPAT,SPIT,SPIN,SHIN,SHIP'], seed: 'daily-2026-09-25-LADDER' }),
  row({ guess_count: 2, completed: true, time_seconds: 0, hints_used: 0, player1_guesses: ['+MOLE', '+MALE', '+MALT', '+MELT'], solutions: ['MOLD', 'MELT', 'par:3', 'path:MOLE,MALE,MALT,MELT'], seed: 'unlimited-LADDER-1' }),
  row({ guess_count: 6, completed: false, time_seconds: 400, hints_used: 0, player1_guesses: ['+FEAR', '+FEAT', '+BEAT', '+BEAD', '+BEND', '+BAND', '+BOND', '+FOND', '+FIND'], solutions: ['FEAR', 'FIRE', 'par:4', 'path:FEAT,FIAT,FIRE'], seed: 'daily-2026-09-26-LADDER' }),
];

// Muddle: solutions = [W1..W4, PUNCHLINE]; events "i✓WORD" solved, "i✗TRY" wrong, "ih<mask>" letter hint, "iH" word by hint. guess_count = checks.
const scrambleRows: MatchRow[] = [
  row({ guess_count: 5, completed: true, time_seconds: 112, hints_used: 0, player1_guesses: ['0✓BREAD', '1✓PAGER', '2✓STOOL', '3✓CANDY', '4✓A SLICE OF LIFE'], solutions: ['BREAD', 'PAGER', 'STOOL', 'CANDY', 'A SLICE OF LIFE'], seed: 'daily-2026-09-23-SCRAMBLE' }),
  row({ guess_count: 5, completed: true, time_seconds: 190, hints_used: 1, player1_guesses: ['0✓LEMON', '1h__N___', '1✓BANANA', '2✓GRAPE', '3✓PLUMS', '4✓FRUIT LOOP'], solutions: ['LEMON', 'BANANA', 'GRAPE', 'PLUMS', 'FRUIT LOOP'], seed: 'daily-2026-09-24-SCRAMBLE' }),
  row({ guess_count: 7, completed: true, time_seconds: 240, hints_used: 2, player1_guesses: ['0✗TRAIL', '0✓TRIAL', '1✓JUDGE', '2H', '3✓GAVEL', '4✗ORDER IN COURT', '4✓CASE CLOSED'], solutions: ['TRIAL', 'JUDGE', 'BENCH', 'GAVEL', 'CASE CLOSED'], seed: 'daily-2026-09-25-SCRAMBLE' }),
  row({ guess_count: 13, completed: false, time_seconds: 480, hints_used: 0, player1_guesses: ['0✓PIANO', '1✗VIOLA', '1✗VOILA', '1✓VIOLA', '2✗DRUMS', '2✗DRUMS', '2✗DRUMS', '2✗DRUMS', '2✗DRUMS', '2✗DRUMS', '2✗DRUMS', '2✗DRUMS', '2✗DRUMS'], solutions: ['PIANO', 'VIOLA', 'MUSIC', 'CELLO', 'BAND TOGETHER'], seed: 'daily-2026-09-26-SCRAMBLE' }),
];

// Spyglass: solutions = ["g:<grid>", "t:<title>", "WORD@r,c,d" ×10]; events "+WORD" found, "x r,c>r,c" miss, "?WORD" hint, "!" reveal. guess_count = 10 + misses.
const wsSolutions = ['g:<grid100>', 't:In the Kitchen', 'WHISK@0,0,E', 'LADLE@1,0,E', 'SPOON@2,0,E', 'KNIFE@3,0,E', 'PLATE@4,0,E', 'GLASS@5,0,E', 'BOWL@6,0,E', 'CUP@7,0,E', 'PAN@8,0,E', 'POT@9,0,E'];
const wsFound = ['+WHISK', '+LADLE', '+SPOON', '+KNIFE', '+PLATE', '+GLASS', '+BOWL', '+CUP', '+PAN', '+POT'];
const wordsearchRows: MatchRow[] = [
  row({ guess_count: 10, completed: true, time_seconds: 165, hints_used: 0, player1_guesses: wsFound, solutions: wsSolutions, seed: 'daily-2026-09-23-WORDSEARCH' }),
  row({ guess_count: 12, completed: true, time_seconds: 255, hints_used: 0, player1_guesses: ['x 0,0>0,4', ...wsFound.slice(0, 5), 'x 3,3>3,7', ...wsFound.slice(5)], solutions: wsSolutions, seed: 'daily-2026-09-24-WORDSEARCH' }),
  row({ guess_count: 10, completed: true, time_seconds: 200, hints_used: 1, player1_guesses: ['?WHISK', ...wsFound], solutions: wsSolutions, seed: 'daily-2026-09-25-WORDSEARCH' }),
  row({ guess_count: 15, completed: false, time_seconds: 900, hints_used: 0, player1_guesses: [...wsFound.slice(0, 6), 'x 1,1>1,5', 'x 2,2>2,6', 'x 3,3>3,7', 'x 4,4>4,8', 'x 5,5>5,9', '!'], solutions: wsSolutions, seed: 'daily-2026-09-26-WORDSEARCH' }),
];

// Hubbub: solutions = [id, letters (centre first), max, wordCount, pangramCount]; events "+WORD" scored, "=WORD" bonus, "?ST5" hint, "!WORD" revealed, "#" ended.
// guess_count = rank position (1 Pandemonium … 10 Hush); boards = floor(points × 20 / max).
const hubRows: MatchRow[] = [
  // 4 = Hubbub. Points: TRAIN 5 + RETINAL 7+7 + LATER 5 + ALERT 5 + RAIL 1 + LINEAR 6 = 36 of 60 → 12 of 20.
  row({ guess_count: 4, completed: true, time_seconds: 900, hints_used: 0, player1_guesses: ['+TRAIN', '+RETINAL', '=TALER', '+LATER', '+ALERT', '+RAIL', '+LINEAR'], solutions: ['h-0001', 'ATLNEIR', '60', '24', '2'], seed: 'daily-2026-09-23-HUB' }),
  // 1 = Pandemonium: every point (OUTDOING 8+7, OUTING 6, DUGOUT 6 revealed, DOING 5, DOTING 6, INGOT 5, UNDO 1 = 44 of 44 → 20 of 20).
  row({ guess_count: 1, completed: true, time_seconds: 1500, hints_used: 3, player1_guesses: ['+OUTDOING', '?DU6', '+OUTING', '!DUGOUT', '+DOING', '+DOTING', '+INGOT', '+UNDO'], solutions: ['h-0002', 'OUTGNID', '44', '9', '1'], seed: 'daily-2026-09-24-HUB' }),
  // 8 = Chatter, ended early: 5 of 40 → 2 of 20.
  row({ guess_count: 8, completed: false, time_seconds: 120, hints_used: 0, player1_guesses: ['+CAMP', '+PALM', '=CALM', '#'], solutions: ['h-0003', 'MCAPLOT', '40', '18', '1'], seed: 'daily-2026-09-25-HUB' }),
  // A daily_results-style row that already stores its boards: used as-is, events not rebuilt.
  row({ guess_count: 3, completed: true, time_seconds: 700, hints_used: 0, boards_solved: 15, total_boards: 20, player1_guesses: ['+STARE', '+TEARS', '+ASTER'], solutions: ['h-0004', 'SATERMN', '50', '20', '1'], seed: 'daily-2026-09-26-HUB' }),
];

// Crosswordocious: solutions = ["id|title|WxH", solutionGrid, …answers]; guesses = ["=" + fill, "h" + revealed, "c" + checks]. guess_count = checks + 1.
const crosswordRows: MatchRow[] = [
  row({ guess_count: 1, completed: true, time_seconds: 200, hints_used: 0, player1_guesses: ['=<fill25>', 'h<mask25>', 'c0'], solutions: ['cw-0001|Kitchen Sayings|5x5', '<grid25>', 'SALT', 'PEPPER'], seed: 'daily-2026-09-23-CROSSWORD' }),
  row({ guess_count: 3, completed: true, time_seconds: 430, hints_used: 0, player1_guesses: ['=<fill25>', 'h<mask25>', 'c2'], solutions: ['cw-0002|Garden Sayings|5x5', '<grid25>', 'ROSE', 'THORN'], seed: 'daily-2026-09-24-CROSSWORD' }),
  row({ guess_count: 1, completed: true, time_seconds: 360, hints_used: 2, player1_guesses: ['=<fill25>', 'h<mask25>', 'c0'], solutions: ['cw-0003|Sea Sayings|5x5', '<grid25>', 'TIDE', 'WAVE'], seed: 'daily-2026-09-25-CROSSWORD' }),
  row({ guess_count: 2, completed: false, time_seconds: 150, hints_used: 0, player1_guesses: ['=<fill25>', 'h<mask25>', 'c1'], solutions: ['cw-0004|Sky Sayings|5x5', '<grid25>', 'STAR', 'CLOUD'], seed: 'daily-2026-09-26-CROSSWORD' }),
];

// Codebreaker: solutions = [text, key26, id]; guesses = ["=" + mapping26, "h" + mask26, "c" + checks]. guess_count = checks + 1.
const cryptogramRows: MatchRow[] = [
  row({ guess_count: 1, completed: true, time_seconds: 300, hints_used: 0, player1_guesses: ['=<mapping26>', 'h<mask26>', 'c0'], solutions: ['THE EARLY BIRD CATCHES THE WORM', '<key26>', 'cg-0001'], seed: 'daily-2026-09-23-CRYPTOGRAM' }),
  row({ guess_count: 2, completed: true, time_seconds: 480, hints_used: 1, player1_guesses: ['=<mapping26>', 'h<mask26>', 'c1'], solutions: ['A STITCH IN TIME SAVES NINE', '<key26>', 'cg-0002'], seed: 'daily-2026-09-24-CRYPTOGRAM' }),
  row({ guess_count: 1, completed: false, time_seconds: 300, hints_used: 0, player1_guesses: ['=<mapping26>', 'h<mask26>', 'c0'], solutions: ['LOOK BEFORE YOU LEAP', '<key26>', 'cg-0003'], seed: 'daily-2026-09-25-CRYPTOGRAM' }),
];

// Kindred: solutions = ["tier|LABEL|W1,W2,W3,W4" ×4]; events "+t:…" solved, "x1:…" one away, "x0:…" miss, "?ct" / "?p:A,B" hints, "~n" shuffle.
// guess_count = submissions on a win (4 perfect … 7), groups found + 4 on a loss.
const groupsSolutions = ['1|FRUIT|APPLE,PEAR,PLUM,FIG', '2|SHADES OF RED|RUBY,CHERRY,SCARLET,ROSE', '3|___ PIE|APPLE,MUD,HUMBLE,CUTIE', '4|ANAGRAMS OF STOP|POTS,TOPS,OPTS,POST'];
const groupsRows: MatchRow[] = [
  row({ guess_count: 4, completed: true, time_seconds: 95, hints_used: 0, player1_guesses: ['+4:OPTS,POST,POTS,TOPS', '+3:APPLE,CUTIE,HUMBLE,MUD', '+2:CHERRY,ROSE,RUBY,SCARLET', '+1:APPLE,FIG,PEAR,PLUM'], solutions: groupsSolutions, seed: 'daily-2026-09-23-GROUPS' }),
  row({ guess_count: 6, completed: true, time_seconds: 240, hints_used: 0, player1_guesses: ['~1', 'x1:APPLE,FIG,PEAR,ROSE', '+1:APPLE,FIG,PEAR,PLUM', 'x0:CHERRY,MUD,OPTS,ROSE', '+2:CHERRY,ROSE,RUBY,SCARLET', '+3:APPLE,CUTIE,HUMBLE,MUD', '+4:OPTS,POST,POTS,TOPS'], solutions: groupsSolutions, seed: 'daily-2026-09-24-GROUPS' }),
  row({ guess_count: 4, completed: true, time_seconds: 180, hints_used: 1, player1_guesses: ['?c1', '+1:APPLE,FIG,PEAR,PLUM', '+2:CHERRY,ROSE,RUBY,SCARLET', '+4:OPTS,POST,POTS,TOPS', '+3:APPLE,CUTIE,HUMBLE,MUD'], solutions: groupsSolutions, seed: 'daily-2026-09-25-GROUPS' }),
  row({ guess_count: 5, completed: false, time_seconds: 400, hints_used: 0, player1_guesses: ['+4:OPTS,POST,POTS,TOPS', 'x0:APPLE,MUD,ROSE,RUBY', 'x1:APPLE,FIG,PEAR,ROSE', 'x1:CHERRY,RUBY,SCARLET,PLUM', 'x0:APPLE,CUTIE,ROSE,FIG'], solutions: groupsSolutions, seed: 'daily-2026-09-26-GROUPS' }),
];

// [dbKey, semantics, guessBase, totals, matches]. Word modes on the default
// profile, Gauntlet's and ProperNoundle's panel exceptions, then an empty and a
// realistic case for every custom game's profile.
const CASES: Array<[string, string, number, StatTotals, MatchRow[]]> = [
  ['DUEL', 'guesses', 1, { wins: 41, losses: 6, totalGames: 47, bestScore: 2, fastestTime: 38, streak: 3, bestStreak: 12 }, []],
  ['DUEL', 'guesses', 1, ZERO, []],
  ['QUORDLE', 'guesses', 4, { wins: 10, losses: 5, totalGames: 15, bestScore: 5, fastestTime: 125, streak: 0, bestStreak: 4 }, []],
  ['OCTORDLE', 'guesses', 8, { wins: 3, losses: 1, totalGames: 4, bestScore: 10, fastestTime: 600, streak: 1, bestStreak: 1 }, []],
  ['GAUNTLET', 'guesses', 21, { wins: 7, losses: 9, totalGames: 16, bestScore: 29, fastestTime: 1499, streak: 2, bestStreak: 2 }, []],
  ['PROPERNOUNDLE', 'guesses', 1, { wins: 18, losses: 2, totalGames: 20, bestScore: 1, fastestTime: 59, streak: 5, bestStreak: 9 }, []],
  ['PROPERNOUNDLE', 'guesses', 1, ZERO, []],

  ['SUDOKU', 'mistakes', 1, ZERO, []],
  ['SUDOKU', 'mistakes', 1, { wins: 4, losses: 1, totalGames: 5, bestScore: 1, fastestTime: 238, streak: 0, bestStreak: 4 }, sudokuRows],
  ['SUDOKU', 'mistakes', 1, { wins: 36, losses: 5, totalGames: 41, bestScore: 1, fastestTime: 238, streak: 6, bestStreak: 14 }, []],
  ['REGIONS', 'mistakes', 1, ZERO, []],
  ['REGIONS', 'mistakes', 1, { wins: 2, losses: 1, totalGames: 3, bestScore: 1, fastestTime: 130, streak: 0, bestStreak: 2 }, regionsRows],

  ['LADDER', 'overPar', 1, ZERO, []],
  ['LADDER', 'overPar', 1, { wins: 4, losses: 1, totalGames: 5, bestScore: 1, fastestTime: 75, streak: 0, bestStreak: 4 }, ladderRows],
  ['LADDER', 'overPar', 1, { wins: 2, losses: 1, totalGames: 3, bestScore: 3, fastestTime: 240, streak: 1, bestStreak: 1 }, []],

  ['SCRAMBLE', 'checks', 5, ZERO, []],
  ['SCRAMBLE', 'checks', 5, { wins: 3, losses: 1, totalGames: 4, bestScore: 5, fastestTime: 112, streak: 0, bestStreak: 3 }, scrambleRows],

  ['WORDSEARCH', 'misses', 10, ZERO, []],
  ['WORDSEARCH', 'misses', 10, { wins: 3, losses: 1, totalGames: 4, bestScore: 10, fastestTime: 165, streak: 0, bestStreak: 3 }, wordsearchRows],

  ['HUB', 'rank', 1, ZERO, []],
  ['HUB', 'rank', 1, { wins: 3, losses: 1, totalGames: 4, bestScore: 1, fastestTime: 700, streak: 1, bestStreak: 2 }, hubRows],
  ['HUB', 'rank', 1, { wins: 30, losses: 4, totalGames: 34, bestScore: 1, fastestTime: 1500, streak: 8, bestStreak: 11 }, []],

  ['CROSSWORD', 'checks', 1, ZERO, []],
  ['CROSSWORD', 'checks', 1, { wins: 3, losses: 1, totalGames: 4, bestScore: 1, fastestTime: 200, streak: 0, bestStreak: 3 }, crosswordRows],
  ['CRYPTOGRAM', 'checks', 1, ZERO, []],
  ['CRYPTOGRAM', 'checks', 1, { wins: 2, losses: 1, totalGames: 3, bestScore: 1, fastestTime: 300, streak: 0, bestStreak: 2 }, cryptogramRows],

  ['GROUPS', 'guesses', 4, ZERO, []],
  ['GROUPS', 'guesses', 4, { wins: 3, losses: 1, totalGames: 4, bestScore: 4, fastestTime: 95, streak: 0, bestStreak: 3 }, groupsRows],
];

const fixtures = CASES.map(([dbKey, semantics, guessBase, totals, matches]) => {
  const aggregates = modeAggregates(dbKey, matches, guessBase);
  return {
    dbKey, semantics, guessBase, totals, matches, aggregates,
    lines: statLines(dbKey, totals, semantics, guessBase, aggregates),
    panels: statPanels(dbKey, semantics),
  };
});

const json = JSON.stringify(fixtures, null, 2) + '\n';
const targets = [
  join(repoRoot, 'apps/web/lib/__fixtures__/mode-stats-fixtures.json'),
  join(repoRoot, 'apps/android/app/src/test/resources/fixtures/mode-stats-fixtures.json'),
  join(repoRoot, 'apps/ios/Tests/Fixtures/mode-stats-fixtures.json'),
];
for (const t of targets) {
  writeFileSync(t, json);
  console.log('wrote', t.replace(repoRoot + '/', ''));
}
console.log(`\n${fixtures.length} mode-stats fixtures generated.`);
