// Writes packages/core/src/content-safety/served-snapshot.json: a hash of every puzzle entry already
// served (or bundled in shipped builds) before CONTENT_RELEASE_DATE, per registered bank, plus every
// answer pool (pools are order-locked: they only change through dated swap batches). content-check.test.ts
// fails if any of them changes. Run when CONTENT_RELEASE_DATE moves forward, FROM THE COMMIT THAT WAS LIVE
// (--ref=<git ref>, default HEAD), so the snapshot records what players actually saw:
//   node apps/web/scripts/content-snapshot.mjs [--ref=HEAD]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { CONTENT_RELEASE_DATE } from './content-release-date.mjs';
import { servedEntries, sha } from '../../../packages/core/src/content-safety/served.mjs';

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');
const ref = (process.argv.find((a) => a.startsWith('--ref=')) ?? '--ref=HEAD').split('=')[1];
const reg = JSON.parse(fs.readFileSync(path.join(REPO, 'packages/core/src/content-safety/registry.json'), 'utf8'));
const read = (p) => JSON.parse(execSync(`git show ${ref}:${p}`, { cwd: REPO, maxBuffer: 1 << 30 }).toString());
const holidayDays = read('apps/web/data/holiday-days.json').days;
const pnHol = read('apps/web/data/propernoundle-holidays.json').holiday;
holidayDays.__pnHoliday = new Set(Object.keys(pnHol));
const out = { from: CONTENT_RELEASE_DATE, ref: execSync(`git rev-parse ${ref}`, { cwd: REPO }).toString().trim(), banks: {} };
for (const b of reg.banks) {
  const entries = servedEntries(b.schema, read(b.web), { from: CONTENT_RELEASE_DATE, holidayDays });
  if (entries.length) out.banks[b.id] = Object.fromEntries(entries.map((e) => [e.key, sha(e.value)]));
}
fs.writeFileSync(path.join(REPO, 'packages/core/src/content-safety/served-snapshot.json'), JSON.stringify(out, null, 1) + '\n');
console.log(Object.entries(out.banks).map(([k, v]) => `${k}: ${Object.keys(v).length}`).join('\n'));
