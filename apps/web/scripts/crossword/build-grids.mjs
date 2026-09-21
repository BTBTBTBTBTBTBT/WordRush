// Crosswordocious (themed fill-in sayings crossword) — screens phrase/answer pairs
// and constructs sparse criss-cross grids. Every entry crosses another, no two
// entries touch side by side (no accidental words), the grid is connected by
// construction, bounding box <= 10 wide x 11 tall, >= 60% of entries on-theme,
// no answer used twice in a puzzle.   node scripts/crossword/build-grids.mjs
import path from 'node:path';
import { WEB, REPO, readJSON, rngFor, below, shuffle, writeSample, wordset } from '../more-games/lib.mjs';

const MAXW = 10, MAXH = 11, MIN_ENTRIES = 10, MAX_ENTRIES = 13, SIZE = 40, MID = 20;
const bank = readJSON(path.join(WEB, 'scripts', 'crossword', 'phrases.sample.json'));
const lex = readJSON(path.join(REPO, 'scripts', 'data', 'lexicon-all.json'));
const common = new Set(lex.common), hard = new Set([...wordset('profanity-exact.generated.txt'), ...wordset('offensive-blocklist.txt')]);

// ---- screen -------------------------------------------------------------
const pairs = [], rejected = [];
for (const [theme, t] of Object.entries(bank)) for (const [clue, raw] of t.pairs) {
  const answer = raw.replace(/\d+$/, ''), why = [];
  if (!/^[A-Z]{3,9}$/.test(answer)) why.push('answer must be 3–9 letters');
  if (!common.has(answer)) why.push('answer not in the common lexicon tier');
  if (hard.has(answer)) why.push('blocked term');
  if ((clue.match(/____/g) || []).length !== 1) why.push('clue needs exactly one blank');
  if (new RegExp(`\\b${answer}\\b`, 'i').test(clue)) why.push('answer appears in its own clue');
  (why.length ? rejected : pairs).push({ theme, clue, answer, why });
}
console.log(`pairs: ${pairs.length} accepted, ${rejected.length} rejected`);
for (const r of rejected) console.log(`  REJECT ${r.answer.padEnd(9)} "${r.clue}" — ${r.why.join('; ')}`);

