import { describe, expect, it } from 'vitest';
import {
  AVATAR_BACKDROP_IDS, AVATAR_BODIES, AVATAR_EYES, AVATAR_FACES, AVATAR_FRAMES, AVATAR_HEADS, AVATAR_MOUTHS, AVATAR_NECKS,
  AVATAR_NOSES, AVATAR_PATTERNS, AVATAR_PRO_ONLY, defaultAvatar, type AvatarConfig,
} from '@wordle-duel/core';
import {
  AVATAR_PARTS, AVATAR_RADIUS, BODY_BOX, BUILDER_TABS, MASCOT_ID_TOKEN, SMALL_AVATAR_MAX, avatarArtNames, avatarArtPending,
  avatarConfigKey, avatarCrowned, avatarGeometry, avatarInitial, avatarLayers, avatarOptionIds, avatarOptionLabel,
  avatarProOnly, avatarRadiusPx, bodyAnchors, bodyPath, cachedMascotSvg, clampAvatarSize, effectiveAvatarFrame,
  frameLevelLocked, isDarkBackdrop, mascotSvg, randomAvatar, withAvatarId, type BuilderField,
} from './avatar-render';

const base: AvatarConfig = { ...defaultAvatar('player-1', '#7c3aed'), body: 'classic' };
const svg = (c: Partial<AvatarConfig>, size = 64, extra: Partial<Parameters<typeof mascotSvg>[0]> = {}) =>
  mascotSvg({ config: { ...base, ...c }, initial: 'B', size, crownSrc: '/art/art-badge-pro-crown-sprite.webp', artSrc: (n) => `/art/${n}.webp`, ...extra });

describe('geometry from the manifest anchors (AN2)', () => {
  it('places every part from its body anchors', () => {
    for (const body of AVATAR_BODIES) {
      const box = BODY_BOX[body];
      const a = bodyAnchors(body);
      const g = avatarGeometry({ body, neck: 'none' });
      expect(g.box).toEqual(box);
      expect(g.eyes.y).toBeCloseTo(box.y + a.eyeY * box.h, 6);
      expect(g.mouth.y).toBeCloseTo(box.y + a.mouthY * box.h, 6);
      expect(g.nose.y).toBeCloseTo(box.y + a.cheekY * box.h, 6);
      expect(g.eyes.x).toBeCloseTo(box.x + a.faceCenter[0] * box.w, 6);
      expect(g.head.y).toBeCloseTo(box.y + a.headTop.y * box.h, 6);
      expect(g.head.w).toBeCloseTo(a.headTop.w * box.w * AVATAR_PARTS.parts.head.scale, 6);
      expect(g.eyes.w).toBeCloseTo(AVATAR_PARTS.parts.eyes.scale * box.w, 6);
      // The letter box maps from letterBox and the letter fits inside it.
      expect(g.letter.box.x).toBeCloseTo(box.x + a.letterBox[0] * box.w, 6);
      expect(g.letter.box.w).toBeCloseTo(a.letterBox[2] * box.w, 6);
      expect(g.letter.fontSize * 0.74).toBeLessThanOrEqual(g.letter.box.h + 1e-6);
      expect(g.letter.baseline).toBeLessThanOrEqual(g.letter.box.y + g.letter.box.h + 1e-6);
      // Everything stays inside the 100-unit tile, feet + shadow included.
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(100);
      expect(box.y + box.h + 7).toBeLessThanOrEqual(100);
    }
  });

  it('steps the letter down under a bow tie / scarf / chain (not at small sizes)', () => {
    const plain = avatarGeometry({ body: 'classic', neck: 'none' });
    for (const neck of ['bowtie', 'scarf', 'chain'] as const) {
      expect(avatarGeometry({ body: 'classic', neck }).letter.box.y).toBeGreaterThan(plain.letter.box.y);
      expect(avatarGeometry({ body: 'classic', neck }, { small: true }).letter.box.y).toBe(plain.letter.box.y);
    }
  });

  it('draws a closed outline for every body', () => {
    for (const body of AVATAR_BODIES) {
      const d = bodyPath(body);
      expect(d.startsWith('M')).toBe(true);
      expect(d.trim().endsWith('Z')).toBe(true);
      expect(d).not.toMatch(/NaN|undefined/);
    }
  });

  it('keeps the placeholder manifest from probing for art', () => {
    expect(avatarArtPending({ ...AVATAR_PARTS, placeholder: true })).toBe(true);
    expect(avatarArtPending({ ...AVATAR_PARTS, placeholder: false })).toBe(false);
  });
});

