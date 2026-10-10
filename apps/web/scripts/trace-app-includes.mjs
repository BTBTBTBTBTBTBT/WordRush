// Runs after `next build`. Next 13.5 applies `experimental.outputFileTracingIncludes` to Pages-router traces only
// (build/index.js loops over pageKeys.pages and writes server/pages/*.nft.json), so App-router routes shipped without
// the files they read at runtime: the push art route 500'd (no sharp native build, no public/ art) and the App Store
// routes' ./certs were never in their bundles. This applies the same globs to each matching App route's trace file,
// which Vercel reads to assemble the function.
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const glob = require('next/dist/compiled/glob');
const config = require(path.join(dir, 'next.config.js'));
const includes = config.experimental?.outputFileTracingIncludes ?? {};

// Files plus symlinks: pnpm links @img/sharp-<platform> into sharp's folder, and the trace must carry the link itself
// (as nft does for the links it finds) or sharp's require can't reach the package.
const globAsync = (pattern) =>
  new Promise((resolve, reject) =>
    glob(pattern, { cwd: dir, dot: true }, (err, found) =>
      err ? reject(err) : resolve(found.filter((f) => { const st = lstatSync(path.join(dir, f)); return st.isFile() || st.isSymbolicLink(); })),
    ),
  );

let failed = false;
for (const [route, patterns] of Object.entries(includes)) {
  const traceFile = path.join(dir, '.next/server/app', route, 'route.js.nft.json');
  if (!existsSync(traceFile)) continue; // a Pages route: Next already applied it
  const traceDir = path.dirname(traceFile);
  const trace = JSON.parse(readFileSync(traceFile, 'utf8'));
  const files = new Set(trace.files);
  const before = files.size;
  for (const pattern of patterns) {
    for (const file of await globAsync(pattern)) files.add(path.relative(traceDir, path.join(dir, file)));
  }
  if (files.size === before) {
    console.error(`trace-app-includes: ${route} matched no new files`);
    failed = true;
  }
  trace.files = [...files];
  writeFileSync(traceFile, JSON.stringify(trace));
  console.log(`trace-app-includes: ${route} +${files.size - before} files`);
}
if (failed) console.error("trace-app-includes: check the globs above (deploy continues)");
