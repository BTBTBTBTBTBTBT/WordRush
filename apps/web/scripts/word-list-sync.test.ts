import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the hand-synced word-list copies. The same 9 JSON lists ship in three
 * app bundles and two native test-fixture dirs; nothing else asserts they stay
 * identical, and `curate-solutions.py --write` historically skipped the
 * fixture dirs for solutions*.json — this test is what turns silent drift into
 * a red build. On failure: run `python3 scripts/curate-solutions.py --write`
 * (or copy the canonical apps/web/data file over the divergent path shown).
 */
const repoRoot = join(__dirname, '..', '..', '..');

const WORD_LIST_DIRS = [
  'apps/web/data',
  'apps/ios/Wordocious/Resources',
  'apps/android/core/src/main/resources/data',
  'apps/ios/Tests/Fixtures',
  'apps/android/core/src/test/resources/fixtures',
];

const WORD_LISTS = [
  'allowed.json',
  'allowed-6.json',
  'allowed-7.json',
  'solutions.json',
  'solutions-6.json',
  'solutions-7.json',
  'solutions-legacy.json',
  'solutions-6-legacy.json',
  'solutions-7-legacy.json',
];

// propernoundle-puzzles.json has no fixture copies — bundles only.
const PN_PUZZLE_DIRS = [
  'apps/web/data',
  'apps/ios/Wordocious/Resources',
  'apps/android/core/src/main/resources/data',
];

const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('bundled word-list copies are identical everywhere', () => {
  for (const list of WORD_LISTS) {
    it(list, () => {
      const canonical = sha(join(repoRoot, WORD_LIST_DIRS[0], list));
      for (const dir of WORD_LIST_DIRS.slice(1)) {
        expect(
          sha(join(repoRoot, dir, list)),
          `${dir}/${list} differs from ${WORD_LIST_DIRS[0]}/${list} — run scripts/curate-solutions.py --write`,
        ).toBe(canonical);
      }
    });
  }

  it('propernoundle-puzzles.json', () => {
    const canonical = sha(join(repoRoot, PN_PUZZLE_DIRS[0], 'propernoundle-puzzles.json'));
    for (const dir of PN_PUZZLE_DIRS.slice(1)) {
      expect(
        sha(join(repoRoot, dir, 'propernoundle-puzzles.json')),
        `${dir}/propernoundle-puzzles.json differs from the web copy — copy apps/web/data/propernoundle-puzzles.json over it`,
      ).toBe(canonical);
    }
  });
});
