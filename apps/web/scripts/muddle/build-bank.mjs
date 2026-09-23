// Muddle bank builder (More Games §5 + §20) — turns the founder-reviewed puns
// (scripts/muddle/jokes.json, merged from bank/*.json by merge-banks.mjs) into
// the SHIPPED bank. It runs compose.mjs (four 5/6-letter answer words whose
// CIRCLED letters are exactly the punchline's letters, scrambles derived and
// validated, tone-swept) and then schedules the result:
//
//   apps/web/data/scramble-puzzles.json   { version, epoch, daily[], extra[], holiday: { key: [...] } }
//
// Each entry: { id, words: [{ answer, scramble, circled[] }] × 4, final: { answer, pattern }, caption, altText, cartoon: null }.
// `cartoon` stays null until the founder's image batch runs (his own key); the
// apps show the bundled placeholder panel and the caption meanwhile, so the
// puzzle is fully playable. Ids hash the punchline's letters, so a cut elsewhere
// never renames a puzzle. Everyday puns are shuffled once (seeded) and split
// daily / extra; holiday-tagged puns go under their key and are served on their
// dates by bankHolidayPick. Deterministic. APPEND-ONLY once live.
//
//   node apps/web/scripts/muddle/build-bank.mjs [--daily=365] [--skip-compose]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { WEB, DATA, SAMPLES, readJSON, simpleHash, rngFor, shuffle } from '../more-games/lib.mjs';

const arg = (k, d) => Number((process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d);
const DAILY_COUNT = arg('daily', 365);
const EPOCH = '2026-09-23';
if (!process.argv.includes('--skip-compose')) {
  console.log('composing…');
  execSync('node scripts/muddle/compose.mjs --in scripts/muddle/jokes.json --out muddle-bank.json', { cwd: WEB, stdio: 'ignore' });
}
const composed = readJSON(path.join(SAMPLES, 'muddle-bank.json'));
const seen = new Set(), everyday = [], holiday = {};
for (const p of composed.puzzles) {
  const letters = p.final.answer.replace(/[^A-Z]/g, '');
  if (seen.has(letters)) continue; seen.add(letters);
  const entry = {
    id: `md-${simpleHash(letters).toString(36)}`,
    words: p.words.map((w) => ({ answer: w.answer, scramble: w.scramble, circled: w.circled })),
    final: { answer: p.final.answer, pattern: p.final.pattern },
    caption: p.caption, altText: p.altText, cartoon: null,
  };
  // Sanity: the circled letters are exactly the punchline's letters.
  const circ = entry.words.flatMap((w) => w.circled.map((i) => w.answer[i])).sort().join('');
  if (circ !== [...letters].sort().join('')) throw new Error(`${entry.id}: circled letters ≠ final`);
  if (p.holiday) (holiday[p.holiday] ||= []).push({ ...entry, holiday: p.holiday });
  else everyday.push(entry);
}
const ids = new Set(); for (const e of [...everyday, ...Object.values(holiday).flat()]) { if (ids.has(e.id)) throw new Error(`id collision ${e.id}`); ids.add(e.id); }
const order = shuffle(everyday, rngFor('scramble-bank-v1'));
const daily = order.slice(0, DAILY_COUNT), extra = order.slice(DAILY_COUNT);
for (const k of Object.keys(holiday)) holiday[k].sort((a, b) => a.id.localeCompare(b.id));
const bank = { version: 1, epoch: EPOCH, daily, extra, holiday: Object.fromEntries(Object.keys(holiday).sort().map((k) => [k, holiday[k]])) };
const out = path.join(DATA, 'scramble-puzzles.json');
fs.writeFileSync(out, JSON.stringify(bank) + '\n');
console.log(`wrote ${out}: ${daily.length} daily (epoch ${EPOCH}), ${extra.length} extra, ${Object.keys(holiday).length} holidays / ${Object.values(holiday).flat().length} entries; cartoons: none yet`);
console.log(`first daily: ${daily[0].id} "${daily[0].caption}" → ${daily[0].final.answer}`);
