import { describe, expect, it } from 'vitest';
import { AVATAR_BACKDROPS, AVATAR_FACES, AVATAR_HEADS, AVATAR_NECKS, AVATAR_BODIES, AVATAR_COLORS, castPreset, defaultAvatar, enforceAvatarPro, nearestAvatarColor, validateAvatar } from './avatar-config';
import parts from './avatar-parts.json';

describe('avatar config (FINISH_SPEC AN3)', () => {
  it('has the spec catalog sizes', () => {
    expect(AVATAR_BODIES).toHaveLength(6);
    expect(AVATAR_COLORS).toHaveLength(16);
    expect(AVATAR_HEADS.filter((h) => h !== 'none')).toHaveLength(21);
    expect([...AVATAR_FACES, ...AVATAR_NECKS].filter((x) => x !== 'none')).toHaveLength(8);
    expect(AVATAR_BACKDROPS).toHaveLength(18);
  });
  it('gives every player a deterministic friendly default in their accent', () => {
    const a = defaultAvatar('3f6c-user', '#ec4899');
    expect(defaultAvatar('3f6c-user', '#ec4899')).toEqual(a);
    expect(a.color).toBe('pink');
    expect(a).toMatchObject({ v: 1, pattern: 'solid', nose: 'none', head: 'none', face: 'none', neck: 'none', frame: 'none' });
    expect(['beady', 'happy', 'sparkly', 'wink']).toContain(a.eyes);
    expect(defaultAvatar('', null).color).toBe('purple');
    expect(a.display).toBe('mascot');
    expect(defaultAvatar('3f6c-user', '#ec4899', true).display).toBe('photo');
  });
  it('falls back field by field for unknown ids', () => {
    const fb = defaultAvatar('x', '#2563eb');
    const v = validateAvatar({ body: 'tall', color: 'neon', eyes: 'laser', head: 'wizard', frame: 'gold' }, fb);
    expect(v).toMatchObject({ body: 'tall', color: fb.color, eyes: fb.eyes, head: 'wizard', frame: 'gold', patternColor: fb.color });
    expect(validateAvatar(null, fb)).toEqual(fb);
    expect(validateAvatar({ bg: 'sunset' }, fb).bg).toBe('sunset');
    expect(validateAvatar({ bg: 'lava' }, fb).bg).toBe('auto');
    expect(validateAvatar({ display: 'mascot' }, defaultAvatar('x', null, true)).display).toBe('mascot');
    expect(validateAvatar({ display: 'selfie' }, defaultAvatar('x', null, true)).display).toBe('photo');
    expect(validateAvatar({}, defaultAvatar('x', null, false)).display).toBe('mascot');
    expect(validateAvatar([1, 2], fb)).toEqual(fb);
  });
  it('strips Pro-only picks for free players', () => {
    const c = { ...defaultAvatar('x'), head: 'crown' as const, frame: 'diamond' as const, neck: 'wings' as const, bg: 'galaxy' };
    expect(enforceAvatarPro(c, false)).toMatchObject({ head: 'none', frame: 'none', neck: 'none', bg: 'auto' });
    expect(enforceAvatarPro(c, true)).toMatchObject({ head: 'crown', frame: 'diamond' });
  });
  it('maps accents and cast presets to swatches', () => {
    expect(nearestAvatarColor('#7c3aed')).toBe('purple');
    expect(nearestAvatarColor('bogus')).toBe('purple');
    expect(castPreset('w').color).toBe('purple');
    expect(castPreset('s').color).toBe('red');
  });
  it('ships a manifest with anchors for every body', () => {
    for (const b of AVATAR_BODIES) expect((parts.bodies as Record<string, unknown>)[b], b).toBeDefined();
  });
});
