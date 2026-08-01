#!/usr/bin/env node
// Copy the repo-root WORDOCIOUS_BIBLE.md into apps/web as .bible.md so the
// /api/admin/bible route can serve it. Runs as part of `npm run build` —
// Vercel's build has the whole repo checked out, but the serverless bundle
// only traces files INSIDE the app root, so the bible must be copied in
// (same reason ./certs is traced, see next.config.js).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../../../WORDOCIOUS_BIBLE.md');
const dst = path.resolve(here, '../.bible.md');

try {
  fs.copyFileSync(src, dst);
  console.log(`copy-bible: ${(fs.statSync(dst).size / 1024).toFixed(0)}K → .bible.md`);
} catch (e) {
  // Never fail the build over the bible — the route has a dev-path fallback
  // and degrades to 404 in prod if the copy was skipped.
  console.warn(`copy-bible: skipped (${e.message})`);
}
