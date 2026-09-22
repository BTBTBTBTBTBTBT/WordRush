// Spyglass bank builder (More Games §17). Grows the Phase 0 generator into the
// SHIPPED bank:
//
//   apps/web/data/wordsearch-puzzles.json   { version, epoch, daily[], extra[] }
//
// Every puzzle is a themed 10 × 10 grid with ten words in FOUR forward
// directions (E, S, SE, NE) so nothing reads backwards; the fill is rerolled
// until each list word occurs exactly once in all eight directions and no
// line spells a blocked term. `daily[i]` is the puzzle for epoch + i days
// (packages/core bank.ts). The scheduler enforces the founder's variety rules
// (§17): no theme repeats within 120 days; no two consecutive days from the
// same family; no WORD appears twice within 45 days across ALL themes; a
// returning theme draws a different ten (≤ 4 shared with its last outing).
// `extra` feeds Unlimited from the same themes with fresh word draws.
// Deterministic (seeded) — APPEND-ONLY once shipped.
//
//   node apps/web/scripts/wordsearch/build-bank.mjs [--daily=400] [--extra=150]
import fs from 'node:fs';
import path from 'node:path';
import { DATA, readJSON, rngFor, below, shuffle, neverAnswer, wordset } from '../more-games/lib.mjs';

const arg = (k, d) => Number((process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d);
const DAILY_COUNT = arg('daily', 400);
const EXTRA_COUNT = arg('extra', 150);
const EPOCH = '2026-09-23';
const N = 10, WORDS = 10;
const THEME_GAP = 120, WORD_GAP = 45, MAX_SHARED = 4;
const DIRS = { E: [0, 1], S: [1, 0], SE: [1, 1], NE: [-1, 1] };
const ALL8 = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
const FREQ = 'EEEEEEEEEEEETTTTTTTTTAAAAAAAAOOOOOOOIIIIIIINNNNNNNSSSSSSRRRRRRHHHHHHLLLLDDDDCCCUUUMMMFFPPGGWWYYBBVK';
const blockedTerms = [...wordset('profanity-exact.generated.txt'), ...wordset('offensive-blocklist.txt')].filter((t) => t.length >= 3);
const never = neverAnswer();

const themeFile = readJSON(path.join(DATA, 'wordsearch-themes.json'));
const themes = themeFile.themes.map((t) => ({
  ...t,
  pool: [...new Set(t.words.trim().split(/\s+/))].filter((w) => /^[A-Z]{4,10}$/.test(w) && !never.has(w)),
}));
for (const t of themes) if (t.pool.length < WORDS + 4) throw new Error(`${t.key}: only ${t.pool.length} usable words (need ${WORDS + 4})`);

function lines(grid) {
  const out = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of ALL8) {
    let s = ''; for (let k = 0, rr = r, cc = c; rr >= 0 && rr < N && cc >= 0 && cc < N; k++, rr += dr, cc += dc) s += grid[rr][cc];
    out.push(s);
  }
  return out;
}
const occurrences = (ls, w) => ls.filter((l) => l.startsWith(w)).length;

/** Lay `pick` (longest first) into a fresh grid and fill it; deterministic per rng. */
function layout(pick, rng, label) {
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
  throw new Error(`could not lay out ${label}`);
}

// ── Scheduler ──────────────────────────────────────────────────────────────
const rng = rngFor('wordsearch-bank-v1');
const lastThemeDay = new Map();     // theme key → last daily index
const lastWordDay = new Map();      // word → last daily index it appeared
const lastDraw = new Map();         // theme key → the ten it used last time
let serial = 0;

/** Pick ten words for a theme honouring the word gap and the returning-theme rule. */
function draw(theme, day, strict) {
  const fresh = shuffle(theme.pool, rng).filter((w) => !strict || !lastWordDay.has(w) || day - lastWordDay.get(w) > WORD_GAP);
  const prev = lastDraw.get(theme.key) ?? [];
  const pick = [];
  for (const w of fresh) {
    if (pick.length === WORDS) break;
    const shared = pick.filter((x) => prev.includes(x)).length + (prev.includes(w) ? 1 : 0);
    if (strict && prev.length && shared > MAX_SHARED) continue;
    // A word inside another (ANGLE in TRIANGLE) can never occur exactly once — never pick both.
    if (pick.some((x) => x.includes(w) || w.includes(x))) continue;
    pick.push(w);
  }
  return pick.length === WORDS ? pick.sort((a, b) => b.length - a.length) : null;
}

function schedule(day, prevFamily) {
  // Candidates: theme not used within THEME_GAP days, family differs from yesterday.
  const cands = shuffle(themes, rng).filter((t) => (!lastThemeDay.has(t.key) || day - lastThemeDay.get(t.key) >= THEME_GAP) && t.family !== prevFamily);
  // Prefer the least recently used theme so the rotation stays even.
  cands.sort((a, b) => (lastThemeDay.get(a.key) ?? -1e9) - (lastThemeDay.get(b.key) ?? -1e9));
  for (const t of cands) {
    const pick = draw(t, day, true); if (!pick) continue;
    // A ten that will not lay out (rare) falls through to the next theme.
    try { return { t, pick, laid: layout(pick, rngFor(`ws-${t.key}-${day}-v1`), `${t.key} day ${day}`) }; } catch { continue; }
  }
  throw new Error(`no theme satisfies the variety rules on day ${day}`);
}

const daily = [];
let prevFamily = null;
for (let i = 0; i < DAILY_COUNT; i++) {
  const t0 = Date.now();
  const { t, pick, laid } = schedule(i, prevFamily);
  if (process.env.WS_DEBUG) console.log(`day ${i} ${t.key} ${Date.now() - t0}ms`);
  serial++;
  daily.push({ id: `ws${String(serial).padStart(4, '0')}`, theme: t.key, family: t.family, title: t.title, ...laid });
  lastThemeDay.set(t.key, i); lastDraw.set(t.key, pick); for (const w of pick) lastWordDay.set(w, i);
  prevFamily = t.family;
}

// Unlimited pool: cycle the themes with fresh draws (no calendar rules — the
// engine keeps Unlimited off the daily list by construction).
const extra = [];
for (let i = 0; i < EXTRA_COUNT; i++) {
  let t = themes[(i * 7) % themes.length], pick = null, laid = null;
  for (let k = 0; k < themes.length && !laid; k++) {
    t = themes[(i * 7 + k) % themes.length];
    pick = draw(t, 10_000 + i, false);
    if (!pick) continue;
    try { laid = layout(pick, rngFor(`ws-x-${t.key}-${i}-v1`), `${t.key} extra ${i}`); } catch { laid = null; }
  }
  if (!laid) throw new Error(`extra ${i}: no theme laid out`);
  serial++;
  extra.push({ id: `ws${String(serial).padStart(4, '0')}`, theme: t.key, family: t.family, title: t.title, ...laid });
}

const bank = { version: 1, epoch: EPOCH, daily, extra };
const out = path.join(DATA, 'wordsearch-puzzles.json');
fs.writeFileSync(out, JSON.stringify(bank) + '\n');
const famRuns = daily.reduce((m, p) => ((m[p.family] = (m[p.family] || 0) + 1), m), {});
console.log(`daily ${daily.length}, extra ${extra.length}, themes used ${new Set(daily.map((p) => p.theme)).size}/${themes.length}`);
console.log('families:', Object.entries(famRuns).map(([k, v]) => `${k} ${v}`).join(', '));
console.log('wrote', out, `${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
console.log('first dailies:', daily.slice(0, 4).map((p) => `${p.id} ${p.title} [${p.words.map((w) => w.w).join(' ')}]`).join(' | '));
