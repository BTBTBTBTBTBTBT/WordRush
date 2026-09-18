// §265 helper: finds post-cutover daily seeds whose deal lands on a swapped
// index (pinned as cross-platform examples in the native tests), and lists
// swapped-out words still due to be dealt BEFORE the cutover.
//   apps/server/node_modules/.bin/tsx packages/core/scripts/scan-solution-swaps.ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { initDictionary, initDictionaryForLength, _setTodayForTests } from '../src/dictionary';
import { generateSolutionsFromSeed, generateSolutionsFromSeedForLength } from '../src/seed';
import { SOLUTION_SWAPS, SOLUTION_SWAP_CUTOVER_DATE } from '../src/solution-swaps';

const D = join(__dirname, '..', '..', '..', 'apps', 'web', 'data');
const J = (f: string) => JSON.parse(readFileSync(join(D, f), 'utf-8'));
initDictionary(J('allowed.json'), J('solutions.json'), J('solutions-legacy.json'));
initDictionaryForLength(6, J('allowed-6.json'), J('solutions-6.json'), J('solutions-6-legacy.json'));
initDictionaryForLength(7, J('allowed-7.json'), J('solutions-7.json'), J('solutions-7-legacy.json'));
_setTodayForTests('2026-09-01');

const MODES5: [string, number][] = [['DUEL', 1], ['QUORDLE', 4], ['OCTORDLE', 8], ['SEQUENCE', 4], ['RESCUE', 4], ['GAUNTLET', 21]];
const news = new Set(Object.values(SOLUTION_SWAPS));
const olds = new Set(Object.keys(SOLUTION_SWAPS));
const day = (d: Date) => d.toISOString().slice(0, 10);
const pinned: any[] = []; const pending: string[] = [];
for (let t = Date.parse('2026-09-18T00:00:00Z'); t <= Date.parse('2026-12-31T00:00:00Z'); t += 86400000) {
  const date = day(new Date(t));
  const cases: [string, number, number][] = [...MODES5.map(([m, c]) => [`daily-${date}-${m}`, c, 5] as [string, number, number]),
    [`daily-${date}-DUEL_6`, 1, 6], [`daily-${date}-DUEL_7`, 1, 7]];
  for (const [seed, count, len] of cases) {
    const sols = len === 5 ? generateSolutionsFromSeed(seed, count) : generateSolutionsFromSeedForLength(seed, count, len);
    if (date < SOLUTION_SWAP_CUTOVER_DATE) { for (const w of sols) if (olds.has(w)) pending.push(`${date} ${seed.split('-').pop()} ${w}`); }
    else if (sols.some((w) => news.has(w)) && pinned.filter((p) => p.length === len).length < 3) pinned.push({ seed, count, length: len, solutions: sols });
    if (date >= SOLUTION_SWAP_CUTOVER_DATE && sols.some((w) => olds.has(w))) throw new Error(`swapped-out word dealt post-cutover: ${seed} ${sols}`);
  }
}
console.log(JSON.stringify({ pendingBeforeCutover: pending, pinned }, null, 1));
