import { describe, expect, it } from 'vitest';
import { nameColorHex, playerNameColor } from './player-tint';

const HEX = /^#[0-9A-F]{6}$/;

describe('nameColorHex (the friend menu title color)', () => {
  it('lifts a pastel backdrop to a vivid hue (lemon -> a sunny yellow)', () => {
    const c = nameColorHex('lemon', 'purple');
    expect(c).toMatch(HEX);
    expect(c.startsWith('#FE')).toBe(true); // red stays at the 0.996 brightness floor
  });
  it('uses the LAST color of a gradient backdrop', () => {
    expect(nameColorHex('ocean', 'purple')).toMatch(HEX);
    expect(nameColorHex('ocean', 'purple')).not.toBe(nameColorHex('sunset', 'purple'));
  });
  it('a gray or white backdrop takes the brand purple', () => {
    expect(nameColorHex('cloud', 'purple')).toBe('#8B5CF6');
  });
  it('"auto" reads the body color', () => {
    expect(nameColorHex('auto', 'purple')).toMatch(HEX);
  });
  it('resolves a row with no saved look to a color (the seeded mascot)', () => {
    expect(playerNameColor({ username: 'lexi' })).toMatch(HEX);
  });
});
