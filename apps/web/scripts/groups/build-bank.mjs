// Kindred bank builder (More Games §14 + §20) — turns the founder-reviewed
// puzzles (scripts/groups/puzzles.json, merged from bank/*.json by
// merge-banks.mjs and proven single-solution by validate-groups.mjs) into the
// SHIPPED bank:
//
//   apps/web/data/groups-puzzles.json   { version, epoch, daily[], extra[], holiday: { key: [...] } }
//
// Each entry: { id, groups: [{ tier, label, words[4] }] } (tiers 1–4 in order;
// alsoFits / redHerrings / source are validator-only and dropped). Ids hash the
// sorted sixteen words, so a cut elsewhere never renames a puzzle. Everyday
// puzzles are shuffled once (seeded) and split daily / extra; holiday-tagged
// puzzles go under their key and are served on their dates by bankHolidayPick.
// Deterministic: same input → same file. APPEND-ONLY once live.
//
//   node apps/web/scripts/groups/build-bank.mjs [--daily=380]
import fs from 'node:fs';
import path from 'node:path';
import { WEB, DATA, readJSON, simpleHash, rngFor, shuffle } from '../more-games/lib.mjs';

const arg = (k, d) => Number((process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d);
const DAILY_COUNT = arg('daily', 380);
const EPOCH = '2026-09-23';

const puzzles = readJSON(path.join(WEB, 'scripts', 'groups', 'puzzles.json'));
const seen = new Set(), everyday = [], holiday = {}, rejects = [];
for (const p of puzzles) {
  const groups = [...p.groups].sort((a, b) => a.tier - b.tier).map((g) => ({ tier: g.tier, label: g.label, words: g.words.map((w) => w.toUpperCase()) }));
  const words = groups.flatMap((g) => g.words), problems = [];
  if (groups.length !== 4 || groups.some((g) => g.words.length !== 4)) problems.push('needs 4 groups of 4');
  if (new Set(words).size !== 16) problems.push('duplicate word');
  if (groups.map((g) => g.tier).join('') !== '1234') problems.push('tiers must be 1–4');
  if (words.some((w) => !/^[A-Z]{2,12}$/.test(w))) problems.push('bad word shape');
  const key = [...words].sort().join('|');
  if (seen.has(key)) problems.push('duplicate puzzle');
  if (problems.length) { rejects.push([groups.map((g) => g.label).join(' · '), problems.join('; ')]); continue; }
  seen.add(key);
  const entry = { id: `gr-${simpleHash(key).toString(36)}`, groups };
  if (p.holiday) (holiday[p.holiday] ||= []).push({ ...entry, holiday: p.holiday });
  else everyday.push(entry);
}
const ids = new Set(); for (const e of [...everyday, ...Object.values(holiday).flat()]) { if (ids.has(e.id)) throw new Error(`id collision ${e.id}`); ids.add(e.id); }
const order = shuffle(everyday, rngFor('groups-bank-v1'));
const daily = order.slice(0, DAILY_COUNT), extra = order.slice(DAILY_COUNT);
for (const k of Object.keys(holiday)) holiday[k].sort((a, b) => a.id.localeCompare(b.id));
const bank = { version: 1, epoch: EPOCH, daily, extra, holiday: Object.fromEntries(Object.keys(holiday).sort().map((k) => [k, holiday[k]])) };
const out = path.join(DATA, 'groups-puzzles.json');
fs.writeFileSync(out, JSON.stringify(bank, null, 1) + '\n');
console.log(`wrote ${out}: ${daily.length} daily (epoch ${EPOCH}), ${extra.length} extra, ${Object.keys(holiday).length} holidays / ${Object.values(holiday).flat().length} entries; ${rejects.length} rejected`);
for (const [t, why] of rejects) console.log(`  REJECT ${t} — ${why}`);
console.log(`first daily: ${daily[0].id} — ${daily[0].groups.map((g) => g.label).join(' · ')}`);
