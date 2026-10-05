import { describe, expect, it } from 'vitest';
import {
  AVATAR_BODIES, AVATAR_CHEEKS, AVATAR_EYES, AVATAR_FACES, AVATAR_HEADS, AVATAR_MOUTHS, AVATAR_NECKS, AVATAR_NOSES,
  AVATAR_BUNDLES, AVATAR_INTEGRATED_OPTIONS, castPreset, validateAvatar, type AvatarConfig,
} from './avatar-config';
import { AVATAR_MANIFEST, HAT_EYE_CLEARANCE, applyAvatarPick, avatarLayout, avatarPickConflict, avatarPatternShapes } from './avatar-layout';

// The automated fit proof (founder 10-03): every body × every hat × every neck/back item, plus sampled face
// combos, composes inside the padded frame without shrinking below the minimum, face parts stay in the
// body's face box, and hats sit on the head by their intended overlap. docs/design/brand/avatar/fit-check.py
// renders the worst cases of the same layout for review.

const base = castPreset('w');
const mk = (o: Partial<AvatarConfig>) => validateAvatar({ ...base, ...o }, base);
const { pad, minBody } = AVATAR_MANIFEST.fit;
const EPS = 1e-3;

function checkFrame(c: AvatarConfig, small = false) {
  const L = avatarLayout(c, { small });
  const b = L.bounds;
  expect(b.x, JSON.stringify(c)).toBeGreaterThanOrEqual(pad - EPS);
  expect(b.y).toBeGreaterThanOrEqual(pad - EPS);
  expect(b.x + b.w).toBeLessThanOrEqual(1 - pad + EPS);
  expect(b.y + b.h).toBeLessThanOrEqual(1 - pad + EPS);
  expect(L.scale, `${c.body}/${c.head}/${c.neck} shrinks too far`).toBeGreaterThanOrEqual(minBody);
  for (const l of L.layers) {
    if (l.layer === 'body') continue;   // the body CANVAS square has transparent margins; its content is in bounds
    expect(l.rect.x).toBeGreaterThanOrEqual(pad - EPS);
    expect(l.rect.x + l.rect.w).toBeLessThanOrEqual(1 - pad + EPS);
  }
  return L;
}

