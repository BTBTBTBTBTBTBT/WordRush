#!/usr/bin/env node
// Spyglass HARDER generator (Friday queue item 30, founder 10-08: "if the puzzles are this
// easy all the time it won't make finding the answers fun").
//
// Tooling only — nothing here writes to apps/web/data. It regenerates a 10 × 10 grid for a
// theme + ten words with:
//   • all EIGHT directions including backwards (W, N, NW, SW);
//   • a per-puzzle mix rule: ≥ 3 diagonal, ≥ 2 backwards, ≤ 3 plain E/S (tightened by level);
//   • crossings encouraged (placements sharing letters score higher);
//   • long words not always edge-to-edge (at most `maxEdge` placements touch both edges);
//   • camouflage filler drawn from the theme words' own letters (letter-frequency weighted,
//     blended with plain English frequency by level) — NO planted decoys or fake partial words
//     (founder 10-08: with a hidden list they would feel like false finds);
//   • rejection of any grid where the filler accidentally spells a theme word (the ten, the
//     theme's whole pool, or their +S/+ES plurals) or a ≥ 4-letter chunk of one of the TEN in
//     any of the eight directions outside the word's own cells, or a blocked term;
//   • a weekday ramp knob: level 1 (Mon, gentler) … 6 (Sat/Sun, hardest).
//
// Difficulty score (0–100): direction mix + crossings + edge avoidance + camouflage; see
// `difficultyScore`. The matching engine (packages/core/src/games/wordsearch.ts) already accepts
// a selection forwards or backwards in all eight directions, so grids from here need no engine
// change — only the bank data, its sha and the parity fixtures (out of scope here).
//
//   node scripts/puzzles/spyglass-harder.mjs            # preview the next 14 dailies → docs/audits/puzzles/
//   node scripts/puzzles/spyglass-harder.mjs --from=2026-10-10 --days=14 --out=docs/audits/puzzles
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.join(HERE, '..', '..');
const DATA = path.join(REPO, 'apps', 'web', 'data');

export const N = 10;
export const WORDS = 10;
export const DIRS = {
  E: [0, 1], S: [1, 0], SE: [1, 1], NE: [-1, 1], W: [0, -1], N: [-1, 0], NW: [-1, -1], SW: [1, -1],
};
const DIAGONAL = new Set(['SE', 'NE', 'NW', 'SW']);
const BACKWARDS = new Set(['W', 'N', 'NW', 'SW']);
const PLAIN = new Set(['E', 'S']);
const ENGLISH = 'EEEEEEEEEEEETTTTTTTTTAAAAAAAAOOOOOOOIIIIIIINNNNNNNSSSSSSRRRRRRHHHHHHLLLLDDDDCCCUUUMMMFFPPGGWWYYBBVK';
const CHUNK = 4; // a ≥ 4-letter run is a miss in the engine, so that is the chunk size to keep clean

