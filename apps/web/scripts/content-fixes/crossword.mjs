// Crosswordocious content fixes from the 2026-10-06 content audit (REPORT-CONTENT-FIXES.md). FUTURE puzzles
// only (dailies from CONTENT_RELEASE_DATE, Unlimited, unserved holiday entries); ids and grids are kept.
// Clue rewrites replace British idioms, offensive wording ("A c**** in the ____", "A c*** and bull ____"),
// wrong or answer-giving clues. Answer swaps keep EVERY crossing letter (only unchecked cells change), keep
// 3–9 capitals, stay unique in the grid and bring their own clue (exactly one ____). Prints changes as JSON.
//   node apps/web/scripts/content-fixes/crossword.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { DATA, readJSON } from '../more-games/lib.mjs';
import { CONTENT_RELEASE_DATE } from '../content-release-date.mjs';
import { flagWord, liveFrom } from './lib.mjs';

const DRY = process.argv.includes('--dry');
const file = path.join(DATA, 'crossword-puzzles.json');
const bank = readJSON(file);
const audit = readJSON(path.join(DATA, '..', '..', '..', 'content-audit.json'));
const live = new Map(liveFrom(bank, CONTENT_RELEASE_DATE).map((e) => [e.p.id, e]));
/** Lead-review overrides of the audit's proposals: [puzzle, entry] → { answer?, clue? } (null = leave as is). */
const OVERRIDE = {
  'cw-wp828k 6D': { answer: 'HOLD', clue: 'Please ____ the line' }, // the audit's MAKE broke a crossing
  // Answer swaps whose clue the audit gave only in prose (validated below like every change):
  'cw-j80rk5 12A': { answer: 'TICKET', clue: "Punch your ____ to the playoffs" },
  'cw-m7qx2e 3D': { answer: 'BATON', clue: "Pass the ____" },
  'cw-k046t9 1D': { answer: 'FORTUNE', clue: "Cost a small ____" },
  'cw-o8abad 12D': { answer: 'SEEK', clue: "Hide and ____" },
  'cw-o8abad 7D': { answer: 'SMELL', clue: "The ____ of bacon and eggs in the morning" },
  'cw-tvmg0u 12A': { answer: 'STRESS', clue: "The ____ of big-city life" },
  'cw-oiqcxc 3D': { answer: 'HOUR', clue: "The eleventh ____" },
  'cw-oiqcxc 9D': { answer: 'OUT', clue: "Knocked ____" },
  'cw-2vvdkb 9A': { answer: 'OPTIONS', clue: "Keep your ____ open" },
  'cw-gt4x5h 1D': { answer: 'WEATHER', clue: "Under the ____" },
  'cw-4ddmn1 4A': { answer: 'TOSS', clue: "Coin ____" },
  'cw-r6exr 1D': { answer: 'REST', clue: "Put your mind at ____" },
  'cw-hvckbg 5D': { answer: 'TIGHT', clue: "Sleep ____, don't let the bedbugs bite" },
  'cw-wfza34 8D': { answer: 'PEACE', clue: "Keep the ____ with the neighbors" },
  'cw-np7iap 8D': { answer: 'STAKE', clue: "Drive a ____ into the ground" },
  'cw-kofxd9 9A': { answer: 'HINTED', clue: "She ____ at a surprise party" },
  'cw-bo7559 3A': { answer: 'TEARS', clue: "Bored to ____" },
  'cw-wezdxu 11D': { answer: 'DAY', clue: "A ____dream during class" },
  'cw-qf7ooi 2D': { answer: 'STEM', clue: "Long-____ roses" },
  'cw-qf7ooi 5D': { answer: 'SHEDS', clue: "A snake ____ its skin" },
  'cw-4tl15e 2A': { answer: 'ALOUD', clue: "Read the story ____" },
  'cw-n9l7yd 9A': { answer: 'SLOPE', clue: "A slippery ____" },
  'cw-g4cad0 4D': { answer: 'SINK', clue: "Everything but the kitchen ____" },
  'cw-sviga8 9A': { answer: 'FREEZE', clue: "Brain ____" },
  'cw-8q7eps 8A': { answer: 'SPEEDS', clue: "A ten-____ bike" },
  'cw-e7mwbm 5D': { answer: 'CALM', clue: "Cool, ____ and collected" },
  'cw-sc80xy 12A': { answer: 'SACRED', clue: "Is nothing ____?" },
  'cw-7asa6 5A': { clue: 'Lock the barn door after the horse has ____' }, // US form; clues here are fill-in-the-blank
  'cw-iczowd 5D': null, // "A horseshoe is nailed to the ____" is fine as it stands
};
const cells = (e) => [...e.answer].map((_, k) => `${e.r + (e.dir === 'D' ? k : 0)},${e.c + (e.dir === 'A' ? k : 0)}`);
const changes = [], skipped = [], errors = [];
for (const f of audit.flags.filter((x) => x.game === 'crossword' && x.changeable)) {
  const e0 = live.get(f.id); if (!e0) { skipped.push({ id: f.id, word: flagWord(f), why: 'already served (before CONTENT_RELEASE_DATE)' }); continue; }
  const p = e0.p, m = /^(\d+)([AD]) ([A-Z]+)/.exec(flagWord(f));
  if (!m) { skipped.push({ id: f.id, word: flagWord(f), why: 'not an entry flag' }); continue; }
  const e = p.entries.find((x) => x.n === Number(m[1]) && x.dir === m[2]);
  if (!e || e.answer !== m[3]) { skipped.push({ id: f.id, word: flagWord(f), why: 'entry changed' }); continue; }
  const key = `${p.id} ${m[1]}${m[2]}`;
  let answer = e.answer, clue = e.clue;
  if (OVERRIDE[key] === null) continue;
  if (OVERRIDE[key]) ({ answer = e.answer, clue = e.clue } = OVERRIDE[key]);
  else if (f.field === 'clue') clue = f.replacement;
  else if (f.field === 'answer' && f.replacement) {
    answer = f.replacement.trim().split(/\s+/)[0].toUpperCase();
    const nc = /New clue:\s*["“']([^"”]*?)["”'](?:\.|$|\s)/.exec(f.replacement_note ?? '') ?? /New clue:\s*["“'](.*)["”']/.exec(f.replacement_note ?? '');
    if (!nc) { skipped.push({ id: p.id, word: flagWord(f), why: `no clue given for ${answer}` }); continue; }
    clue = nc[1];
  } else { skipped.push({ id: p.id, word: flagWord(f), why: f.replacement_note ?? 'no replacement (needs a grid rebuild)' }); continue; }
  // Validate against the bank test's rules.
  try {
  if (!/^[A-Z]{3,9}$/.test(answer) || answer.length !== e.answer.length) throw new Error(`${key}: ${answer} shape`);
  if ((clue.match(/____/g) || []).length !== 1) throw new Error(`${key}: clue needs exactly one ____: ${clue}`);
  const fixed = new Map(); for (const o of p.entries) if (o !== e) cells(o).forEach((c, k) => fixed.set(c, o.answer[k]));
  cells(e).forEach((c, k) => { if (fixed.has(c) && fixed.get(c) !== answer[k]) throw new Error(`${key}: ${answer} breaks the crossing at ${c}`); });
  if (answer !== e.answer && p.entries.some((o) => o.answer === answer)) throw new Error(`${key}: ${answer} already in the grid`);
  if (clue.toUpperCase().includes(answer) && answer.length >= 4) throw new Error(`${key}: clue gives away ${answer}`);
  } catch (err) { errors.push(`${err.message}  [was: ${e.answer} :: ${e.clue}]`); continue; }
  changes.push({ id: p.id, where: e0.where, date: e0.date, entry: `${m[1]}${m[2]}`, old: `${e.answer} :: ${e.clue}`, new: `${answer} :: ${clue}`, flag: f.category });
  e.answer = answer; e.clue = clue;
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
if (!DRY) fs.writeFileSync(file, JSON.stringify(bank) + '\n');
console.log(JSON.stringify({ changes, skipped }));
