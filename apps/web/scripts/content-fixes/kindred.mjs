// Kindred content fixes from the 2026-10-06 content audit (REPORT-CONTENT-FIXES.md). FUTURE puzzles only
// (dailies from CONTENT_RELEASE_DATE, Unlimited, unserved holiday entries); ids, tiers and order are kept.
//  - single-word swaps: British / obscure / unfair words, and words that repeat their own label
//    ("Hinder: HINDER") — the replacement fits the label and no other group in the puzzle;
//  - whole-group replacements: a group repeated word for word elsewhere in the bank (WON TOO FORE ATE ×6,
//    "___ pie", "Walk heavily"…) gets a fresh group of the same tier; the earliest copy keeps the original.
// Validates the bank test's rules (16 distinct words, A–Z 2–12, labels ≤ 40, tiers 1–4), every word in the
// lexicon, "Hidden X" groups really hiding X, and no group repeated anywhere in the bank. Prints changes.
//   node apps/web/scripts/content-fixes/kindred.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { DATA, REPO, readJSON } from '../more-games/lib.mjs';
import { CONTENT_RELEASE_DATE } from '../content-release-date.mjs';
import { flagWord, liveFrom } from './lib.mjs';

const DRY = process.argv.includes('--dry');
const file = path.join(DATA, 'groups-puzzles.json');
const bank = readJSON(file);
const audit = readJSON(path.join(DATA, '..', '..', '..', 'content-audit.json'));
const lex = readJSON(path.join(REPO, 'scripts', 'data', 'lexicon-all.json'));
const U = (f) => readJSON(path.join(DATA, f)).map((w) => w.toUpperCase());
// The lexicon is a 1934-dictionary list and misses everyday modern words; these were checked by hand.
const EVERYDAY = ['YOU', 'BOX', 'MOM', 'MAMA', 'HIM', 'AYE', 'NANA', 'GRAMMY', 'CEASEFIRE', 'PINATA', 'WHAMMY', 'BACKPACK', 'COCKATIEL', 'FELLA', 'THUNDERHEAD'];
const known = new Set([...lex.common, ...lex.extended, ...(lex.acceptOnly ?? []), ...U('allowed.json'), ...U('allowed-6.json'), ...U('allowed-7.json'), ...EVERYDAY]);

