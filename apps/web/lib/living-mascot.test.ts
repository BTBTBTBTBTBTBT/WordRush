import { describe, expect, it } from 'vitest';
import { AVATAR_LIVE_CONFIG, AVATAR_PICKER_POSES, AVATAR_POSES, avatarLiveFrame, defaultAvatar, type AvatarConfig } from '@wordle-duel/core';
import { avatarArtNames, avatarLiveLayout, avatarLiveTransforms, avatarOptionIds, avatarOptionLabel, cachedMascotSvg, mascotSvg } from './avatar-render';
import { livingMascotOn, claimLivingSlot, emitMascotMoment, livingSlotsInUse } from './living-mascot';

// 10-06 poses + the living mascot (docs/cloud-prompts/06): everything ships behind AVATAR_LIVE_CONFIG.livingMascot.
const base: AvatarConfig = { ...defaultAvatar('player-1', '#7c3aed'), body: 'classic', held: 'mug', feet: 'sneakers' };
const everyArt = (c: AvatarConfig, live = false) => new Set([...avatarArtNames(c, live), ...avatarArtNames(c)]);
const svg = (c: AvatarConfig, extra: Partial<Parameters<typeof mascotSvg>[0]> = {}) =>
  mascotSvg({ config: c, initial: 'B', size: 120, crownSrc: '', artSrc: (n) => `/art/${n}.webp`, art: everyArt(c, true), cutout: true, ...extra });

describe('the living-mascot flag', () => {
  it('ships OFF: no saved pose is drawn and moments are no-ops', () => {
    expect(AVATAR_LIVE_CONFIG.livingMascot).toBe(false);
    expect(livingMascotOn()).toBe(false);
    const posed = { ...base, pose: 'wave' };
    // the default layout ignores the saved pose while the flag is off: byte-identical to no pose
    expect(svg(posed)).toBe(svg(base));
    expect(svg(posed)).not.toContain('data-lm');
    expect(() => emitMascotMoment('win')).not.toThrow();
  });
});

describe('posed + live svg', () => {
  it('draws a pose from the rig layers, each under its part matrix', () => {
    const s = svg({ ...base, pose: 'cheer' }, { pose: 'saved' });
    for (const part of ['base', 'feet', 'armL', 'armR']) expect(s).toContain(`art-av-body-classic-${part}.webp`);
    expect(s).not.toContain('art-av-body-classic.webp');
    expect(s).toMatch(/data-lm="armL" transform="matrix\(/);
    expect(s).toMatch(/data-lm="handR"/);    // the mug rides the viewer's-right hand
    expect(s).toMatch(/data-lm="feet"/);     // the sneakers ride the feet
  });
  it('the live svg marks every group and its first frame is the saved pose at rest', () => {
    const c = { ...base, pose: 'wave' };
    const s = svg(c, { live: true });
    const L = avatarLiveLayout(c, false);
    const tf = avatarLiveTransforms(L, c, { spec: avatarLiveFrame({ pose: 'wave', t: 0, still: true }).spec, eyes: 1, laugh: 0 }, 100, 0);
    expect(Object.keys(tf).sort()).toEqual(['armL', 'armR', 'eyes', 'feet', 'handL', 'handR', 'mouth', 'none', 'root'].sort());
    expect(s).toContain(`data-lm="eyes"`);
    expect(s).toContain(`data-lm="mouth"`);
    expect(s).toContain(`transform="${tf.armL}"`);
  });
  it('the live fit leaves room for reactions (never rescales while it moves)', () => {
    const c = { ...base, pose: 'none' };
    const L = avatarLiveLayout(c, false);
    expect(L.bounds.y).toBeGreaterThanOrEqual(0);
    expect(L.bounds.x + L.bounds.w).toBeLessThanOrEqual(1);
  });
  it('caches live and posed svgs apart from the plain one', () => {
    const c = { ...base, pose: 'wave' };
    const input = { config: c, initial: 'B', size: 120, crownSrc: '', artSrc: (n: string) => `/art/${n}.webp`, art: everyArt(c, true), cutout: true };
    expect(cachedMascotSvg({ ...input, live: true })).not.toBe(cachedMascotSvg(input));
  });
});

describe('the Pose tab options', () => {
  it('offers the picker poses (founder 10-09 trim), labeled', () => {
    expect(avatarOptionIds('pose')).toEqual(AVATAR_PICKER_POSES);
    expect(avatarOptionLabel('pose', 'none')).toBe('Standing');
    expect(avatarOptionLabel('pose', 'hips')).toBe('Hands on hips');
  });
});

describe('the animation budget', () => {
  it('runs at most maxAnimated at once and starts the next when one stops', () => {
    const started: number[] = [];
    const keys = Array.from({ length: AVATAR_LIVE_CONFIG.maxAnimated + 2 }, () => ({}));
    const releases = keys.map((k, i) => claimLivingSlot(k, false, () => started.push(i)));
    expect(livingSlotsInUse()).toBe(AVATAR_LIVE_CONFIG.maxAnimated);
    releases[0]();
    expect(started).toContain(AVATAR_LIVE_CONFIG.maxAnimated);
    for (const r of releases) r();
    expect(livingSlotsInUse()).toBe(0);
  });
});
