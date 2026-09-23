// Merges the authored shards under apps/web/scripts/<game>/bank/ into ONE
// source bank per game (the file the real generators will read from), dropping
// exact duplicates across shards, then runs each game's validator/composer
// against the merged bank so the review artefacts reflect the whole thing.
//   node scripts/more-games/merge-banks.mjs            (merge + validate)
//   node scripts/more-games/merge-banks.mjs --no-run   (merge only)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { WEB, readJSON } from './lib.mjs';

const RUN = !process.argv.includes('--no-run');
const shards = (game, pattern) => fs.readdirSync(path.join(WEB, 'scripts', game, 'bank')).filter((f) => pattern.test(f)).sort().map((f) => path.join(WEB, 'scripts', game, 'bank', f));
const write = (rel, obj) => { const p = path.join(WEB, 'scripts', rel); fs.writeFileSync(p, JSON.stringify(obj, null, 1) + '\n'); return p; };
const run = (cmd) => { console.log('\n$ ' + cmd); const out = execSync(cmd, { cwd: WEB, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); console.log(out.trim().split('\n').slice(-3).join('\n')); };

// ---- Kindred (groups): array of puzzles; dedupe on the sorted 16-word set ----
{
  const seen = new Set(), out = []; let dropped = 0;
  for (const f of shards('groups', /^shard-\d+\.json$/)) for (const p of readJSON(f)) {
    const key = p.groups.flatMap((g) => g.words).sort().join('|');
    if (seen.has(key)) { dropped++; continue; }
    seen.add(key); out.push({ ...p, source: path.basename(f, '.json') });
  }
  console.log(`Kindred: ${out.length} puzzles merged (${dropped} duplicates dropped)`);
  write('groups/puzzles.json', out);
  if (RUN && out.length) run('node scripts/groups/validate-groups.mjs --in scripts/groups/puzzles.json --out kindred-bank.json');
}
// ---- Codebreaker (cryptogram): array of {text}; dedupe on letters only ----
{
  const seen = new Set(), out = []; let dropped = 0;
  const files = [path.join(WEB, 'scripts', 'cryptogram', 'sayings.sample.json'), ...shards('cryptogram', /^sayings-.+\.json$/)];
  for (const f of files) for (const q of readJSON(f)) {
    const key = q.text.toUpperCase().replace(/[^A-Z]/g, '');
    if (seen.has(key)) { dropped++; continue; }
    seen.add(key); out.push({ text: q.text });
  }
  console.log(`Codebreaker: ${out.length} sayings merged (${dropped} duplicates dropped; includes the 24 Phase 0 samples)`);
  write('cryptogram/sayings.json', out);
  if (RUN && out.length) run('node scripts/cryptogram/make-and-validate.mjs --in scripts/cryptogram/sayings.json --out cryptogram-bank.json');
}
// ---- Crosswordocious (crossword): object of themes; later shard wins on a key clash ----
{
  const out = {}; let pairs = 0;
  // themes-*.json = evergreen themes; holidays-*.json = date-pinned themes (each carries a `holiday` key from holidays.mjs).
  const files = [path.join(WEB, 'scripts', 'crossword', 'phrases.sample.json'), ...shards('crossword', /^(themes|holidays)-.+\.json$/)];
  for (const f of files) for (const [k, t] of Object.entries(readJSON(f))) {
    if (out[k]) console.log(`  crossword theme key "${k}" appears twice; keeping ${path.basename(f)}`);
    const seenClue = new Set(); t.pairs = t.pairs.filter(([c]) => !seenClue.has(c) && seenClue.add(c));
    out[k] = t; pairs += t.pairs.length;
  }
  console.log(`Crosswordocious: ${Object.keys(out).length} themes, ${pairs} pairs merged (includes the 6 Phase 0 themes)`);
  write('crossword/phrases.json', out);
  if (RUN && pairs) run('node scripts/crossword/build-grids.mjs --in scripts/crossword/phrases.json --out crossword-bank.json --per 3');
}
// ---- Muddle (scramble): array of jokes; dedupe on the final answer ----
{
  const seen = new Set(), out = []; let dropped = 0;
  const files = [path.join(WEB, 'scripts', 'muddle', 'jokes.sample.json'), ...shards('muddle', /^jokes-.+\.json$/)];
  for (const f of files) for (const j of readJSON(f)) {
    const key = j.final.replace(/[^A-Z]/g, '');
    if (seen.has(key)) { dropped++; continue; }
    seen.add(key); out.push(j);
  }
  console.log(`Muddle: ${out.length} jokes merged (${dropped} duplicates dropped; includes the 10 Phase 0 samples)`);
  write('muddle/jokes.json', out);
  if (RUN && out.length) run('node scripts/muddle/compose.mjs --in scripts/muddle/jokes.json --out muddle-bank.json');
}
