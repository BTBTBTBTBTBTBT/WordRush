// Hubbub content fixes from the 2026-10-06 content audit (REPORT-CONTENT-FIXES.md). FUTURE puzzles only
// (dailies from CONTENT_RELEASE_DATE, Unlimited, unserved holiday entries); ids and positions are kept.
//  - REMOVE: slurs, sexual, drug and crude words — no longer scored AND no longer accepted at all.
//  - DEMOTE: British, obscure, proper-noun and mildly crude required words — moved to the 0-point
//    accepted (bonus) list, so typing them is still fine but nobody needs them for Genius.
//  `max` is recomputed. A puzzle whose ONLY pangram is removed/demoted gets a fresh letter set built with
//  hub/repair-future.mjs's rules (common-tier words, 20–60 words, max 60–250 and within ±25% of the old
//  one, ≤ 35% -ED/-ING, ≥ 3 long words, never S, a letter set unused anywhere in the bank) — and the same
//  REMOVE/DEMOTE rules then apply to it. Prints every change as JSON.
//   node apps/web/scripts/content-fixes/hubbub.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { DATA, REPO, readJSON, rngFor, shuffle } from '../more-games/lib.mjs';
import { CONTENT_RELEASE_DATE } from '../content-release-date.mjs';
import { liveFrom } from './lib.mjs';
import { offensiveWord, britishWord, isListedObscure } from '../../../../packages/core/src/content-safety/safety.mjs';

const DRY = process.argv.includes('--dry');
const bankPath = path.join(DATA, 'hub-puzzles.json');
const bank = readJSON(bankPath);

import { HUB_REMOVE, HUB_DEMOTE } from './hub-lists.mjs';

const mask = (w) => { let m = 0; for (const c of w) m |= 1 << (c.charCodeAt(0) - 65); return m; };
const bits = (m) => { let n = 0; while (m) { n += m & 1; m >>>= 1; } return n; };
const wordScore = (w, pangram) => (w.length === 4 ? 1 : w.length) + (pangram ? 7 : 0);
const maxOf = (p) => p.words.reduce((t, w) => t + wordScore(w, p.pangrams.includes(w)), 0);
const changes = [];

// Beyond the audit's lists, the shared content-safety module decides: offensive → REMOVE; British-only or
// curated-obscure → DEMOTE (still accepted as a bonus word).
const isRemove = (w) => HUB_REMOVE.has(w) || offensiveWord(w) !== null;
const isDemote = (w) => !isRemove(w) && (HUB_DEMOTE.has(w) || britishWord(w) !== null || isListedObscure(w));
function clean(e) {
  const p = e.p;
  const removed = p.words.filter(isRemove), demoted = p.words.filter(isDemote);
  const droppedBonus = p.bonus.filter(isRemove);
  if (!removed.length && !demoted.length && !droppedBonus.length) return false;
  const before = p.max;
  p.words = p.words.filter((w) => !isRemove(w) && !isDemote(w));
  p.pangrams = p.pangrams.filter((w) => p.words.includes(w));
  p.bonus = [...new Set([...p.bonus.filter((w) => !isRemove(w)), ...demoted])].sort();
  p.max = maxOf(p);
  changes.push({ id: p.id, where: e.where, date: e.date, letters: p.letters, removed: [...new Set([...removed, ...droppedBonus])], demoted, max: `${before} → ${p.max}` });
  return true;
}

const live = liveFrom(bank, CONTENT_RELEASE_DATE);
for (const e of live) clean(e);
const needNew = live.filter((e) => !e.p.pangrams.length);

