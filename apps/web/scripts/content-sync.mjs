// Copies every registered content file from apps/web (the canonical copy) over its iOS / Android / fixture
// copies (packages/core/src/content-safety/registry.json), so the three platforms stay byte-identical —
// the content gate (G9) fails until they are.   node apps/web/scripts/content-sync.mjs [--check]
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const REPO = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');
const reg = JSON.parse(fs.readFileSync(path.join(REPO, 'packages/core/src/content-safety/registry.json'), 'utf8'));
const check = process.argv.includes('--check');
let n = 0;
for (const b of reg.banks) {
  const src = fs.readFileSync(path.join(REPO, b.web));
  for (const c of b.copies) {
    const dst = path.join(REPO, c);
    if (fs.existsSync(dst) && Buffer.compare(fs.readFileSync(dst), src) === 0) continue;
    n++; console.log(`${check ? 'DIFFERS' : 'copied '} ${b.web} → ${c}`);
    if (!check) fs.writeFileSync(dst, src);
  }
}
console.log(`${n} ${check ? 'copies differ' : 'copies updated'}`);
// The web serves banks one puzzle per file from lib/banks-manifest.json (bank-loader.test.ts guards it).
if (!check) execFileSync(process.execPath, [path.join(REPO, 'apps/web/scripts/split-banks.js')], { stdio: 'inherit' });
process.exit(check && n ? 1 : 0);
