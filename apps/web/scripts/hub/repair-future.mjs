// Hubbub repair for FUTURE puzzles only (founder, 2026-10-05: "no confusing British jargon").
// A puzzle whose PANGRAM is British (ENROLMENT, YOGHURT, MOTORWAY, CALIBRE, HONOURED):
//  - if it has an American pangram too (ENROLLMENT, CALIBER), the British form moves from the
//    scored list to the 0-point accepted list and `max` is recomputed;
//  - otherwise the puzzle is replaced IN PLACE (same id) by a fresh letter set built with
//    build-bank.mjs's rules (common-tier words, 20–60 words, a non-British pangram, max 60–250,
//    ≤ 35% -ED/-ING, ≥ 3 long words, never S, a letter set unused anywhere in the bank) and its
//    accepted list widened from /usr/share/dict/words exactly like widen-acceptance.mjs.
// Only dailies from CONTENT_RELEASE_DATE, the Unlimited pool and holidays are touched.
//
//   node apps/web/scripts/hub/repair-future.mjs [--from=YYYY-MM-DD] [--dry]
// then copy apps/web/data/hub-puzzles.json to the iOS/Android bundles (word-list-sync pins them).
import fs from 'node:fs';
import path from 'node:path';
import { DATA, REPO, readJSON, rngFor, shuffle } from '../more-games/lib.mjs';
import { CONTENT_RELEASE_DATE } from '../content-release-date.mjs';

const argv = process.argv.slice(2);
const FROM = (argv.find((a) => a.startsWith('--from=')) || `--from=${CONTENT_RELEASE_DATE}`).split('=')[1];
const DRY = argv.includes('--dry');
const bankPath = path.join(DATA, 'hub-puzzles.json');
const bank = readJSON(bankPath);

// British forms: the guard's lists (content-american.test.ts / spelling-copy.test.ts).
const guard = fs.readFileSync(path.join(DATA, '..', 'scripts', 'content-american.test.ts'), 'utf8');
const tpl = (name) => { const s = guard.indexOf(name); const a = guard.indexOf('`', s) + 1; return guard.slice(a, guard.indexOf('`', a)); };
const spell = fs.readFileSync(path.join(DATA, '..', 'scripts', 'spelling-copy.test.ts'), 'utf8');
const ls = spell.indexOf('const WORDS');
const BRIT = new Set([...tpl('const BRIT_WORDS').trim().split(/\s+/), ...[...spell.slice(ls, spell.indexOf('];', ls)).matchAll(/'([a-z-]+)'/g)].map((m) => m[1].toUpperCase())]);

const mask = (w) => { let m = 0; for (const c of w) m |= 1 << (c.charCodeAt(0) - 65); return m; };
const bits = (m) => { let n = 0; while (m) { n += m & 1; m >>>= 1; } return n; };
const wordScore = (w, pangram) => (w.length === 4 ? 1 : w.length) + (pangram ? 7 : 0);
const maxOf = (p) => p.words.reduce((t, w) => t + wordScore(w, p.pangrams.includes(w)), 0);

const fromIdx = Math.round((Date.parse(`${FROM}T00:00:00Z`) - Date.parse(`${bank.epoch}T00:00:00Z`)) / 86400000);
const unseen = [...bank.daily.slice(fromIdx), ...bank.extra, ...Object.values(bank.holiday ?? {}).flat()];
const report = [];
const needNew = [];
for (const p of unseen) {
  const brit = p.pangrams.filter((w) => BRIT.has(w));
  if (!brit.length) continue;
  const american = p.pangrams.filter((w) => !BRIT.has(w));
  if (american.length) {
    p.words = p.words.filter((w) => !brit.includes(w));
    p.pangrams = american;
    p.bonus = [...new Set([...p.bonus, ...brit])].sort();
    const before = p.max; p.max = maxOf(p);
    report.push(`  ${p.id} ${p.letters}: ${brit.join('/')} → 0-point accepted; pangram ${american.join('/')}; max ${before} → ${p.max}`);
  } else needNew.push(p);
}

