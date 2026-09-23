// Holiday-themed answers for the WORD games (Classic 5, Six 6, Seven 7, and the
// five-letter sets QuadWord/OctoWord/Gauntlet draw from). Founder, 2026-09-23:
// "themed solutions on holidays on all of the other games, as well? Like
// classic and the like". Input: scripts/holidays/holiday-answers.json —
//   { "christmas": { "5": ["HOLLY", ...], "6": ["WREATH", ...], "7": ["PRESENT", ...] }, ... }
// Rules: every word is a valid GUESS for its length (allowed list), is not a
// proper noun (answer-proper-nouns / names blocklists), is not blocked, and no
// word appears under two holidays. At least 8 five-letter words per holiday
// (OctoWord needs eight distinct answers on the day), 2 six-letter, 2 seven.
//   node scripts/holidays/validate-holiday-answers.mjs [--in file]
import path from 'node:path';
import { WEB, readJSON, upperList, neverAnswer, wordset } from '../more-games/lib.mjs';
import { HOLIDAY_KEYS } from '../crossword/holidays.mjs';

const argv = process.argv.slice(2), argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const IN = argOf('--in', path.join(WEB, 'scripts', 'holidays', 'holiday-answers.json'));
const table = readJSON(IN);
const allowed = { 5: new Set(upperList('allowed.json')), 6: new Set(upperList('allowed-6.json')), 7: new Set(upperList('allowed-7.json')) };
const answers = { 5: new Set(upperList('solutions.json')), 6: new Set(upperList('solutions-6.json')), 7: new Set(upperList('solutions-7.json')) };
const never = neverAnswer(), hard = new Set([...wordset('profanity-exact.generated.txt'), ...wordset('offensive-blocklist.txt')]);
const MIN = { 5: 8, 6: 2, 7: 2 };
let problems = 0, total = 0;
const seen = new Map();
for (const key of Object.keys(table)) {
  if (!HOLIDAY_KEYS.includes(key)) { console.log(`FAIL ${key}: not a holiday key (see crossword/holidays.mjs)`); problems++; }
  for (const len of [5, 6, 7]) {
    const words = (table[key][String(len)] || []).map((w) => w.toUpperCase());
    if (words.length < MIN[len]) { console.log(`FAIL ${key}/${len}: ${words.length} words, need ${MIN[len]}`); problems++; }
    for (const w of words) {
      total++;
      const why = [];
      if (w.length !== len || !/^[A-Z]+$/.test(w)) why.push('wrong shape');
      else if (!allowed[len].has(w)) why.push('not a valid guess (allowed list)');
      if (never.has(w)) why.push('proper noun / blocklisted answer');
      if (hard.has(w)) why.push('blocked term');
      if (seen.has(w) && seen.get(w) !== key) why.push(`also under ${seen.get(w)}`);
      seen.set(w, key);
      if (why.length) { console.log(`FAIL ${key}/${len} ${w}: ${why.join('; ')}`); problems++; }
    }
    const notAnswers = words.filter((w) => allowed[len].has(w) && !answers[len].has(w));
    if (notAnswers.length) console.log(`note ${key}/${len}: valid guesses but not on the everyday answer list (fine for a holiday, just be sure they are fair): ${notAnswers.join(' ')}`);
  }
}
const missing = HOLIDAY_KEYS.filter((k) => !table[k]);
if (missing.length) console.log(`note: holidays without a table yet: ${missing.join(' ')}`);
console.log(`${total} words checked, ${problems} problems, ${Object.keys(table).length}/${HOLIDAY_KEYS.length} holidays covered`);
process.exit(problems ? 1 : 0);
