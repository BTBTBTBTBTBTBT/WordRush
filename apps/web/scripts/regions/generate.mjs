// Region-placement logic puzzle, sample generator (Phase 0). Generic id
// `regions` / `REGIONS`; display name Starsweep (founder, 2026-09-21).
// Rules: an N×N board split into N colored regions. Place exactly one marker
// in every row, every column and every region; no two markers may touch, not
// even diagonally. Fully generated, zero content review:
//   1. seeded marker layout (one per row/column, no touching),
//   2. regions grown outward from each marker in seeded order,
//   3. a solver counts solutions; boards with more than one are repaired by
//      moving single border cells between regions (connectivity preserved)
//      until exactly one solution remains, else the seed is re-rolled.
// Deterministic: same seed → same board (parity fixtures pin this at build).
import { rngFor, shuffle, below, writeSample } from '../more-games/lib.mjs';

const N4 = (n, i) => { const r = (i / n) | 0, c = i % n, o = []; if (r) o.push(i - n); if (r < n - 1) o.push(i + n); if (c) o.push(i - 1); if (c < n - 1) o.push(i + 1); return o; };

function layout(n, rng) { // one marker per row, distinct columns, adjacent rows' columns differ by ≥ 2
  const cols = []; const go = (r) => { if (r === n) return true; for (const c of shuffle([...Array(n).keys()], rng)) { if (cols.includes(c) || (r && Math.abs(cols[r - 1] - c) < 2)) continue; cols.push(c); if (go(r + 1)) return true; cols.pop(); } return false; };
  return go(0) ? cols : null;
}
function grow(n, cols, rng) {
  const reg = Array(n * n).fill(-1); cols.forEach((c, r) => { reg[r * n + c] = r; });
  const weight = cols.map(() => 1 + below(rng, 4)); // uneven appetites → varied region sizes
  for (let left = n * n - n; left > 0;) { const k = below(rng, n); if (below(rng, 4) >= weight[k]) continue;
    const edge = []; reg.forEach((v, i) => { if (v === k) for (const j of N4(n, i)) if (reg[j] < 0) edge.push(j); }); if (!edge.length) continue;
    reg[edge[below(rng, edge.length)]] = k; left--; }
  return reg;
}
function solutions(n, reg, limit = 2, keep = null) {
  const usedC = Array(n).fill(false), usedR = Array(n).fill(false), cur = []; let count = 0;
  const go = (r) => { if (r === n) { count++; if (keep) keep.push(cur.slice()); return; } for (let c = 0; c < n && count < limit; c++) { const g = reg[r * n + c]; if (usedC[c] || usedR[g] || (r && Math.abs(cur[r - 1] - c) < 2)) continue; usedC[c] = usedR[g] = true; cur.push(c); go(r + 1); cur.pop(); usedC[c] = usedR[g] = false; } };
  go(0); return count;
}
function connected(n, reg, k, without) { const cells = []; reg.forEach((v, i) => { if (v === k && i !== without) cells.push(i); }); if (!cells.length) return false; const seen = new Set([cells[0]]), q = [cells[0]]; while (q.length) for (const j of N4(n, q.pop())) if (reg[j] === k && j !== without && !seen.has(j)) { seen.add(j); q.push(j); } return seen.size === cells.length; }

function make(seed, n) {
  for (let k = 0; k < 400; k++) { const rng = rngFor(`${seed}-regions-v1${k ? `-r${k}` : ''}`), cols = layout(n, rng); if (!cols) continue; const reg = grow(n, cols, rng);
    for (let step = 0; step < 60 && solutions(n, reg) > 1; step++) { // repair: find a rival solution, hand one of its cells to a neighbouring region so it breaks
      const all = []; solutions(n, reg, 2, all); const rival = all.find((s) => s.some((c, r) => c !== cols[r])); if (!rival) break;
      const moves = []; rival.forEach((c, r) => { const i = r * n + c; if (c === cols[r]) return; for (const j of N4(n, i)) if (reg[j] !== reg[i] && connected(n, reg, reg[i], i)) moves.push([i, reg[j]]); }); if (!moves.length) break;
      const [i, to] = moves[below(rng, moves.length)]; reg[i] = to; }
    const sizes = Array(n).fill(0); reg.forEach((v) => sizes[v]++);
    if (solutions(n, reg) !== 1 || sizes.filter((s) => s <= 2).length > 1 || Math.max(...sizes) > n * 2 || sizes.some((s, g) => !connected(n, reg, g, -1))) continue;
    const order = [...new Set(reg)]; // relabel regions in reading order so colors are assigned predictably
    return { seed, n, rerolls: k, regions: reg.map((v) => order.indexOf(v)).join(''), solution: cols.join(''), sizes: order.map((g) => sizes[g]) };
  }
  throw new Error(`no board for ${seed}`);
}

const plan = [['daily-2026-10-01-REGIONS', 7], ['daily-2026-10-02-REGIONS', 7], ['daily-2026-10-03-REGIONS', 8], ['daily-2026-10-04-REGIONS', 8], ['daily-2026-10-05-REGIONS', 8], ['unlimited-REGIONS-1-hard', 9]];
const puzzles = plan.map(([s, n]) => make(s, n));
if (JSON.stringify(plan.map(([s, n]) => make(s, n))) !== JSON.stringify(puzzles)) throw new Error('not deterministic');
for (const p of puzzles) console.log(`${p.n}×${p.n}`, 'one solution · region sizes', p.sizes.join(','), `· rerolls ${p.rerolls}`);
console.log('wrote', writeSample('regions.json', { puzzles }));
