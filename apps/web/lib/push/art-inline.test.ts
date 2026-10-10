import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { castPreset } from '@wordle-duel/core';
import { avatarInitial, mascotSvg, withAvatarId } from '@/lib/avatar-render';
import { artSrc, badgeSrc } from '@/lib/art';
import { fallbackMascotPng, inlineLocalImages } from './art-inline';

// Founder 10-10: rich push pictures never showed — the mascot SVG's art is referenced by URL path, which sharp can't
// load. Proves the route's render path turns a real mascot into a PNG with the character's pixels in it.
describe('rich push art inlining', () => {
  it('inlines every local image as a PNG data URI', async () => {
    // Today's server mascots are vector; Pro crowns / art layers reference /art/… paths — those must inline.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><image href="${artSrc('game-crossword')}" width="64" height="64"/><image href="/art/missing-x.webp" width="1" height="1"/></svg>`;
    const inlined = await inlineLocalImages(svg);
    expect(inlined).not.toMatch(/href="\/art\//);
    expect(inlined).toMatch(/href="data:image\/png;base64,/);
    const png = await sharp(Buffer.from(inlined)).png().toBuffer();
    expect(png.length).toBeGreaterThan(200);
  });

  it('renders a mascot PNG with visible character pixels', async () => {
    const svg = withAvatarId(mascotSvg({ config: { ...castPreset('c'), display: 'mascot' }, initial: 'T', size: 256,
      crownSrc: badgeSrc('pro-crown-sprite'), artSrc }), 'push-av').replace('width="100%" height="100%"', 'width="256" height="256"');
    const png = await sharp(Buffer.from(await inlineLocalImages(svg)), { density: 144 }).resize(256, 256).png().toBuffer();
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 200) opaque++;
    expect(info.width).toBe(256);
    expect(opaque / (256 * 256)).toBeGreaterThan(0.1);   // the body art is drawn, not just an empty frame
  });

  it('the fallback mascot loads', async () => {
    expect((await fallbackMascotPng(64)).length).toBeGreaterThan(100);
  });
});
