// The posed layouts the per-pose guards check (docs/design/brand/avatar/integration/rig-body.py --guards):
// every pose × body × one worn item, laid out by the SHIPPED avatarLayout with no per-pose withholds, plus the
// item's rest layout. Writes docs/design/brand/avatar/rigs/_pose-layouts.json.
//   apps/server/node_modules/.bin/tsx packages/core/scripts/dump-pose-layouts.ts
import * as fs from 'fs';
import { join } from 'path';
import {
  AVATAR_BODIES, AVATAR_FACES, AVATAR_HEADS, AVATAR_INTEGRATED_OPTIONS, AVATAR_NECKS, AVATAR_POSES, AVATAR_POSES_DATA,
  avatarLayout, defaultAvatar, type AvatarConfig,
} from '../src/index';

const repo = join(__dirname, '..', '..', '..');
const data = { ...AVATAR_POSES_DATA, withheld: {} };
const fields: Array<[string, readonly string[]]> = [['head', AVATAR_HEADS], ['face', AVATAR_FACES], ['neck', AVATAR_NECKS],
  ...Object.entries(AVATAR_INTEGRATED_OPTIONS)];
const out: unknown[] = [];
for (const body of AVATAR_BODIES) {
  if (!data.rigs[body]) continue;
  for (const [field, ids] of fields) {
    for (const id of ids) {
      if (id === 'none') continue;
      const config: AvatarConfig = { ...defaultAvatar('x'), body, eyes: 'beady', mouth: 'smile', [field]: id } as AvatarConfig;
      const rest = avatarLayout(config, { pose: null });
      const key = rest.layers.find((l) => l.field === field)?.art;
      if (!key) continue;   // withheld on this body already
      for (const pose of AVATAR_POSES.slice(1)) {
        const L = avatarLayout(config, { pose }, undefined, data);
        out.push({ body, field, id, pose, layers: L.layers, letter: L.letter, letterM: L.letterM, rest: rest.layers.filter((l) => l.field === field) });
      }
    }
  }
}
fs.mkdirSync(join(repo, 'docs/design/brand/avatar/rigs'), { recursive: true });
fs.writeFileSync(join(repo, 'docs/design/brand/avatar/rigs/_pose-layouts.json'), JSON.stringify(out));
console.log('cases', out.length);
