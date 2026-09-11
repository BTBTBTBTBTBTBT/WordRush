// Re-rank the senses in data/word-definitions.json in place (offline — no
// network) so every entry leads with its best sense, then sync the two native
// copies. Run after gen-word-defs.mjs, or on its own when the rule changes:
//   node scripts/rerank-word-defs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rankSenses, cleanDefinition } from './rank-senses.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.join(here, '..', 'data', 'word-definitions.json');
const copies = [
  path.join(here, '..', '..', 'ios', 'Wordocious', 'Resources', 'word-definitions.json'),
  path.join(here, '..', '..', 'android', 'app', 'src', 'main', 'assets', 'word-definitions.json'),
];
const db = JSON.parse(fs.readFileSync(web, 'utf8'));
let changed = 0; let cleaned = 0; const examples = [];
for (const [word, rec] of Object.entries(db)) {
  if (!rec?.senses?.length) continue;
  // Wiktionary's HTML occasionally leaks a CSS rule into the text
  // (".mw-parser-output .defdate{font-size:…}"); cut it and anything after.
  // §260: then drop grammar/editorial labels and usage-note prefixes.
  for (const s of rec.senses) {
    const cut = cleanDefinition((s.def || '').replace(/\s*\.mw-parser-output[\s\S]*$/, '').trim());
    if (cut !== s.def) { s.def = cut; cleaned++; }
  }
  const ranked = rankSenses(word, rec.senses);
  if (ranked[0] !== rec.senses[0]) {
    changed++;
    if (examples.length < 12) examples.push(`${word}: [${rec.senses[0].pos}] ${rec.senses[0].def.slice(0, 50)} → [${ranked[0].pos}] ${ranked[0].def.slice(0, 50)}`);
  }
  rec.senses = ranked;
}
const out = JSON.stringify(db);
fs.writeFileSync(web, out);
for (const c of copies) fs.writeFileSync(c, out);
console.log(`re-ranked ${changed} of ${Object.keys(db).length} entries; cleaned ${cleaned} CSS-leak definitions; synced ${copies.length} native copies`);
for (const e of examples) console.log('  ' + e);
