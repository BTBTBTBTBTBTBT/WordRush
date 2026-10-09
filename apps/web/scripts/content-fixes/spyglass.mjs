// Spyglass content fixes from the 2026-10-06 content audit (REPORT-CONTENT-FIXES.md): edits the THEME POOLS
// (apps/web/data/wordsearch-themes.json — the build source future grids are drawn from). Run
// wordsearch/repair-future.mjs afterwards: it re-lays every future/Unlimited grid that still holds a word
// its pool no longer carries (past dailies untouched). Prints the pool changes as JSON.
//   node apps/web/scripts/content-fixes/spyglass.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { DATA, readJSON } from '../more-games/lib.mjs';
import { flagWord } from './lib.mjs';

const DRY = process.argv.includes('--dry');
const file = path.join(DATA, 'wordsearch-themes.json');
const data = readJSON(file);
let text = fs.readFileSync(file, 'utf8'); // one theme per line — edit lines in place to keep the layout
const audit = readJSON(path.join(DATA, '..', '..', '..', 'content-audit.json'));
const OVERRIDE = {}; // 'theme WORD' → replacement (lead review)
const RETITLE = { castle: 'At the Castle' }; // "Castle Keep" leans on an obscure noun sense of KEEP
const changes = [];
for (const f of audit.flags.filter((x) => x.game === 'spyglass' && x.status === 'theme-pool')) {
  const t = data.themes.find((x) => x.key === f.id); if (!t) throw new Error(`no theme ${f.id}`);
  if (f.field === 'title') continue;
  const words = t.words.split(/\s+/), rep = (OVERRIDE[`${f.id} ${flagWord(f)}`] ?? f.replacement).toUpperCase();
  if (!words.includes(flagWord(f))) throw new Error(`${f.id}: ${flagWord(f)} not in pool`);
  if (!/^[A-Z]{4,10}$/.test(rep)) throw new Error(`${f.id}: ${rep} must be 4–10 letters`);
  if (words.includes(rep)) throw new Error(`${f.id}: ${rep} already in pool`);
  if (words.some((w) => w !== flagWord(f) && (w.includes(rep) || rep.includes(w)))) throw new Error(`${f.id}: ${rep} overlaps a pool word`);
  const next = words.map((w) => (w === flagWord(f) ? rep : w)).join(' ');
  const line = `"key": "${t.key}"`, at = text.indexOf(line), end = text.indexOf('\n', at);
  text = text.slice(0, at) + text.slice(at, end).replace(`"words": "${t.words}"`, `"words": "${next}"`) + text.slice(end);
  t.words = next;
  changes.push({ theme: f.id, title: t.title, old: flagWord(f), new: rep, flag: f.category });
}
for (const [key, title] of Object.entries(RETITLE)) {
  const t = data.themes.find((x) => x.key === key); changes.push({ theme: key, title: `${t.title} → ${title}` });
  const at = text.indexOf(`"key": "${key}"`), end = text.indexOf('\n', at);
  text = text.slice(0, at) + text.slice(at, end).replace(`"title": "${t.title}"`, `"title": "${title}"`) + text.slice(end);
  t.title = title;
}
if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(data)) throw new Error('line edit diverged');
if (!DRY) fs.writeFileSync(file, text);
console.log(JSON.stringify(changes));
