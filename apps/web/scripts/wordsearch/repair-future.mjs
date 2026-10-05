// Spyglass content repair for FUTURE puzzles only (2026-10-05, tester Johnny on #13 "Rain Gear":
// PUDDLE/SOGGY/WATERPROOF are not gear, WELLIES is British, TOGGLE needs explaining).
//
// The bank is APPEND-ONLY once shipped, so this never rebuilds it. It walks the dailies from
// --from (default: CONTENT_RELEASE_DATE, scripts/content-release-date.mjs) plus the whole Unlimited pool and, for each
// puzzle whose theme pool (apps/web/data/wordsearch-themes.json) no longer carries one of its
// words, swaps only those words for fresh pool members and re-lays the grid with the builder's
// own layout rules (four forward directions, each word exactly once, no blocked term in any
// line). Titles follow the themes file (retitled themes: "Small Town", "Railroad", …). Ids are
// kept, past dailies are untouched, and `near` is recomputed for every puzzle this touches.
// Variety rules still hold: no word within 45 days of itself across ALL dailies, no word inside
// another word in the same ten.
//
//   node apps/web/scripts/wordsearch/repair-future.mjs [--from=YYYY-MM-DD] [--dry]
//
// Bundled bank: after running, copy apps/web/data/wordsearch-puzzles.json to the iOS Resources
// + Tests/Fixtures and Android resources (word-list-sync.test.ts pins all four copies).
import fs from 'node:fs';
import path from 'node:path';
import { DATA, readJSON, rngFor, below, shuffle, neverAnswer, wordset } from '../more-games/lib.mjs';
import { nearWords } from './add-near.mjs';
import { CONTENT_RELEASE_DATE } from '../content-release-date.mjs';

const argv = process.argv.slice(2);
const FROM = (argv.find((a) => a.startsWith('--from=')) || `--from=${CONTENT_RELEASE_DATE}`).split('=')[1];
const DRY = argv.includes('--dry');
const N = 10, WORDS = 10, WORD_GAP = 45;
const DIRS = { E: [0, 1], S: [1, 0], SE: [1, 1], NE: [-1, 1] };
const ALL8 = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
const FREQ = 'EEEEEEEEEEEETTTTTTTTTAAAAAAAAOOOOOOOIIIIIIINNNNNNNSSSSSSRRRRRRHHHHHHLLLLDDDDCCCUUUMMMFFPPGGWWYYBBVK';
const blockedTerms = [...wordset('profanity-exact.generated.txt'), ...wordset('offensive-blocklist.txt')].filter((t) => t.length >= 3);
const never = neverAnswer();

const bankPath = path.join(DATA, 'wordsearch-puzzles.json');
const bank = readJSON(bankPath);
const { themes } = readJSON(path.join(DATA, 'wordsearch-themes.json'));
const byKey = new Map(themes.map((t) => [t.key, {
  ...t,
  rawPool: t.words.trim().split(/\s+/),
  pool: [...new Set(t.words.trim().split(/\s+/))].filter((w) => /^[A-Z]{4,10}$/.test(w) && !never.has(w)),
}]));
const fromIdx = Math.round((Date.parse(`${FROM}T00:00:00Z`) - Date.parse(`${bank.epoch}T00:00:00Z`)) / 86400000);
if (!(fromIdx >= 1)) throw new Error(`--from=${FROM} is not after the epoch ${bank.epoch}`);

function lines(grid) {
  const out = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of ALL8) {
    let s = ''; for (let rr = r, cc = c; rr >= 0 && rr < N && cc >= 0 && cc < N; rr += dr, cc += dc) s += grid[rr][cc];
    out.push(s);
  }
  return out;
}
const occurrences = (ls, w) => ls.filter((l) => l.startsWith(w)).length;

