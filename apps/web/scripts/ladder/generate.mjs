// Letter Ladder (word ladder) bank generator — fully generated, no content review.
// Endpoints are common 5-letter ANSWER words; every step may be any guessable
// word. A pair qualifies when its shortest path is 4–7, there are >= 2 distinct
// shortest paths using only answer words (so it never needs an obscure step),
// and the full guess dictionary offers no shorter route (par can't be beaten
// with an obscure word).   node scripts/ladder/generate.mjs [--count N]
import { upperList, neverAnswer, rngFor, shuffle, writeSample } from '../more-games/lib.mjs';

const COUNT = Number((process.argv.find((a) => a.startsWith('--count=')) || '').split('=')[1] || 14);
const allowed = upperList('allowed.json');
const never = neverAnswer();
const common = upperList('solutions.json').filter((w) => !never.has(w));

function graph(words) {
  const buckets = new Map();
  for (const w of words) for (let i = 0; i < 5; i++) {
    const k = w.slice(0, i) + '_' + w.slice(i + 1);
    (buckets.get(k) || buckets.set(k, []).get(k)).push(w);
  }
  const adj = new Map(words.map((w) => [w, []]));
  for (const group of buckets.values()) for (const a of group) for (const b of group) if (a !== b) adj.get(a).push(b);
  return adj;
}
const gCommon = graph(common), gAll = graph([...new Set([...allowed, ...common])]);

/** BFS returning distance + number of shortest paths from `src`. */
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
function onePath(adj, src, dst) {           // deterministic: alphabetical tie-break
  const { dist } = bfs(adj, dst); const path = [src]; let cur = src;
  while (cur !== dst) { cur = [...adj.get(cur)].filter((v) => dist.get(v) === dist.get(cur) - 1).sort()[0]; path.push(cur); }
  return path;
}

const pairs = [];
for (const s of common) {
  const c = bfs(gCommon, s), a = bfs(gAll, s);
  for (const e of common) {
    if (e <= s) continue;
    const d = c.dist.get(e);
    if (d >= 4 && d <= 7 && c.ways.get(e) >= 2 && a.dist.get(e) === d) pairs.push({ start: s, end: e, par: d, routes: c.ways.get(e) });
  }
}
const byPar = {}; for (const p of pairs) (byPar[p.par] ||= []).push(p);
console.log(`qualifying pairs: ${pairs.length}  ` + Object.entries(byPar).map(([k, v]) => `par ${k}: ${v.length}`).join(', '));

// Weekday ramp Mon→Sun = par 4,4,5,5,6,6,7; each word an endpoint at most twice.
const ramp = [4, 4, 5, 5, 6, 6, 7], used = new Map(), rng = rngFor('ladder-bank-v1'), out = [];
const pools = Object.fromEntries(Object.entries(byPar).map(([k, v]) => [k, shuffle(v, rng)]));
for (let i = 0; out.length < COUNT; i++) {
  const par = ramp[i % 7], pool = pools[par];
  const idx = pool.findIndex((p) => (used.get(p.start) || 0) < 2 && (used.get(p.end) || 0) < 2);
  if (idx < 0) break;
  const [p] = pool.splice(idx, 1);
  const flip = rng() % 2 === 0; const start = flip ? p.end : p.start, end = flip ? p.start : p.end;
  for (const w of [start, end]) used.set(w, (used.get(w) || 0) + 1);
  out.push({ id: `ld${String(out.length + 1).padStart(4, '0')}`, start, end, par, routes: p.routes, path: onePath(gCommon, start, end) });
}
const file = writeSample('ladder.json', { generatedBy: 'apps/web/scripts/ladder/generate.mjs', totalQualifying: pairs.length, puzzles: out });
for (const p of out) console.log(`  ${p.id} par ${p.par} (${p.routes} routes)  ${p.path.join(' → ')}`);
console.log('wrote', file);
