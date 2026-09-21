// Muddle composer: turns an authored pun (final answer + caption + scene) into
// a complete puzzle — four scrambled 5/6-letter words whose CIRCLED letters are
// exactly the letters of the final answer — and validates every rule.
//   node scripts/muddle/compose.mjs
import path from 'node:path';
import { WEB, readJSON, upperList, neverAnswer, rngFor, below, shuffle, writeSample, wordset } from '../more-games/lib.mjs';
const jokes = readJSON(path.join(WEB, 'scripts', 'muddle', 'jokes.sample.json'));
const never = neverAnswer(), hard = new Set([...wordset('profanity-exact.generated.txt'), ...wordset('offensive-blocklist.txt')]);
const sig = (w) => w.split('').sort().join('');
const anagramCount = new Map();
for (const w of [...upperList('allowed.json'), ...upperList('allowed-6.json')]) anagramCount.set(sig(w), (anagramCount.get(sig(w)) || 0) + 1);
// Answer words: curated answers only, no anagram twin anywhere in the guess lists, no doubled-up letters galore.
// Family-newspaper tone: real words the word games may deal, but not a cartoon puzzle.
const TONE = new Set(['MURDER','THEFT','KILLER','CORPSE','WEAPON','BULLET','POISON','SUICIDE','DEADLY','BLOODY','CANCER','RIFLE','KNIFE','PISTOL','GRAVE','DEATH','DYING','CRIME','DRUNK','ABUSE','TERROR','HATRED','TUMOR']);
const pool = [...upperList('solutions.json'), ...upperList('solutions-6.json')].filter((w) => !never.has(w) && !TONE.has(w) && anagramCount.get(sig(w)) === 1);
const allowedAll = new Set([...upperList('allowed.json'), ...upperList('allowed-6.json')]);

function scramble(word, rng) {
  for (let t = 0; t < 200; t++) {
    const s = shuffle(word.split(''), rng).join('');
    const moved = s.split('').filter((c, i) => c !== word[i]).length;
    if (s !== word && moved >= word.length - 1 && !allowedAll.has(s) && ![...hard].some((h) => s.includes(h))) return s;
  }
  return null;
}
function splitParts(letters, rng) {                 // 4 parts, each 2–4 letters, exact cover
  const n = letters.length, sizes = [];
  const options = []; for (let a = 2; a <= 4; a++) for (let b = 2; b <= 4; b++) for (let c = 2; c <= 4; c++) { const d = n - a - b - c; if (d >= 2 && d <= 4) options.push([a, b, c, d]); }
  if (!options.length) return null;
  const pick = options[below(rng, options.length)], sh = shuffle(letters, rng), parts = []; let i = 0;
  for (const k of pick) { parts.push(sh.slice(i, i + k)); i += k; }
  return parts;
}
function wordFor(part, usedWords, wantLen, rng) {
  const need = {}; for (const c of part) need[c] = (need[c] || 0) + 1;
  const cands = shuffle(pool, rng).filter((w) => w.length === wantLen && !usedWords.has(w) && Object.entries(need).every(([c, k]) => w.split(c).length - 1 >= k));
  for (const w of cands) {
    const idx = [], taken = new Set();
    for (const c of part) { const pos = [...w].findIndex((ch, i) => ch === c && !taken.has(i)); taken.add(pos); idx.push(pos); }
    return { answer: w, circled: idx.sort((a, b) => a - b) };
  }
  return null;
}
const out = [];
jokes.forEach((j, n) => {
  const id = `md${String(n + 1).padStart(4, '0')}`, letters = j.final.replace(/[^A-Z]/g, '').split('');
  let puzzle = null;
  for (let t = 0; t < 4000 && !puzzle; t++) {
    const rng = rngFor(`${id}-compose-${t}-v1`), parts = splitParts(letters, rng); if (!parts) break;
    const lens = shuffle([5, 5, 6, 6], rng), used = new Set(), words = [];
    for (let k = 0; k < 4; k++) { const w = wordFor(parts[k], used, lens[k], rng); if (!w) break; const sc = scramble(w.answer, rng); if (!sc) break; used.add(w.answer); words.push({ ...w, scramble: sc }); }
    if (words.length !== 4) continue;
    const finalWords = new Set(j.final.split(' '));
    if (words.some((w) => finalWords.has(w.answer) || j.caption.toUpperCase().includes(w.answer))) continue;
    // final tray = circled letters in word order; must not already spell the answer
    const tray = words.flatMap((w) => w.circled.map((i) => w.answer[i])).join('');
    if (tray === letters.join('')) continue;
    puzzle = { id, words, final: { answer: j.final, pattern: j.final.split(' ').map((x) => x.length) }, tray, caption: j.caption, scene: j.scene, altText: j.altText };
  }
  if (!puzzle) { console.log(id, 'COULD NOT COMPOSE', j.final); return; }
  // ---- validate the rules the app will rely on ----
  const circ = puzzle.words.flatMap((w) => w.circled.map((i) => w.answer[i])).sort().join('');
  if (circ !== letters.slice().sort().join('')) throw new Error(`${id}: circled letters ≠ final answer`);
  for (const w of puzzle.words) if (sig(w.scramble) !== sig(w.answer) || w.scramble === w.answer) throw new Error(`${id}: bad scramble`);
  if (j.caption.length < 20 || j.caption.length > 110 || (j.caption.match(/____/g) || []).length !== 1) throw new Error(`${id}: caption shape`);
  if (j.final.split(' ').some((x) => j.altText.toUpperCase().includes(x) && x.length > 3)) throw new Error(`${id}: altText leaks the answer`);
  out.push(puzzle);
  console.log(`${id}  ${puzzle.words.map((w) => `${w.scramble}→${[...w.answer].map((c, i) => (w.circled.includes(i) ? `(${c})` : c)).join('')}`).join('  ')}   ⇒ ${j.final}`);
});
console.log(`${out.length}/${jokes.length} composed; wrote`, writeSample('muddle.json', { generatedBy: 'apps/web/scripts/muddle/compose.mjs', answerPool: pool.length, puzzles: out }));
