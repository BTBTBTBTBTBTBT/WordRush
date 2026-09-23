// Kindred (groups of four) validator. Beyond shape checks it PROVES each
// puzzle has exactly one solution: every group lists `alsoFits` — words from
// other groups that plausibly belong — and the validator counts exact covers
// of the 16 words by four groups of four drawn from (words ∪ alsoFits). More
// than one cover means the puzzle is ambiguous; zero means the key is broken.
import path from 'node:path';
import { WEB, REPO, readJSON, writeSample, wordset } from '../more-games/lib.mjs';
const argv = process.argv.slice(2), argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const IN = argOf('--in', path.join(WEB, 'scripts', 'groups', 'puzzles.sample.json')), OUT = argOf('--out', 'kindred.json');
const puzzles = readJSON(IN);
const hard = new Set([...wordset('profanity-exact.generated.txt'), ...wordset('offensive-blocklist.txt')]);
const lex = readJSON(path.join(REPO, 'scripts', 'data', 'lexicon-all.json'));
const known = new Set([...lex.common, ...lex.extended, ...lex.acceptOnly]);
const combos = (arr, k) => k === 0 ? [[]] : arr.flatMap((x, i) => combos(arr.slice(i + 1), k - 1).map((c) => [x, ...c]));
function covers(groups, words) {
  let n = 0;
  const rec = (gi, left) => {
    if (gi === groups.length) { if (!left.size) n++; return; }
    const cand = [...new Set([...groups[gi].words, ...(groups[gi].alsoFits || [])])].filter((w) => left.has(w));
    for (const c of combos(cand, 4)) { const next = new Set(left); c.forEach((w) => next.delete(w)); rec(gi + 1, next); }
  };
  rec(0, new Set(words)); return n;
}
const out = []; let failed = 0;
puzzles.forEach((p, i) => {
  const id = `gr${String(i + 1).padStart(4, '0')}`, problems = [], words = p.groups.flatMap((g) => g.words);
  if (p.groups.length !== 4 || p.groups.some((g) => g.words.length !== 4)) problems.push('needs 4 groups of 4');
  if (new Set(words).size !== 16) problems.push('duplicate word');
  if (new Set(words.map((w) => w.replace(/S$/, ''))).size !== 16) problems.push('singular/plural twins');
  if (p.groups.map((g) => g.tier).sort().join('') !== '1234') problems.push('tiers must be exactly 1–4');
  for (const g of p.groups) { if (g.label.length > 40) problems.push(`label too long: ${g.label}`); for (const w of g.alsoFits || []) if (!words.includes(w)) problems.push(`alsoFits ${w} is not in the puzzle`); }
  for (const w of words) { if (!/^[A-Z' -]{2,12}$/.test(w)) problems.push(`bad word shape ${w}`); if (hard.has(w)) problems.push(`blocked ${w}`); if (!known.has(w)) problems.push(`not in lexicon: ${w}`); }
  const n = covers(p.groups, words); if (n !== 1) problems.push(`${n} valid solutions (must be exactly 1)`);
  if (problems.length) failed++;
  out.push({ id, ...p, solutions: n, problems });
  console.log(`${id} ${problems.length ? 'FAIL ' + problems.join('; ') : 'ok'}  — ${p.groups.map((g) => g.label).join(' · ')}`);
});
console.log(`${puzzles.length - failed}/${puzzles.length} valid; wrote`, writeSample(OUT, { generatedBy: 'apps/web/scripts/groups/validate-groups.mjs', puzzles: out }));
process.exit(failed ? 1 : 0);
