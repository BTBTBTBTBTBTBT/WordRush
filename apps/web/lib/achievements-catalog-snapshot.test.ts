import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('./supabase-client', () => ({ supabase: {} }));

import { ACHIEVEMENT_CATALOG } from './achievement-service';

// The native apps bundle a snapshot of /api/achievements (iOS Resources/achievements-catalog.json, Android
// assets/achievements-catalog.json) so the Title Shelves and the badge grid are never bare on a first
// offline open (founder 10-05: no bare screens). The live fetch still replaces it; this pins the copies.
// After a catalog change: WRITE_CATALOG_SNAPSHOT=1 npx vitest run lib/achievements-catalog-snapshot.test.ts
const root = path.join(__dirname, '..', '..', '..');
const COPIES = [
  'apps/ios/Wordocious/Resources/achievements-catalog.json',
  'apps/android/app/src/main/assets/achievements-catalog.json',
];

function snapshot(): string {
  const achievements = ACHIEVEMENT_CATALOG.map((a) => ({
    key: a.key, name: a.name, description: a.description, category: a.category, icon: a.icon,
    ...(a.xp ? { xp: a.xp } : {}), ...(a.hidden ? { hidden: true } : {}),
  }));
  return `${JSON.stringify({ achievements })}\n`;
}

describe('the bundled achievement catalog snapshot', () => {
  it('matches ACHIEVEMENT_CATALOG on iOS and Android', () => {
    const want = snapshot();
    for (const rel of COPIES) {
      const file = path.join(root, rel);
      if (process.env.WRITE_CATALOG_SNAPSHOT) fs.writeFileSync(file, want);
      const got = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      expect(got === want, `${rel} is stale: WRITE_CATALOG_SNAPSHOT=1 npx vitest run lib/achievements-catalog-snapshot.test.ts`).toBe(true);
    }
  });
});
