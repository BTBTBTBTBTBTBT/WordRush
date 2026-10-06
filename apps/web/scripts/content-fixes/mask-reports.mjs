// Masks offensive words in the content-audit / content-fixes reports (policy: never in plain text in the
// repo's own files): each offensive token becomes its first letter + asterisks (F*****). In content-audit.json
// a masked `word` keeps its original as `word_b64` so the fix scripts can still find the entry.
//   node apps/web/scripts/content-fixes/mask-reports.mjs <file.md|file.json>…
import fs from 'node:fs';
import { offensiveWord, mask } from '../../../../packages/core/src/content-safety/safety.mjs';
import { dec } from './lib.mjs';

const ALSO = new Set(dec(['UVVFRVI=', 'Q09DSw=='])); // contextual words still masked in prose
const maskText = (t) => t.replace(/[A-Za-z][A-Za-z']*/g, (w) => (offensiveWord(w.replace(/'s$/i, '')) || ALSO.has(w.toUpperCase()) ? mask(w) : w));
for (const f of process.argv.slice(2)) {
  if (f.endsWith('.json')) {
    const walk = (v) => (typeof v === 'string' ? maskText(v) : Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v);
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const x of d.flags ?? []) { const m = maskText(x.word); if (m !== x.word) x.word_b64 = Buffer.from(x.word).toString('base64'); }
    const out = walk(d);
    fs.writeFileSync(f, JSON.stringify(out, null, 1) + '\n');
  } else fs.writeFileSync(f, maskText(fs.readFileSync(f, 'utf8')));
  console.log('masked', f);
}