// ---- construct ----------------------------------------------------------
function tryBuild(theme, seedLabel) {
  const rng = rngFor(seedLabel);
  const themed = shuffle(pairs.filter((p) => p.theme === theme), rng), wild = shuffle(pairs.filter((p) => p.theme !== theme), rng);
  const grid = new Map(), key = (r, c) => r * SIZE + c, at = (r, c) => grid.get(key(r, c));
  const placed = [], used = new Set();
  const bbox = (extra) => { let r0 = 1e9, r1 = -1, c0 = 1e9, c1 = -1; for (const e of [...placed, ...(extra ? [extra] : [])]) { const er = e.r + (e.dir === 'D' ? e.answer.length - 1 : 0), ec = e.c + (e.dir === 'A' ? e.answer.length - 1 : 0); r0 = Math.min(r0, e.r); c0 = Math.min(c0, e.c); r1 = Math.max(r1, er); c1 = Math.max(c1, ec); } return { h: r1 - r0 + 1, w: c1 - c0 + 1, r0, c0 }; };
  function fits(word, r, c, dir) {
    const dr = dir === 'D' ? 1 : 0, dc = dir === 'A' ? 1 : 0; let crossings = 0;
    if (at(r - dr, c - dc) || at(r + dr * word.length, c + dc * word.length)) return -1;
    for (let k = 0; k < word.length; k++) {
      const rr = r + dr * k, cc = c + dc * k, ch = at(rr, cc);
      if (ch) { if (ch.letter !== word[k] || ch.dirs.has(dir)) return -1; crossings++; }
      else if (at(rr + dc, cc + dr) || at(rr - dc, cc - dr)) return -1;     // side-by-side touch
    }
    return crossings;
  }
  function put(p, r, c, dir) {
    const dr = dir === 'D' ? 1 : 0, dc = dir === 'A' ? 1 : 0;
    for (let k = 0; k < p.answer.length; k++) { const kk = key(r + dr * k, c + dc * k), cell = grid.get(kk) || { letter: p.answer[k], dirs: new Set() }; cell.dirs.add(dir); grid.set(kk, cell); }
    placed.push({ ...p, r, c, dir }); used.add(p.answer);
  }
  const first = themed.slice().sort((a, b) => b.answer.length - a.answer.length)[0];
  put(first, MID, MID - (first.answer.length >> 1), 'A');
  let crossTotal = 0;
  const queue = [...themed.filter((p) => p !== first), ...wild];
  for (let pass = 0; pass < 3 && placed.length < MAX_ENTRIES; pass++) for (const p of queue) {
    if (placed.length >= MAX_ENTRIES || used.has(p.answer)) continue;
    // No answer may be readable in another clue of the same puzzle (RAIN vs "It never rains…").
    const stem = (w) => w.toLowerCase().replace(/(s|es|ed|ing)$/, '');
    if (placed.some((e) => e.clue.toLowerCase().includes(stem(p.answer)) || p.clue.toLowerCase().includes(stem(e.answer)))) continue;
    const themedCount = placed.filter((e) => e.theme === theme).length;
    if (p.theme !== theme && (themedCount / (placed.length + 1)) < 0.6) continue;
    let best = null;
    for (const e of placed) for (let i = 0; i < e.answer.length; i++) for (let k = 0; k < p.answer.length; k++) {
      if (e.answer[i] !== p.answer[k]) continue;
      const dir = e.dir === 'A' ? 'D' : 'A';
      const cr = e.r + (e.dir === 'D' ? i : 0), cc = e.c + (e.dir === 'A' ? i : 0);
      const r = cr - (dir === 'D' ? k : 0), c = cc - (dir === 'A' ? k : 0);
      const x = fits(p.answer, r, c, dir); if (x < 1) continue;
      const bb = bbox({ answer: p.answer, r, c, dir }); if (bb.w > MAXW || bb.h > MAXH) continue;
      const score = x * 100 - bb.w * bb.h + below(rng, 7);
      if (!best || score > best.score) best = { r, c, dir, x, score };
    }
    if (best) { put(p, best.r, best.c, best.dir); crossTotal += best.x; }
  }
  const bb = bbox();
  const entries = placed.map((e) => ({ ...e, r: e.r - bb.r0, c: e.c - bb.c0 }));
  return { theme, w: bb.w, h: bb.h, entries, crossings: crossTotal, themedShare: entries.filter((e) => e.theme === theme).length / entries.length };
}
function number(p) {
  const starts = new Map(); for (const e of p.entries) { const k = e.r * 100 + e.c; (starts.get(k) || starts.set(k, []).get(k)).push(e); }
  let n = 0; for (const k of [...starts.keys()].sort((a, b) => a - b)) { n++; for (const e of starts.get(k)) e.n = n; }
  p.entries.sort((a, b) => a.n - b.n || a.dir.localeCompare(b.dir));
}
const out = [];
for (const theme of Object.keys(bank)) for (const serial of [1, 2]) {
  let best = null;
  for (let t = 0; t < 300; t++) {
    const p = tryBuild(theme, `cw-${theme}-${serial}-${t}-v1`);
    if (p.entries.length < MIN_ENTRIES || p.themedShare < 0.6 || p.crossings < p.entries.length) continue;
    const q = p.entries.length * 10 + p.crossings * 3 - p.w * p.h / 10;
    if (!best || q > best.q) best = { ...p, q };
  }
  if (!best) { console.log(`  ${theme} #${serial}: no grid met the rules`); continue; }
  number(best);
  out.push({ id: `cw-${theme}-${serial}`, theme, title: bank[theme].title, w: best.w, h: best.h, crossings: best.crossings,
    entries: best.entries.map(({ n, dir, r, c, answer, clue, theme: th }) => ({ n, dir, r, c, answer, clue, onTheme: th === theme })) });
}
const p = out[0];
if (p) { const g = Array.from({ length: p.h }, () => Array(p.w).fill('·')); for (const e of p.entries) for (let k = 0; k < e.answer.length; k++) g[e.r + (e.dir === 'D' ? k : 0)][e.c + (e.dir === 'A' ? k : 0)] = e.answer[k];
  console.log(`\n${p.title} — ${p.entries.length} entries, ${p.crossings} crossings, ${p.w}×${p.h}`); for (const row of g) console.log('  ' + row.join(' ')); for (const e of p.entries) console.log(`  ${e.n}${e.dir} ${e.clue}`); }
console.log(`\nbuilt ${out.length} grids: ` + out.map((x) => `${x.id}(${x.entries.length}e/${x.crossings}x ${x.w}×${x.h})`).join(' '));
console.log('wrote', writeSample('crossword.json', { generatedBy: 'apps/web/scripts/crossword/build-grids.mjs', accepted: pairs.length, rejected, puzzles: out }));
