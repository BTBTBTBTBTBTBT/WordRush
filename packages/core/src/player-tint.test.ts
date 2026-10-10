import { describe, it, expect } from 'vitest';
import { nameHex, plateHexes, plateInk, tintMix, backdropHexes } from './player-tint';

describe('plateHexes', () => {
  it('auto backdrop = a light tint of the body color', () => {
    const p = plateHexes('auto', 'none', '#7c3aed');
    expect(p.fill).toEqual(['#e2d4fb']);
    expect(p.lightInk).toBe(false);
    expect(p.borderWidth).toBe(1.5);
    expect(p.border).toEqual([tintMix('#e2d4fb', '#000000', 0.28)]);
  });
  it('unknown backdrop and frame fall back like auto / none', () => {
    expect(plateHexes('mystery', 'bogus', '#0ea5e9')).toEqual(plateHexes('auto', 'none', '#0ea5e9'));
  });
  it('dark backdrops pick white ink; light ones the dark ink', () => {
    expect(plateHexes('night', 'none', '#7c3aed').lightInk).toBe(true);
    expect(plateHexes('lemon', 'none', '#7c3aed').lightInk).toBe(false);
    expect(plateInk(true).heading).toBe('#ffffff');
    expect(plateInk(false).heading).toBe('#2a1650');
  });
  it('a pattern reads as its base color plus a whisper of the accent', () => {
    expect(backdropHexes('galaxy', '#000000')).toEqual(['#4c1d95', tintMix('#4c1d95', '#fde68a', 0.3)]);
  });
  it('frames: metals are 2.5 wide, none is 1.5', () => {
    for (const m of ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'pro']) expect(plateHexes('auto', m, '#7c3aed').borderWidth).toBe(2.5);
    expect(plateHexes('auto', 'diamond', '#7c3aed').border).toHaveLength(3);
  });
});

describe('nameHex', () => {
  it('lemon becomes a sunny gold (saturated, bright)', () => {
    expect(nameHex('lemon', '#7c3aed')).toBe('#feed38');
  });
  it('a grey / white backdrop gives the brand purple', () => {
    expect(nameHex('cloud', '#7c3aed')).toBe('#8B5CF6');
    expect(nameHex('auto', '#f8fafc')).toBe('#8B5CF6');
  });
  it('no backdrop uses the body color', () => {
    expect(nameHex('auto', '#f5a524')).toBe('#f5a524');
  });
});
