// Sudoku sample generator (Phase 0). Same recipe the plan gives the runtime
// engine: a seeded solved grid (base pattern + seeded permutations), then cells
// dug out in seeded order while a solver proves the puzzle still has exactly
// one solution. Difficulty = clue target + a "singles only" gate: an Easy must
// be solvable with nothing but naked/hidden singles; a Hard must NOT be.
// Deterministic: same seed → same puzzle, which is what the three-platform
// parity fixtures will pin at build time.
import { rngFor, shuffle, below, writeSample } from '../more-games/lib.mjs';

const TARGET = { easy: 38, medium: 32, hard: 26 };
const boxOf = (r, c) => ((r / 3) | 0) * 3 + ((c / 3) | 0);
const peers = Array.from({ length: 81 }, (_, i) => { const r = (i / 9) | 0, c = i % 9, out = [];
  for (let j = 0; j < 81; j++) { const r2 = (j / 9) | 0, c2 = j % 9; if (j !== i && (r2 === r || c2 === c || boxOf(r2, c2) === boxOf(r, c))) out.push(j); } return out; });
const units = [];
for (let k = 0; k < 9; k++) { const row = [], col = [], box = []; for (let j = 0; j < 81; j++) { const r = (j / 9) | 0, c = j % 9; if (r === k) row.push(j); if (c === k) col.push(j); if (boxOf(r, c) === k) box.push(j); } units.push(row, col, box); }

function solvedGrid(rng) {
  const lines = () => shuffle([0, 1, 2], rng).flatMap((g) => shuffle([0, 1, 2], rng).map((x) => g * 3 + x));
  const rows = lines(), cols = lines(), digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng), flip = below(rng, 2) === 1;
  const g = Array(81);
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) { const R = rows[r], C = cols[c]; g[flip ? c * 9 + r : r * 9 + c] = digits[(3 * (R % 3) + ((R / 3) | 0) + C) % 9]; }
  return g;
}
const cand = (g, i) => { let m = 0x3fe; for (const p of peers[i]) m &= ~(1 << g[p]); return m; };
const bits = (m) => { let n = 0; while (m) { n += m & 1; m >>= 1; } return n; };
function countSolutions(g, limit = 2) { // bitmask candidates, most-constrained cell first
  let best = -1, bm = 0, bn = 10;
  for (let i = 0; i < 81; i++) if (!g[i]) { const m = cand(g, i), n = bits(m); if (n === 0) return 0; if (n < bn) { bn = n; bm = m; best = i; if (n === 1) break; } }
  if (best < 0) return 1;
  let total = 0;
  for (let d = 1; d <= 9 && total < limit; d++) if (bm & (1 << d)) { g[best] = d; total += countSolutions(g, limit - total); g[best] = 0; }
  return total;
}
function singlesOnly(puz) {
  const g = puz.slice();
  for (let moved = true; moved;) { moved = false;
    for (let i = 0; i < 81; i++) if (!g[i]) { const m = cand(g, i); if (bits(m) === 1) { g[i] = 31 - Math.clz32(m); moved = true; } }
    for (const u of units) for (let d = 1; d <= 9; d++) { if (u.some((i) => g[i] === d)) continue; const spots = u.filter((i) => !g[i] && (cand(g, i) & (1 << d))); if (spots.length === 1) { g[spots[0]] = d; moved = true; } } }
  return g.every(Boolean);
}

function make(seed, difficulty) {
  for (let k = 0; k < 60; k++) {
    const rng = rngFor(`${seed}-sudoku-v1${k ? `-r${k}` : ''}`), solution = solvedGrid(rng);
    if (units.some((u) => new Set(u.map((i) => solution[i])).size !== 9)) throw new Error('bad solved grid');
    const puz = solution.slice(); let clues = 81;
    for (const i of shuffle([...Array(81).keys()], rng)) { if (clues <= TARGET[difficulty]) break; const keep = puz[i]; puz[i] = 0; if (countSolutions(puz.slice()) === 1) clues--; else puz[i] = keep; }
    const easy = singlesOnly(puz);
    if (clues > TARGET[difficulty] + 2) continue;
    if (difficulty === 'easy' && !easy) continue;
    if (difficulty === 'hard' && easy) continue;
    return { seed, difficulty, rerolls: k, clues, singlesOnly: easy, givens: puz.join(''), solution: solution.join('') };
  }
  throw new Error(`no ${difficulty} puzzle for ${seed}`);
}

const plan = [['daily-2026-10-01-SUDOKU', 'medium'], ['daily-2026-10-02-SUDOKU', 'medium'], ['daily-2026-10-03-SUDOKU', 'medium'], ['daily-2026-10-04-SUDOKU', 'medium'], ['unlimited-SUDOKU-1-easy', 'easy'], ['unlimited-SUDOKU-2-easy', 'easy'], ['unlimited-SUDOKU-1-hard', 'hard'], ['unlimited-SUDOKU-2-hard', 'hard']];
const puzzles = plan.map(([s, d]) => make(s, d));
if (JSON.stringify(plan.map(([s, d]) => make(s, d))) !== JSON.stringify(puzzles)) throw new Error('not deterministic');
for (const p of puzzles) console.log(p.difficulty.padEnd(6), p.clues, 'clues ·', p.singlesOnly ? 'singles only' : 'needs more than singles', `· rerolls ${p.rerolls}`);
console.log('wrote', writeSample('sudoku.json', { puzzles }));
