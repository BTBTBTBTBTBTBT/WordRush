import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  AVATAR_INTEGRATED_OPTIONS, AVATAR_BODIES, AVATAR_CHEEKS, AVATAR_EYES, AVATAR_FACES, AVATAR_HEADS, AVATAR_MOUTHS, AVATAR_NECKS, AVATAR_NOSES,
  avatarColor, avatarLayout, defaultAvatar, validateAvatar, type AvatarConfig,
} from '@wordle-duel/core';
import { ART_SIZE } from './art';

// The fit-check combinations (every body × hat × neck item, plus every face part on every
// body) must render ALL their layers: each layer's art ships in public/art with its size
// in ART_SIZE (iOS AvatarArtCoverageTests + Android AvatarArtCoverageTest check the same
// against the asset catalog / drawable-nodpi). A missing file would draw a body with a hole.

const webp = (name: string) => path.join(__dirname, '..', 'public', 'art', `${name}.webp`);
const BASE: AvatarConfig = { ...defaultAvatar('coverage'), color: 'violet', patternColor: 'violet', pattern: 'solid' };

function combos(): AvatarConfig[] {
  const out: AvatarConfig[] = [];
  for (const body of AVATAR_BODIES) {
    for (const head of AVATAR_HEADS) for (const neck of AVATAR_NECKS) out.push({ ...BASE, body, head, neck });
    for (const eyes of AVATAR_EYES) out.push({ ...BASE, body, eyes });
    for (const mouth of AVATAR_MOUTHS) out.push({ ...BASE, body, mouth });
    for (const nose of AVATAR_NOSES) out.push({ ...BASE, body, nose });
    for (const cheeks of AVATAR_CHEEKS) out.push({ ...BASE, body, cheeks });
    for (const face of AVATAR_FACES) out.push({ ...BASE, body, face });
    // 10-05 integrated parts: every option on every body (per-body layer art), alone and with a hat + neck item
    for (const [field, ids] of Object.entries(AVATAR_INTEGRATED_OPTIONS)) {
      for (const id of ids) {
        out.push({ ...BASE, body, [field]: id });
        out.push({ ...BASE, body, head: 'party', neck: 'backpack', [field]: id });
      }
    }
  }
  return out;
}

describe('avatar art coverage (fit-check combinations)', () => {
  it('every layer of every combination ships, small and large', () => {
    const missing = new Set<string>();
    let layers = 0;
    const all = combos();
    for (const c of all) {
      for (const small of [false, true]) {
        const L = avatarLayout(c, { small });
        expect(L.layers[0]?.layer === 'body' || L.layers.some((l) => l.layer === 'body')).toBe(true);
        for (const l of L.layers) {
          layers++;
          if (!(l.art in ART_SIZE) || !fs.existsSync(webp(l.art))) missing.add(l.art);
        }
      }
    }
    expect(all.length).toBeGreaterThan(4800);
    expect(layers).toBeGreaterThan(20000);
    expect([...missing]).toEqual([]);
  });

  it('unknown part + color ids fall back to shipped art (and the old nose → cheeks migration)', () => {
    const raw = {
      v: 1, body: 'blobfish', color: 'plasma', pattern: 'tartan', patternColor: 'plasma', eyes: 'laser', nose: 'freckles',
      mouth: 'fangs', head: 'jetpack', face: 'visor', neck: 'tail', frame: 'none', accColor: 'chrome',
    };
    const c = validateAvatar(raw);
    expect(c.cheeks).toBe('freckles');
    expect(c.nose).toBe('none');
    expect(avatarColor(c.color).hex).toMatch(/^#[0-9a-f]{6}$/i);
    for (const small of [false, true]) {
      for (const l of avatarLayout(c, { small }).layers) expect(fs.existsSync(webp(l.art)), l.art).toBe(true);
    }
  });
});
