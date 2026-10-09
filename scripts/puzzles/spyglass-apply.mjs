// Apply the harder Spyglass generator (FRIDAY-QUEUE item 30) to dailies on/after the content release date and
// to the Unlimited pool (mid level). Same themes, titles and word lists; new grid + placements; near = [] (the
// generator rejects any off-list theme word in the filler, so there are no close calls). Past days never change.
import fs from 'node:fs';
import { generateHarder, levelForDate, themePools } from './spyglass-harder.mjs';
const HORIZON = '2026-12-13'; // the next ~2 months; later dates regenerate as data in a later build

const RELEASE = '2026-10-13';
const file = 'apps/web/data/wordsearch-puzzles.json';
const raw = fs.readFileSync(file, 'utf8');
const bank = JSON.parse(raw);
const pools = themePools();
const epoch = Date.parse(`${bank.epoch}T00:00:00Z`);
const dayOf = (i) => new Date(epoch + i * 86400000).toISOString().slice(0, 10);
let daily = 0, extra = 0; const scores = [];
let kept = 0;
const rebuild = (p, level) => {
  const words = p.words.map((x) => x.w);
  let r;
  // requested level, then one gentler try at level 2; else keep the current grid (bounded runtime)
  for (const L of [level, 2]) { try { r = generateHarder({ words, pool: pools[p.theme] ?? [], level: L, seed: p.id }); break; } catch { /* next */ } }
  if (!r) { kept++; return; } // a word set the 10 × 10 can't fit cleanly keeps its current grid
  p.grid = r.grid; p.words = r.words.map(({ w, r: row, c, d }) => ({ w, r: row, c, d })); p.near = [];
  scores.push(r.score);
};
bank.daily.forEach((p, i) => { const day = dayOf(i); if (day >= RELEASE && day <= HORIZON) { rebuild(p, levelForDate(day)); daily++; } });
fs.writeFileSync(file, JSON.stringify(bank, null, raw.includes('\n  ') ? 2 : undefined) + (raw.endsWith('\n') ? '\n' : ''));
const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
console.log({ daily, extra, kept, avgScore: Math.round(avg), min: Math.min(...scores), max: Math.max(...scores) });
