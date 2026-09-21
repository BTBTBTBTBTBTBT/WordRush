// Spyglass (word search) generator: themed 10×10 grids, ten words each, FOUR
// forward directions (E, S, SE, NE) so nothing ever reads backwards. Fill is
// rerolled until every list word occurs exactly once in all eight directions
// and no line in any direction spells a blocked term.
//   node scripts/wordsearch/generate.mjs
import path from 'node:path';
import { WEB, readJSON, rngFor, below, shuffle, writeSample, neverAnswer, wordset } from '../more-games/lib.mjs';

const N = 10, WORDS = 10;
const DIRS = { E: [0, 1], S: [1, 0], SE: [1, 1], NE: [-1, 1] };
const ALL8 = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
const FREQ = 'EEEEEEEEEEEETTTTTTTTTAAAAAAAAOOOOOOOIIIIIIINNNNNNNSSSSSSRRRRRRHHHHHHLLLLDDDDCCCUUUMMMFFPPGGWWYYBBVK';
const blockedTerms = [...wordset('profanity-exact.generated.txt'), ...wordset('offensive-blocklist.txt')].filter((t) => t.length >= 3);
const never = neverAnswer();
const themes = readJSON(path.join(WEB, 'scripts', 'wordsearch', 'themes.sample.json'));

function lines(grid) {                       // every straight line, both ways
  const out = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of ALL8) {
    let s = ''; for (let k = 0, rr = r, cc = c; rr >= 0 && rr < N && cc >= 0 && cc < N; k++, rr += dr, cc += dc) s += grid[rr][cc];
    out.push(s);
  }
  return out;
}
const occurrences = (grid, w) => lines(grid).filter((l) => l.startsWith(w)).length;

function build(themeKey, serial) {
  const theme = themes[themeKey], rng = rngFor(`ws-${themeKey}-${serial}-v1`);
  const pool = theme.words.filter((w) => w.length >= 4 && w.length <= N && !never.has(w));
  const pick = shuffle(pool, rng).slice(0, WORDS).sort((a, b) => b.length - a.length);
  if (pick.length < WORDS) throw new Error(`${themeKey}: only ${pick.length} usable words`);
  for (let attempt = 0; attempt < 400; attempt++) {
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
      const pool2 = spots.filter((s) => s.cross === best || below(rng, 4) === 0);   // prefer crossings, keep variety
      const s = pool2[below(rng, pool2.length)];
      const [dr, dc] = DIRS[s.d]; for (let k = 0; k < w.length; k++) grid[s.r + dr * k][s.c + dc * k] = w[k];
      placed.push({ w, r: s.r, c: s.c, d: s.d });
    }
    if (!ok) continue;
    for (let fill = 0; fill < 60; fill++) {
      const g = grid.map((row) => row.map((ch) => ch || FREQ[below(rng, FREQ.length)]));
      const ls = lines(g);
      if (pick.every((w) => occurrences(g, w) === 1) && !blockedTerms.some((t) => ls.some((l) => l.includes(t))))
        return { id: `ws-${themeKey}-${serial}`, theme: themeKey, title: theme.title, grid: g.map((r) => r.join('')).join(''), words: placed };
    }
  }
  throw new Error(`could not build ${themeKey}`);
}
const out = []; let i = 0;
for (const key of Object.keys(themes)) { out.push(build(key, 1)); if (++i < 5) out.push(build(key, 2)); }
const file = writeSample('spyglass.json', { generatedBy: 'apps/web/scripts/wordsearch/generate.mjs', puzzles: out.slice(0, 10) });
const p = out[0]; console.log(p.title, '—', p.words.map((x) => `${x.w}(${x.d})`).join(' '));
for (let r = 0; r < N; r++) console.log('  ' + p.grid.slice(r * N, r * N + N).split('').join(' '));
console.log(`built ${Math.min(out.length, 10)} grids; wrote`, file);
