// Hubbub (seven-letter hub game) bank generator. Reads the shared offline
// lexicon; clients never see it — each puzzle freezes its own accepted words,
// so a later lexicon change can never rewrite a played day.
//   node scripts/hub/build-bank.mjs [--count=N]
import path from 'node:path';
import { REPO, readJSON, rngFor, shuffle, writeSample } from '../more-games/lib.mjs';

const COUNT = Number((process.argv.find((a) => a.startsWith('--count=')) || '').split('=')[1] || 10);
const lex = readJSON(path.join(REPO, 'scripts', 'data', 'lexicon-all.json'));
const mask = (w) => { let m = 0; for (const c of w) m |= 1 << (c.charCodeAt(0) - 65); return m; };
const bits = (m) => { let n = 0; while (m) { n += m & 1; m >>>= 1; } return n; };
const S = 1 << 18;
const prep = (list) => list.filter((w) => w.length >= 4).map((w) => ({ w, m: mask(w) })).filter((x) => bits(x.m) <= 7 && !(x.m & S));
const common = prep(lex.common), bonus = prep([...lex.extended, ...lex.acceptOnly]);
export const wordScore = (w, isPangram) => (w.length === 4 ? 1 : w.length) + (isPangram ? 7 : 0);
export const RANKS = [['Hush', 0], ['Murmur', 5], ['Chatter', 12], ['Banter', 20], ['Clamor', 30], ['Racket', 40], ['Hubbub', 50], ['Uproar', 70], ['Thunder', 85], ['Pandemonium', 100]];

const sets = [...new Set(common.filter((x) => bits(x.m) === 7).map((x) => x.m))];
const candidates = [];
for (const set of sets) {
  const inSet = common.filter((x) => (x.m & ~set) === 0), inBonus = bonus.filter((x) => (x.m & ~set) === 0);
  for (let b = 0; b < 26; b++) {
    const centre = 1 << b; if (!(set & centre)) continue;
    const words = inSet.filter((x) => x.m & centre); if (words.length < 20 || words.length > 60) continue;
    const pangrams = words.filter((x) => x.m === set).map((x) => x.w);
    const max = words.reduce((t, x) => t + wordScore(x.w, x.m === set), 0);
    const edIng = words.filter((x) => /(ED|ING)$/.test(x.w)).length / words.length;
    const long = words.filter((x) => x.w.length >= 6).length;
    if (!pangrams.length || max < 60 || max > 250 || edIng > 0.35 || long < 3) continue;
    const letters = String.fromCharCode(65 + b) + [...Array(26).keys()].filter((i) => (set >> i) & 1 && i !== b).map((i) => String.fromCharCode(65 + i)).join('');
    candidates.push({ set, letters, words: words.map((x) => x.w).sort(), bonus: inBonus.filter((x) => x.m & centre).map((x) => x.w).sort(), pangrams, max });
  }
}
console.log(`letter sets with a pangram: ${sets.length}; qualifying puzzles: ${candidates.length}`);
const rng = rngFor('hub-bank-v1'), usedSets = new Set(), out = [];
for (const c of shuffle(candidates, rng)) {
  if (usedSets.has(c.set)) continue; usedSets.add(c.set);
  out.push({ id: `hb${String(out.length + 1).padStart(4, '0')}`, letters: c.letters, words: c.words, bonus: c.bonus, pangrams: c.pangrams, max: c.max,
    ranks: RANKS.map(([name, pct]) => ({ name, points: Math.ceil((pct * c.max) / 100) })) });
  if (out.length >= COUNT) break;
}
const file = writeSample('hubbub.json', { generatedBy: 'apps/web/scripts/hub/build-bank.mjs', qualifying: candidates.length, puzzles: out });
for (const p of out) console.log(`  ${p.id} ${p.letters[0]}·${p.letters.slice(1)}  ${p.words.length} words, max ${p.max}, solved at ${p.ranks[6].points} pts, pangram ${p.pangrams.join('/')}, +${p.bonus.length} bonus`);
console.log('wrote', file);
