// Letter Ladder bank builder (More Games §15) — fully generated, no content
// review. Grows the Phase 0 generator (generate.mjs) into the SHIPPED bank:
//
//   apps/web/data/ladder-puzzles.json   { version, epoch, daily[], extra[] }
//
// `daily[i]` is the puzzle for epoch + i days (packages/core bank.ts — never
// modulo while entries remain), with par set by that day's weekday: Mon/Tue 4,
// Wed/Thu 5, Fri/Sat 6, Sun 7. `extra` feeds Unlimited (cycled 4→7) so an
// Unlimited game can never spoil a future daily. Endpoints are common 5-letter
// ANSWER words; a pair qualifies when its shortest path is 4–7 using only
// answer words with ≥ 2 distinct shortest routes, AND the full guess
// dictionary offers no shorter route (par can't be beaten with an obscure
// word). Every path word must be a legal guess. Only ~470 answer words ever
// qualify as endpoints, so a word may recur (always with a new partner) as
// the pools thin out — two uses first, then up to six. Deterministic — re-running with
// the same lists reproduces the file byte for byte; APPEND-ONLY once shipped.
//
//   node apps/web/scripts/ladder/build-bank.mjs [--daily=400] [--extra=300]
import fs from 'node:fs';
import path from 'node:path';
import { DATA, upperList, neverAnswer, rngFor, shuffle } from '../more-games/lib.mjs';

const arg = (k, d) => Number((process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d);
const DAILY_COUNT = arg('daily', 400);
const EXTRA_COUNT = arg("extra", 200);
const EPOCH = '2026-09-23';

const allowedRaw = upperList('allowed.json').filter((w) => w.length === 5);
const allowed = new Set(allowedRaw);
const never = neverAnswer();
const common = upperList('solutions.json').filter((w) => !never.has(w) && allowed.has(w));
const dropped = upperList('solutions.json').filter((w) => !allowed.has(w));
if (dropped.length) console.log(`note: ${dropped.length} answer words are not legal guesses and were skipped as endpoints`);

function graph(words) {
  const buckets = new Map();
  for (const w of words) for (let i = 0; i < 5; i++) {
    const k = w.slice(0, i) + '_' + w.slice(i + 1);
    (buckets.get(k) || buckets.set(k, []).get(k)).push(w);
  }
  const adj = new Map(words.map((w) => [w, []]));
  for (const group of buckets.values()) for (const a of group) for (const b of group) if (a !== b) adj.get(a).push(b);
  for (const list of adj.values()) list.sort();
  return adj;
}
const gCommon = graph(common), gAll = graph([...allowed]);

function bfs(adj, src) {
  const dist = new Map([[src, 0]]), ways = new Map([[src, 1]]); let frontier = [src];
  while (frontier.length) {
    const next = [];
    for (const u of frontier) for (const v of adj.get(u) || []) {
      if (!dist.has(v)) { dist.set(v, dist.get(u) + 1); ways.set(v, 0); next.push(v); }
      if (dist.get(v) === dist.get(u) + 1) ways.set(v, ways.get(v) + ways.get(u));
    }
    frontier = next;
  }
  return { dist, ways };
}
/** One shortest path through answer words; alphabetical tie-break (deterministic). */
function onePath(adj, src, dst) {
  const { dist } = bfs(adj, dst); const path = [src]; let cur = src;
  while (cur !== dst) { cur = adj.get(cur).filter((v) => dist.get(v) === dist.get(cur) - 1).sort()[0]; path.push(cur); }
  return path;
}

const pairs = [];
for (const s of common) {
  const c = bfs(gCommon, s), a = bfs(gAll, s);
  for (const e of common) {
    if (e <= s) continue;
    const d = c.dist.get(e);
    if (d >= 4 && d <= 7 && c.ways.get(e) >= 2 && a.dist.get(e) === d) pairs.push({ start: s, end: e, par: d });
  }
}
const byPar = {}; for (const p of pairs) (byPar[p.par] ||= []).push(p);
console.log(`qualifying pairs: ${pairs.length}  ` + Object.entries(byPar).map(([k, v]) => `par ${k}: ${v.length}`).join(', '));

const rng = rngFor('ladder-bank-v1');
const pools = Object.fromEntries(Object.entries(byPar).map(([k, v]) => [k, shuffle(v, rng)]));
const used = new Map();
let serial = 0;
function take(par) {
  // The requested par first, then the nearest pars; endpoints under a two-use
  // cap first, loosening to three and four only when the pools run dry (the
  // qualifying pairs cluster on hub words, so a hard cap of two exhausts the
  // par-4 pool before 400 dailies).
  for (const cap of [2, 3, 4, 5, 6]) {
    for (const p of [par, par - 1, par + 1, par - 2, par + 2, par - 3, par + 3]) {
      const pool = pools[p]; if (!pool) continue;
      const idx = pool.findIndex((q) => (used.get(q.start) || 0) < cap && (used.get(q.end) || 0) < cap);
      if (idx < 0) continue;
      const [q] = pool.splice(idx, 1);
      const flip = rng() % 2 === 0; const start = flip ? q.end : q.start, end = flip ? q.start : q.end;
      for (const w of [start, end]) used.set(w, (used.get(w) || 0) + 1);
      serial++;
      return { id: `ld${String(serial).padStart(4, '0')}`, start, end, par: q.par, path: onePath(gCommon, start, end) };
    }
  }
  throw new Error(`bank exhausted at par ${par} after ${serial} puzzles; distinct endpoints in qualifying pairs: ${new Set(pairs.flatMap((q) => [q.start, q.end])).size}`);
}

// Weekday par: Mon/Tue 4, Wed/Thu 5, Fri/Sat 6, Sun 7 (UTC calendar from the epoch).
const PAR_BY_DOW = { 1: 4, 2: 4, 3: 5, 4: 5, 5: 6, 6: 6, 0: 7 };
const epochMs = Date.parse(`${EPOCH}T00:00:00Z`);
const daily = [];
for (let i = 0; i < DAILY_COUNT; i++) daily.push(take(PAR_BY_DOW[new Date(epochMs + i * 86400000).getUTCDay()]));
const extra = [];
for (let i = 0; i < EXTRA_COUNT; i++) extra.push(take(4 + (i % 4)));

const bank = { version: 1, epoch: EPOCH, daily, extra };
const out = path.join(DATA, 'ladder-puzzles.json');
fs.writeFileSync(out, JSON.stringify(bank) + '\n');
const tally = (list) => Object.entries(list.reduce((m, p) => ((m[p.par] = (m[p.par] || 0) + 1), m), {})).map(([k, v]) => `par ${k}: ${v}`).join(', ');
console.log(`daily ${daily.length} (${tally(daily)})`);
console.log(`extra ${extra.length} (${tally(extra)})`);
console.log('wrote', out, `${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
console.log('first dailies:', daily.slice(0, 5).map((p) => `${p.id} ${p.start}→${p.end} par ${p.par}`).join(' | '));
