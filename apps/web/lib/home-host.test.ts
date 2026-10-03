import { beforeEach, describe, expect, it } from 'vitest';
import { castPreset, defaultAvatar, levelTier } from '@wordle-duel/core';
import { resolveRowAvatar } from './avatar-cast';
import { portraitFrame } from './avatar-render';
import { BANNER_SLOT } from './stationary-layout';
import {
  HOME_HOST_PORTRAIT, HOME_HOST_SIZE, __resetHomeHostWaveForTests, homeHostChoice, homeHostHidden, takeHomeHostWave,
} from './home-host';

const UPLOADED = 'https://x.supabase.co/storage/v1/object/public/avatars/b/avatar.jpg?t=1';
const OAUTH = 'https://lh3.googleusercontent.com/a/x=s96-c';
const cfg = { v: 1, body: 'star', color: 'mint', eyes: 'happy', neck: 'scarf' };

describe('BJ6 Home host choice', () => {
  it('a guest gets W', () => {
    expect(homeHostChoice(null)).toEqual({ kind: 'w' });
  });

  it('a photo (founder BMT: uploaded, display photo) stands whole as a portrait', () => {
    const r = resolveRowAvatar({ avatar_url: UPLOADED, avatar_config: { ...cfg, display: 'photo' } }, 'BMT');
    expect(homeHostChoice(r)).toMatchObject({ kind: 'photo', photoUrl: UPLOADED });
    // An uploaded photo with no saved config is a portrait too.
    expect(homeHostChoice(resolveRowAvatar({ avatar_url: UPLOADED }, 'x')).kind).toBe('photo');
  });

  it('a saved mascot or a worn cast hero → the full mascot (never the photo)', () => {
    const saved = homeHostChoice(resolveRowAvatar({ avatar_url: UPLOADED, avatar_config: { ...cfg, display: 'mascot' } }, 'BMT'));
    expect(saved.kind).toBe('mascot');
    expect(saved.kind === 'mascot' && saved.config.display).toBe('mascot');
    const cast = homeHostChoice(resolveRowAvatar({ avatar_cast_id: 'r' }, 'x'));
    expect(cast).toEqual({ kind: 'mascot', config: { ...castPreset('r'), display: 'mascot' } });
  });

  it('the seeded default and an OAuth picture with no saved config keep W', () => {
    expect(homeHostChoice(resolveRowAvatar({}, 'zed')).kind).toBe('w');
    expect(homeHostChoice(resolveRowAvatar({ avatar_url: OAUTH }, 'Ukrainian Cyclone')).kind).toBe('w');
  });

  it('during the celebration art W steps out; the player’s own host stays', () => {
    expect(homeHostHidden({ kind: 'w' }, true)).toBe(true);
    expect(homeHostHidden({ kind: 'w' }, false)).toBe(false);
    expect(homeHostHidden({ kind: 'mascot', config: defaultAvatar('x') }, true)).toBe(false);
    expect(homeHostHidden({ kind: 'photo', photoUrl: UPLOADED, config: defaultAvatar('x') }, true)).toBe(false);
  });

  it('is the 88 px symmetric hero (round 3, iOS parity); the portrait is ~86% of the box', () => {
    expect(HOME_HOST_SIZE).toBe(88);
    expect(HOME_HOST_PORTRAIT).toBe(76);
    expect(HOME_HOST_SIZE).toBe(BANNER_SLOT.hostSize);
    // Its top 28 above the card's top edge, 60 inside it; the headline starts 4 under its feet.
    expect(BANNER_SLOT.hostRise + BANNER_SLOT.hostInset).toBe(BANNER_SLOT.hostSize);
    // Home moves down only 16 over BH3's 6 headroom; the rest overhangs the header's bottom edge.
    expect(BANNER_SLOT.headroom).toBe(6 + 16);
    expect(BANNER_SLOT.headroom + BANNER_SLOT.hostOverhang).toBe(BANNER_SLOT.hostRise);
    expect(BANNER_SLOT.cap + BANNER_SLOT.stripTopHost).toBe(BANNER_SLOT.hostInset + BANNER_SLOT.hostToHeadline);
  });

  describe('wave once per launch', () => {
    beforeEach(() => __resetHomeHostWaveForTests());
    it('only the first ask waves', () => {
      expect(takeHomeHostWave()).toBe(true);
      expect(takeHomeHostWave()).toBe(false);
      expect(takeHomeHostWave()).toBe(false);
    });
  });
});

describe('BJ6 photo rule: portrait frame fallback', () => {
  it('the chosen frame wins', () => {
    expect(portraitFrame('silver', { level: 40 })).toBe('silver');
    expect(portraitFrame('pro', { pro: true })).toBe('pro');
  });

  it('no chosen frame → the level tier frame when the level is known', () => {
    expect(portraitFrame('none', { level: 1 })).toBe(levelTier(1));
    expect(portraitFrame('none', { level: 60 })).toBe(levelTier(60));
    expect(portraitFrame('none', { level: 60 })).not.toBe('none');
  });

  it('no chosen frame and no level → none; a Pro player with none wears the Pro gold frame', () => {
    expect(portraitFrame('none')).toBe('none');
    expect(portraitFrame('none', { pro: true, level: 5 })).toBe('pro');
  });

  it('a chosen tier frame above the level steps down (same clamp as every avatar)', () => {
    expect(portraitFrame('diamond', { pro: true, level: 1 })).toBe('diamond');
    expect(portraitFrame('platinum', { level: 1 })).toBe(levelTier(1));
  });
});

describe('BJ6 round 3: the host always has a box (the missing-host fix)', () => {
  it('renders as a block box so the banner’s absolute (non-flex) slot can size it', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(__dirname, '../components/home/home-host.tsx'), 'utf8');
    expect(src).toContain('className="relative block shrink-0');
    // Never an empty host: W's art failing falls back to the code-drawn W mascot.
    expect(src).toContain('onError={() => setWArtFailed(true)}');
    expect(src).toContain("castPreset('w')");
  });

  it('W hides only on a day that HAS celebration art', () => {
    expect(homeHostHidden({ kind: 'w' }, false)).toBe(false);
  });
});