describe('layers (AN1 order, AN5 small sizes)', () => {
  const dressed: AvatarConfig = { ...base, pattern: 'stripes', nose: 'freckles', head: 'party', face: 'mustache', neck: 'cape', frame: 'gold' };

  it('stacks back → front', () => {
    expect(avatarLayers(dressed, 64)).toEqual([
      'frameBack', 'stage', 'neckBack', 'body', 'pattern', 'gloss', 'letter', 'nose', 'eyes', 'mouth', 'face', 'head', 'frameFront',
    ]);
    expect(avatarLayers({ ...dressed, neck: 'bowtie' }, 64)).toContain('neckFront');
  });

  it(`drops the pattern and every accessory except hats at ≤ ${SMALL_AVATAR_MAX} px`, () => {
    const small = avatarLayers(dressed, SMALL_AVATAR_MAX);
    expect(small).not.toContain('pattern');
    expect(small).not.toContain('face');
    expect(small).not.toContain('neckBack');
    expect(small).not.toContain('nose'); // freckles vanish at that size
    expect(small).toContain('head');
    expect(small).toContain('letter');
    expect(avatarLayers(dressed, SMALL_AVATAR_MAX + 1)).toContain('pattern');
    expect(avatarLayers({ ...dressed, nose: 'red' }, 20)).toContain('nose');
  });

  it('draws no frame layers without a frame', () => {
    const l = avatarLayers({ ...dressed, frame: 'none' }, 64);
    expect(l).not.toContain('frameBack');
    expect(l).not.toContain('frameFront');
    expect(l[0]).toBe('stage');
  });

  it('reflects the layer set in the markup', () => {
    expect(svg({ pattern: 'dots' }, 64)).toContain('-pg)');
    expect(svg({ pattern: 'dots' }, 24)).not.toContain('-pg)');
    expect(svg({ neck: 'cape' }, 64)).toContain('-cape)');
    expect(svg({ neck: 'cape' }, 24)).not.toContain('-cape)');
    expect(svg({ head: 'crown' }, 20)).toContain('art-badge-pro-crown-sprite');
  });
});

describe('frames (AN6) and the crown (AA2)', () => {
  it('upgrades a Pro player with no frame to the Pro gold frame and strips Pro frames from free players', () => {
    expect(effectiveAvatarFrame('none', { pro: true })).toBe('pro');
    expect(effectiveAvatarFrame('silver', { pro: true })).toBe('silver');
    expect(effectiveAvatarFrame('pro', { pro: false })).toBe('none');
    expect(effectiveAvatarFrame('diamond', { pro: false })).toBe('none');
    expect(effectiveAvatarFrame('pro', {})).toBe('pro');
  });

  it('clamps a tier frame to a known level', () => {
    expect(effectiveAvatarFrame('platinum', { level: 12 })).toBe('silver');
    expect(effectiveAvatarFrame('gold', { level: 30 })).toBe('gold');
    expect(effectiveAvatarFrame('gold', {})).toBe('gold');
    expect(effectiveAvatarFrame('diamond', { level: 3 })).toBe('diamond'); // Pro-gated, not level-gated
    expect(frameLevelLocked('gold', 25)).toBe(true);
    expect(frameLevelLocked('gold', 26)).toBe(false);
    expect(frameLevelLocked('diamond', 1)).toBe(false);
  });

  it('crowns Pro players and the Pro frame', () => {
    expect(avatarCrowned('none', true)).toBe(true);
    expect(avatarCrowned('pro', null)).toBe(true);
    expect(avatarCrowned('pro', false)).toBe(false);
    expect(avatarCrowned('gold', null)).toBe(false);
  });

  it('is a rounded square (≈22%), never a circle', () => {
    expect(AVATAR_RADIUS).toBeCloseTo(0.22, 5);
    expect(avatarRadiusPx(100)).toBe(22);
    expect(svg({ frame: 'gold' })).toContain('rx="22"');
  });
});

describe('the body letter = the initial', () => {
  it('takes the first letter or digit, uppercased', () => {
    expect(avatarInitial('brian')).toBe('B');
    expect(avatarInitial('  _zed')).toBe('Z');
    expect(avatarInitial('9lives')).toBe('9');
    expect(avatarInitial('élan')).toBe('É');
    expect(avatarInitial('')).toBe('?');
    expect(avatarInitial(null)).toBe('?');
    expect(avatarInitial('__')).toBe('?');
  });

  it('draws it white (with its emboss shadow) and escapes it', () => {
    const out = svg({});
    expect(out).toMatch(/fill="#ffffff"[^>]*>B<\/text>/);
    expect(mascotSvg({ config: base, initial: '<', size: 64, crownSrc: '', artSrc: (n) => n })).toContain('&lt;</text>');
  });
});

