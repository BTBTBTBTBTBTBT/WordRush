// Codebreaker content fixes from the 2026-10-06 content audit (REPORT-CONTENT-FIXES.md). FUTURE puzzles only
// (dailies from CONTENT_RELEASE_DATE, Unlimited, unserved holiday entries). British sayings take their
// American form ("…lock the barn door…") or a different well-known American saying; misquotes are
// corrected; duplicates get a different saying. Ids and cipher keys are kept; `given` is recomputed (the
// three most frequent letters, ties alphabetical). Each text passes build-bank.mjs's validate() and stays
// unique in the bank. Prints changes as JSON.   node apps/web/scripts/content-fixes/codebreaker.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { DATA, readJSON, wordset } from '../more-games/lib.mjs';
import { CONTENT_RELEASE_DATE } from '../content-release-date.mjs';
import { liveFrom } from './lib.mjs';

const DRY = process.argv.includes('--dry');
const file = path.join(DATA, 'cryptogram-puzzles.json');
const bank = readJSON(file);
const audit = readJSON(path.join(DATA, '..', '..', '..', 'content-audit.json'));
const [MINLEN, MAXLEN, MINLET, MAXLET] = [30, 90, 10, 22];
const hard = [...wordset('profanity-exact.generated.txt'), ...wordset('offensive-blocklist.txt')];
function validate(t) { // = scripts/cryptogram/build-bank.mjs
  const problems = [], letters = new Set(t.toUpperCase().replace(/[^A-Z]/g, ''));
  if (t.length < MINLEN || t.length > MAXLEN) problems.push(`length ${t.length}`);
  if (!/^[A-Za-z .,;:'"!?\-]+$/.test(t)) problems.push('unsupported characters');
  if (letters.size < MINLET || letters.size > MAXLET) problems.push(`${letters.size} distinct letters`);
  if (!t.split(/\s+/).some((w) => w.replace(/[^A-Za-z]/g, '').length <= 3)) problems.push('no short word');
  const words = t.toUpperCase().split(/[^A-Z']+/); if (hard.some((h) => words.includes(h))) problems.push('blocked term');
  return problems;
}
/** Lead review: the audit's text broke build-bank's rules (30–90 chars, 10–22 letters, a word of ≤ 3). */
const OVERRIDE = {
  'cg-hcxmaj': "There is no time like the present.",
  'cg-spl4xt': "Where there is smoke, there is fire.",
  'cg-ejj9u0': "Time flies when you are having fun.",
  'cg-axt6y7': "Variety is the very spice of life.",
  'cg-sx17eg': "Hope for the best, prepare for the worst.",
  'cg-tmrtky': "The grass is always greener on the other side.",
  'cg-sdrx68': "Where there is a will, there is a way.",
  'cg-70fd9a': "Don't look a gift horse in the mouth.",
  'cg-gaew8v': "It ain't over until it's over.",
  'cg-yxoocs': "Ask me no questions and I'll tell you no lies.",
  'cg-57bcsm': "Don't judge a man until you walk a mile in his shoes.",
  'cg-r17owx': "Laugh and the world laughs with you.",
  'cg-kuqhdy': "Two's company, three's a crowd.",
  'cg-abao6o': "Better late than never, but never late is better.",
  'cg-o473ws': "Even a broken clock is right twice a day.",
  'cg-rvnfi9': "Don't sweat the small stuff, and it's all small stuff.",
};
const live = new Map(liveFrom(bank, CONTENT_RELEASE_DATE).map((e) => [e.p.id, e]));
const norm = (t) => t.toUpperCase().replace(/[^A-Z]/g, '');
const all = () => [...bank.daily, ...bank.extra, ...Object.values(bank.holiday ?? {}).flat()];
const changes = [], skipped = [], problems = [];
for (const f of audit.flags.filter((x) => x.game === 'codebreaker' && x.changeable)) {
  const e = live.get(f.id); if (!e) { skipped.push({ id: f.id, text: f.word, why: 'already served' }); continue; }
  if (changes.some((c) => c.id === f.id)) continue;
  const text = (OVERRIDE[f.id] ?? f.replacement ?? '').trim();
  if (!text) { skipped.push({ id: f.id, text: f.word, why: f.replacement_note ?? 'no replacement' }); continue; }
  const why = validate(text);
  if (all().some((q) => q !== e.p && norm(q.text) === norm(text))) why.push('already in the bank');
  if (why.length) { problems.push(`${f.id}: "${text}" — ${why.join('; ')}`); continue; }
  const freq = {}; for (const c of norm(text)) freq[c] = (freq[c] || 0) + 1;
  const given = Object.keys(freq).sort((a, b) => freq[b] - freq[a] || a.localeCompare(b)).slice(0, 3);
  changes.push({ id: f.id, where: e.where, date: e.date, old: e.p.text, new: text, flag: f.category });
  e.p.text = text; e.p.given = given;
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
if (!DRY) fs.writeFileSync(file, JSON.stringify(bank, null, 1) + '\n');
console.log(JSON.stringify({ changes, skipped }));
