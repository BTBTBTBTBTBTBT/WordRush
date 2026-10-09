// Third pass of the 2026-10-06 content fixes (REPORT-CONTENT-FIXES.md): what the finished content gate
// (content-check.test.ts) still found, FUTURE puzzles only:
//  - Crosswordocious: six grids that repeated a word stem (CORN / CORNER, EAT / EATING…) — one entry each is
//    swapped for a word that keeps every crossing letter, with its own fill-in-the-blank clue;
//  - Muddle: every scramble word the shared content-safety module calls British or obscure (BATTEN, SLUICE,
//    LINDEN…) — replaced by the most common word that carries the same circled letters, using the builder's
//    rules (5–6 letters, one arrangement only, not in the grid / final answer / caption / alt text).
// Prints changes as JSON.   node apps/web/scripts/content-fixes/gate-repairs.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { DATA, readJSON, upperList, wordset, rngFor, shuffle } from '../more-games/lib.mjs';
import { CONTENT_RELEASE_DATE } from '../content-release-date.mjs';
import { liveFrom } from './lib.mjs';
import { wordProblems, textProblems, offensiveWord, zipf, isMustAccept } from '../../../../packages/core/src/content-safety/safety.mjs';

const DRY = process.argv.includes('--dry');
const changes = [];
const load = (f) => ({ file: path.join(DATA, f), bank: readJSON(path.join(DATA, f)) });
const live = (b) => new Map(liveFrom(b, CONTENT_RELEASE_DATE).map((e) => [e.p.id, e]));
const fail = (m) => { throw new Error(m); };

// ---- Crosswordocious: stem repeats
const cw = load('crossword-puzzles.json'), cwLive = live(cw.bank);
const cells = (e) => [...e.answer].map((_, k) => `${e.r + (e.dir === 'D' ? k : 0)},${e.c + (e.dir === 'A' ? k : 0)}`);
for (const [id, entry, answer, clue] of [
  ['cw-2iaydx', '3D', 'CURE', 'An ounce of prevention is worth a pound of ____'], // was CORN (grid has CORNER)
  ['cw-58qna3', '2D', 'PLANET', 'Save the ____'], // was FLOWER (grid has FLOWERS)
  ['cw-cgm8rx', '7A', 'FOOT', 'Put your best ____ forward'], // was ROOT (grid has ROOTS)
  ['cw-8jclrh', '7A', 'CAN', 'Open a ____ of worms'], // was EAT (grid has EATING)
  ['cw-hy8wn0', '3D', 'EXTENT', 'To a certain ____'], // was EATING (grid has EAT)
  ['cw-6bo6l9', '2D', 'SLOW', '____ and steady wins the race'], // was FLOW (grid has FLOWERS)
]) {
  const e0 = cwLive.get(id) ?? fail(`${id} served`), p = e0.p;
  const e = p.entries.find((x) => `${x.n}${x.dir}` === entry) ?? fail(`${id} ${entry}`);
  if (answer.length !== e.answer.length || !/^[A-Z]{3,9}$/.test(answer)) fail(`${id}: ${answer} shape`);
  if ((clue.match(/____/g) || []).length !== 1) fail(`${id}: clue needs one ____`);
  const fixed = new Map(); for (const o of p.entries) if (o !== e) cells(o).forEach((c, k) => fixed.set(c, o.answer[k]));
  cells(e).forEach((c, k) => { if (fixed.has(c) && fixed.get(c) !== answer[k]) fail(`${id}: ${answer} breaks a crossing`); });
  if (p.entries.some((o) => o !== e && o.answer === answer)) fail(`${id}: ${answer} already in the grid`);
  if (wordProblems(answer).length || textProblems(clue).length) fail(`${id}: ${answer} / ${clue} fails the safety module`);
  changes.push({ game: 'crossword', id, where: e0.where, date: e0.date, field: entry, old: `${e.answer} :: ${e.clue}`, new: `${answer} :: ${clue}`, why: 'stem repeat' });
  e.answer = answer; e.clue = clue;
}