// ── Deterministic RNG (same family as apps/web/scripts/more-games/lib.mjs) ─────────────────
function simpleHash(str) { let h = 0; for (let i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; } return Math.abs(h); }
function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0); };
}
export const rngFor = (label) => mulberry32(simpleHash(label));
const below = (rng, n) => rng() % n;
function shuffle(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = below(rng, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ── Weekday ramp ───────────────────────────────────────────────────────────────────────────
/** Level 1 (Mon, gentler) … 6 (Sat + Sun, hardest). */
export function levelForDate(day) {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat
  return [6, 1, 2, 3, 4, 5, 6][dow];
}
/** The knobs a level turns. */
export function knobsForLevel(level) {
  const L = Math.min(6, Math.max(1, level));
  return {
    level: L,
    minDiagonal: [3, 3, 4, 4, 5, 5][L - 1],
    minBackwards: [2, 2, 3, 3, 4, 5][L - 1],
    maxPlain: [3, 3, 2, 2, 1, 1][L - 1],
    /** Placements allowed to touch both edges of their row/column/diagonal. */
    maxEdge: [3, 2, 2, 1, 1, 1][L - 1],
    /** Share of filler drawn from the theme words' letters (rest: plain English frequency). */
    camouflage: [0.55, 0.65, 0.75, 0.85, 0.9, 0.95][L - 1],
    /** Minimum crossings (cells shared by two words) the placement must reach. */
    minCrossings: [2, 2, 3, 3, 4, 4][L - 1],
  };
}

// ── Geometry helpers ───────────────────────────────────────────────────────────────────────
export function cellsOf(p) {
  const [dr, dc] = DIRS[p.d];
  return Array.from({ length: p.w.length }, (_, k) => (p.r + dr * k) * N + (p.c + dc * k));
}
/** Every straight line of cells (as index arrays) in all 8 directions, from every start. */
function allLines() {
  const out = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [d, [dr, dc]] of Object.entries(DIRS)) {
    const cells = [];
    for (let rr = r, cc = c; rr >= 0 && rr < N && cc >= 0 && cc < N; rr += dr, cc += dc) cells.push(rr * N + cc);
    if (cells.length >= CHUNK) out.push({ d, cells });
  }
  return out;
}
const LINES = allLines();
const touchesBothEdges = (p) => {
  const cells = cellsOf(p), a = cells[0], b = cells[cells.length - 1];
  const edge = (i) => { const r = Math.floor(i / N), c = i % N; return r === 0 || r === N - 1 || c === 0 || c === N - 1; };
  return edge(a) && edge(b);
};

// ── Lists ──────────────────────────────────────────────────────────────────────────────────
function wordset(file) {
  const p = path.join(REPO, 'scripts', 'data', file);
  if (!fs.existsSync(p)) return new Set();
  return new Set(fs.readFileSync(p, 'utf8').split('\n').map((l) => l.trim().split(/[\s#,]/)[0].toUpperCase()).filter((l) => /^[A-Z]+$/.test(l)));
}
let blockedCache = null;
function blockedTerms() {
  if (!blockedCache) blockedCache = [...wordset('profanity-exact.generated.txt'), ...wordset('offensive-blocklist.txt')].filter((t) => t.length >= 3);
  return blockedCache;
}

/** Theme pools from apps/web/data/wordsearch-themes.json, keyed by theme key. */
export function themePools() {
  const file = JSON.parse(fs.readFileSync(path.join(DATA, 'wordsearch-themes.json'), 'utf8'));
  const out = {};
  for (const t of file.themes) out[t.key] = [...new Set(t.words.trim().split(/\s+/).map((w) => w.toUpperCase()))];
  return out;
}

// ── Camouflage filler ──────────────────────────────────────────────────────────────────────
/** A letter bag: theme-word letters (frequency weighted) blended with English frequency. */
export function fillerBag(words, camouflage) {
  const theme = words.join('');
  const themeShare = Math.round(100 * camouflage), englishShare = 100 - themeShare;
  let bag = '';
  for (let i = 0; i < themeShare; i++) bag += theme[i % theme.length];
  for (let i = 0; i < englishShare; i++) bag += ENGLISH[(i * 7) % ENGLISH.length];
  return bag;
}

// ── Validation ─────────────────────────────────────────────────────────────────────────────
/**
 * Why a filled grid is rejected, or null when clean:
 *  - a list word occurs more than once (reading any of the 8 directions);
 *  - a theme-pool word or plural (+S/+ES) of any list/pool word sits in the grid off-list;
 *  - a ≥ 4-letter chunk of one of the ten reads anywhere outside that word's own cells;
 *  - a blocked term reads anywhere;
 *  - a placed word is extended by an S (LADLE → LADLES would be a near-find).
 */
export function rejectReason(grid, placed, pool) {
  const words = placed.map((p) => p.w);
  const wordCells = placed.map((p) => new Set(cellsOf(p)));
  const listSet = new Set(words);
  const offList = new Set();
  for (const w of pool) if (!listSet.has(w) && w.length >= CHUNK) offList.add(w);
  for (const w of [...words, ...pool]) { offList.add(w + 'S'); offList.add(w + 'ES'); }
  for (const w of words) offList.delete(w);
  const chunks = new Map(); // chunk string → indices of words it belongs to
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    for (let a = 0; a + CHUNK <= w.length; a++) for (let b = a + CHUNK; b <= w.length; b++) {
      const s = w.slice(a, b);
      if (!chunks.has(s)) chunks.set(s, new Set());
      chunks.get(s).add(i);
    }
  }
  const counts = new Map(words.map((w) => [w, 0]));
  const blocked = blockedTerms();
  for (const { cells } of LINES) {
    const str = cells.map((i) => grid[i]).join('');
    for (const w of words) if (str.startsWith(w)) counts.set(w, counts.get(w) + 1);
    for (const w of offList) if (str.startsWith(w)) return `off-list word ${w} reads in the grid`;
    for (const t of blocked) if (str.includes(t)) return 'blocked term in a line';
    for (let a = 0; a < str.length; a++) for (let b = a + CHUNK; b <= str.length; b++) {
      const s = str.slice(a, b);
      const owners = chunks.get(s);
      if (!owners) continue;
      const span = cells.slice(a, b);
      const legit = [...owners].some((i) => span.every((c) => wordCells[i].has(c)))
        || placed.some((_, i) => span.every((c) => wordCells[i].has(c))); // a chunk of A fully inside B's cells is B's own letters
      if (!legit) return `chunk ${s} of ${words[[...owners][0]]} reads off the word`;
    }
  }
  for (const w of words) if (counts.get(w) !== 1) return `${w} occurs ${counts.get(w)} times`;
  for (const p of placed) {
    const [dr, dc] = DIRS[p.d];
    const er = p.r + dr * p.w.length, ec = p.c + dc * p.w.length;
    if (er >= 0 && er < N && ec >= 0 && ec < N && grid[er * N + ec] === 'S') return `${p.w} extended by S`;
  }
  return null;
}

// ── Difficulty score ───────────────────────────────────────────────────────────────────────
/** Shared cells between distinct words. */
export function crossings(placed) {
  const seen = new Map();
  let n = 0;
  for (const p of placed) for (const c of cellsOf(p)) { if (seen.has(c)) n++; seen.set(c, true); }
  return n;
}
/** Cosine similarity of the filler letters' histogram to the words' letters' histogram (0–1). */
function camouflageSimilarity(grid, placed) {
  const covered = new Set(placed.flatMap((p) => cellsOf(p)));
  const hw = new Array(26).fill(0), hf = new Array(26).fill(0);
  for (const p of placed) for (const ch of p.w) hw[ch.charCodeAt(0) - 65]++;
  for (let i = 0; i < grid.length; i++) if (!covered.has(i)) hf[grid[i].charCodeAt(0) - 65]++;
  let dot = 0, a = 0, b = 0;
  for (let i = 0; i < 26; i++) { dot += hw[i] * hf[i]; a += hw[i] * hw[i]; b += hf[i] * hf[i]; }
  return a && b ? dot / Math.sqrt(a * b) : 0;
}
/**
 * 0–100. Direction mix 45 (diagonals 15, backwards 20, plain E/S penalty 10), crossings 20,
 * edge avoidance 10, camouflage 25. A grid where every word runs E or S with English-frequency
 * filler lands around 10–25; a level-6 grid from here should pass 70.
 */
export function difficultyScore(puzzle) {
  const placed = puzzle.words;
  const n = placed.length || 1;
  const diag = placed.filter((p) => DIAGONAL.has(p.d)).length;
  const back = placed.filter((p) => BACKWARDS.has(p.d)).length;
  const plain = placed.filter((p) => PLAIN.has(p.d)).length;
  const edge = placed.filter(touchesBothEdges).length;
  const cross = crossings(placed);
  const cam = camouflageSimilarity(puzzle.grid, placed);
  const parts = {
    diagonals: Math.round(15 * Math.min(1, diag / 5)),
    backwards: Math.round(20 * Math.min(1, back / 5)),
    plainPenalty: Math.round(10 * (1 - Math.min(1, plain / n))),
    crossings: Math.round(20 * Math.min(1, cross / 6)),
    edges: Math.round(10 * (1 - edge / n)),
    camouflage: Math.round(25 * Math.max(0, (cam - 0.5) / 0.5)),
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { total, parts, stats: { diagonal: diag, backwards: back, plainES: plain, edgeToEdge: edge, crossings: cross, camouflage: Number(cam.toFixed(3)) } };
}

/** Does a placement set satisfy the mix rule for these knobs? */
export function meetsMixRule(placed, knobs) {
  const diag = placed.filter((p) => DIAGONAL.has(p.d)).length;
  const back = placed.filter((p) => BACKWARDS.has(p.d)).length;
  const plain = placed.filter((p) => PLAIN.has(p.d)).length;
  const edge = placed.filter((p) => p.w.length < N && touchesBothEdges(p)).length; // a 10-letter word has no choice
  return diag >= knobs.minDiagonal && back >= knobs.minBackwards && plain <= knobs.maxPlain && edge <= knobs.maxEdge && crossings(placed) >= knobs.minCrossings;
}

// ── Generator ──────────────────────────────────────────────────────────────────────────────
/**
 * Build one harder grid. `words` are the ten list words (any order); `pool` is the theme's full
 * word list (for off-list rejection); `level` 1–6. Deterministic for a given `seed`.
 * Returns { grid, words: placements, score, attempts } or throws when no clean grid is found.
 */
export function generateHarder({ words, pool = [], level = 3, seed = 'spyglass' }) {
  const knobs = knobsForLevel(level);
  const rng = rngFor(`spyglass-harder-${seed}-L${knobs.level}-v1`);
  const list = [...words].map((w) => w.toUpperCase()).sort((a, b) => b.length - a.length);
  if (list.length !== WORDS) throw new Error(`need ${WORDS} words, got ${list.length}`);
  const bag = fillerBag(list, knobs.camouflage);
  const dirNames = Object.keys(DIRS);
  let attempts = 0;
  const why = { placement: 0, mix: 0, fill: 0 };
  for (let attempt = 0; attempt < 2500; attempt++) {
    attempts++;
    const grid = new Array(N * N).fill('');
    const placed = [];
    // Direction plan: enough diagonals + backwards, few plain, then shuffled onto the words.
    const plan = [];
    const diagPool = ['SE', 'NE', 'NW', 'SW'], backPool = ['W', 'N', 'NW', 'SW'];
    for (let i = 0; i < knobs.minDiagonal; i++) plan.push(diagPool[below(rng, 4)]);
    while (plan.filter((d) => BACKWARDS.has(d)).length < knobs.minBackwards) plan.push(backPool[below(rng, 4)]);
    while (plan.length < WORDS) {
      const d = dirNames[below(rng, dirNames.length)];
      if (PLAIN.has(d) && plan.filter((x) => PLAIN.has(x)).length >= knobs.maxPlain) continue;
      plan.push(d);
    }
    const dirs = shuffle(plan, rng);
    let ok = true;
    for (let wi = 0; wi < list.length; wi++) {
      const w = list[wi];
      // Try the planned direction first, then any other that still respects the quotas.
      const order = [dirs[wi], ...shuffle(dirNames.filter((d) => d !== dirs[wi]), rng)];
      let chosen = null;
      for (const d of order) {
        const [dr, dc] = DIRS[d];
        const spots = [];
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          const er = r + dr * (w.length - 1), ec = c + dc * (w.length - 1);
          if (er < 0 || er >= N || ec < 0 || ec >= N) continue;
          let cross = 0, fits = true;
          for (let k = 0; k < w.length; k++) { const ch = grid[(r + dr * k) * N + (c + dc * k)]; if (ch === w[k]) cross++; else if (ch) { fits = false; break; } }
          if (!fits) continue;
          const cand = { w, r, c, d };
          const edgy = touchesBothEdges(cand);
          if (edgy && w.length < N && placed.filter((p) => p.w.length < N && touchesBothEdges(p)).length >= knobs.maxEdge) continue;
          spots.push({ ...cand, cross, edgy });
        }
        if (!spots.length) continue;
        const best = Math.max(...spots.map((s) => s.cross));
        // Prefer crossings strongly; keep some variety so grids differ day to day.
        const top = spots.filter((s) => s.cross === best);
        const varied = spots.filter((s) => s.cross >= Math.max(0, best - 1));
        const from = below(rng, 5) === 0 ? varied : top;
        chosen = from[below(rng, from.length)];
        break;
      }
      if (!chosen) { ok = false; break; }
      const [dr, dc] = DIRS[chosen.d];
      for (let k = 0; k < w.length; k++) grid[(chosen.r + dr * k) * N + (chosen.c + dc * k)] = w[k];
      placed.push({ w, r: chosen.r, c: chosen.c, d: chosen.d });
    }
    if (!ok) { why.placement++; continue; }
    if (!meetsMixRule(placed, knobs)) { why.mix++; continue; }
    for (let fill = 0; fill < 80; fill++) {
      const g = grid.map((ch) => ch || bag[below(rng, bag.length)]);
      if (rejectReason(g, placed, pool)) continue;
      const puzzle = { grid: g.join(''), words: placed };
      return { ...puzzle, score: difficultyScore(puzzle), attempts, level: knobs.level, knobs };
    }
    why.fill++;
  }
  throw new Error(`could not build a clean level-${knobs.level} grid after ${attempts} attempts (${JSON.stringify(why)})`);
}

/**
 * `generateHarder` with a graceful ramp-down: some word sets (four 9-letter words, say) cannot
 * meet the hardest knobs in a 10 × 10; try the requested level, then one level gentler, and so
 * on. The result's `requestedLevel` vs `level` shows what the set allowed.
 */
export function generateHardest(opts) {
  const requested = Math.min(6, Math.max(1, opts.level ?? 3));
  for (let level = requested; level >= 1; level--) {
    try { return { ...generateHarder({ ...opts, level }), requestedLevel: requested }; } catch (e) { if (level === 1) throw e; }
  }
  throw new Error('unreachable');
}

export function asciiGrid(grid, placed = []) {
  const covered = new Set(placed.flatMap((p) => cellsOf(p)));
  const rows = [];
  for (let r = 0; r < N; r++) {
    let line = '';
    for (let c = 0; c < N; c++) { const i = r * N + c; line += (covered.has(i) ? grid[i] : grid[i].toLowerCase()) + ' '; }
    rows.push(line.trimEnd());
  }
  return rows.join('\n');
}

// ── CLI: preview the next dailies ─────────────────────────────────────────────────────────
function cli() {
  const argv = process.argv.slice(2);
  const opt = (k, d) => (argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
  const bank = JSON.parse(fs.readFileSync(path.join(DATA, 'wordsearch-puzzles.json'), 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const from = opt('from', new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10));
  const days = Number(opt('days', 14));
  const outDir = path.join(REPO, opt('out', 'docs/audits/puzzles'));
  fs.mkdirSync(outDir, { recursive: true });
  const pools = themePools();
  const epoch = Date.parse(`${bank.epoch}T00:00:00Z`);
  const fromIdx = Math.round((Date.parse(`${from}T00:00:00Z`) - epoch) / 86400000);
  const preview = [];
  for (let i = fromIdx; i < fromIdx + days; i++) {
    const cur = bank.daily[i];
    const day = new Date(epoch + i * 86400000).toISOString().slice(0, 10);
    const level = levelForDate(day);
    const words = cur.words.map((p) => p.w);
    const gen = generateHardest({ words, pool: pools[cur.theme] ?? [], level, seed: `${cur.id}-${day}` });
    const before = difficultyScore(cur);
    preview.push({ index: i, day, weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${day}T00:00:00Z`).getUTCDay()], level: gen.level, requestedLevel: level, id: cur.id, theme: cur.theme, title: cur.title,
      current: { grid: cur.grid, words: cur.words, score: before }, proposed: { grid: gen.grid, words: gen.words, score: gen.score, attempts: gen.attempts } });
  }
  const json = { generatedBy: 'scripts/puzzles/spyglass-harder.mjs', generatedOn: today, note: 'PREVIEW ONLY — not applied to apps/web/data/wordsearch-puzzles.json. Grids are deterministic per (id, date, level). `near` must be recomputed with apps/web/scripts/wordsearch/add-near.mjs when applied (the generator already rejects off-list theme words, so it should come out empty).', bank: { epoch: bank.epoch, version: bank.version }, puzzles: preview };
  fs.writeFileSync(path.join(outDir, 'spyglass-preview.json'), JSON.stringify(json, null, 1));

  const md = [];
  md.push('# Spyglass harder grids — preview of the next 14 dailies', '');
  md.push(`Generated ${today} by \`scripts/puzzles/spyglass-harder.mjs\` (Friday queue item 30). **Not applied**: the bank, its sha and the parity fixtures are untouched; this is the playtest sample sheet.`, '');
  md.push('How to read: UPPERCASE letters belong to a hidden word, lowercase are filler (the shipped grid is all uppercase; the case here is only a reading aid). Score is `difficultyScore` 0–100: diagonals 15 + backwards 20 + few-plain-E/S 10 + crossings 20 + edge avoidance 10 + camouflage 25.', '');
  md.push('Ramp: Mon L1 → Fri L5, Sat/Sun L6. Knobs per level: min diagonals 3/3/4/4/5/5, min backwards 2/2/3/3/4/5, max plain E/S 3/3/2/2/1/1, max edge-to-edge placements 3/2/2/1/1/0, camouflage share 55–95 %, min crossings 2/2/3/3/4/4.', '');
  md.push('| # | Date | Day | Lvl | Puzzle | Current score | Proposed score | Diag | Back | Plain | Cross | Edge | Camo |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const p of preview) {
    const s = p.proposed.score, c = p.current.score;
    md.push(`| ${p.index} | ${p.day} | ${p.weekday} | ${p.level}${p.level !== p.requestedLevel ? ` (asked ${p.requestedLevel})` : ''} | ${p.id} ${p.title} | ${c.total} (${c.stats.diagonal}d/${c.stats.backwards}b/${c.stats.plainES}p) | **${s.total}** | ${s.stats.diagonal} | ${s.stats.backwards} | ${s.stats.plainES} | ${s.stats.crossings} | ${s.stats.edgeToEdge} | ${s.stats.camouflage} |`);
  }
  const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  md.push('', `Average score: current **${avg(preview.map((p) => p.current.score.total))}** → proposed **${avg(preview.map((p) => p.proposed.score.total))}**.`, '');
  for (const p of preview) {
    md.push(`## ${p.day} (${p.weekday}, level ${p.level}) — ${p.id} · ${p.title}`, '');
    md.push('```', 'PROPOSED                    CURRENT', ...asciiGrid(p.proposed.grid, p.proposed.words).split('\n').map((row, k) => `${row.padEnd(28)}${asciiGrid(p.current.grid, p.current.words).split('\n')[k]}`), '```', '');
    md.push(`Proposed score **${p.proposed.score.total}** (${Object.entries(p.proposed.score.parts).map(([k, v]) => `${k} ${v}`).join(', ')}) vs current ${p.current.score.total}.`, '');
    md.push('| Word | Proposed | Current |', '|---|---|---|');
    for (const w of p.proposed.words) {
      const c = p.current.words.find((x) => x.w === w.w);
      md.push(`| ${w.w} | ${w.d} from r${w.r} c${w.c} | ${c ? `${c.d} from r${c.r} c${c.c}` : '—'} |`);
    }
    md.push('');
  }
  fs.writeFileSync(path.join(outDir, 'spyglass-preview.md'), md.join('\n'));
  console.log(`wrote ${preview.length} previews to ${outDir}/spyglass-preview.{json,md}`);
  for (const p of preview) console.log(`${p.day} ${p.weekday} L${p.level} ${p.id.padEnd(7)} ${String(p.current.score.total).padStart(3)} → ${String(p.proposed.score.total).padStart(3)}  ${p.proposed.words.map((w) => `${w.w}(${w.d})`).join(' ')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) cli();