/** [puzzle, tier] → fresh group. */
const GROUPS = {
  'gr-hxs0xt 4': { label: 'Sound like letters', words: ['BEE', 'SEA', 'TEA', 'PEA'] },
  'gr-o5smn1 4': { label: 'Hidden ANT', words: ['PANT', 'GIANT', 'PLANT', 'CHANT'] },
  'gr-hzkd13 4': { label: 'Sound like trees', words: ['FUR', 'YOU', 'BEACH', 'PAIR'] },
  'gr-l6j9u0 4': { label: 'Hidden BUN', words: ['BUNNY', 'BUNDLE', 'BUNCH', 'BUNKER'] },
  'gr-agqgrx 4': { label: 'Hidden STAR', words: ['START', 'STARCH', 'MUSTARD', 'STARFISH'] },
  'gr-agqgrx 1': { label: 'At a parade', words: ['FLOAT', 'BAND', 'BATON', 'BANNER'] },
  'gr-c2ql4 4': { label: 'Hidden TART', words: ['TARTAN', 'START', 'STARTLE', 'TARTAR'] },
  'gr-srcu1m 4': { label: 'Hidden EEL', words: ['PEEL', 'FEEL', 'KNEEL', 'STEEL'] },
  'gr-yy3mgy 3': { label: '___line', words: ['PUNCH', 'HEAD', 'FINISH', 'CLOTHES'] },
  'gr-wtbjf3 2': { label: 'Exhausted', words: ['WEARY', 'SPENT', 'DRAINED', 'BUSHED'] },
  'gr-frg0yr 4': { label: 'Hidden ICE', words: ['SLICE', 'PRICE', 'NOTICE', 'POLICE'] },
  'gr-c4pqdk 3': { label: 'Sun___', words: ['FLOWER', 'BURN', 'GLASSES', 'DIAL'] },
  'gr-jaod5y 3': { label: 'Sand___', words: ['CASTLE', 'PAPER', 'BOX', 'BAR'] },
  'gr-723zmp 3': { label: 'Gift ___', words: ['WRAP', 'CARD', 'BAG', 'SHOP'] },
  'gr-73fg0q 3': { label: 'Fire___', words: ['WORKS', 'FLY', 'PLACE', 'HOUSE'] },
  'gr-2gsrjx 1': { label: 'Luggage', words: ['SUITCASE', 'DUFFEL', 'BACKPACK', 'TRUNK'] },
  'gr-3yc1e2 3': { label: 'Pen ___', words: ['PAL', 'NAME', 'KNIFE', 'LIGHT'] },
  'gr-8lubi 3': { label: 'Love ___', words: ['SEAT', 'BIRD', 'LETTER', 'SONG'] },
  'gr-blhx74 2': { label: 'Things you can sign', words: ['CAST', 'CHECK', 'LEASE', 'PETITION'] },
  'gr-jkqygy 3': { label: 'Bad ___', words: ['LUCK', 'NEWS', 'HABIT', 'APPLE'] },
  'gr-novecn 3': { label: 'Tooth___', words: ['BRUSH', 'PASTE', 'PICK', 'ACHE'] },
  'gr-qjz5vu 3': { label: 'Head___', words: ['BAND', 'LIGHT', 'PHONES', 'START'] },
  'gr-cd53an 4': { label: 'Hidden ROW', words: ['GROWL', 'ARROW', 'THROW', 'BROWSE'] },
  'gr-snvm4m 3': { label: '___ cake', words: ['CARROT', 'POUND', 'SPONGE', 'LAYER'] },
};
/** Lead-review overrides of single-word swaps: 'puzzle WORD' → replacement. */
const WORD_OVERRIDE = {
  'gr-lnujaf SCARF': 'GORGE', // the audit's INHALE recreated gr-7d4dsy's group word for word
};
const live = new Map(liveFrom(bank, CONTENT_RELEASE_DATE).map((e) => [e.p.id, e]));
const changes = [], skipped = [];
const touched = new Set();
for (const [key, g] of Object.entries(GROUPS)) {
  const [id, tier] = key.split(' '); const e = live.get(id);
  if (!e) { skipped.push({ id, why: 'already served' }); continue; }
  const old = e.p.groups.find((x) => x.tier === Number(tier));
  changes.push({ id, where: e.where, date: e.date, field: `T${tier} group`, old: `${old.label}: ${old.words.join(' ')}`, new: `${g.label}: ${g.words.join(' ')}` });
  old.label = g.label; old.words = [...g.words]; touched.add(`${id} ${tier}`);
}
for (const f of audit.flags.filter((x) => x.game === 'kindred' && x.changeable && x.field === 'answer')) {
  const e = live.get(f.id); if (!e) { skipped.push({ id: f.id, word: flagWord(f), why: 'already served' }); continue; }
  const g = e.p.groups.find((x) => x.words.includes(flagWord(f)));
  if (!g) { skipped.push({ id: f.id, word: flagWord(f), why: 'group replaced' }); continue; }
  if (touched.has(`${f.id} ${g.tier}`)) continue;
  const rep = (WORD_OVERRIDE[`${f.id} ${flagWord(f)}`] ?? f.replacement ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2,12}$/.test(rep)) { skipped.push({ id: f.id, word: flagWord(f), why: f.replacement_note ?? 'no single-word replacement' }); continue; }
  changes.push({ id: f.id, where: e.where, date: e.date, field: `T${g.tier} ${g.label}`, old: flagWord(f), new: rep, flag: f.category });
  g.words = g.words.map((w) => (w === flagWord(f) ? rep : w));
}
// Validate the touched puzzles, and that no group appears twice anywhere in the bank.
const all = [...bank.daily, ...bank.extra, ...Object.values(bank.holiday ?? {}).flat()];
const problems = [];
for (const id of new Set(changes.map((c) => c.id))) {
  const p = live.get(id).p, words = p.groups.flatMap((g) => g.words);
  if (new Set(words).size !== 16) problems.push(`${id}: repeated word`);
  if (p.groups.map((g) => g.tier).join('') !== '1234') problems.push(`${id}: tiers`);
  for (const g of p.groups) {
    if (g.label.length > 40) problems.push(`${id}: label too long`);
    const h = /^Hidden ([A-Z]{2,})$/.exec(g.label); if (h) for (const w of g.words) if (!w.includes(h[1])) problems.push(`${id}: ${w} lacks ${h[1]}`);
    for (const w of g.words) { if (!/^[A-Z]{2,12}$/.test(w)) problems.push(`${id}: shape ${w}`); if (!known.has(w)) problems.push(`${id}: ${w} not in the lexicon`); }
  }
}
const seen = new Map();
for (const p of all) for (const g of p.groups) { const k = [...g.words].sort().join(' '); if (seen.has(k) && live.has(p.id) && changes.some((c) => c.id === p.id)) problems.push(`${p.id}: group ${k} also in ${seen.get(k)}`); seen.set(k, p.id); }
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
if (!DRY) fs.writeFileSync(file, JSON.stringify(bank, null, 1) + '\n');
console.log(JSON.stringify({ changes, skipped }));
