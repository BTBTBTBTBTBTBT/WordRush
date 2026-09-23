import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { applyAllSolutionSwaps } from './solution-swaps';
import { USERNAME_BLOCKED_SUBSTRINGS, USERNAME_BLOCKED_TOKENS } from './username';

/**
 * Answer-pool hygiene (founder, 2026-09-23: "please continue to get rid of
 * profanity like fucker and blowjob"). The pools are ORDER-LOCKED, so a bad
 * answer is never deleted — it is swapped in place via solution-swaps.ts. This
 * test looks at the pools AS DEALT once every swap batch is live and fails the
 * moment a profane or slur word is (or becomes) an answer, so the next one is
 * caught at commit time rather than on a player's screen.
 *
 * Three sources, because each alone has holes:
 *  1. The app-wide hard profanity vocabulary (USERNAME_BLOCKED_SUBSTRINGS +
 *     USERNAME_BLOCKED_TOKENS — the same lists scripts/export-profanity-terms.ts
 *     flattens into scripts/data/profanity-exact.generated.txt), matched as
 *     EXACT words. This is how FUCKER/FUCKING/SHITTY slipped through: the list
 *     carries FUCK and SHIT, not their inflections.
 *  2. scripts/data/offensive-blocklist.txt (slurs), exact words.
 *  3. A short list of hard profanity ROOTS matched as substrings, so
 *     inflections and compounds (FUCKER, BLOWJOBS, SLUTTY…) cannot slip past
 *     an exact list again. Kept short and unambiguous: WANK would flag SWANKY
 *     if it were in a pool, so each root is checked against the real pools and
 *     any genuine false positive gets an explicit exemption below.
 */
const D = join(__dirname, '..', '..', '..', 'apps', 'web', 'data');
const J = (f: string): string[] => JSON.parse(readFileSync(join(D, f), 'utf-8')).map((w: string) => w.toUpperCase());
const listFile = (f: string): string[] =>
  readFileSync(join(__dirname, '..', '..', '..', 'scripts', 'data', f), 'utf-8')
    .split(/\r?\n/).map((l) => l.trim().toUpperCase()).filter((l) => l && !l.startsWith('#'));

const HARD_ROOTS = [
  'FUCK', 'SHIT', 'CUNT', 'BLOWJOB', 'HANDJOB', 'WANK', 'TWAT', 'NIGG', 'FAGG',
  'SLUT', 'WHORE', 'PUSSY', 'JIZZ', 'DILDO', 'RAPIST',
];

/**
 * Words the founder has NOT ruled on (2026-09-23): they sit in a blocklist for
 * another purpose (SLANT is a slur only as a username; the rest are on the
 * Word-of-the-Day taste list, which is display-only) but read as ordinary
 * dictionary entries in a puzzle. Listed here so the exact-match sources do not
 * fail the build on them; remove a word from this list the day it is swapped.
 * Roots are never exempted.
 */
const PENDING_FOUNDER_CALL = new Set([
  'BOOZE', 'VOMIT', 'DRUNK', 'URINE', 'OPIUM', 'NAKED', 'SLAVE', 'SLANT',
  'DAMNED', 'DAMNING', 'SLAVERY', 'COLORED', 'HOSPICE', 'DRUNKEN',
]);

describe('answer-pool hygiene (pools as dealt once every swap batch is live)', () => {
  const hardExact = new Set([...USERNAME_BLOCKED_SUBSTRINGS, ...USERNAME_BLOCKED_TOKENS].map((t) => t.toUpperCase()));
  const slurs = new Set(listFile('offensive-blocklist.txt'));
  const pools: Record<string, string[]> = {
    'solutions.json': applyAllSolutionSwaps(J('solutions.json')),
    'solutions-6.json': applyAllSolutionSwaps(J('solutions-6.json')),
    'solutions-7.json': applyAllSolutionSwaps(J('solutions-7.json')),
  };

  it('the sources loaded', () => {
    expect(hardExact.size).toBeGreaterThan(30);
    expect(slurs.size).toBeGreaterThan(20);
    for (const pool of Object.values(pools)) expect(pool.length).toBeGreaterThan(1000);
  });

  for (const [file, pool] of Object.entries(pools)) {
    it(`${file}: no answer is an exact hard-profanity or slur term`, () => {
      const hits = pool.filter((w) => (hardExact.has(w) || slurs.has(w)) && !PENDING_FOUNDER_CALL.has(w));
      expect(hits, `swap these in place via solution-swaps.ts: ${hits.join(' ')}`).toEqual([]);
    });

    it(`${file}: no answer contains a hard profanity root`, () => {
      const hits = pool.filter((w) => HARD_ROOTS.some((r) => w.includes(r)));
      expect(hits, `swap these in place via solution-swaps.ts: ${hits.join(' ')}`).toEqual([]);
    });
  }

  it('the pending list only holds words that are actually still answers (prune it as they are swapped)', () => {
    const all = new Set(Object.values(pools).flat());
    for (const w of PENDING_FOUNDER_CALL) expect(all.has(w), `${w} is no longer an answer — drop it from PENDING_FOUNDER_CALL`).toBe(true);
  });
});
