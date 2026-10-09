// Satori (next/og) cannot decode WebP, so the per-invite preview image (app/api/invite-og) reads the
// sender's mascot from a PNG. This converts each cast member's "ready" pose to
// public/og/invite/cast-<id>.png (360 px, transparent). Re-run if the cast art changes:
//   node apps/web/scripts/og/make-invite-cast-pngs.mjs
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'public/og/invite');
mkdirSync(out, { recursive: true });

// The ten cast ids and the pose each uses (W's "point" invites you in; the rest are "ready").
const CAST = { w: 'point', c: 'ready', i: 'ready', d: 'ready', s: 'ready', r: 'ready', u: 'ready', o1: 'ready', o2: 'ready', o3: 'ready' };

for (const [id, pose] of Object.entries(CAST)) {
  const src = path.join(root, `public/art/art-pose-${id}-${pose}.webp`);
  const dst = path.join(out, `cast-${id}.png`);
  await sharp(src).resize(360, 360, { fit: 'inside' }).png({ compressionLevel: 9 }).toFile(dst);
  console.log('wrote', path.relative(root, dst));
}
