// Codebreaker bank builder (More Games §16 + §20) — turns the founder-reviewed
// sayings (scripts/cryptogram/sayings.json, merged from bank/*.json by
// merge-banks.mjs) into the SHIPPED bank:
//
//   apps/web/data/cryptogram-puzzles.json   { version, epoch, daily[], extra[], holiday: { key: [...] } }
//
// Each entry: { id, text, key, given } — `key` is a stored 26-letter derangement
// (key[i] = code letter for plain letter i), `given` the three most frequent
// plain letters (ties alphabetical). Ids hash the saying's letters, so a cut
// elsewhere in the list never renames a puzzle. Everyday sayings are shuffled
// once (seeded) and split daily / extra; holiday-tagged sayings go under their
// key and are served on their dates by bankHolidayPick (holiday-days.json).
// Deterministic: same input → same file. APPEND-ONLY once live.
//
//   node apps/web/scripts/cryptogram/build-bank.mjs [--daily=372]
import fs from 'node:fs';
import path from 'node:path';
import { WEB, DATA, readJSON, simpleHash, rngFor, shuffle, wordset } from '../more-games/lib.mjs';

const arg = (k, d) => Number((process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d);
const DAILY_COUNT = arg('daily', 372);
const EPOCH = '2026-09-23';
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const [MINLEN, MAXLEN, MINLET, MAXLET] = [30, 90, 10, 22];

const sayings = readJSON(path.join(WEB, 'scripts', 'cryptogram', 'sayings.json'));
const hard = [...wordset('profanity-exact.generated.txt'), ...wordset('offensive-blocklist.txt')];

function makeKey(id) {
  const rng = rngFor(`${id}-cipher-v1`);
  for (;;) { const p = shuffle(A.split(''), rng); if (p.every((c, i) => c !== A[i])) return p.join(''); }
}
function validate(t) {
  const problems = [], letters = new Set(t.toUpperCase().replace(/[^A-Z]/g, ''));
  if (t.length < MINLEN || t.length > MAXLEN) problems.push(`length ${t.length}`);
  if (!/^[A-Za-z .,;:'"!?\-]+$/.test(t)) problems.push('unsupported characters');
  if (letters.size < MINLET || letters.size > MAXLET) problems.push(`${letters.size} distinct letters`);
  if (!t.split(/\s+/).some((w) => w.replace(/[^A-Za-z]/g, '').length <= 3)) problems.push('no short word');
  const words = t.toUpperCase().split(/[^A-Z']+/); if (hard.some((h) => words.includes(h))) problems.push('blocked term');
  return problems;
}
const seen = new Set(), everyday = [], holiday = {}, rejects = [];
for (const q of sayings) {
  const t = q.text.trim(), norm = t.toUpperCase().replace(/[^A-Z]/g, '');
  if (seen.has(norm)) continue; seen.add(norm);
  const problems = validate(t);
  if (problems.length) { rejects.push([t, problems.join('; ')]); continue; }
  const id = `cg-${simpleHash(norm).toString(36)}`;
  const freq = {}; for (const c of norm) freq[c] = (freq[c] || 0) + 1;
  const given = Object.keys(freq).sort((a, b) => freq[b] - freq[a] || a.localeCompare(b)).slice(0, 3);
  const entry = { id, text: t, key: makeKey(id), given };
  if (q.holiday) (holiday[q.holiday] ||= []).push({ ...entry, holiday: q.holiday });
  else everyday.push(entry);
}
const ids = new Set(); for (const e of [...everyday, ...Object.values(holiday).flat()]) { if (ids.has(e.id)) throw new Error(`id collision ${e.id}`); ids.add(e.id); }
const order = shuffle(everyday, rngFor('cryptogram-bank-v1'));
const daily = order.slice(0, DAILY_COUNT), extra = order.slice(DAILY_COUNT);
for (const k of Object.keys(holiday)) holiday[k].sort((a, b) => a.id.localeCompare(b.id));
const bank = { version: 1, epoch: EPOCH, daily, extra, holiday: Object.fromEntries(Object.keys(holiday).sort().map((k) => [k, holiday[k]])) };
const out = path.join(DATA, 'cryptogram-puzzles.json');
fs.writeFileSync(out, JSON.stringify(bank, null, 1) + '\n');
console.log(`wrote ${out}: ${daily.length} daily (epoch ${EPOCH}), ${extra.length} extra, ${Object.keys(holiday).length} holidays / ${Object.values(holiday).flat().length} entries; ${rejects.length} rejected`);
for (const [t, why] of rejects) console.log(`  REJECT ${JSON.stringify(t)} — ${why}`);
console.log(`first daily: ${daily[0].id} "${daily[0].text}" given ${daily[0].given.join('')}`);
