// Holiday Word of the Day (founder, 2026-09-23: the home-page Word of the Day
// and its definition should be thematic on a holiday or day of significance).
// Input: scripts/holidays/holiday-wotd.json
//   { "christmas": [ { "word": "HOLLY", "sense": 0 }, { "word": "CAROL", "definition": "...", "partOfSpeech": "noun" } ], ... }
// Each holiday lists 2+ words (the k-th recurrence of the holiday shows entry
// k, wrapping). A word must be a real dictionary entry in
// apps/web/data/word-definitions.json (the same dataset every Word of the Day
// uses) — `sense` picks the thematic sense by index, or an explicit
// `definition` (+ `partOfSpeech`) overrides it. Words must not be proper nouns
// or blocked, and must not be on the Word-of-the-Day blocklist. Five-letter
// words are preferred (they are also valid Classic guesses) but any length in
// the dictionary is allowed — the Word of the Day is a reading feature.
//   node scripts/holidays/validate-holiday-wotd.mjs [--in file] [--show WORD]
import path from 'node:path';
import { WEB, DATA, readJSON, neverAnswer, wordset } from '../more-games/lib.mjs';
import { HOLIDAY_KEYS } from '../crossword/holidays.mjs';

const argv = process.argv.slice(2), argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const dict = readJSON(path.join(DATA, 'word-definitions.json'));
const show = argOf('--show', null);
if (show) { const r = dict[show.toLowerCase()]; console.log(show, r ? JSON.stringify(r.senses?.map((s, i) => `${i}: (${s.pos}) ${s.def}`), null, 1) : 'NOT IN THE DICTIONARY'); process.exit(0); }
const IN = argOf('--in', path.join(WEB, 'scripts', 'holidays', 'holiday-wotd.json'));
const table = readJSON(IN);
const never = neverAnswer(), hard = new Set([...wordset('profanity-exact.generated.txt'), ...wordset('offensive-blocklist.txt')]);
let problems = 0, total = 0; const seen = new Map();
for (const [key, entries] of Object.entries(table)) {
  if (!HOLIDAY_KEYS.includes(key)) { console.log(`FAIL ${key}: not a holiday key`); problems++; }
  if (!Array.isArray(entries) || entries.length < 2) { console.log(`FAIL ${key}: need at least 2 entries`); problems++; continue; }
  for (const e of entries) {
    total++;
    const w = String(e.word || '').toUpperCase(), why = [];
    if (!/^[A-Z]{3,12}$/.test(w)) why.push('word must be 3–12 letters A–Z');
    const rec = dict[w.toLowerCase()];
    if (!rec || rec.miss || !rec.senses?.length) why.push('not in word-definitions.json (pick a word that is, or the card has no definition)');
    else if (e.sense !== undefined && !rec.senses[e.sense]) why.push(`sense ${e.sense} does not exist (0–${rec.senses.length - 1})`);
    if (e.definition !== undefined && (typeof e.definition !== 'string' || e.definition.length < 12 || e.definition.length > 220)) why.push('definition must be 12–220 chars');
    if (e.definition !== undefined && !e.partOfSpeech) why.push('an explicit definition needs partOfSpeech');
    if (never.has(w)) why.push('proper noun / blocklisted');
    if (hard.has(w)) why.push('blocked term');
    if (seen.has(w) && seen.get(w) !== key) why.push(`also under ${seen.get(w)}`);
    seen.set(w, key);
    if (why.length) { console.log(`FAIL ${key} ${w}: ${why.join('; ')}`); problems++; }
  }
}
const missing = HOLIDAY_KEYS.filter((k) => !table[k]);
if (missing.length) console.log(`note: holidays without entries yet: ${missing.join(' ')}`);
console.log(`${total} words checked, ${problems} problems, ${Object.keys(table).length}/${HOLIDAY_KEYS.length} holidays covered`);
process.exit(problems ? 1 : 0);
