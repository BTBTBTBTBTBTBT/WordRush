import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { join } from 'node:path';
import { renderSeedFixtures, renderPrefillFixtures } from '../scripts/gen-parity-fixtures';

// Freshness guard for the cross-platform engine-parity fixtures. The Swift and
// Kotlin ports assert against the committed JSON; this test asserts the
// committed JSON still matches what the TS core produces with the CURRENT
// word lists. If a curation run (or engine change) lands without regenerating,
// this fails here — on the web/TS side — instead of surfacing days later as
// mysterious native test failures (which is exactly what happened when the
// 2026-07 curation left these stale; see gen-parity-fixtures.ts).
const repo = join(__dirname, '..', '..', '..');
const FIXTURE_COPIES = [
  join(repo, 'apps', 'ios', 'Tests', 'Fixtures'),
  join(repo, 'apps', 'android', 'core', 'src', 'test', 'resources', 'fixtures'),
];

describe('engine parity fixtures are fresh and synced', () => {
  const rendered: Array<[string, string]> = [
    ['seed-fixtures.json', JSON.stringify(renderSeedFixtures(), null, 2) + '\n'],
    ['prefill-fixtures.json', JSON.stringify(renderPrefillFixtures(), null, 2) + '\n'],
  ];

  for (const [name, expected] of rendered) {
    for (const dir of FIXTURE_COPIES) {
      it(`${name} in ${dir.includes('ios') ? 'iOS' : 'Android'} matches TS core output`, () => {
        const onDisk = fs.readFileSync(join(dir, name), 'utf8');
        expect(onDisk).toBe(expected);
      });
    }
  }
});
