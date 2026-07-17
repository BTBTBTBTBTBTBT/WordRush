// Generates the shared display-format fixtures from the web source of truth
// (lib/composite-scoring.ts formatScore + lib/format.ts) and writes an
// identical copy into each platform's test-resource dir. The iOS
// (Sources/Core/Format.swift) and Android (ui/Format.kt + ModeCatalog
// formatScore) ports load the same JSON and assert byte-identical strings —
// the display-format half of the parity guard (composite-scoring fixtures pin
// the score VALUE; these pin how it and its neighbors are SHOWN).
//
// Born from three live divergences: iOS profile/records scores showed "2332"
// where web/Android showed "2,332"; the rank badge said "Top 12%" on web but
// "Top 13%" on native for the same rank (round vs truncate — ROUND is
// canonical, user decision 2026-07-16); and t=0 rendered "0s" on web/Android
// but "—" on iOS.
//
//   Regenerate after any formatter change:  node scripts/gen-display-format-fixtures.mjs
//
// Requires Node ≥ 22 (TypeScript type-stripping). Node 23.6+/24 enable it by default.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { formatScore } from '../lib/composite-scoring.ts';
import { topPercentLabel, formatShortTime } from '../lib/format.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

// Expected values are COMPUTED from the web implementations (never hand-typed)
// so the fixtures always match the source of truth.
const SCORE_CASES = [0, 36, 999.99, 1000, 1365, 1713.6, 2332.8, 123456.4, 1234567.9];
const TIME_CASES = [0, 1, 9, 59, 60, 61, 119, 120, 125, 599, 3599, 3600];
const PERCENTILE_CASES = [
  [1, 2], [2, 2], [1, 8], [2, 8], [4, 8], [8, 8], [1, 100], [25, 100], [26, 100], [100, 100], [2, 3],
];

const fixtures = {
  formatScore: SCORE_CASES.map((score) => ({ score, expected: formatScore(score) })),
  formatShortTime: TIME_CASES.map((seconds) => ({ seconds, expected: formatShortTime(seconds) })),
  topPercentLabel: PERCENTILE_CASES.map(([rank, totalPlayers]) => {
    const { label, gold } = topPercentLabel(rank, totalPlayers);
    return { rank, totalPlayers, expectedLabel: label, expectedGold: gold };
  }),
};

const json = JSON.stringify(fixtures, null, 2) + '\n';
const targets = [
  join(repoRoot, 'apps/web/lib/__fixtures__/display-format-fixtures.json'),
  join(repoRoot, 'apps/android/app/src/test/resources/fixtures/display-format-fixtures.json'),
  join(repoRoot, 'apps/ios/Tests/Fixtures/display-format-fixtures.json'),
];
for (const t of targets) {
  writeFileSync(t, json);
  console.log('wrote', t.replace(repoRoot + '/', ''));
}
console.log(`\n${fixtures.formatScore.length + fixtures.formatShortTime.length + fixtures.topPercentLabel.length} cases generated.`);
