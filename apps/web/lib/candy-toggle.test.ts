import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { candyPad, threeSlice } from './candy-toggle';

const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

describe('candy toggles (night art 10-03 sprites)', () => {
  it('three-slices a pill: caps are half the sprite height, ends half the drawn height', () => {
    const s = threeSlice('track', 30, '--candy-track');
    expect(s.borderImageSlice).toBe('0 84 fill'); // art-toggle-light-track is 480 × 167
    expect(s.borderImageWidth).toBe('0 15px');
    expect(s.borderImageSource).toBe('var(--candy-track)');
    expect(candyPad(38)).toBe(5);
  });

  it('wires the sprites into Daily | Unlimited (crown inside), the settings switch and Solo | VS', () => {
    const banner = read('components/home/home-banner.tsx');
    expect(banner).toContain("threeSlice('track'");
    expect(banner).toContain("threeSlice('thumb-on'");
    expect(banner).toContain("badgeSrc('pro-crown-sprite')");
    expect(banner).toContain('aria-pressed={on}');
    expect(read('components/settings/settings-kit.tsx')).toContain('<CandySwitch');
    const sw = read('components/ui/candy-switch.tsx');
    expect(sw).toContain('role="switch"');
    expect(sw).toContain('aria-checked={checked}');
    expect(read('app/records/page.tsx')).toContain('<CandySegment');
    expect(read('app/profile/[id]/page.tsx')).toContain('<CandySegment');
  });

  it('moves only the thumb / knob (transform) and fades the on-track (opacity)', () => {
    const css = read('app/globals.css');
    expect(css).toMatch(/\.candy-slide \{ transition: transform [^;]+, opacity [^;]+;/);
    expect(css).toContain('[data-theme="dark"] {\n  --candy-track: url(/art/art-toggle-dark-track.webp);');
  });
});
