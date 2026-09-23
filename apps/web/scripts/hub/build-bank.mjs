// Hubbub (seven-letter hub game) bank builder (More Games §12). Reads the
// shared offline lexicon (scripts/data/lexicon-all.json); clients never see
// it — each puzzle FREEZES its own accepted words, so a later lexicon change can
// never rewrite a played day. Grows the Phase 0 generator into the SHIPPED bank:
//
//   apps/web/data/hub-puzzles.json   { version, epoch, daily[], extra[] }
//
// A puzzle = seven distinct letters (never S), one centre letter, 20–60 common
// words of 4+ letters using only those letters and containing the centre,
// ≥ 1 pangram, max score 60–250, ≤ 35% -ED/-ING, ≥ 3 words of 6+ letters.
// `words` score (4 letters = 1, else length, pangram +7) and set `max`;
// `bonus` = extended-tier words accepted for 0 points. Each letter set is used
// once across the whole bank. Deterministic (seeded) — APPEND-ONLY once shipped.
//
//   node apps/web/scripts/hub/build-bank.mjs [--daily=400] [--extra=200]
import fs from 'node:fs';
import path from 'node:path';
import { REPO, DATA, readJSON, rngFor, shuffle } from '../more-games/lib.mjs';

const arg = (k, d) => Number((process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d);
const DAILY_COUNT = arg('daily', 400);
const EXTRA_COUNT = arg('extra', 200);
const EPOCH = '2026-09-23';

const lex = readJSON(path.join(REPO, 'scripts', 'data', 'lexicon-all.json'));
const mask = (w) => { let m = 0; for (const c of w) m |= 1 << (c.charCodeAt(0) - 65); return m; };
const bits = (m) => { let n = 0; while (m) { n += m & 1; m >>>= 1; } return n; };
const S = 1 << 18;
const prep = (list) => list.filter((w) => /^[A-Z]{4,}$/.test(w)).map((w) => ({ w, m: mask(w) })).filter((x) => bits(x.m) <= 7 && !(x.m & S));
const common = prep(lex.common), bonus = prep([...lex.extended, ...lex.acceptOnly]);
const commonSet = new Set(common.map((x) => x.w));
export const wordScore = (w, isPangram) => (w.length === 4 ? 1 : w.length) + (isPangram ? 7 : 0);

const sets = [...new Set(common.filter((x) => bits(x.m) === 7).map((x) => x.m))];
const candidates = [];
for (const set of sets) {
  const inSet = common.filter((x) => (x.m & ~set) === 0), inBonus = bonus.filter((x) => (x.m & ~set) === 0 && !commonSet.has(x.w));
  for (let b = 0; b < 26; b++) {
    const centre = 1 << b; if (!(set & centre)) continue;
    const words = inSet.filter((x) => x.m & centre); if (words.length < 20 || words.length > 60) continue;
    const pangrams = words.filter((x) => x.m === set).map((x) => x.w);
    const max = words.reduce((t, x) => t + wordScore(x.w, x.m === set), 0);
    const edIng = words.filter((x) => /(ED|ING)$/.test(x.w)).length / words.length;
    const long = words.filter((x) => x.w.length >= 6).length;
    if (!pangrams.length || max < 60 || max > 250 || edIng > 0.35 || long < 3) continue;
    const letters = String.fromCharCode(65 + b) + [...Array(26).keys()].filter((i) => (set >> i) & 1 && i !== b).map((i) => String.fromCharCode(65 + i)).join('');
    candidates.push({ set, letters, words: words.map((x) => x.w).sort(), bonus: inBonus.filter((x) => x.m & centre).map((x) => x.w).sort(), pangrams: pangrams.sort(), max });
  }
}
console.log(`letter sets with a pangram: ${sets.length}; qualifying puzzles: ${candidates.length}`);

const rng = rngFor('hub-bank-v1'), usedSets = new Set(), picked = [];
for (const c of shuffle(candidates, rng)) {
  if (usedSets.has(c.set)) continue; usedSets.add(c.set);
  picked.push(c);
  if (picked.length >= DAILY_COUNT + EXTRA_COUNT) break;
}
if (picked.length < DAILY_COUNT + EXTRA_COUNT) throw new Error(`only ${picked.length} distinct letter sets`);
let serial = 0;
const entry = (c) => { serial++; return { id: `hb${String(serial).padStart(4, '0')}`, letters: c.letters, words: c.words, bonus: c.bonus, pangrams: c.pangrams, max: c.max }; };
const daily = picked.slice(0, DAILY_COUNT).map(entry);
const extra = picked.slice(DAILY_COUNT).map(entry);

const bank = { version: 1, epoch: EPOCH, daily, extra };
const out = path.join(DATA, 'hub-puzzles.json');
fs.writeFileSync(out, JSON.stringify(bank) + '\n');
const avg = (list, f) => (list.reduce((t, p) => t + f(p), 0) / list.length).toFixed(1);
console.log(`daily ${daily.length}, extra ${extra.length}; avg words ${avg(daily, (p) => p.words.length)}, avg max ${avg(daily, (p) => p.max)}, avg bonus ${avg(daily, (p) => p.bonus.length)}`);
console.log('wrote', out, `${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
console.log('first dailies:', daily.slice(0, 4).map((p) => `${p.id} ${p.letters[0]}·${p.letters.slice(1)} ${p.words.length}w max ${p.max} pangram ${p.pangrams.join('/')}`).join(' | '));