describe('every option draws', () => {
  it('renders each part, backdrop and frame without broken numbers', () => {
    const variants: Array<Partial<AvatarConfig>> = [
      ...AVATAR_BODIES.map((body) => ({ body })),
      ...AVATAR_PATTERNS.map((pattern) => ({ pattern })),
      ...AVATAR_EYES.map((eyes) => ({ eyes })),
      ...AVATAR_NOSES.map((nose) => ({ nose })),
      ...AVATAR_MOUTHS.map((mouth) => ({ mouth })),
      ...AVATAR_HEADS.map((head) => ({ head })),
      ...AVATAR_FACES.map((face) => ({ face })),
      ...AVATAR_NECKS.map((neck) => ({ neck })),
      ...AVATAR_BACKDROP_IDS.map((bg) => ({ bg })),
      ...AVATAR_FRAMES.map((frame) => ({ frame })),
    ];
    for (const v of variants) {
      for (const size of [16, 40, 200]) {
        const out = svg(v, size);
        expect(out.startsWith('<svg')).toBe(true);
        expect(out).not.toMatch(/NaN|undefined|Infinity/);
        expect(out.split('<svg').length).toBe(2);
      }
    }
  });

  it('draws the backdrop behind the mascot', () => {
    expect(svg({ bg: 'night' })).toContain('#1e1b4b');
    expect(svg({ bg: 'checkers' })).toContain('-stc)');
    expect(svg({ bg: 'aurora' })).toContain('#34d399');
    expect(isDarkBackdrop('night')).toBe(true);
    expect(isDarkBackdrop('lemon')).toBe(false);
    expect(isDarkBackdrop('auto')).toBe(false);
  });
});

describe('art swap + caching', () => {
  it('draws a loaded body from art (tinted, pattern masked to its alpha)', () => {
    const art = new Set(['art-av-body-classic', 'art-av-eyes-happy']);
    const out = svg({ pattern: 'stripes', eyes: 'happy' }, 64, { art });
    expect(out).toContain('/art/art-av-body-classic.webp');
    expect(out).toContain(`url(#${MASCOT_ID_TOKEN}-tint)`);
    expect(out).toContain(`mask="url(#${MASCOT_ID_TOKEN}-mask)"`);
    expect(out).toContain('/art/art-av-eyes-happy.webp');
    expect(svg({ pattern: 'stripes' }, 64)).not.toContain('art-av-body');
  });

  it('lists the art a config would use', () => {
    expect(avatarArtNames({ ...base, nose: 'none', head: 'none', face: 'none', neck: 'none' })).toEqual([
      'art-av-body-classic', `art-av-eyes-${base.eyes}`, `art-av-mouth-${base.mouth}`,
    ]);
    expect(avatarArtNames({ ...base, nose: 'red', head: 'party', face: 'monocle', neck: 'wings' })).toContain('art-av-acc-wings');
  });

  it('memoizes per config + size class and swaps in a unique id', () => {
    const input = { config: { ...base, pattern: 'stripes' as const }, initial: 'B', size: 40, crownSrc: '', artSrc: (n: string) => n };
    const a = cachedMascotSvg(input);
    expect(cachedMascotSvg({ ...input, size: 60 })).toBe(a); // same size class
    expect(cachedMascotSvg({ ...input, size: 20 })).not.toBe(a);
    const one = withAvatarId(a, 'mA');
    expect(one).not.toContain(MASCOT_ID_TOKEN);
    expect(one).toContain('url(#mA-bg)');
    expect(avatarConfigKey(base)).not.toBe(avatarConfigKey({ ...base, bg: 'night' }));
  });

  it('clamps the size to 16–200', () => {
    expect(clampAvatarSize(4)).toBe(16);
    expect(clampAvatarSize(500)).toBe(200);
    expect(clampAvatarSize(NaN)).toBe(40);
  });
});

describe('builder options (AN4)', () => {
  it('labels every option', () => {
    const fields: BuilderField[] = ['body', 'color', 'pattern', 'patternColor', 'eyes', 'nose', 'mouth', 'head', 'face', 'neck', 'bg', 'frame'];
    for (const f of fields) {
      const ids = avatarOptionIds(f);
      expect(ids.length).toBeGreaterThan(1);
      for (const id of ids) expect(avatarOptionLabel(f, id).trim().length).toBeGreaterThan(1);
    }
    expect(avatarOptionLabel('head', 'tophat')).toBe('Top hat');
    expect(avatarOptionLabel('bg', 'auto')).toBe('Match my color');
    expect(BUILDER_TABS.map((t) => t.label)).toEqual(['Body', 'Color', 'Pattern', 'Eyes', 'Nose', 'Mouth', 'Hats', 'Extras', 'Backdrop', 'Frame']);
  });

  it('marks the Pro-only options from core', () => {
    for (const id of AVATAR_PRO_ONLY.head) expect(avatarProOnly('head', id)).toBe(true);
    for (const id of AVATAR_PRO_ONLY.bg) expect(avatarProOnly('bg', id)).toBe(true);
    expect(avatarProOnly('head', 'party')).toBe(false);
    expect(avatarProOnly('eyes', 'happy')).toBe(false);
  });

  it('randomizes without Pro-only picks for free players, keeping frame + display', () => {
    let seed = 7;
    const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const start: AvatarConfig = { ...base, frame: 'silver', display: 'photo' };
    for (let i = 0; i < 300; i++) {
      const r = randomAvatar(start, rng, { isPro: false });
      expect(r.frame).toBe('silver');
      expect(r.display).toBe('photo');
      expect(avatarProOnly('head', r.head)).toBe(false);
      expect(avatarProOnly('neck', r.neck)).toBe(false);
      expect(avatarProOnly('bg', r.bg)).toBe(false);
      expect(r.patternColor).not.toBe(r.color);
    }
  });
});