describe('avatar fit system', () => {
  it('fits every body × hat × neck/back item inside the padded frame', () => {
    let n = 0;
    for (const body of AVATAR_BODIES) for (const head of AVATAR_HEADS) for (const neck of AVATAR_NECKS) {
      checkFrame(mk({ body, head, neck }));
      n++;
    }
    expect(n).toBe(AVATAR_BODIES.length * AVATAR_HEADS.length * AVATAR_NECKS.length);
  });

  it('keeps face parts inside each body face box (sampled face combos)', () => {
    for (const body of AVATAR_BODIES) {
      const a = AVATAR_MANIFEST.bodies[body];
      const combos: Partial<AvatarConfig>[] = [];
      for (const eyes of AVATAR_EYES) for (const face of AVATAR_FACES) combos.push({ eyes, face });
      for (const mouth of AVATAR_MOUTHS) for (const nose of AVATAR_NOSES) combos.push({ mouth, nose });
      for (const cheeks of AVATAR_CHEEKS) for (const face of AVATAR_FACES) combos.push({ cheeks, face });
      for (const o of combos) {
        const L = checkFrame(mk({ body, ...o }));
        const s = L.scale, ox = L.body.x;
        const left = ox + (a.face.x - a.face.w / 2) * s, right = ox + (a.face.x + a.face.w / 2) * s;
        for (const l of L.layers) {
          if (!['eyes', 'nose', 'mouth', 'cheeks', 'face'].includes(l.layer)) continue;
          expect(l.rect.x, `${body} ${l.field}=${l.id}`).toBeGreaterThanOrEqual(left - 0.02 * s);
          expect(l.rect.x + l.rect.w, `${body} ${l.field}=${l.id}`).toBeLessThanOrEqual(right + 0.02 * s);
        }
      }
    }
  });

  it('seats hats on the head by their overlap (or just above the eyes)', () => {
    for (const body of AVATAR_BODIES) for (const head of AVATAR_HEADS) {
      if (head === 'none') continue;
      for (const eyes of ['beady', 'glasses'] as const) {
        const L = avatarLayout(mk({ body, head, eyes }));
        const meta = AVATAR_MANIFEST.items[`acc:${head}`];
        const hat = L.layers.find((l) => l.layer === 'head')!;
        const eye = L.layers.find((l) => l.layer === 'eyes')!;
        const headY = L.body.y + AVATAR_MANIFEST.bodies[body].headTop.y * L.scale;
        const intended = (meta.overlap ?? 0) * hat.rect.h;
        const actual = hat.rect.y + hat.rect.h - headY;
        if (Math.abs(actual - intended) > EPS) {
          // raised to clear the eyes: its bottom sits exactly the clearance above them
          expect(meta.overFace).toBeFalsy();
          expect(hat.rect.y + hat.rect.h, `${body} ${head}`).toBeCloseTo(eye.rect.y - HAT_EYE_CLEARANCE * L.scale, 2);
        }
        if (!meta.overFace) expect(hat.rect.y + hat.rect.h, `${body} ${head} covers the eyes`).toBeLessThanOrEqual(eye.rect.y + EPS);
      }
    }
  });

  it('small avatars keep only the body, face basics and the hat', () => {
    const L = avatarLayout(mk({ head: 'crown', neck: 'wings', face: 'mask', cheeks: 'blush' }), { small: true });
    expect(L.layers.map((l) => l.layer)).toEqual(['body', 'eyes', 'mouth', 'head']);
  });

  it('swaps out conflicting picks', () => {
    expect(avatarPickConflict(mk({ eyes: 'glasses' }), 'face', 'mask')).toEqual({ field: 'eyes', id: 'glasses' });
    expect(applyAvatarPick(mk({ eyes: 'glasses' }), 'face', 'mask')).toMatchObject({ face: 'mask', eyes: 'beady' });
    expect(applyAvatarPick(mk({ cheeks: 'blush' }), 'face', 'facepaint')).toMatchObject({ face: 'facepaint', cheeks: 'none' });
    expect(avatarPickConflict(mk({}), 'face', 'mask')).toBeNull();
    // a conflicting stored config draws the higher-priority part only
    const L = avatarLayout(mk({ eyes: 'sunglasses', face: 'heart-glasses' }));
    expect(L.layers.some((l) => l.field === 'face')).toBe(false);
  });

  it('draws back items behind the body and front neck items over it', () => {
    const L = avatarLayout(mk({ neck: 'wings', head: 'crown' }));
    expect(L.layers[0].layer).toBe('back');
    expect(L.layers[1].layer).toBe('body');
    const F = avatarLayout(mk({ neck: 'medal' }));
    expect(F.layers[F.layers.length - 1].layer).toBe('neckFront');
  });

  it('has a manifest entry + pattern for every option', () => {
    for (const id of AVATAR_EYES) expect(AVATAR_MANIFEST.items[`eyes:${id}`], id).toBeDefined();
    for (const id of AVATAR_MOUTHS) expect(AVATAR_MANIFEST.items[`mouth:${id}`], id).toBeDefined();
    for (const id of AVATAR_NOSES.filter((x) => x !== 'none')) expect(AVATAR_MANIFEST.items[`nose:${id}`], id).toBeDefined();
    for (const id of AVATAR_CHEEKS.filter((x) => x !== 'none')) expect(AVATAR_MANIFEST.items[`cheeks:${id}`], id).toBeDefined();
    for (const id of [...AVATAR_HEADS, ...AVATAR_FACES, ...AVATAR_NECKS].filter((x) => x !== 'none')) expect(AVATAR_MANIFEST.items[`acc:${id}`], id).toBeDefined();
    for (const b of AVATAR_BODIES) expect(AVATAR_MANIFEST.bodies[b], b).toBeDefined();
    expect(avatarPatternShapes('solid')).toEqual([]);
    for (const p of ['hearts', 'stars', 'zigzag', 'checkers', 'tiedye', 'leopard', 'galaxy', 'colorblock']) expect(avatarPatternShapes(p).length, p).toBeGreaterThan(0);
  });
});

