import path from 'path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { CAST } from './mascots';
import { ART_SIZE } from './art';
import { castRowLayout } from './share-fit';
import {
  HALLOWEEN_TRIM, SKIN_ART_SIZE, castArt, castImageSources, halloweenPropSrc, HALLOWEEN_BANNER_SRC,
  parseSeasonParam, parseStoredSeason, reflowCastRow, resolveSeason, seasonOfSrc,
} from './season';

// FINISH_SPEC X: the Halloween skins replace the hero cast Oct 9 – Oct 31
// (local date); `?season=halloween|none` previews on web.

describe('season resolution', () => {
  it('follows the calendar without a preview', () => {
    expect(resolveSeason('2026-10-08', null)).toBeNull();
    expect(resolveSeason('2026-10-09', null)).toBe('halloween');
    expect(resolveSeason('2026-10-24', null)).toBe('halloween');
    expect(resolveSeason('2026-10-31', null)).toBe('halloween');
    expect(resolveSeason('2026-11-01', null)).toBeNull();
  });

  it('lets the preview force the skins on or off', () => {
    expect(resolveSeason('2026-03-01', 'halloween')).toBe('halloween');
    expect(resolveSeason('2026-10-31', 'none')).toBeNull();
  });

  it('reads ?season= from a query string', () => {
    expect(parseSeasonParam('?season=halloween')).toBe('halloween');
    expect(parseSeasonParam('?a=1&season=HALLOWEEN')).toBe('halloween');
    expect(parseSeasonParam('?season=none')).toBe('none');
    expect(parseSeasonParam('?season=off')).toBe('none');
    expect(parseSeasonParam('?season=auto')).toBe('auto');
    expect(parseSeasonParam('?season=xmas')).toBeNull();
    expect(parseSeasonParam('')).toBeNull();
    expect(parseSeasonParam('?other=halloween')).toBeNull();
  });

  it('only trusts known stored previews', () => {
    expect(parseStoredSeason('halloween')).toBe('halloween');
    expect(parseStoredSeason('none')).toBe('none');
    expect(parseStoredSeason('auto')).toBeNull();
    expect(parseStoredSeason(null)).toBeNull();
  });
});

describe('Halloween skin framing', () => {
  it('has a skin for every cast member, shipped at 320 px', () => {
    for (const id of CAST) {
      expect(ART_SIZE[`art-halloween-${id}`]).toEqual([SKIN_ART_SIZE, SKIN_ART_SIZE]);
      expect(castArt(id, 'halloween').src).toBe(`/art/art-halloween-${id}.webp`);
    }
  });

  it('stores the measured alpha box of every skin (edge-tight row)', async () => {
    for (const id of CAST) {
      const file = path.resolve(__dirname, `../public/art/art-halloween-${id}.webp`);
      const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          if (data[(y * info.width + x) * info.channels + 3] > 8) {
            if (x < x0) x0 = x;
            if (y < y0) y0 = y;
            if (x + 1 > x1) x1 = x + 1;
            if (y + 1 > y1) y1 = y + 1;
          }
        }
      }
      const [tx0, ty0, tx1, ty1] = HALLOWEEN_TRIM[id];
      // Within 2 px of the measured box (re-exports may shift a pixel).
      expect(Math.abs(tx0 - x0)).toBeLessThanOrEqual(2);
      expect(Math.abs(ty0 - y0)).toBeLessThanOrEqual(2);
      expect(Math.abs(tx1 - x1)).toBeLessThanOrEqual(2);
      expect(Math.abs(ty1 - y1)).toBeLessThanOrEqual(2);
    }
  });

  it('keeps every box inside the square with sane aspects', () => {
    for (const id of CAST) {
      const [x0, y0, x1, y1] = HALLOWEEN_TRIM[id];
      expect(x0).toBeGreaterThanOrEqual(0);
      expect(y0).toBeGreaterThanOrEqual(0);
      expect(x1).toBeLessThanOrEqual(SKIN_ART_SIZE);
      expect(y1).toBeLessThanOrEqual(SKIN_ART_SIZE);
      const a = castArt(id, 'halloween').aspect;
      expect(a).toBeGreaterThan(0.6);
      // 10-05 layered skins: W's cape and U's wings make them wider than tall (W 1.19, U 1.26).
      expect(a).toBeLessThan(1.3);
    }
  });

  it('lays the 320 px skin so only its box shows', () => {
    // c: box 254 × 307 at (33, 6).
    expect(castArt('c', 'halloween').layout).toEqual({ width: '125.984%', left: '-12.992%', top: '-1.954%' });
  });

  it('falls back to the hero art outside the season', () => {
    expect(castArt('w', null).src).toBe('/mascots/w.png');
    expect(castArt('w', null).artSize).toBe(512);
    expect(castImageSources('w', null)).toEqual(['/mascots/w.png']);
    expect(castImageSources('w', 'halloween')).toEqual(['/art/art-halloween-w.webp', '/mascots/w.png']);
  });

  it('tells a skin from a hero by its path', () => {
    expect(seasonOfSrc('https://wordocious.com/art/art-halloween-o1.webp')).toBe('halloween');
    expect(seasonOfSrc('https://wordocious.com/mascots/o1.png')).toBeNull();
  });
});

describe('share wordmark reflow', () => {
  it('keeps height, lift, overlap and center while each skin takes its own width', () => {
    const row = castRowLayout(900, 540, 1000);
    const skin = reflowCastRow(row, (id) => castArt(id, 'halloween').aspect);
    expect(skin.charH).toBe(row.charH);
    expect(skin.slots.map((s) => s.y)).toEqual(row.slots.map((s) => s.y));
    const step = row.slots[0].x + row.slots[0].w - row.slots[1].x;
    for (let i = 1; i < skin.slots.length; i++) {
      const prev = skin.slots[i - 1];
      expect(prev.x + prev.w - skin.slots[i].x).toBeCloseTo(step, 6);
    }
    const left = skin.slots[0].x;
    const last = skin.slots[skin.slots.length - 1];
    expect((left + last.x + last.w) / 2).toBeCloseTo(540, 6);
    expect(last.x + last.w - left).toBeCloseTo(skin.rowW, 6);
    // 10-05 layered skins (W's cape, U's wings) run ~1% wider than the heroes: within 2% of the card's
    // row, i.e. still well inside the card's side margins (the row is 90% of the card).
    expect(skin.rowW).toBeLessThanOrEqual(row.rowW * 1.02);
  });

  it('is the identity for the hero aspects', () => {
    const row = castRowLayout(900, 540, 1000);
    const same = reflowCastRow(row, (id) => castArt(id, null).aspect);
    same.slots.forEach((s, i) => {
      expect(s.x).toBeCloseTo(row.slots[i].x, 6);
      expect(s.w).toBeCloseTo(row.slots[i].w, 6);
    });
  });
});

describe('Halloween prop slots', () => {
  it('point at the shipped files (night art 10-03), which are in ART_SIZE', () => {
    expect(halloweenPropSrc('pumpkin')).toBe('/art/art-halloween-prop-pumpkin.webp');
    expect(HALLOWEEN_BANNER_SRC).toBe('/art/art-scene-banner-halloween.webp');
    for (const p of ['pumpkin', 'bat', 'candy', 'ghost']) expect(Object.keys(ART_SIZE)).toContain(`art-halloween-prop-${p}`);
    expect(Object.keys(ART_SIZE)).toContain('art-scene-banner-halloween');
  });
});