// ---- Muddle: British / obscure scramble words
const md = load('scramble-puzzles.json');
const allowedAll = new Set([...upperList('allowed.json'), ...upperList('allowed-6.json')]);
const sig = (w) => [...w].sort().join(''); const anagrams = new Map(); for (const w of allowedAll) anagrams.set(sig(w), (anagrams.get(sig(w)) || 0) + 1);
const hard = new Set([...wordset('profanity-exact.generated.txt'), ...wordset('offensive-blocklist.txt')]);
const point = (word, letters) => { const taken = new Set(), idx = []; for (const c of letters) { const i = [...word].findIndex((ch, k) => ch === c && !taken.has(k)); if (i < 0) return null; taken.add(i); idx.push(i); } return idx.sort((a, b) => a - b); };
const scramble = (word, label) => { const rng = rngFor(`${label}-content-fix-v1`); for (let t = 0; t < 400; t++) { const s = shuffle(word.split(''), rng).join(''); if (s !== word && [...s].filter((c, i) => c !== word[i]).length >= word.length - 1 && !allowedAll.has(s) && ![...hard].some((h) => s.includes(h)) && !offensiveWord(s)) return s; } fail(`no scramble ${word}`); };
// Candidates: everyday 5–6 letter guessable words, most common first (ties alphabetical, so the run is stable).
const lexCommon = new Set(readJSON(path.join(DATA, '..', '..', '..', 'scripts', 'data', 'lexicon-all.json')).common); // no names (WILSON)
const candidates = [...allowedAll].filter((w) => /^[A-Z]{5,6}$/.test(w) && lexCommon.has(w) && anagrams.get(sig(w)) === 1 && !wordProblems(w, { minZipf: 3.5 }).length)
  .sort((a, b) => (isMustAccept(b) - isMustAccept(a)) || zipf(b) - zipf(a) || a.localeCompare(b));
// TOGGLE's circled T,O,G,G fit no common word: JOGGER carries O,G,G,R and SHIRT (same puzzle) gives its T
// instead of its R — the final answer's letters are unchanged.
{
  const e = live(md.bank).get('md-9px0a6') ?? fail('md-9px0a6 served'), p = e.p;
  const k = p.words.findIndex((x) => x.answer === 'TOGGLE'), s = p.words.findIndex((x) => x.answer === 'SHIRT');
  if (k < 0 || s < 0 || String(p.words[s].circled) !== '0,1,2,3') fail('md-9px0a6 changed');
  const before = [p.words[k], p.words[s]];
  p.words[k] = { answer: 'JOGGER', scramble: scramble('JOGGER', 'md-9px0a6-JOGGER'), circled: point('JOGGER', ['O', 'G', 'G', 'R']) };
  p.words[s] = { ...p.words[s], circled: [0, 1, 2, 4] };
  changes.push({ game: 'muddle', id: p.id, where: e.where, date: e.date, field: 'words', old: `${before[0].answer} [${before[0].circled}], ${before[1].answer} [${before[1].circled}]`, new: `JOGGER [${p.words[k].circled}], SHIRT [0,1,2,4]`, why: wordProblems('TOGGLE').join('; ') });
}
const stuck = [];
const usedNow = new Set(); // spread replacements: no word used twice by this pass
for (const e of liveFrom(md.bank, CONTENT_RELEASE_DATE)) {
  const p = e.p;
  p.words.forEach((x, k) => {
    if (!wordProblems(x.answer).length) return;
    const letters = x.circled.map((i) => x.answer[i]);
    const ok = (w) => !usedNow.has(w) && Math.abs(w.length - x.answer.length) <= 0 && !p.words.some((y) => y.answer === w)
      && !p.final.answer.split(' ').includes(w) && !p.caption.toUpperCase().includes(w) && !p.altText.toUpperCase().includes(w) && point(w, letters);
    const w = candidates.find(ok) ?? candidates.find((c) => ok(c) || (c.length !== x.answer.length && !usedNow.has(c) && !p.words.some((y) => y.answer === c) && !p.final.answer.split(' ').includes(c) && !p.caption.toUpperCase().includes(c) && !p.altText.toUpperCase().includes(c) && point(c, letters)))
      ?? null;
    if (!w) { stuck.push(`${p.id} ${e.where} ${x.answer} [${letters.join('')}]`); return; }
    usedNow.add(w);
    p.words[k] = { answer: w, scramble: scramble(w, `${p.id}-${w}`), circled: point(w, letters) };
    changes.push({ game: 'muddle', id: p.id, where: e.where, date: e.date, field: 'word', old: `${x.answer} [${x.circled}]`, new: `${w} [${p.words[k].circled}]`, why: wordProblems(x.answer).join('; ') });
  });
}

if (stuck.length) fail(`no replacement carries the circled letters:\n${stuck.join('\n')}`);
if (!DRY) {
  fs.writeFileSync(cw.file, JSON.stringify(cw.bank) + '\n');
  fs.writeFileSync(md.file, JSON.stringify(md.bank) + '\n');
}
console.log(JSON.stringify(changes));
