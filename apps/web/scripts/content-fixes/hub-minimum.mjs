// Hubbub, third pass of the 2026-10-06 content fixes (REPORT-CONTENT-FIXES.md). hubbub.mjs moved British,
// obscure and proper-noun words off the scored lists, which left some FUTURE puzzles under the game's
// 20-scored-word minimum (hub.test.ts). Each of those gets a fresh letter set built with
// hub/repair-future.mjs's rules (common-tier words, 20–60 words, max 60–250 and within ±25% of the puzzle's
// original max, ≤ 35% -ED/-ING, ≥ 3 long words, never S, a letter set unused anywhere in the bank) from
// words hubbub.mjs would keep scored; its bonus list follows everyday-words.mjs (rarer real words, minus
// offensive / Zipf < 2.0 / rare curated-obscure ones, plus every must-accept word that fits). Ids are kept.
//   node apps/web/scripts/content-fixes/hub-minimum.mjs [--dry]
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { DATA, REPO, readJSON, rngFor, shuffle } from '../more-games/lib.mjs';
import { CONTENT_RELEASE_DATE } from '../content-release-date.mjs';
import { liveFrom } from './lib.mjs';
import { HUB_REMOVE, HUB_DEMOTE } from './hub-lists.mjs';
import { offensiveWord, britishWord, isListedObscure, zipf, mustAccept } from '../../../../packages/core/src/content-safety/safety.mjs';

const DRY = process.argv.includes('--dry');
const bankPath = path.join(DATA, 'hub-puzzles.json');
const bank = readJSON(bankPath);
// Each puzzle's max as audited (commit 843a2aa, before any content fix) — the ±25% target.
const headBank = JSON.parse(execSync('git show 843a2aa:apps/web/data/hub-puzzles.json', { cwd: REPO, maxBuffer: 1 << 28 }).toString());

const mask = (w) => { let m = 0; for (const c of w) m |= 1 << (c.charCodeAt(0) - 65); return m; };
const bits = (m) => { let n = 0; while (m) { n += m & 1; m >>>= 1; } return n; };
const wordScore = (w, pangram) => (w.length === 4 ? 1 : w.length) + (pangram ? 7 : 0);
const isRemove = (w) => HUB_REMOVE.has(w) || offensiveWord(w) !== null;
const isDemote = (w) => HUB_DEMOTE.has(w) || britishWord(w) !== null || isListedObscure(w);
const bonusKeep = (w) => !(isRemove(w) || zipf(w) < 2.0 || (isListedObscure(w) && zipf(w) < 3.0));

const live = liveFrom(bank, CONTENT_RELEASE_DATE);
const short = live.filter((e) => e.p.words.length < 20);

const lex = readJSON(path.join(REPO, 'scripts', 'data', 'lexicon-all.json'));
const block = new Set(['LEUKEMIA', 'CANCER', 'TUMOR', 'DEATH', 'DYING', 'MURDER', 'CORPSE', 'FUNERAL', 'DISEASE']);
for (const f of ['offensive-blocklist.txt', 'profanity-exact.generated.txt', 'taste-exact.generated.txt', 'manual-blocklist.txt', 'proper-noun-blocklist.txt', 'answer-proper-nouns.txt', 'names-blocklist.txt', 'lexicon-reject.txt']) {
  for (const line of fs.readFileSync(path.join(REPO, 'scripts/data', f), 'utf8').split('\n')) { const w = line.trim().split(/[\s#,]/)[0].toUpperCase(); if (/^[A-Z]+$/.test(w)) block.add(w); }
}
const S = 1 << 18;
// A fresh puzzle's pangram is its headline: nothing religious, violent or intimate.
const SENSITIVE = ['MARTYR', 'CATHOLIC', 'INTIMA', 'MERCENAR', 'CHRIST', 'MUSLIM', 'JEWISH', 'MILITAR', 'WEAPON', 'ROMAN', 'BLACKMAIL', 'VIOLAT'];
const SOMBER = ['VOMIT', 'URINE', 'FECES', 'FECAL', 'CANCER', 'TUMOR', 'CORPSE', 'MURDER', 'KILL', 'DEATH', 'DYING', 'SUICID', 'LEUKEMIA', 'DISEASE', 'FUNERAL'];
const prep = (list) => list.filter((w) => /^[A-Z]{4,}$/.test(w) && !block.has(w) && !SOMBER.some((r) => w.includes(r))).map((w) => ({ w, m: mask(w) })).filter((x) => bits(x.m) <= 7 && !(x.m & S));
// Scored words: common tier, nothing hubbub.mjs would remove or demote.
const common = prep(lex.common).filter((x) => !isRemove(x.w) && !isDemote(x.w));
const commonSet = new Set(common.map((x) => x.w));
const lexBonus = prep([...lex.common, ...lex.extended, ...lex.acceptOnly]).filter((x) => !commonSet.has(x.w) && bonusKeep(x.w));
const must = mustAccept().filter((w) => w.length >= 4 && !offensiveWord(w) && !britishWord(w));
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
    if (pangrams.some((w) => SENSITIVE.some((r) => w.includes(r)))) continue;
    if (!pangrams.length || max < 60 || max > 250 || edIng > 0.35 || long < 3) continue;
    const letters = String.fromCharCode(65 + b) + [...Array(26).keys()].filter((i) => (set >> i) & 1 && i !== b).map((i) => String.fromCharCode(65 + i)).join('');
    candidates.push({ set, letters, words: words.map((x) => x.w).sort(), pangrams: pangrams.sort(), max });
  }
}
const pool = shuffle(candidates.sort((a, b) => a.letters.localeCompare(b.letters)), rngFor(`hub-minimum-${CONTENT_RELEASE_DATE}`));
const original = new Map([...headBank.daily, ...headBank.extra, ...Object.values(headBank.holiday ?? {}).flat()].map((p) => [p.id, p.max]));
const changes = [];
for (const { p, where, date } of short) {
  const target = original.get(p.id) ?? p.max;
  const i = pool.findIndex((c) => !usedSets.has(c.set) && Math.abs(c.max - target) <= Math.max(target, 60) * 0.25);
  if (i < 0) throw new Error(`no replacement letter set for ${p.id}`);
  const [c] = pool.splice(i, 1); usedSets.add(c.set);
  const fits = (w) => [...w].every((ch) => c.letters.includes(ch)) && w.includes(c.letters[0]);
  const bonus = new Set([...lexBonus.filter((x) => fits(x.w)).map((x) => x.w), ...must.filter(fits)]);
  for (const w of c.words) bonus.delete(w);
  const before = `${p.letters} (${p.words.length} scored words, max ${p.max})`;
  p.letters = c.letters; p.words = c.words; p.bonus = [...bonus].sort(); p.pangrams = c.pangrams; p.max = c.max;
  changes.push({ id: p.id, where, date, rebuilt: `${before} → ${p.letters} (${p.pangrams.join('/')}, ${p.words.length} words, max ${p.max}, ${p.bonus.length} bonus)` });
}
for (const { p } of live) {
  if (p.words.length < 20 || p.words.length > 60) throw new Error(`${p.id}: ${p.words.length} words`);
  for (const w of [...p.words, ...p.bonus]) if (isRemove(w)) throw new Error(`${p.id}: removed word still accepted`);
}
if (!DRY) fs.writeFileSync(bankPath, JSON.stringify(bank) + '\n');
console.log(JSON.stringify(changes));
