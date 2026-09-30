// Spyglass "close calls" (founder, 2026-09-30: in Night Sky the filler spelled STARS, a theme
// word that was not one of the day's ten, and tracing it cost a miss). For every puzzle, `near`
// lists the words that fit the theme and really sit in the grid (any of the 8 directions) but are
// not on the list: the theme's other pool words and plurals of the targets and pool words
// (+S / +ES). The engine treats a selection spelling one of them as a close call — a friendly message, never a miss. Grids are untouched, so every platform keeps the same daily.
//
//   node apps/web/scripts/wordsearch/add-near.mjs      # rewrites apps/web/data/wordsearch-puzzles.json in place
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const N = 10;
const MIN = 4; // shorter selections are never misses anyway
const DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];

/** Every straight run of ≥ MIN letters in the grid, all 8 directions. */
function runs(grid) {
  const out = new Set();
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of DIRS) {
    let s = '';
    for (let rr = r, cc = c; rr >= 0 && rr < N && cc >= 0 && cc < N; rr += dr, cc += dc) {
      s += grid[rr * N + cc];
      if (s.length >= MIN) out.add(s);
    }
  }
  return out;
}

/** The close-call words for one puzzle, sorted; `pool` is the theme's full word list. */
export function nearWords(puzzle, pool) {
  const targets = new Set(puzzle.words.map((p) => p.w));
  const cands = new Set();
  for (const w of [...pool, ...targets]) {
    if (!targets.has(w)) cands.add(w);
    cands.add(`${w}S`); cands.add(`${w}ES`);
  }
  const inGrid = runs(puzzle.grid);
  return [...cands].filter((w) => w.length >= MIN && !targets.has(w) && inGrid.has(w)).sort();
}

/** Adds `near` to every puzzle of a bank (in place) from the themes file's pools. */
export function addNear(bank, themes) {
  const pools = new Map(themes.map((t) => [t.key, (Array.isArray(t.words) ? t.words : String(t.words).split(/\s+/)).filter(Boolean)]));
  for (const p of [...bank.daily, ...bank.extra]) p.near = nearWords(p, pools.get(p.theme) ?? []);
  return bank;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
  const bankPath = path.join(DATA, 'wordsearch-puzzles.json');
  const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
  const { themes } = JSON.parse(fs.readFileSync(path.join(DATA, 'wordsearch-themes.json'), 'utf8'));
  addNear(bank, themes);
  fs.writeFileSync(bankPath, JSON.stringify(bank) + '\n');
  const all = [...bank.daily, ...bank.extra];
  console.log(`near: ${all.filter((p) => p.near.length).length}/${all.length} puzzles, ${all.reduce((n, p) => n + p.near.length, 0)} words`);
  console.log('ws0008:', bank.daily.find((p) => p.id === 'ws0008')?.near.join(' '));
}
