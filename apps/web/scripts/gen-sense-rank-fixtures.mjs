// §260: parity fixtures for the sense ranker. The rule exists four times
// (scripts/rank-senses.mjs, lib/sense-rank.ts, iOS Sources/Core/SenseRank.swift,
// Android data/SenseRank.kt); this pins the EXPECTED first sense for a fixed
// sample of real dictionary entries so a port that drifts fails its test.
// Expected values are COMPUTED from the .mjs (never hand-typed), and every
// entry the ranker actually reorders is included, plus a spread of the rest.
//   Regenerate after any rule change:  node scripts/gen-sense-rank-fixtures.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rankSenses, senseScore } from './rank-senses.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..', '..', '..');
const db = JSON.parse(fs.readFileSync(path.join(here, '..', 'data', 'word-definitions.json'), 'utf8'));

const cases = [];
const words = Object.keys(db).sort();
for (const [i, word] of words.entries()) {
  const senses = (db[word].senses || []).map((s) => ({ pos: s.pos || '', def: s.def || '' }));
  if (senses.length < 2) continue;
  const scores = senses.map((s) => senseScore(word, s));
  const reorders = scores.some((sc, k) => k > 0 && sc < scores[0]);
  // every reordered entry + every 40th of the rest
  if (!reorders && i % 40 !== 0) continue;
  cases.push({ word, senses, expectedFirst: rankSenses(word, senses)[0].def, scores });
}
const out = { generatedBy: 'apps/web/scripts/gen-sense-rank-fixtures.mjs', cases };
const json = JSON.stringify(out, null, 1);
for (const dest of [
  path.join(here, '..', 'lib', '__fixtures__', 'sense-rank-fixtures.json'),
  path.join(repoRoot, 'apps', 'ios', 'Tests', 'Fixtures', 'sense-rank-fixtures.json'),
  path.join(repoRoot, 'apps', 'android', 'app', 'src', 'test', 'resources', 'fixtures', 'sense-rank-fixtures.json'),
]) { fs.writeFileSync(dest, json); console.log(`wrote ${cases.length} cases → ${path.relative(repoRoot, dest)}`); }