if (needNew.length) {
  const lex = readJSON(path.join(REPO, 'scripts', 'data', 'lexicon-all.json'));
  const S = 1 << 18;
  const prep = (list) => list.filter((w) => /^[A-Z]{4,}$/.test(w)).map((w) => ({ w, m: mask(w) })).filter((x) => bits(x.m) <= 7 && !(x.m & S));
  const common = prep(lex.common).filter((x) => !BRIT.has(x.w));
  const lexBonus = prep([...lex.extended, ...lex.acceptOnly]);
  const commonSet = new Set(common.map((x) => x.w));
  // widen-acceptance.mjs's dictionary + blocklists
  const block = new Set();
  for (const f of ['offensive-blocklist.txt', 'profanity-exact.generated.txt', 'taste-exact.generated.txt', 'manual-blocklist.txt', 'proper-noun-blocklist.txt', 'answer-proper-nouns.txt', 'names-blocklist.txt', 'lexicon-reject.txt']) {
    try { for (const line of fs.readFileSync(path.join(REPO, 'scripts/data', f), 'utf8').split('\n')) { const w = line.trim().split(/[\s#,]/)[0].toUpperCase(); if (/^[A-Z]+$/.test(w)) block.add(w); } } catch { /* optional */ }
  }
  const ROOTS = ['FUCK', 'SHIT', 'CUNT', 'NIGG', 'FAGG', 'KIKE', 'SPIC', 'WETBACK', 'RETARD', 'RAPE', 'RAPIST', 'PISS', 'COCK', 'DICK', 'TWAT', 'WANK', 'JIZZ', 'CUM', 'BONER', 'PUSSY', 'WHORE', 'SLUT', 'PORN', 'NAZI', 'HITLER'];
  const blocked = (w) => block.has(w) || ROOTS.some((r) => w.includes(r));
  const dict = fs.readFileSync('/usr/share/dict/words', 'utf8').split('\n').filter((w) => /^[a-z]{4,12}$/.test(w)).map((w) => w.toUpperCase()).filter((w) => !blocked(w));
  const usedSets = new Set([...bank.daily, ...bank.extra, ...Object.values(bank.holiday ?? {}).flat()].map((p) => mask(p.letters)));
  const sets = [...new Set(common.filter((x) => bits(x.m) === 7).map((x) => x.m))].filter((s) => !usedSets.has(s));
  const candidates = [];
  for (const set of sets) {
    const inSet = common.filter((x) => (x.m & ~set) === 0);
    for (let b = 0; b < 26; b++) {
      const centre = 1 << b; if (!(set & centre)) continue;
      const words = inSet.filter((x) => x.m & centre); if (words.length < 20 || words.length > 60) continue;
      const pangrams = words.filter((x) => x.m === set).map((x) => x.w);
      const max = words.reduce((t, x) => t + wordScore(x.w, x.m === set), 0);
      const edIng = words.filter((x) => /(ED|ING)$/.test(x.w)).length / words.length;
      const long = words.filter((x) => x.w.length >= 6).length;
      if (!pangrams.length || max < 60 || max > 250 || edIng > 0.35 || long < 3) continue;
      const letters = String.fromCharCode(65 + b) + [...Array(26).keys()].filter((i) => (set >> i) & 1 && i !== b).map((i) => String.fromCharCode(65 + i)).join('');
      candidates.push({ set, letters, words: words.map((x) => x.w).sort(), pangrams: pangrams.sort(), max });
    }
  }
  const rng = rngFor(`hub-repair-${FROM}`);
  const pool = shuffle(candidates.sort((a, b) => a.letters.localeCompare(b.letters)), rng);
  for (const p of needNew) {
    // keep the old puzzle's size class: a candidate within ±25% of its max
    const i = pool.findIndex((c) => !usedSets.has(c.set) && Math.abs(c.max - p.max) <= p.max * 0.25);
    if (i < 0) throw new Error(`no replacement letter set for ${p.id}`);
    const [c] = pool.splice(i, 1); usedSets.add(c.set);
    const fits = (w) => [...w].every((ch) => c.letters.includes(ch)) && w.includes(c.letters[0]);
    const scored = new Set(c.words);
    const bonus = new Set([...lexBonus.filter((x) => fits(x.w) && !commonSet.has(x.w)).map((x) => x.w), ...dict.filter(fits)]);
    for (const w of scored) bonus.delete(w);
    const before = `${p.letters} (${p.pangrams.join('/')}, max ${p.max})`;
    p.letters = c.letters; p.words = c.words; p.bonus = [...bonus].sort(); p.pangrams = c.pangrams; p.max = c.max;
    report.push(`  ${p.id}: ${before} → ${p.letters} (${p.pangrams.join('/')}, ${p.words.length} words, max ${p.max}, ${p.bonus.length} accepted)`);
  }
}
console.log(`from ${FROM}: ${report.length} Hubbub puzzles repaired`);
console.log(report.join('\n'));
if (!DRY) { fs.writeFileSync(bankPath, JSON.stringify(bank) + '\n'); console.log('wrote', bankPath); }