// 10-05 integrated parts (docs/design/brand/avatar/INTEGRATION.md): drawn per body from baked layer art, never as a
// sticker; every option fits the frame on every body; the letter sits on the 'under' garments.
describe('integrated parts (v3 pieces)', () => {
  const OPTIONS: Record<string, readonly string[]> = AVATAR_INTEGRATED_OPTIONS;
  it('every integrated option on every body: per-body pieces only, inside the frame', () => {
    expect(AVATAR_MANIFEST.version).toBe(3);
    for (const body of AVATAR_BODIES) {
      for (const [field, ids] of Object.entries(OPTIONS)) {
        for (const id of ids.slice(1)) {
          const c = mk({ body, [field]: id } as Partial<AvatarConfig>);
          const L = checkFrame(c);
          const mine = L.layers.filter((l) => l.field === field);
          expect(mine.length, `${body} ${field}:${id}`).toBeGreaterThan(0);
          for (const l of mine) expect(l.art).toBe(`art-av-${field === 'brows' ? 'brows' : 'acc'}-${id}-${body}-${l.layer}`);
          // small avatars keep only the body, face and hat
          expect(avatarLayout(c, { small: true }).layers.some((l) => l.field === field)).toBe(false);
        }
      }
    }
  });

  it('the 7 rebuilt parts keep their ids and draw per body (the chain withheld where there is no neck room)', () => {
    for (const id of ['backpack', 'chain', 'bubbletea', 'guitar', 'cape', 'supercape']) {
      expect(AVATAR_MANIFEST.items[`acc:${id}`].pieces).toBeTruthy();
      expect(validateAvatar({ neck: id }).neck).toBe(id);
    }
    const pack = avatarLayout(mk({ body: 'classic', neck: 'backpack', accColor: 'orange' })).layers.filter((l) => l.id === 'backpack');
    expect(pack.map((l) => l.layer)).toEqual(['back', 'wrap']);
    expect(pack.every((l) => l.tint)).toBe(true);
    for (const body of ['wide', 'mini']) expect(avatarLayout(mk({ body, neck: 'chain' })).layers.some((l) => l.id === 'chain')).toBe(false);
  });

  it('the letter is drawn after the under garments and before every front layer', () => {
    const L = avatarLayout(mk({ body: 'tall', wrap: 'apron', held: 'spatula' }));
    const names = L.layers.map((l) => l.layer);
    expect(names.slice(0, L.letterIndex)).toEqual(['body', 'under']);
    expect(names.slice(L.letterIndex)).toContain('wrap');
    expect(avatarLayout(mk({})).letterIndex).toBe(1);
  });

  it('brows clear taller eyes (never lower than over the default eyes)', () => {
    const top = (eyes: string) => avatarLayout(mk({ body: 'classic', eyes: eyes as AvatarConfig['eyes'], brows: 'happy' })).layers.find((l) => l.layer === 'brows')!.rect.y;
    for (const eyes of AVATAR_EYES) expect(top(eyes)).toBeLessThanOrEqual(top('beady') + 1e-3);
  });

  it('held items swap out a held guitar / bubble tea; a drape cape swaps out back parts', () => {
    expect(avatarPickConflict(mk({ neck: 'guitar' }), 'held', 'mug')).toEqual({ field: 'neck', id: 'guitar' });
    expect(applyAvatarPick(mk({ neck: 'backpack' }), 'wrap', 'cape-drape').neck).toBe('none');
    expect(applyAvatarPick(mk({ neck: 'scarf' }), 'wrap', 'lei').neck).toBe('none');
  });

  it('old configs (no integrated fields) validate to none and lay out unchanged', () => {
    const c = validateAvatar({ body: 'blob', eyes: 'happy', mouth: 'grin', neck: 'bowtie' });
    for (const f of ['held', 'wrap', 'feet', 'pet', 'brows', 'extra'] as const) expect(c[f] ?? 'none').toBe('none');
    expect(Object.keys(c)).not.toContain('held');
    expect(validateAvatar({ wrap: 'tie' }).wrap ?? 'none').toBe('none');
    expect(validateAvatar({ wrap: 'sash' }).wrap ?? 'none').toBe('none');
  });

  it('bundles only pick shipped options', () => {
    for (const b of AVATAR_BUNDLES) {
      for (const [field, id] of Object.entries(b.picks)) {
        const c = validateAvatar({ [field]: id });
        expect((c as unknown as Record<string, string>)[field], `${b.id} ${field}`).toBe(id);
      }
    }
  });
});
