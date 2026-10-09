// Letter Ladder repair for FUTURE puzzles only (2026-10-05): every unseen puzzle (dailies from
// CONTENT_RELEASE_DATE, the whole Unlimited pool) must be solvable in par over the curated
// common-word list (data/ladder-words.json, build-ladder-words.mjs) and its par path must use only
// words on that list. A puzzle that fails (BLOKE / PENCE endpoints, a rung that left the list) is
// replaced IN PLACE (same id, same par) by a fresh pair built with generate.mjs's rules: endpoints
// are common answer words never used as an endpoint elsewhere in the bank, >= 2 shortest routes over
// answer words, and the full ladder list offers no shorter route. Past dailies are never touched.
//
//   node apps/web/scripts/ladder/repair-future.mjs [--from=YYYY-MM-DD] [--dry]
// then rebuild ladder-words.json and copy both files to the iOS/Android bundles.
import fs from 'node:fs';
import path from 'node:path';
import { DATA, readJSON, rngFor, shuffle, gateBank } from '../more-games/lib.mjs';
import { CONTENT_RELEASE_DATE } from '../content-release-date.mjs';

const argv = process.argv.slice(2);
const FROM = (argv.find((a) => a.startsWith('--from=')) || `--from=${CONTENT_RELEASE_DATE}`).split('=')[1];
const DRY = argv.includes('--dry');
const bankPath = path.join(DATA, 'ladder-puzzles.json');
const bank = readJSON(bankPath);
const words = readJSON(path.join(DATA, 'ladder-words.json'));
const wordSet = new Set(words);
const answers = new Set(readJSON(path.join(DATA, 'solutions.json')).map((w) => w.toUpperCase()).filter((w) => wordSet.has(w)));

function graph(list) {
  const buckets = new Map();
  for (const w of list) for (let i = 0; i < 5; i++) { const k = w.slice(0, i) + '_' + w.slice(i + 1); (buckets.get(k) || buckets.set(k, []).get(k)).push(w); }
  const adj = new Map(list.map((w) => [w, []]));
  for (const g of buckets.values()) for (const a of g) for (const b of g) if (a !== b) adj.get(a).push(b);
  return adj;
}
const gCommon = graph([...answers]), gAll = graph(words);
function bfs(adj, src) {
  const dist = new Map([[src, 0]]), ways = new Map([[src, 1]]); let frontier = [src];
  while (frontier.length) {
    const next = [];
    for (const u of frontier) for (const v of adj.get(u) || []) {
      if (!dist.has(v)) { dist.set(v, dist.get(u) + 1); ways.set(v, 0); next.push(v); }
      if (dist.get(v) === dist.get(u) + 1) ways.set(v, ways.get(v) + ways.get(u));
    }
    frontier = next;
  }
  return { dist, ways };
}
function onePath(adj, src, dst) {
  const { dist } = bfs(adj, dst); const p = [src]; let cur = src;
  while (cur !== dst) { cur = [...adj.get(cur)].filter((v) => dist.get(v) === dist.get(cur) - 1).sort()[0]; p.push(cur); }
  return p;
}

const fromIdx = Math.round((Date.parse(`${FROM}T00:00:00Z`) - Date.parse(`${bank.epoch}T00:00:00Z`)) / 86400000);
const unseen = [...bank.daily.slice(fromIdx).map((p, i) => ({ p, where: `day ${fromIdx + i + 1}` })), ...bank.extra.map((p, i) => ({ p, where: `unlimited ${i}` }))];
const broken = unseen.filter(({ p }) => p.path.some((w) => !wordSet.has(w)) || bfs(gAll, p.start).dist.get(p.end) !== p.par);
const endpoints = new Set([...bank.daily, ...bank.extra].flatMap((p) => [p.start, p.end]));
const rng = rngFor(`ladder-repair-${FROM}`);
const report = [];
for (const { p, where } of broken) {
  const starts = shuffle([...answers].filter((w) => !endpoints.has(w)).sort(), rng);
  let pick = null;
  for (const s of starts) {
    const c = bfs(gCommon, s), a = bfs(gAll, s);
    const ends = shuffle([...answers].filter((e) => e !== s && !endpoints.has(e) && c.dist.get(e) === p.par && c.ways.get(e) >= 2 && a.dist.get(e) === p.par).sort(), rng);
    if (ends.length) { pick = { start: s, end: ends[0], routes: c.ways.get(ends[0]) }; break; }
  }
  if (!pick) throw new Error(`no replacement pair for ${p.id} (par ${p.par})`);
  const before = `${p.start}→${p.end}`;
  p.start = pick.start; p.end = pick.end; p.path = onePath(gCommon, pick.start, pick.end);
  if ('routes' in p) p.routes = pick.routes;
  endpoints.add(pick.start); endpoints.add(pick.end);
  report.push(`  ${p.id} (${where}) par ${p.par}: ${before} → ${p.path.join(' → ')}`);
}
console.log(`from ${FROM} (daily index ${fromIdx}): ${broken.length} ladders replaced`);
console.log(report.join('\n'));
// Content gate (docs/CONTENT-SAFETY.md): refuses offensive / British-only / obscure words in unseen puzzles.
await gateBank('ladder', bank);
if (!DRY) { fs.writeFileSync(bankPath, JSON.stringify(bank) + '\n'); console.log('wrote', bankPath); }
