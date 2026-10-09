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
import { mustAccept, offensiveWord } from '../../../../packages/core/src/content-safety/safety.mjs';

const allowed = new Set(upperList('allowed.json').filter((w) => w.length === 5));
const lex = readJSON(path.join(REPO, 'scripts', 'data', 'lexicon-all.json'));
const common = lex.common.filter((w) => w.length === 5);

// The answer pool as dealt once every swap batch is live (swap tables parsed from the core source).
const swapSrc = fs.readFileSync(path.join(REPO, 'packages', 'core', 'src', 'solution-swaps.ts'), 'utf8');
// Batch 4 is split into a plain table and a base64-keyed one (offensive keys are never stored in plain text).
const tableOf = (name) => {
  const start = swapSrc.indexOf(`${name}: Readonly`), end = swapSrc.indexOf('};', start);
  if (start < 0) throw new Error(`swap table ${name} not found in solution-swaps.ts`);
  return new Map([...swapSrc.slice(start, end).matchAll(/^\s+'?([A-Za-z0-9+/=]+)'?: '([A-Z]+)',$/gm)]
    .map((m) => [name.endsWith('_ENCODED') ? Buffer.from(m[1], 'base64').toString('utf8') : m[1], m[2]]));
};
const BATCHES = [['SOLUTION_SWAPS'], ['SOLUTION_SWAPS_2'], ['SOLUTION_SWAPS_3'], ['SOLUTION_SWAPS_4_PLAIN', 'SOLUTION_SWAPS_4_ENCODED']]
  .map((names) => new Map(names.flatMap((n) => [...tableOf(n)])));
let answers = upperList('solutions.json');
for (const map of BATCHES) answers = answers.map((w) => map.get(w) ?? w);
// Batches 1–3 only: batch 4 (content audit) mostly retires answers for being obscure or unfair as a
// Classic ANSWER, which does not make them bad ladder rungs (SHIRE alone carries ~70 ladders); the
// audit's ladder-specific removals are in ladderOut / the British and obscure lists below.
const swappedOut = new Set(BATCHES.slice(0, 3).flatMap((m) => [...m.keys()]));

// The content guard's British + obscure lists (single source: content-american.test.ts / spelling-copy.test.ts).
const guard = fs.readFileSync(path.join(DATA, '..', 'scripts', 'content-american.test.ts'), 'utf8');
const block = (name) => { const s = guard.indexOf(name); return guard.slice(guard.indexOf('`', s) + 1, guard.indexOf('`', guard.indexOf('`', s) + 1)); };
const listFile = (f) => fs.readFileSync(path.join(DATA, '..', 'scripts', 'data', f), 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/)[0]);
// + the content audit's lists (2026-10-06): extended British vocabulary and the obscure words it found.
const britWords = new Set([...block('const BRIT_WORDS').trim().split(/\s+/), ...listFile('brit-words-extended.txt')]);
const obscure = new Set([...block('const OBSCURE_WORDS').trim().split(/\s+/), ...listFile('obscure-words.txt')]);
// Content audit: proper-noun, obscure and British rungs (ladder-words is typed AND shown as a hint). Offensive
// rungs are rejected by the shared content-safety module (offensiveWord), whose list is stored encoded.
const ladderOut = new Set(`JETER BOTOX DANES BRITS TURKS ARABS BOWIE TORAH EBOLA COSTA AIRES ALACK TWIXT NEATH BOSUN WIGGY SITCH FORME ORTHO NEURO INTRA SUPRA TERRA VERSA COLES MASSE HERES BATES BLANC BLUEY JAMMY LIPPY CARER TONNE MAINS HIPPY RANDY`.trim().split(/\s+/));
const spell = fs.readFileSync(path.join(DATA, '..', 'scripts', 'spelling-copy.test.ts'), 'utf8');
const ls = spell.indexOf('const WORDS');
const britSpell = new Set([...spell.slice(ls, spell.indexOf('];', ls)).matchAll(/'([a-z-]+)'/g)].map((m) => m[1].toUpperCase()));
// Offensive / profane / manual blocks only: names that are also plain words (FRANK, ROBIN) are fine as rungs.
const never = new Set([...wordset('offensive-blocklist.txt'), ...wordset('manual-blocklist.txt'), ...wordset('profanity-exact.generated.txt')]);
// Every endpoint and par-path rung in the bank, so the hint BFS always reaches the end word.
const bank = readJSON(path.join(DATA, 'ladder-puzzles.json'));
const bankWords = [...bank.daily, ...bank.extra].flatMap((p) => [p.start, p.end, ...p.path]);

// + the everyday words every accept list must carry (content-safety must-accept, prompt 05b: AUNTY…).
const everyday = mustAccept().filter((w) => w.length === 5);
const everydaySet = new Set(everyday);
const offensive = new Set([...wordset('offensive-blocklist.txt'), ...wordset('profanity-exact.generated.txt')]);
const out = [...new Set([...common, ...answers, ...bankWords, ...everyday])]
  // Everyday words bypass manual-blocklist (a Classic ANSWER list of regionalisms like AUNTY), never the
  // offensive / profanity lists.
  .filter((w) => allowed.has(w) && (everydaySet.has(w) ? !offensive.has(w) : (!never.has(w) && !britWords.has(w) && !britSpell.has(w) && !obscure.has(w) && !swappedOut.has(w) && !ladderOut.has(w) && !offensiveWord(w))))
  .sort();
fs.writeFileSync(path.join(DATA, 'ladder-words.json'), JSON.stringify(out) + '\n');
console.log(`ladder-words.json: ${out.length} words (allowed 5-letter: ${allowed.size})`);
