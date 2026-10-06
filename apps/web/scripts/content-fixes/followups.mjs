// Second pass of the 2026-10-06 content fixes (REPORT-CONTENT-FIXES.md) — what the content gate
// (content-check.test.ts) still found after the first pass, FUTURE puzzles only:
//  - Crosswordocious: two more British "Pull your ____ up" clues;
//  - Kindred: two groups the first pass made identical to other puzzles' groups;
//  - Muddle: two British scramble words (DREAMT, UNWELL);
//  - Codebreaker: five sayings whose replacement was a near-copy of a saying already in the bank.
// Every candidate is validated with the bank's own rules; the first that passes is used. Prints changes.
//   node apps/web/scripts/content-fixes/followups.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { DATA, readJSON, upperList, wordset, rngFor, shuffle } from '../more-games/lib.mjs';
import { CONTENT_RELEASE_DATE } from '../content-release-date.mjs';
import { liveFrom } from './lib.mjs';
import { wordProblems, textProblems } from '../../../../packages/core/src/content-safety/safety.mjs';

const DRY = process.argv.includes('--dry');
const changes = [];
const load = (f) => ({ file: path.join(DATA, f), bank: readJSON(path.join(DATA, f)) });
const live = (b) => new Map(liveFrom(b, CONTENT_RELEASE_DATE).map((e) => [e.p.id, e]));
const fail = (m) => { throw new Error(m); };