/** The builder's layout (build-bank.mjs), verbatim rules: longest first, prefer crossings. */
function layout(pick, rng) {
  for (let attempt = 0; attempt < 150; attempt++) {
    const grid = Array.from({ length: N }, () => Array(N).fill(''));
    const placed = []; let ok = true;
    for (const w of pick) {
      const spots = [];
      for (const [d, [dr, dc]] of Object.entries(DIRS)) for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const er = r + dr * (w.length - 1), ec = c + dc * (w.length - 1);
        if (er < 0 || er >= N || ec < 0 || ec >= N) continue;
        let cross = 0, fits = true;
        for (let k = 0; k < w.length; k++) { const ch = grid[r + dr * k][c + dc * k]; if (ch === w[k]) cross++; else if (ch) { fits = false; break; } }
        if (fits) spots.push({ r, c, d, cross });
      }
      if (!spots.length) { ok = false; break; }
      const best = Math.max(...spots.map((s) => s.cross));
      const pool2 = spots.filter((s) => s.cross === best || below(rng, 4) === 0);
      const s = pool2[below(rng, pool2.length)];
      const [dr, dc] = DIRS[s.d]; for (let k = 0; k < w.length; k++) grid[s.r + dr * k][s.c + dc * k] = w[k];
      placed.push({ w, r: s.r, c: s.c, d: s.d });
    }
    if (!ok) continue;
    for (let fill = 0; fill < 60; fill++) {
      const g = grid.map((row) => row.map((ch) => ch || FREQ[below(rng, FREQ.length)]));
      const ls = lines(g);
      if (pick.every((w) => occurrences(ls, w) === 1) && !blockedTerms.some((t) => ls.some((l) => l.includes(t))))
        return { grid: g.map((r) => r.join('')).join(''), words: placed };
    }
  }
  return null;
}

/** Days (daily indexes) each word appears on, for the 45-day gap check. */
const dayOf = new Map();
bank.daily.forEach((p, i) => p.words.forEach((w) => { if (!dayOf.has(w.w)) dayOf.set(w.w, []); dayOf.get(w.w).push(i); }));
const gapOk = (w, i) => (dayOf.get(w) ?? []).every((j) => j === i || Math.abs(j - i) > WORD_GAP);

const report = [];
function repair(p, i /* daily index, or null for Unlimited */) {
  const t = byKey.get(p.theme);
  if (!t) throw new Error(`${p.id}: theme ${p.theme} missing`);
  const pool = new Set(t.pool);
  const off = p.words.map((w) => w.w).filter((w) => !pool.has(w));
  const retitle = p.title !== t.title;
  if (!off.length) {
    if (retitle) { report.push({ id: p.id, day: i, title: [p.title, t.title], swaps: [] }); p.title = t.title; }
    return;
  }
  const keep = p.words.map((w) => w.w).filter((w) => pool.has(w));
  for (let tries = 0; tries < 40; tries++) {
    const rng = rngFor(`ws-fix-${p.id}-${tries}-v1`);
    const pick = keep.slice();
    for (const w of shuffle(t.pool, rng)) {
      if (pick.length === WORDS) break;
      if (pick.includes(w) || pick.some((x) => x.includes(w) || w.includes(x))) continue;
      if (i !== null && !gapOk(w, i)) continue;
      pick.push(w);
    }
    if (pick.length < WORDS) continue;
    pick.sort((a, b) => b.length - a.length);
    const laid = layout(pick, rngFor(`ws-fix-${p.id}-${tries}-layout-v1`));
    if (!laid) continue;
    const added = pick.filter((w) => !keep.includes(w));
    report.push({ id: p.id, day: i, title: retitle ? [p.title, t.title] : null, swaps: off.map((w, k) => `${w}→${added[k]}`) });
    if (i !== null) {
      for (const w of off) dayOf.set(w, (dayOf.get(w) ?? []).filter((j) => j !== i));
      for (const w of added) { if (!dayOf.has(w)) dayOf.set(w, []); dayOf.get(w).push(i); }
    }
    p.title = t.title; p.grid = laid.grid; p.words = laid.words;
    return;
  }
  throw new Error(`${p.id}: could not repair (${off.join(' ')})`);
}

const touched = [];
for (let i = fromIdx; i < bank.daily.length; i++) { repair(bank.daily[i], i); touched.push(bank.daily[i]); }
for (const p of bank.extra) { repair(p, null); touched.push(p); }
for (const p of touched) p.near = nearWords(p, byKey.get(p.theme).rawPool);

const swapped = report.filter((r) => r.swaps.length);
console.log(`from ${FROM} (daily index ${fromIdx}): ${swapped.length} puzzles re-laid, ${report.filter((r) => r.title).length} retitled`);
for (const r of report) console.log(`  ${r.id}${r.day === null ? ' (unlimited)' : ` day ${r.day + 1}`}${r.title ? ` "${r.title[0]}" → "${r.title[1]}"` : ''}${r.swaps.length ? ` ${r.swaps.join(' ')}` : ''}`);
if (!DRY) { fs.writeFileSync(bankPath, JSON.stringify(bank) + '\n'); console.log('wrote', bankPath); }
