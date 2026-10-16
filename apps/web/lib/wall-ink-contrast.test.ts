import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import registry from '../../../packages/core/src/season-registry.json';
import { contrastRatio } from '../../../packages/core/src/contrast';
import { surfaceCssVars, resolveSurfaces, type SeasonSurfaces } from './season-kit';

// 10-16 time of day (docs/design/brand/seasons/time-of-day/NOTES.md v2): in a season whose morning / day sky is light
// (`surfaces.tod.<t>.tone = "light"`) the on-wall chrome ink (streak / shield digits, labels sitting straight on the wall) is
// the dark `--season-wall-ink`. It is measured here on the REAL wall pixels of that time, in the band the chrome sits in
// (the controls row at the top of every page): large / bold text (the 17 pt digits) >= 3:1 at the darkest 5 % of the band,
// body-size lines >= 4.5:1 at the median. Ports of the value: iOS SeasonSurface.wallInk, Android WTheme.wallInk.

interface Season {
  id: string;
  slots?: { walls?: Record<string, string | Record<string, string>> };
  surfaces?: SeasonSurfaces;
}
const SEASONS = (registry as unknown as { seasons: Season[] }).seasons;
const ART = join(__dirname, '..', 'public', 'art');
const LIGHT_TIMES = ['morning', 'day'] as const;

/** Relative luminance at a percentile (0..1) of the band's pixels, returned as the pixel's hex. */
async function bandPixel(name: string, pct: number): Promise<string> {
  const img = sharp(readFileSync(join(ART, `${name}.webp`)));
  const { width = 0, height = 0 } = await img.metadata();
  const top = Math.round(height * 0.05);
  const band = Math.round(height * 0.07);
  const { data } = await img.extract({ left: 0, top, width, height: band }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px: { y: number; h: string }[] = [];
  for (let i = 0; i < data.length; i += 3 * 7) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    px.push({ y: 0.2126 * r + 0.7152 * g + 0.0722 * b, h: `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}` });
  }
  px.sort((a, b) => a.y - b.y);
  return px[Math.min(px.length - 1, Math.floor(px.length * pct))].h;
}

describe('the dark on-wall ink holds on the light time-of-day walls', () => {
  for (const s of SEASONS) {
    const times = LIGHT_TIMES.filter((t) => (s.surfaces as { tod?: Record<string, { tone?: string }> } | undefined)?.tod?.[t]?.tone === 'light');
    for (const t of times) {
      const ink = surfaceCssVars(resolveSurfaces(s.surfaces, t)!)['--season-wall-ink'];
      it(`${s.id} ${t}: wall ink ${ink} is dark; night / evening keep white`, () => {
        expect(ink).toBe('#1B1230');
        for (const other of ['night', 'evening'] as const) expect(surfaceCssVars(resolveSurfaces(s.surfaces, other)!)['--season-wall-ink']).toBe('#FFFFFF');
      });
      for (const [page, v] of Object.entries(s.slots?.walls ?? {})) {
        if (page.endsWith('*') || typeof v === 'string') continue;
        const name = v[t];
        if (!name) continue;
        it(`${s.id} ${t} ${page}: ${ink} on the wall band clears 3:1 (large) at the darkest 5 % and 4.5:1 (body) at the median`, async () => {
          expect(contrastRatio(ink, await bandPixel(name, 0.05)), `${name} p5`).toBeGreaterThanOrEqual(3);
          expect(contrastRatio(ink, await bandPixel(name, 0.5)), `${name} median`).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});
