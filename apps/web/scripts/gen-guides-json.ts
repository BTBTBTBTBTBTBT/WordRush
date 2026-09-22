// Writes the in-game guide content (lib/guide-content.ts) as JSON into the
// native apps' bundles (More Games §19): iOS Wordocious/Resources and Android
// assets. The natives render the bundled copy immediately and let the
// network copy (/api/guides) replace it when it is newer — so a game on
// TestFlight never spins on "Loading guide" or shows Classic's rules because
// production has not published its entry yet.
//
//   Regenerate:  apps/server/node_modules/.bin/tsx scripts/gen-guides-json.ts
//   Guarded by:  scripts/guide-content.test.ts (fails when the copies are stale)

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { MODE_GUIDES } from '../lib/guide-content';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

/** Same field set /api/guides serves (drops metaDescription + related). */
export function renderGuidesJson(): string {
  const guides = MODE_GUIDES.map((g) => ({
    slug: g.slug, title: g.title, accent: g.accent, tagline: g.tagline,
    facts: g.facts, rules: g.rules, scoring: g.scoring, tips: g.tips,
    ...(g.controls ? { controls: g.controls } : {}),
  }));
  return JSON.stringify({ guides }, null, 2) + '\n';
}

export const GUIDE_JSON_TARGETS = [
  join(repoRoot, 'apps/ios/Wordocious/Resources/guides.generated.json'),
  join(repoRoot, 'apps/android/app/src/main/assets/guides.generated.json'),
];

const isMain = process.argv[1]?.endsWith('gen-guides-json.ts') ?? false;
if (isMain) {
  const json = renderGuidesJson();
  for (const t of GUIDE_JSON_TARGETS) {
    writeFileSync(t, json);
    console.log('wrote', t.replace(repoRoot + '/', ''));
  }
}
