// Generates the shared mode-stats fixtures from the web source of truth
// (lib/mode-stats.ts) and writes an identical copy into each platform's
// test-resource dir. ModeStats.swift and ModeStats.kt load the same JSON and
// assert byte-identical lines and panels — the per-mode stats half of the
// parity guard (More Games §18).
//
//   Regenerate after any registry change:  apps/server/node_modules/.bin/tsx scripts/gen-mode-stats-fixtures.ts
//   (tsx, like packages/core/scripts/gen-parity-fixtures.ts: the registry imports ./format without an extension)
//


import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { statLines, statPanels, type StatTotals } from '../lib/mode-stats';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

// [dbKey, semantics, guessBase, totals]. Word modes on the default profile,
// Gauntlet's panel exception, and the custom semantics families so the "Best"
// reading is pinned before any game lands.
const CASES: Array<[string, string, number, StatTotals]> = [
  ['DUEL', 'guesses', 1, { wins: 41, losses: 6, totalGames: 47, bestScore: 2, fastestTime: 38, streak: 3, bestStreak: 12 }],
  ['DUEL', 'guesses', 1, { wins: 0, losses: 0, totalGames: 0, bestScore: 0, fastestTime: 0, streak: 0, bestStreak: 0 }],
  ['QUORDLE', 'guesses', 4, { wins: 10, losses: 5, totalGames: 15, bestScore: 5, fastestTime: 125, streak: 0, bestStreak: 4 }],
  ['OCTORDLE', 'guesses', 8, { wins: 3, losses: 1, totalGames: 4, bestScore: 10, fastestTime: 600, streak: 1, bestStreak: 1 }],
  ['GAUNTLET', 'guesses', 21, { wins: 7, losses: 9, totalGames: 16, bestScore: 29, fastestTime: 1499, streak: 2, bestStreak: 2 }],
  ['PROPERNOUNDLE', 'guesses', 1, { wins: 18, losses: 2, totalGames: 20, bestScore: 1, fastestTime: 59, streak: 5, bestStreak: 9 }],
  ['SUDOKU', 'mistakes', 1, { wins: 36, losses: 5, totalGames: 41, bestScore: 1, fastestTime: 238, streak: 6, bestStreak: 14 }],
  ['SUDOKU', 'mistakes', 1, { wins: 1, losses: 0, totalGames: 1, bestScore: 3, fastestTime: 900, streak: 1, bestStreak: 1 }],
  ['SCRAMBLE', 'checks', 5, { wins: 12, losses: 3, totalGames: 15, bestScore: 5, fastestTime: 112, streak: 2, bestStreak: 6 }],
  ['CROSSWORD', 'checks', 1, { wins: 4, losses: 0, totalGames: 4, bestScore: 1, fastestTime: 200, streak: 4, bestStreak: 4 }],
  ['LADDER', 'overPar', 1, { wins: 20, losses: 4, totalGames: 24, bestScore: 1, fastestTime: 75, streak: 0, bestStreak: 7 }],
  ['LADDER', 'overPar', 1, { wins: 2, losses: 1, totalGames: 3, bestScore: 3, fastestTime: 240, streak: 1, bestStreak: 1 }],
  ['WORDSEARCH', 'misses', 10, { wins: 9, losses: 1, totalGames: 10, bestScore: 10, fastestTime: 165, streak: 3, bestStreak: 5 }],
  ['HUB', 'rank', 1, { wins: 30, losses: 4, totalGames: 34, bestScore: 1, fastestTime: 1500, streak: 8, bestStreak: 11 }],
  ['REGIONS', 'mistakes', 1, { wins: 5, losses: 2, totalGames: 7, bestScore: 2, fastestTime: 130, streak: 1, bestStreak: 3 }],
];

const fixtures = CASES.map(([dbKey, semantics, guessBase, totals]) => ({
  dbKey, semantics, guessBase, totals,
  lines: statLines(dbKey, totals, semantics, guessBase),
  panels: statPanels(dbKey, semantics),
}));

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
