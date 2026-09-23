// Emits the shared holiday calendar as DATA so every platform reads the same
// table instead of porting the date rules: apps/web/data/holiday-days.json
//   { version, from, to, days: { "2026-12-25": "christmas", ... } }
// Copies go to iOS Resources / Android core resources (sha-guarded like the
// word lists) when the runtime lands. Covers every year the tabled
// Hebrew/lunar/Hindu dates in crossword/holidays.mjs cover; the runway test
// warns when the table ends within a year.
//   node scripts/holidays/gen-holiday-days.mjs
import fs from 'node:fs';
import path from 'node:path';
import { DATA } from '../more-games/lib.mjs';
import { holidayDays } from '../crossword/holidays.mjs';

const FROM = 2026, TO = 2030;
const days = {};
for (let y = FROM; y <= TO; y++) Object.assign(days, holidayDays(y));
const out = { version: 1, from: `${FROM}-01-01`, to: `${TO}-12-31`, days: Object.fromEntries(Object.entries(days).sort()) };
const p = path.join(DATA, 'holiday-days.json');
fs.writeFileSync(p, JSON.stringify(out, null, 1) + '\n');
console.log(`wrote ${p}: ${Object.keys(days).length} holiday days ${FROM}–${TO}, ${new Set(Object.values(days)).size} holidays`);
