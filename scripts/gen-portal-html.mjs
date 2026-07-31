#!/usr/bin/env node
// Regenerate WORDOCIOUS_PORTAL.html (repo root) from the single source in
// apps/web/lib/portal-html.ts. The root file is the standalone copy that
// survives the site being down — keep it in the Developer folder like the
// bible, send it to whoever needs it.
//
//   node scripts/gen-portal-html.mjs
//
// apps/web/scripts/portal-sync.test.ts fails if the two copies diverge.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(REPO, 'apps/web/lib/portal-html.ts');
const OUT = path.join(REPO, 'WORDOCIOUS_PORTAL.html');

const ts = fs.readFileSync(SRC, 'utf8');
const start = ts.indexOf('<!doctype html>');
const end = ts.lastIndexOf('</html>');
if (start === -1 || end === -1) {
  console.error('portal-html.ts: could not locate the HTML document boundaries');
  process.exit(1);
}
const html = ts.slice(start, end + '</html>'.length) + '\n';
fs.writeFileSync(OUT, html);
console.log(`wrote ${path.relative(REPO, OUT)} (${(html.length / 1024).toFixed(1)} KB)`);
