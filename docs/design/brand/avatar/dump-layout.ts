// Prints the core avatarLayout (packages/core/src/avatar-layout.ts) for configs on stdin (a JSON array of
// partial AvatarConfigs, merged over the classic default) — the input for fit-check.py and the contact sheets.
//   apps/server/node_modules/.bin/tsx docs/design/brand/avatar/dump-layout.ts < configs.json > layouts.json
import fs from 'node:fs';
import { avatarLayout, avatarPatternShapes, AVATAR_MANIFEST } from '../../../../packages/core/src/avatar-layout';
import { castPreset, validateAvatar, avatarColor, type AvatarConfig } from '../../../../packages/core/src/avatar-config';

const input = JSON.parse(fs.readFileSync(0, 'utf8')) as Array<Partial<AvatarConfig> & { small?: boolean }>;
const base = castPreset('w');
const out = input.map((raw) => {
  const config = validateAvatar({ ...base, ...raw }, base);
  const layout = avatarLayout(config, { small: !!raw.small });
  return {
    config, layout, pattern: avatarPatternShapes(config.pattern),
    color: avatarColor(config.color), patternColor: avatarColor(config.patternColor),
    accColor: config.accColor === 'default' ? null : avatarColor(config.accColor),
  };
});
process.stdout.write(JSON.stringify({ fit: AVATAR_MANIFEST.fit, bodies: AVATAR_MANIFEST.bodies, items: AVATAR_MANIFEST.items, out }));
