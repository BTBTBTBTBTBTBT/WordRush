// Re-runs the web composite-scoring function against the committed shared
// fixtures and fails if any total drifts. This is the WEB end of the
// cross-platform guard (iOS/Android assert the same JSON in their own test
// suites). If this fails after an intentional formula change, regenerate:
//   node scripts/gen-composite-scoring-fixtures.mjs
//
// Requires Node ≥ 22 (TypeScript type-stripping; default-on in 23.6+/24).

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { calculateCompositeScore } from '../lib/composite-scoring.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(
  readFileSync(join(here, '..', 'lib', '__fixtures__', 'composite-scoring-fixtures.json'), 'utf8'),
);

let failures = 0;
for (const { name, input: i, expectedTotal } of fixtures) {
  const got = calculateCompositeScore(
    i.gameMode, i.completed, i.guessCount, i.timeSeconds, i.boardsSolved, i.totalBoards, i.hintsUsed,
    i.stagesCompleted ?? undefined, i.bestCorrectLetters ?? undefined, i.dateKey ?? undefined,
  );
  if (got !== expectedTotal) {
    failures++;
    console.error(`✗ ${name}: expected ${expectedTotal}, got ${got}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures}/${fixtures.length} composite-scoring fixtures FAILED.`);
  console.error('If this was an intentional change, run: node scripts/gen-composite-scoring-fixtures.mjs');
  process.exit(1);
}
console.log(`✓ all ${fixtures.length} composite-scoring fixtures pass (web)`);
