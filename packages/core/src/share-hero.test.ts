import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AVATAR_POSES } from './avatar-pose';
import {
  SHARE_FRAMES, SHARE_HERO_GAP, SHARE_HERO_H, shareHeroBand, shareHeroResultFor, shareHeroResultForRank, shareHeroSpec,
  type ShareHeroResult,
} from './share-hero';

const RESULTS: ShareHeroResult[] = ['win', 'flawless', 'sweep', 'loss', 'neutral', 'rank1', 'rank2', 'rank3', 'ranked'];

describe('share hero (item 46)', () => {
  it('poses by result, crown on a win, gold on a flawless, a good-sport shrug on a loss', () => {
    expect(shareHeroSpec('win', false)).toMatchObject({ pose: 'cheer', crown: true, gold: false });
    expect(shareHeroSpec('flawless', false)).toMatchObject({ pose: 'jump', crown: true, gold: true, glow: '#FCD34D' });
    expect(shareHeroSpec('loss', false)).toMatchObject({ pose: 'shrug', crown: false });
    expect(shareHeroSpec('rank1', false).crown).toBe(true);
    expect(shareHeroSpec('rank2', false).crown).toBe(false);
    expect(shareHeroSpec('neutral', false).pose).toBe('wave');
  });
  it('every pose is a real living-mascot pose; Halloween turns the glow orange (flawless stays gold)', () => {
    for (const r of RESULTS) expect(AVATAR_POSES as readonly string[]).toContain(shareHeroSpec(r, false).pose);
    expect(shareHeroSpec('win', true).glow).toBe('#FB923C');
    expect(shareHeroSpec('flawless', true).glow).toBe('#FCD34D');
  });
  it('maps win flags and ranks', () => {
    expect(shareHeroResultFor(true)).toBe('win');
    expect(shareHeroResultFor(false)).toBe('loss');
    expect(shareHeroResultFor(undefined)).toBe('neutral');
    expect([1, 2, 3, 4, null].map(shareHeroResultForRank)).toEqual(['rank1', 'rank2', 'rank3', 'ranked', 'ranked']);
  });
  it('frames: message keeps the old clamp, story is 9:16, square is 1:1 and has no hero band', () => {
    expect(SHARE_FRAMES.message).toEqual({ minH: 1350, maxH: 1920 });
    expect(SHARE_FRAMES.story.minH).toBe(1920);
    expect(SHARE_FRAMES.square).toEqual({ minH: 1080, maxH: 1080 });
    expect(shareHeroBand('message', true)).toBe(SHARE_HERO_H + SHARE_HERO_GAP);
    expect(shareHeroBand('square', true)).toBe(0);
    expect(shareHeroBand('story', false)).toBe(0);
  });

  it('share-hero-fixtures.json pins the spec (Swift + Kotlin read the same file)', () => {
    const out = {
      _doc: 'share-hero.ts spec per result + season (pose, crown, glow, gold) and the frame limits. Regenerate: UPDATE_SHARE_HERO_FIXTURES=1 vitest run src/share-hero.test.ts. ShareHero.swift + ShareHero.kt tests read this.',
      specs: RESULTS.flatMap((r) => [false, true].map((h) => ({ result: r, halloween: h, ...shareHeroSpec(r, h) }))),
      frames: SHARE_FRAMES,
      hero: { height: SHARE_HERO_H, gap: SHARE_HERO_GAP },
    };
    const text = JSON.stringify(out, null, 2) + '\n';
    const path = join(__dirname, 'share-hero-fixtures.json');
    if (process.env.UPDATE_SHARE_HERO_FIXTURES === '1') writeFileSync(path, text);
    expect(readFileSync(path, 'utf8')).toBe(text);
  });
});
