import { describe, expect, it } from 'vitest';
import { KEY_DELETE, KEY_ENTER, KEY_SPACE, keyRows, sheetTapFires, themePreview } from './settings-previews';

// FINISH_SPEC BI25: Settings tile previews + single-fire sheet taps (parity ×3).
describe('settings previews', () => {
  it('spells WORD in each theme’s colors', () => {
    for (const t of ['default', 'dark', 'ocean', 'forest']) {
      expect(themePreview(t).tiles.map((x) => x.letter).join('')).toBe('WORD');
    }
    expect(themePreview('dark').page).toBe('#1a1a2e');
    expect(themePreview('ocean').tiles[0].hex).toBe('#0ea5e9');
    expect(themePreview('forest').tiles[0].hex).toBe('#16a34a');
  });

  it('places Enter and Delete per layout', () => {
    expect(keyRows('standard')).toEqual([[KEY_ENTER, 'Z', 'X', 'C', 'V', KEY_DELETE]]);
    expect(keyRows('flipped')).toEqual([[KEY_DELETE, 'Z', 'X', 'C', 'V', KEY_ENTER]]);
    expect(keyRows('michael')).toEqual([[KEY_DELETE, 'Z', 'X', 'C', 'V', KEY_DELETE], [KEY_ENTER, KEY_SPACE, KEY_ENTER]]);
  });

  it('fires a sheet tap once', () => {
    expect(sheetTapFires(1000, null, false)).toBe(true);
    expect(sheetTapFires(1200, 1000, false)).toBe(false);
    expect(sheetTapFires(3000, 1000, true)).toBe(false);
    expect(sheetTapFires(1700, 1000, false)).toBe(true);
  });
});
