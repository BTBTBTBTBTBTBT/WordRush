// Spyglass real words (founder, 2026-10-12: tracing WOOL in a grid cost a miss — "it should just notate that the word
// isn't part of the answer bank"). For every puzzle, `real` lists the everyday words (≥ 4 letters) that sit in the grid
// in any of the 8 directions but are neither list words nor close calls (`near`). The engine treats a selection spelling
// one of them as "a word, but not one of today's 10" — never a miss. The dictionary is the word lists the apps already
// ship: the 5/6/7-letter guess lists, Letter Ladder's words and every Hubbub accepted word. Grids are untouched.
//
//   node apps/web/scripts/wordsearch/add-real.mjs      # rewrites apps/web/data/wordsearch-puzzles.json in place
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const N = 10;
const MIN = 4;
const DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];

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

/** The real-word list for one puzzle, sorted. `blocked(w)` keeps crude words out (the UI echoes the word). */
export function realWords(puzzle, dict, blocked = () => false) {
  const skip = new Set([...puzzle.words.map((p) => p.w), ...(puzzle.near ?? [])]);
  return [...runs(puzzle.grid)].filter((w) => dict.has(w) && !skip.has(w) && !blocked(w)).sort();
}

/**
 * Crude / offensive words never go on the list (a selection spelling one stays an ordinary miss): any word containing a
 * term from scripts/data/offensive-blocklist.txt or core's username tier-1 substrings, or equal to a tier-2 token.
 */
export function loadBlocked(repoRoot) {
  const subs = new Set();
  for (const line of fs.readFileSync(path.join(repoRoot, 'scripts/data/offensive-blocklist.txt'), 'utf8').split('\n')) {
    const t = line.trim().toUpperCase();
    if (t && !t.startsWith('#') && /^[A-Z]+$/.test(t)) subs.add(t);
  }
  const src = fs.readFileSync(path.join(repoRoot, 'packages/core/src/username.ts'), 'utf8');
  const list = (name) => [...(src.match(new RegExp(`${name}[^=]*=\\s*\\[([\\s\\S]*?)\\]`))?.[1] ?? '').matchAll(/'([A-Z]+)'/g)].map((m) => m[1]);
  for (const t of list('USERNAME_BLOCKED_SUBSTRINGS')) subs.add(t);
  const tokens = new Set(list('USERNAME_BLOCKED_TOKENS'));
  if (subs.size < 20 || tokens.size < 5) throw new Error(`blocklists look empty (${subs.size} substrings, ${tokens.size} tokens)`);
  return (w) => tokens.has(w) || [...subs].some((t) => w.includes(t));
}

/** The everyday dictionary from the shipped word lists (uppercase). */
export function loadDictionary(dataDir) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
  const dict = new Set();
  const add = (w) => { const u = String(w).trim().toUpperCase(); if (u.length >= MIN && /^[A-Z]+$/.test(u)) dict.add(u); };
  for (const f of ['allowed.json', 'allowed-6.json', 'allowed-7.json', 'ladder-words.json']) for (const w of read(f)) add(w);
  const hub = read('hub-puzzles.json');
  for (const p of [...hub.daily, ...hub.extra]) for (const w of [...(p.words ?? []), ...(p.bonus ?? []), ...(p.pangrams ?? [])]) add(w);
  return dict;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
  const bankPath = path.join(DATA, 'wordsearch-puzzles.json');
  const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
  const dict = loadDictionary(DATA);
  const blocked = loadBlocked(path.join(DATA, '..', '..', '..'));
  for (const p of [...bank.daily, ...bank.extra]) p.real = realWords(p, dict, blocked);
  fs.writeFileSync(bankPath, JSON.stringify(bank) + '\n');
  const all = [...bank.daily, ...bank.extra];
  console.log(`dictionary ${dict.size} words; real: ${all.filter((p) => p.real.length).length}/${all.length} puzzles, ${all.reduce((n, p) => n + p.real.length, 0)} words`);
}