// ---- Crosswordocious
const cw = load('crossword-puzzles.json'), cwLive = live(cw.bank);
for (const [id, n, dir, clue] of [['cw-3es5ch', 4, 'D', 'Knock your ____ off'], ['cw-ewzkw3', 8, 'D', 'Knock your ____ off']]) {
  const e = cwLive.get(id) ?? fail(`${id} served`); const x = e.p.entries.find((q) => q.n === n && q.dir === dir);
  if (textProblems(clue).length) fail(clue);
  changes.push({ game: 'crossword', id, where: e.where, date: e.date, field: `${n}${dir} ${x.answer}`, old: x.clue, new: clue }); x.clue = clue;
}
// ---- Kindred
const gr = load('groups-puzzles.json'), grLive = live(gr.bank);
const groupKeys = () => new Map([...gr.bank.daily, ...gr.bank.extra, ...Object.values(gr.bank.holiday).flat()].flatMap((p) => p.groups.map((g) => [[...g.words].sort().join(' '), p.id])));
{
  const e = grLive.get('gr-lnujaf'); const g = e.p.groups.find((x) => x.words.includes('GORGE'));
  changes.push({ game: 'kindred', id: e.p.id, where: e.where, date: e.date, field: g.label, old: 'GORGE', new: 'GULP' });
  g.words = g.words.map((w) => (w === 'GORGE' ? 'GULP' : w));
  const e2 = grLive.get('gr-hzkd13'); const g2 = e2.p.groups.find((x) => x.tier === 4);
  changes.push({ game: 'kindred', id: e2.p.id, where: e2.where, date: e2.date, field: 'T4 group', old: `${g2.label}: ${g2.words.join(' ')}`, new: 'Hidden RAIN: TRAIN BRAIN GRAIN STRAIN' });
  g2.label = 'Hidden RAIN'; g2.words = ['TRAIN', 'BRAIN', 'GRAIN', 'STRAIN'];
  for (const p of [e.p, e2.p]) { const ws = p.groups.flatMap((x) => x.words); if (new Set(ws).size !== 16) fail(`${p.id} repeats a word`); }
  const seen = new Map(); for (const p of [...gr.bank.daily, ...gr.bank.extra, ...Object.values(gr.bank.holiday).flat()]) for (const x of p.groups) { const k = [...x.words].sort().join(' '); if (seen.has(k) && [e.p.id, e2.p.id].includes(p.id)) fail(`${p.id} duplicates ${seen.get(k)}`); seen.set(k, p.id); }
}
// ---- Muddle
const md = load('scramble-puzzles.json'), mdLive = live(md.bank);
const allowedAll = new Set([...upperList('allowed.json'), ...upperList('allowed-6.json')]);
const sig = (w) => [...w].sort().join(''); const anagrams = new Map(); for (const w of allowedAll) anagrams.set(sig(w), (anagrams.get(sig(w)) || 0) + 1);
const hard = new Set([...wordset('profanity-exact.generated.txt'), ...wordset('offensive-blocklist.txt')]);
const point = (word, letters) => { const taken = new Set(), idx = []; for (const c of letters) { const i = [...word].findIndex((ch, k) => ch === c && !taken.has(k)); if (i < 0) return null; taken.add(i); idx.push(i); } return idx.sort((a, b) => a - b); };
const scramble = (word, label) => { const rng = rngFor(`${label}-content-fix-v1`); for (let t = 0; t < 400; t++) { const s = shuffle(word.split(''), rng).join(''); if (s !== word && [...s].filter((c, i) => c !== word[i]).length >= word.length - 1 && !allowedAll.has(s) && ![...hard].some((h) => s.includes(h))) return s; } fail(`no scramble ${word}`); };
for (const [id, old, cands] of [['md-5ccbk', 'DREAMT', ['TURNED', 'DETOUR', 'TRENDY', 'STREET', 'TREND']], ['md-tfcteo', 'UNWELL', ['UNCLE', 'LUNCH', 'LINEN', 'PLANET', 'NOBLE']]]) {
  const e = mdLive.get(id) ?? fail(`${id} served`); const p = e.p, k = p.words.findIndex((w) => w.answer === old); const letters = p.words[k].circled.map((i) => old[i]);
  const ok = (w) => /^[A-Z]{5,6}$/.test(w) && allowedAll.has(w) && anagrams.get(sig(w)) === 1 && !wordProblems(w).length && !p.words.some((x) => x.answer === w)
    && !p.final.answer.split(' ').includes(w) && !p.caption.toUpperCase().includes(w) && point(w, letters);
  const w = cands.find(ok) ?? fail(`${id}: no candidate fits ${letters.join('')}`);
  const before = p.words[k]; p.words[k] = { answer: w, scramble: scramble(w, `${id}-${w}`), circled: point(w, letters) };
  changes.push({ game: 'muddle', id, where: e.where, date: e.date, field: 'word', old: `${before.answer} [${before.circled}]`, new: `${w} [${p.words[k].circled}]` });
}
// ---- Codebreaker
const cg = load('cryptogram-puzzles.json'), cgLive = live(cg.bank);
const norm = (t) => t.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
const keys = (t) => [norm(t), `tail:${norm(t).split(' ').slice(-4).join(' ')}`];
const validSaying = (t) => { const L = new Set(t.toUpperCase().replace(/[^A-Z]/g, '')); return t.length >= 30 && t.length <= 90 && /^[A-Za-z .,;:'"!?\-]+$/.test(t) && L.size >= 10 && L.size <= 22 && t.split(/\s+/).some((w) => w.replace(/[^A-Za-z]/g, '').length <= 3) && !textProblems(t).length; };
const pool = ['The road to success is always under construction.', 'A journey of a thousand miles begins with one step.',
  'Look on the bright side of life.', 'Laughter is the shortest distance between two people.',
  'Knowledge is power, but enthusiasm pulls the switch.', 'Do unto others as you would have them do unto you.'];
for (const id of ['cg-hcxmaj', 'cg-70fd9a', 'cg-57bcsm', 'cg-sx17eg', 'cg-o473ws']) {
  const e = cgLive.get(id) ?? fail(`${id} served`);
  const used = new Set([...cg.bank.daily, ...cg.bank.extra, ...Object.values(cg.bank.holiday).flat()].filter((q) => q !== e.p).flatMap((q) => keys(q.text)));
  const t = pool.find((c) => validSaying(c) && !keys(c).some((k) => used.has(k))) ?? fail(`${id}: no saying left`);
  pool.splice(pool.indexOf(t), 1);
  const freq = {}; for (const c of t.toUpperCase().replace(/[^A-Z]/g, '')) freq[c] = (freq[c] || 0) + 1;
  changes.push({ game: 'codebreaker', id, where: e.where, date: e.date, field: 'text', old: e.p.text, new: t });
  e.p.text = t; e.p.given = Object.keys(freq).sort((a, b) => freq[b] - freq[a] || a.localeCompare(b)).slice(0, 3);
}
if (!DRY) {
  fs.writeFileSync(cw.file, JSON.stringify(cw.bank) + '\n');
  fs.writeFileSync(gr.file, JSON.stringify(gr.bank, null, 1) + '\n');
  fs.writeFileSync(md.file, JSON.stringify(md.bank) + '\n');
  fs.writeFileSync(cg.file, JSON.stringify(cg.bank, null, 1) + '\n');
}
console.log(JSON.stringify(changes));
