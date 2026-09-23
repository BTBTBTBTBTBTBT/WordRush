// Crosswordocious bank builder (More Games §13 + §20) — turns the founder-
// reviewed phrase bank (scripts/crossword/phrases.json, merged from bank/*.json
// by merge-banks.mjs) into the SHIPPED bank. It runs build-grids.mjs (six grids
// per evergreen theme, three per holiday theme) and then SCHEDULES them:
//
//   apps/web/data/crossword-puzzles.json   { version, epoch, daily[], extra[], holiday: { key: [...] } }
//
// daily  = grids 1–5 of every evergreen theme, dealt round by round with the
//          theme order reshuffled each round (seeded), so a theme returns
//          roughly every 82 days and never on consecutive days;
// extra  = grid 6 of every evergreen theme (Unlimited never spoils a daily);
// holiday = every grid of a holiday theme under its key, served on the date by
//          bankHolidayPick (k-th outing → grid k).
// Entries drop the builder's onTheme flag (founder: nothing on the board marks
// the theme). Ids hash theme + the sorted answers, so a cut elsewhere never
// renames a grid. Deterministic. APPEND-ONLY once live.
//
//   node apps/web/scripts/crossword/build-bank.mjs [--skip-grids]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { WEB, DATA, SAMPLES, readJSON, simpleHash, rngFor, shuffle } from '../more-games/lib.mjs';

const EPOCH = '2026-09-23';
const PER = 6, PER_HOLIDAY = 3, DAILY_ROUNDS = 5;
if (!process.argv.includes('--skip-grids')) {
  console.log('building grids…');
  execSync(`node scripts/crossword/build-grids.mjs --in scripts/crossword/phrases.json --out crossword-bank.json --per ${PER} --per-holiday ${PER_HOLIDAY}`, { cwd: WEB, stdio: 'ignore' });
}
const built = readJSON(path.join(SAMPLES, 'crossword-bank.json'));
const clean = (g) => ({
  id: `cw-${simpleHash(`${g.theme}|${g.entries.map((e) => e.answer).sort().join(',')}`).toString(36)}`,
  title: g.title, theme: g.theme, w: g.w, h: g.h,
  entries: g.entries.map(({ n, dir, r, c, answer, clue }) => ({ n, dir, r, c, answer, clue })),
});
const evergreen = built.puzzles.filter((g) => !g.holiday), holidayGrids = built.puzzles.filter((g) => g.holiday);
const byTheme = new Map();
for (const g of evergreen) (byTheme.get(g.theme) || byTheme.set(g.theme, []).get(g.theme)).push(g);
const themes = [...byTheme.keys()].sort();
const daily = [], extra = [];
let prevTail = [];
for (let round = 0; round < PER; round++) {
  // Reshuffle (deterministically) until the round's first few themes differ from the previous round's last few,
  // so a theme never returns within a week of its last outing across a round boundary.
  let order = themes, attempt = 0;
  do { order = shuffle(themes, rngFor(`crossword-round-${round}-v1-${attempt++}`)); } while (attempt < 500 && order.slice(0, 7).some((t) => prevTail.includes(t)));
  prevTail = order.slice(-7);
  for (const t of order) {
    const g = byTheme.get(t)[round];
    if (!g) continue;
    (round < DAILY_ROUNDS ? daily : extra).push(clean(g));
  }
}
const holiday = {};
for (const g of holidayGrids) (holiday[g.holiday] ||= []).push({ ...clean(g), holiday: g.holiday });
for (const k of Object.keys(holiday)) holiday[k].sort((a, b) => a.id.localeCompare(b.id));
const ids = new Set(); for (const e of [...daily, ...extra, ...Object.values(holiday).flat()]) { if (ids.has(e.id)) throw new Error(`id collision ${e.id}`); ids.add(e.id); }
const bank = { version: 1, epoch: EPOCH, daily, extra, holiday: Object.fromEntries(Object.keys(holiday).sort().map((k) => [k, holiday[k]])) };
const out = path.join(DATA, 'crossword-puzzles.json');
fs.writeFileSync(out, JSON.stringify(bank) + '\n');
const gaps = []; for (let i = 0; i < daily.length; i++) { const j = daily.findIndex((g, k) => k > i && g.theme === daily[i].theme); if (j > 0) gaps.push(j - i); }
console.log(`wrote ${out}: ${daily.length} daily (epoch ${EPOCH}), ${extra.length} extra, ${Object.keys(holiday).length} holidays / ${Object.values(holiday).flat().length} grids; ${themes.length} evergreen themes; min gap between a theme's outings ${Math.min(...gaps)} days`);
console.log(`first daily: ${daily[0].id} "${daily[0].title}" ${daily[0].w}×${daily[0].h}, ${daily[0].entries.length} entries`);
