// Prompt 05b (tester video: Hubbub rejected AUNTY but accepted TAUN, RUTTY, NITTY). For every Hubbub puzzle not
// yet served (dailies from CONTENT_RELEASE_DATE, Unlimited, unserved holidays):
//  - ACCEPT every everyday word (content-safety must-accept list) that fits the puzzle (4+ letters, only its
//    seven letters, uses the centre) — as a 0-point-count bonus word unless it is already a scored word;
//  - DROP bonus words that are offensive, so rare wordfreq has no Zipf ≥ 2.0 for them (TAUN, RUTTY, COTTERITE…),
//    or on the curated obscure list and still rare (Zipf < 3: NITTY). British forms stay accepted as bonus
//    words (content-american.test.ts's Hubbub rule). Scored lists, max and past puzzles are untouched.
// Letter Ladder's accept list takes the must-accept words through build-ladder-words.mjs.
//   node apps/web/scripts/content-fixes/everyday-words.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { DATA, readJSON } from '../more-games/lib.mjs';
import { CONTENT_RELEASE_DATE } from '../content-release-date.mjs';
import { liveFrom } from './lib.mjs';
import { mustAccept, offensiveWord, britishWord, isListedObscure, zipf } from '../../../../packages/core/src/content-safety/safety.mjs';

const DRY = process.argv.includes('--dry');
const file = path.join(DATA, 'hub-puzzles.json');
const bank = readJSON(file);
const must = mustAccept().filter((w) => w.length >= 4 && !offensiveWord(w) && !britishWord(w));
let added = 0, dropped = 0; const addedWords = new Map(), droppedSample = new Set(), perPuzzle = [];
for (const { p, where, date } of liveFrom(bank, CONTENT_RELEASE_DATE)) {
  const letters = new Set(p.letters), centre = p.letters[0];
  const fits = (w) => [...w].every((c) => letters.has(c)) && w.includes(centre);
  const scored = new Set(p.words);
  const keep = p.bonus.filter((w) => !(offensiveWord(w) || zipf(w) < 2.0 || (isListedObscure(w) && zipf(w) < 3.0)));
  const drop = p.bonus.filter((w) => !keep.includes(w));
  const add = must.filter((w) => fits(w) && !scored.has(w) && !keep.includes(w));
  if (!add.length && !drop.length) continue;
  p.bonus = [...keep, ...add].sort();
  added += add.length; dropped += drop.length;
  for (const w of add) addedWords.set(w, (addedWords.get(w) ?? 0) + 1);
  drop.slice(0, 3).forEach((w) => droppedSample.add(w));
  perPuzzle.push({ id: p.id, where, date, letters: p.letters, added: add, dropped: drop.length });
}
if (!DRY) fs.writeFileSync(file, JSON.stringify(bank) + '\n');
console.log(JSON.stringify({ puzzles: perPuzzle.length, added, dropped, addedWords: Object.fromEntries([...addedWords].sort()), droppedSample: [...droppedSample].slice(0, 60), perPuzzle }));
