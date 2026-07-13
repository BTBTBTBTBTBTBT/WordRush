// Generates the shared composite-scoring fixtures from the web source of truth
// (lib/composite-scoring.ts) and writes an identical copy into each platform's
// test-resource dir. The iOS (DailyScoring.swift) and Android (DailyScoring.kt)
// ports load the same JSON and assert byte-identical scores — that's the
// cross-platform parity guard.
//
//   Regenerate after any scoring-math change:  node scripts/gen-composite-scoring-fixtures.mjs
//   Verify without regenerating (web side):     node scripts/check-composite-scoring.mjs
//
// Requires Node ≥ 22 (TypeScript type-stripping). Node 23.6+/24 enable it by default.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { calculateCompositeScore } from '../lib/composite-scoring.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

// Canonical cases. Each exercises a distinct branch of computeScoreBreakdown;
// expectedTotal is COMPUTED here (never hand-typed) so the fixtures always match
// the web formula, and the native ports are validated against them.
const CASES = [
  // Wins (unchanged path)
  ['classic win, 27s',           'DUEL',          true,  3, 27,  1, 1,  0, null, null],
  ['quadword win',               'QUORDLE',       true,  6, 120, 4, 4,  0, null, null],
  ['octoword win',               'OCTORDLE',      true,  9, 300, 8, 8,  0, null, null],
  ['deliverance win',            'RESCUE',        true,  5, 100, 4, 4,  0, null, null],
  ['six win, no hints',          'DUEL_6',        true,  4, 60,  1, 1,  0, null, null],
  ['six win, one hint penalty',  'DUEL_6',        true,  4, 60,  1, 1,  1, null, null],
  ['gauntlet win (sweep run)',   'GAUNTLET',      true,  30, 600, 21, 21, 0, 5,    null],

  // Multi-board losses (UNCHANGED: proportional boards bonus)
  ['quadword loss 2/4',          'QUORDLE',       false, 9,  300, 2, 4,  0, null, null],
  ['quadword loss 3/4',          'QUORDLE',       false, 9,  300, 3, 4,  0, null, null],
  ['octoword loss 4/8',          'OCTORDLE',      false, 13, 600, 4, 8,  0, null, null],
  ['octoword loss 6/8',          'OCTORDLE',      false, 13, 600, 6, 8,  0, null, null],
  ['succession loss 1/4',        'SEQUENCE',      false, 10, 300, 1, 4,  0, null, null],

  // Single-board losses (NEW: 12 × best green letters)
  ['classic loss, whiff',        'DUEL',          false, 6,  120, 0, 1,  0, null, 0],
  ['classic loss, 2 greens',     'DUEL',          false, 6,  120, 0, 1,  0, null, 2],
  ['classic loss, one away (4)', 'DUEL',          false, 6,  200, 0, 1,  0, null, 4],
  ['six loss, 3 greens',         'DUEL_6',        false, 7,  200, 0, 1,  0, null, 3],
  ['proper loss, 2 greens',      'PROPERNOUNDLE', false, 6,  200, 0, 1,  0, null, 2],

  // Gauntlet losses (NEW: stage-depth ladder + per-board tiebreak)
  ['gauntlet loss, fail stage 1',        'GAUNTLET', false, 4,  60,  0,  21, 0, 0, null],
  ['gauntlet loss, reach stage 2',       'GAUNTLET', false, 14, 300, 5,  21, 0, 2, null],
  ['gauntlet loss, stage 2 w/ 3 boards', 'GAUNTLET', false, 18, 400, 8,  21, 0, 2, null],
  ['gauntlet loss, reach stage 4',       'GAUNTLET', false, 30, 700, 13, 21, 0, 4, null],
  ['gauntlet loss, stage 4 w/ 6 boards', 'GAUNTLET', false, 40, 900, 19, 21, 0, 4, null],
];

// Every case is emitted TWICE: once with a pre-cutover dateKey (frozen V1
// formula) and once with a post-cutover dateKey (current V2 guess-first
// formula), so all three ports are pinned on both sides of the scoring gate.
const DATE_VARIANTS = [
  ['v1', '2026-07-13'], // day before SCORING_CUTOVER_DATE → legacy formula
  ['v2', '2026-07-14'], // cutover day → guess-first formula
];

const fixtures = DATE_VARIANTS.flatMap(([tag, dateKey]) =>
  CASES.map(([name, gameMode, completed, guessCount, timeSeconds, boardsSolved, totalBoards, hintsUsed, stagesCompleted, bestCorrectLetters]) => ({
    name: `${name} [${tag}]`,
    input: { gameMode, completed, guessCount, timeSeconds, boardsSolved, totalBoards, hintsUsed, stagesCompleted, bestCorrectLetters, dateKey },
    expectedTotal: calculateCompositeScore(
      gameMode, completed, guessCount, timeSeconds, boardsSolved, totalBoards, hintsUsed,
      stagesCompleted ?? undefined, bestCorrectLetters ?? undefined, dateKey,
    ),
  })));

const json = JSON.stringify(fixtures, null, 2) + '\n';
const targets = [
  join(repoRoot, 'apps/web/lib/__fixtures__/composite-scoring-fixtures.json'),
  join(repoRoot, 'apps/android/app/src/test/resources/fixtures/composite-scoring-fixtures.json'),
  join(repoRoot, 'apps/ios/Tests/Fixtures/composite-scoring-fixtures.json'),
];
for (const t of targets) {
  writeFileSync(t, json);
  console.log('wrote', t.replace(repoRoot + '/', ''));
}
console.log(`\n${fixtures.length} fixtures generated.`);
