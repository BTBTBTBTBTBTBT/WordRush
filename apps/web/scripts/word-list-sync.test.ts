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

/**
 * The invariants that protect ALREADY-PLAYED games from a word-list change.
 *
 * Replaying a finished game (the completed-daily board, VS result detail, every
 * share card) pushes the STORED guesses back through the reducer, and the
 * reducer drops any guess that fails `isValidWord`. So a word that leaves a
 * guess list does not merely stop being typeable — it silently rewrites history
 * for anyone who ever played it, and the wrong board is what gets shared.
 *
 * `--grow-allowed` enforces monotonicity (G7) when it runs. These assert the
 * consequences on what actually ships, so a hand-edit of a JSON file fails here
 * rather than in someone's saved game.
 */
describe('word lists cannot rewrite finished games', () => {
  const read = (name: string): string[] =>
    JSON.parse(readFileSync(join(repoRoot, 'apps/web/data', name), 'utf8')).map((w: string) => w.toUpperCase());
  const offensive = new Set(
    readFileSync(join(repoRoot, 'scripts/data/offensive-blocklist.txt'), 'utf8')
      .split('\n').map((l) => l.trim().toUpperCase()).filter((l) => l && !l.startsWith('#')),
  );

  for (const [n, allowed, solutions, legacy] of [
    [5, 'allowed.json', 'solutions.json', 'solutions-legacy.json'],
    [6, 'allowed-6.json', 'solutions-6.json', 'solutions-6-legacy.json'],
    [7, 'allowed-7.json', 'solutions-7.json', 'solutions-7-legacy.json'],
  ] as Array<[number, string, string, string]>) {
    describe(`${n}-letter`, () => {
      const guesses = new Set(read(allowed));

      // Every answer ever served must stay guessable, or replaying the day it
      // was the answer drops the winning row. Offensive-blocklist words are the
      // one accepted exception (bible §129).
      it('every current and legacy answer is still a valid guess', () => {
        for (const w of [...read(solutions), ...read(legacy)]) {
          if (offensive.has(w)) continue;
          expect(guesses.has(w), `${w} is an answer in ${solutions}/${legacy} but not in ${allowed}`).toBe(true);
        }
      });

      // A wrong-length entry can never be typed on this board, but it can be
      // picked by anything that indexes the list positionally.
      it(`every entry is exactly ${n} letters, sorted and deduplicated`, () => {
        const raw: string[] = JSON.parse(readFileSync(join(repoRoot, 'apps/web/data', allowed), 'utf8'));
        const bad = raw.filter((w) => !new RegExp(`^[A-Z]{${n}}$`).test(w));
        expect(bad, `${allowed} holds entries that are not ${n} uppercase letters`).toEqual([]);
        expect(raw.length, `${allowed} has duplicates`).toBe(new Set(raw).size);
        expect(raw, `${allowed} is not sorted`).toEqual([...raw].sort());
      });

      it('no guess derives from a blocked slur', () => {
        for (const w of guesses) expect(offensive.has(w), `${w} is on the offensive blocklist`).toBe(false);
      });
    });
  }
});