if (needNew.length) {
  const lex = readJSON(path.join(REPO, 'scripts', 'data', 'lexicon-all.json'));
  const spell = fs.readFileSync(path.join(DATA, '..', 'scripts', 'spelling-copy.test.ts'), 'utf8'); const ls = spell.indexOf('const WORDS');
  const brit = new Set([...[...spell.slice(ls, spell.indexOf('];', ls)).matchAll(/'([a-z-]+)'/g)].map((m) => m[1].toUpperCase()),
    ...fs.readFileSync(path.join(DATA, '..', 'scripts', 'data', 'brit-words-extended.txt'), 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/)[0])]);
  // Somber words never anchor a fresh puzzle (pangram or not).
  const block = new Set([...HUB_REMOVE, 'LEUKEMIA', 'CANCER', 'TUMOR', 'DEATH', 'DYING', 'MURDER', 'CORPSE', 'FUNERAL', 'DISEASE']);
  for (const f of ['offensive-blocklist.txt', 'profanity-exact.generated.txt', 'taste-exact.generated.txt', 'manual-blocklist.txt', 'proper-noun-blocklist.txt', 'answer-proper-nouns.txt', 'names-blocklist.txt', 'lexicon-reject.txt']) {
    for (const line of fs.readFileSync(path.join(REPO, 'scripts/data', f), 'utf8').split('\n')) { const w = line.trim().split(/[\s#,]/)[0].toUpperCase(); if (/^[A-Z]+$/.test(w)) block.add(w); }
  }
  const S = 1 << 18;
  const SOMBER = ['VOMIT', 'URINE', 'FECES', 'FECAL', 'CANCER', 'TUMOR', 'CORPSE', 'MURDER', 'KILL', 'DEATH', 'DYING', 'SUICID', 'LEUKEMIA', 'DISEASE', 'FUNERAL'];
  const prep = (list) => list.filter((w) => /^[A-Z]{4,}$/.test(w) && !block.has(w) && !SOMBER.some((r) => w.includes(r))).map((w) => ({ w, m: mask(w) })).filter((x) => bits(x.m) <= 7 && !(x.m & S));
  const common = prep(lex.common).filter((x) => !brit.has(x.w));
  const lexBonus = prep([...lex.extended, ...lex.acceptOnly]);
  const commonSet = new Set(common.map((x) => x.w));
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
  const pool = shuffle(candidates.sort((a, b) => a.letters.localeCompare(b.letters)), rngFor(`hub-content-fix-${CONTENT_RELEASE_DATE}`));
  for (const { p, where, date } of needNew) {
    const i = pool.findIndex((c) => !usedSets.has(c.set) && Math.abs(c.max - p.max) <= Math.max(p.max, 60) * 0.25);
    if (i < 0) throw new Error(`no replacement letter set for ${p.id}`);
    const [c] = pool.splice(i, 1); usedSets.add(c.set);
    const fits = (w) => [...w].every((ch) => c.letters.includes(ch)) && w.includes(c.letters[0]);
    const bonus = new Set(lexBonus.filter((x) => fits(x.w) && !commonSet.has(x.w)).map((x) => x.w));
    for (const w of c.words) bonus.delete(w);
    const before = `${p.letters} (${p.pangrams.join('/') || 'no pangram left'}, max ${p.max})`;
    p.letters = c.letters; p.words = c.words; p.bonus = [...bonus].sort(); p.pangrams = c.pangrams; p.max = c.max;
    changes.push({ id: p.id, where, date, rebuilt: `${before} → ${p.letters} (${p.pangrams.join('/')}, ${p.words.length} words, max ${p.max})` });
    clean({ p, where, date }); // the same demotions apply to the fresh word list
  }
}
// Sanity: every live puzzle keeps a pangram, and no removed word is scored or accepted anywhere live.
for (const { p } of live) {
  if (!p.pangrams.length || !p.pangrams.every((w) => p.words.includes(w))) throw new Error(`${p.id}: pangram`);
  for (const w of [...p.words, ...p.bonus]) if (isRemove(w)) throw new Error(`${p.id}: ${w} still accepted`);
  for (const w of p.words) if (isDemote(w)) throw new Error(`${p.id}: ${w} still scored`);
  if (p.max !== maxOf(p)) throw new Error(`${p.id}: max`);
}
if (!DRY) fs.writeFileSync(bankPath, JSON.stringify(bank) + '\n');
console.log(JSON.stringify(changes));
