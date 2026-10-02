import { describe, expect, it } from 'vitest';
import { TILE_PALETTE, darkenHex, lightenHex, tileBaseColor, tileColors, tileInitials } from './avatar-tile';

describe('letter-tile avatar colors (ART_SPEC §20)', () => {
  it('uses the cast color for a cast first letter', () => {
    expect(tileBaseColor('wordsmith')).toBe('#8B2CF5');
    expect(tileBaseColor('Olive')).toBe('#FF2F91');
    expect(tileBaseColor('sam')).toBe('#F5A623');
  });

  it('uses palette[char code mod 9] for other letters', () => {
    expect(tileBaseColor('alex')).toBe(TILE_PALETTE[65 % 9]);
    expect(tileBaseColor('Alex')).toBe('#0A6CFF');
    expect(tileBaseColor('zed')).toBe(TILE_PALETTE[90 % 9]);
  });

  it('applies the same mod rule to digits and symbols', () => {
    expect(tileBaseColor('7even')).toBe(TILE_PALETTE[55 % 9]);
    expect(tileBaseColor('_x')).toBe(TILE_PALETTE[95 % 9]);
  });

  it("lets the player's chosen accent win", () => {
    expect(tileBaseColor('wordsmith', '#EC4899')).toBe('#EC4899');
    expect(tileBaseColor('alex', '#0d9488')).toBe('#0D9488');
  });

  it('ignores a null or unknown accent', () => {
    expect(tileBaseColor('wordsmith', null)).toBe('#8B2CF5');
    expect(tileBaseColor('wordsmith', '#123456')).toBe('#8B2CF5');
  });

  it('derives edge / light / bottom shades', () => {
    expect(darkenHex('#FFFFFF', 0.22)).toBe('#C7C7C7');
    expect(lightenHex('#000000', 0.18)).toBe('#2E2E2E');
    expect(tileColors('wordsmith')).toEqual({
      base: '#8B2CF5', edge: darkenHex('#8B2CF5', 0.22), light: lightenHex('#8B2CF5', 0.18), bottom: darkenHex('#8B2CF5', 0.06),
    });
  });

  it('draws the first two characters, uppercased', () => {
    expect(tileInitials('wordsmith')).toBe('WO');
    expect(tileInitials('q')).toBe('Q');
    expect(tileInitials('')).toBe('?');
    expect(tileInitials(null)).toBe('?');
  });
});
