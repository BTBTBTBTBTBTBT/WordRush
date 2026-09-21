// Decipher (cryptogram): validates candidate quotations and assigns each a
// STORED substitution key (a derangement: no letter maps to itself), so parity
// across platforms is "read a string". Sample input: quotes.sample.json.
// Every quote carries `verified: false` until a human checks it against a
// primary text — misattribution is the main content risk for this game.
import path from 'node:path';
import { WEB, readJSON, rngFor, shuffle, writeSample, wordset } from '../more-games/lib.mjs';
const quotes = readJSON(path.join(WEB, 'scripts', 'cryptogram', 'quotes.sample.json'));
const hard = [...wordset('profanity-exact.generated.txt'), ...wordset('offensive-blocklist.txt')];
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function makeKey(id) {
  const rng = rngFor(`${id}-cipher-v1`);
  for (;;) { const p = shuffle(A.split(''), rng); if (p.every((c, i) => c !== A[i])) return p.join(''); }
}
const encipher = (text, key) => text.toUpperCase().replace(/[A-Z]/g, (c) => key[c.charCodeAt(0) - 65]);
const out = [], rejects = [];
quotes.forEach((q, i) => {
  const id = `cg${String(i + 1).padStart(4, '0')}`, t = q.text, problems = [];
  const letters = new Set(t.toUpperCase().replace(/[^A-Z]/g, ''));
  if (t.length < 60 || t.length > 120) problems.push(`length ${t.length} (60–120)`);
  if (!/^[A-Za-z .,;:'"!?\-]+$/.test(t)) problems.push('non-ASCII or unsupported punctuation');
  if (letters.size < 12 || letters.size > 22) problems.push(`${letters.size} distinct letters (12–22)`);
  if (!t.split(/\s+/).some((w) => w.replace(/[^A-Za-z]/g, '').length <= 3)) problems.push('no short word to start from');
  if (!(q.deathYear <= 1950)) problems.push(`author died ${q.deathYear} (must be ≤ 1950)`);
  if (!q.source) problems.push('no source');
  const words = t.toUpperCase().split(/[^A-Z']+/); if (hard.some((h) => words.includes(h))) problems.push('blocked term');
  if (problems.length) { rejects.push({ id, author: q.author, problems }); return; }
  const key = makeKey(id);
  if (![...key].every((c, k) => c !== A[k]) || new Set(key).size !== 26) throw new Error('bad key');
  out.push({ id, ...q, verified: false, key, cipher: encipher(t, key), distinctLetters: letters.size });
});
const file = writeSample('decipher.json', { generatedBy: 'apps/web/scripts/cryptogram/make-and-validate.mjs', puzzles: out, rejects });
console.log(`${out.length} valid, ${rejects.length} rejected`); for (const r of rejects) console.log('  REJECT', r.id, r.author, '—', r.problems.join('; '));
console.log('sample:', out[0].cipher); console.log('wrote', file);
