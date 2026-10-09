// Letter Ladder content fixes from the 2026-10-06 content audit (REPORT-CONTENT-FIXES.md): FUTURE
// puzzles whose start, end or par path used a flagged word (B****, P****, S****, SLAVE, DRUNK…) take
// the audit's same-par reroute (verified shortest on the rebuilt accept list); ids and par are kept.
// Run BEFORE build-ladder-words.mjs; ladder/repair-future.mjs then rebuilds anything still unsolvable.
//   node apps/web/scripts/content-fixes/ladder.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { DATA, readJSON } from '../more-games/lib.mjs';
import { CONTENT_RELEASE_DATE } from '../content-release-date.mjs';
import { flagWord, liveFrom } from './lib.mjs';

const DRY = process.argv.includes('--dry');
const file = path.join(DATA, 'ladder-puzzles.json');
const bank = readJSON(file);
const audit = readJSON(path.join(DATA, '..', '..', '..', 'content-audit.json'));
const live = new Map(liveFrom(bank, CONTENT_RELEASE_DATE).map((e) => [e.p.id, e]));
const usedPairs = new Set([...bank.daily, ...bank.extra].map((p) => [p.start, p.end].sort().join('-')));
const changes = [];
for (const f of audit.flags.filter((x) => x.game === 'ladder' && x.field === 'path' && x.replacement)) {
  const e = live.get(f.id); if (!e) { changes.push({ id: f.id, skipped: 'already served' }); continue; }
  const p = e.p, path_ = f.replacement.trim().split(/\s+/);
  if (path_.length - 1 !== p.par) throw new Error(`${p.id}: par ${p.par} ≠ ${path_.length - 1}`);
  for (let i = 1; i < path_.length; i++) if ([...path_[i]].filter((c, k) => c !== path_[i - 1][k]).length !== 1) throw new Error(`${p.id}: bad step`);
  const pair = [path_[0], path_.at(-1)].sort().join('-');
  if ((path_[0] !== p.start || path_.at(-1) !== p.end) && usedPairs.has(pair)) throw new Error(`${p.id}: pair ${pair} already used`);
  usedPairs.add(pair);
  changes.push({ id: p.id, where: e.where, date: e.date, old: p.path.join(' '), new: path_.join(' '), word: flagWord(f) });
  p.start = path_[0]; p.end = path_.at(-1); p.path = path_;
}
if (!DRY) fs.writeFileSync(file, JSON.stringify(bank) + '\n');
console.log(JSON.stringify(changes));
