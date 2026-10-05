// Letter Ladder's accepted-rung dictionary: COMMON American English only (founder + tester
// Doug, 2026-10-05: STOKE → DROVE accepted THAVE, "a rare British dialect word"). The full
// 5-letter guess list (allowed.json, ~10k, mostly 1934 Webster's lemmas) stays for Classic,
// where lenient guesses are expected; a ladder rung is SHOWN on the board and is what the
// hint suggests, so it must be a word players know.
//
//   ladder-words = allowed(5) ∩ ( lexicon "common" tier (wordfreq Zipf ≥ 3, the tier Hubbub's
//                  required words use) ∪ the curated answer pool as dealt after every swap
//                  ∪ every Ladder endpoint and par-path rung )
//                  − offensive/manual blocklists − British spellings/vocabulary − the guard's
//                  OBSCURE_WORDS − words swapped out of the answer pools
//
// Writes apps/web/data/ladder-words.json (sorted, uppercase). Bundled ×3 like the banks:
// copy to apps/ios/Wordocious/Resources, apps/ios/Tests/Fixtures and
// apps/android/core/src/main/resources/data (word-list-sync.test.ts pins the copies;
// content-american.test.ts guards the contents).   node apps/web/scripts/ladder/build-ladder-words.mjs
import fs from 'node:fs';
import path from 'node:path';
import { DATA, REPO, readJSON, upperList, wordset } from '../more-games/lib.mjs';

const allowed = new Set(upperList('allowed.json').filter((w) => w.length === 5));
const lex = readJSON(path.join(REPO, 'scripts', 'data', 'lexicon-all.json'));
const common = lex.common.filter((w) => w.length === 5);

// The answer pool as dealt once every swap batch is live (swap tables parsed from the core source).
const swapSrc = fs.readFileSync(path.join(REPO, 'packages', 'core', 'src', 'solution-swaps.ts'), 'utf8');
const swaps = [...swapSrc.matchAll(/^\s+([A-Z]+): '([A-Z]+)',$/gm)].map((m) => [m[1], m[2]]);
let answers = upperList('solutions.json');
for (const table of ['SOLUTION_SWAPS:', 'SOLUTION_SWAPS_2:', 'SOLUTION_SWAPS_3:']) {
  const start = swapSrc.indexOf(table), end = swapSrc.indexOf('};', start);
  const map = new Map([...swapSrc.slice(start, end).matchAll(/^\s+([A-Z]+): '([A-Z]+)',$/gm)].map((m) => [m[1], m[2]]));
  answers = answers.map((w) => map.get(w) ?? w);
}
const swappedOut = new Set(swaps.map(([o]) => o));

// The content guard's British + obscure lists (single source: content-american.test.ts / spelling-copy.test.ts).
const guard = fs.readFileSync(path.join(DATA, '..', 'scripts', 'content-american.test.ts'), 'utf8');
const block = (name) => { const s = guard.indexOf(name); return guard.slice(guard.indexOf('`', s) + 1, guard.indexOf('`', guard.indexOf('`', s) + 1)); };
const britWords = new Set(block('const BRIT_WORDS').trim().split(/\s+/));
const obscure = new Set(block('const OBSCURE_WORDS').trim().split(/\s+/));
const spell = fs.readFileSync(path.join(DATA, '..', 'scripts', 'spelling-copy.test.ts'), 'utf8');
const ls = spell.indexOf('const WORDS');
const britSpell = new Set([...spell.slice(ls, spell.indexOf('];', ls)).matchAll(/'([a-z-]+)'/g)].map((m) => m[1].toUpperCase()));
// Offensive / profane / manual blocks only: names that are also plain words (FRANK, ROBIN) are fine as rungs.
const never = new Set([...wordset('offensive-blocklist.txt'), ...wordset('manual-blocklist.txt'), ...wordset('profanity-exact.generated.txt')]);
// Every endpoint and par-path rung in the bank, so the hint BFS always reaches the end word.
const bank = readJSON(path.join(DATA, 'ladder-puzzles.json'));
const bankWords = [...bank.daily, ...bank.extra].flatMap((p) => [p.start, p.end, ...p.path]);

const out = [...new Set([...common, ...answers, ...bankWords])]
  .filter((w) => allowed.has(w) && !never.has(w) && !britWords.has(w) && !britSpell.has(w) && !obscure.has(w) && !swappedOut.has(w))
  .sort();
fs.writeFileSync(path.join(DATA, 'ladder-words.json'), JSON.stringify(out) + '\n');
console.log(`ladder-words.json: ${out.length} words (allowed 5-letter: ${allowed.size})`);
