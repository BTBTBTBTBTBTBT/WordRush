import { describe, expect, it } from 'vitest';
import { STARSWEEP_PIECES } from './art';
import {
  STARSWEEP_TINTS, regionTint, darkTint, starsweepCellLook, starsweepMotion, starsweepChanges, cellSeams,
} from './starsweep-look';

const HEX = /^#[0-9a-f]{6}$/;
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe('Starsweep region pastels', () => {
  it('has nine distinct friendly hues, none plain white', () => {
    expect(STARSWEEP_TINTS).toHaveLength(9);
    expect(STARSWEEP_TINTS.map((t) => t.name)).toEqual(['lilac', 'peach', 'mint', 'sky', 'butter', 'pink', 'aqua', 'coral', 'lavender']);
    expect(new Set(STARSWEEP_TINTS.map((t) => t.face)).size).toBe(9);
    for (const t of STARSWEEP_TINTS) {
      for (const c of [t.face, t.top, t.lip, t.bed]) {
        expect(c).toMatch(HEX);
        expect(c).not.toBe('#ffffff');
      }
      // gloss lighter than the face, the lip and bed darker
      expect(lum(t.top)).toBeGreaterThan(lum(t.face));
      expect(lum(t.lip)).toBeLessThan(lum(t.face));
      expect(lum(t.bed)).toBeLessThan(lum(t.face));
    }
  });

  it('picks deterministically by region index and wraps', () => {
    expect(regionTint(0)).toBe(STARSWEEP_TINTS[0]);
    expect(regionTint(4).name).toBe('butter');
    expect(regionTint(9)).toBe(STARSWEEP_TINTS[0]);
    expect(regionTint(-1)).toBe(STARSWEEP_TINTS[8]);
    // every region on a 9 × 9 board gets its own hue
    expect(new Set(Array.from({ length: 9 }, (_, i) => regionTint(i).name)).size).toBe(9);
  });

  it('dark pastels are deeper than the light ones and keep their order', () => {
    for (const t of STARSWEEP_TINTS) {
      const d = darkTint(t);
      expect(d.name).toBe(t.name);
      expect(d.face).toMatch(HEX);
      expect(lum(d.face)).toBeLessThan(lum(t.face));
      expect(lum(d.top)).toBeGreaterThan(lum(d.face));
      expect(lum(d.lip)).toBeLessThan(lum(d.face));
    }
    expect(regionTint(2, true)).toEqual(darkTint(STARSWEEP_TINTS[2]));
  });
});

describe('Starsweep cell → piece', () => {
  it('maps every core cell state to the shipped art', () => {
    expect(starsweepCellLook('o', false)).toEqual({ piece: 'star-placed', muted: false });
    expect(starsweepCellLook('*', false)).toEqual({ piece: 'star-correct', muted: false });
    expect(starsweepCellLook('*', true)).toEqual({ piece: 'star-wrong', muted: false });
    expect(starsweepCellLook('x', false)).toEqual({ piece: 'cross', muted: false });
    expect(starsweepCellLook('.', false)).toEqual({ piece: null, muted: false });
    expect(starsweepCellLook('.', false, true)).toEqual({ piece: 'star-correct', muted: true });
    // a played star never shows as a faded solution star
    expect(starsweepCellLook('*', false, true).muted).toBe(false);
  });

  it('only uses pieces that exist', () => {
    for (const [m, w] of [['o', false], ['*', false], ['*', true], ['x', false]] as const) {
      expect(STARSWEEP_PIECES).toContain(starsweepCellLook(m, w).piece);
    }
  });
});

describe('Starsweep motion', () => {
  const m = (board: string, wrongMask = '0000', hintMask = '0000') => ({ board, wrongMask, hintMask });

  it('placing a black star or a cross pops', () => {
    expect(starsweepMotion(m('....'), m('o...'), 0)).toBe('pop');
    expect(starsweepMotion(m('o...'), m('x...'), 0)).toBe('pop');
    expect(starsweepMotion(m('x...'), m('x...'), 0)).toBeNull();
  });

  it('playing a star flips with a purple or red glow', () => {
    expect(starsweepMotion(m('o...'), m('*...'), 0)).toBe('right');
    expect(starsweepMotion(m('....'), m('*...', '1000'), 0)).toBe('wrong');
    expect(starsweepMotion(m('*...'), m('*...'), 0)).toBeNull();
  });

  it('a hint star glows gold', () => {
    expect(starsweepMotion(m('....'), m('*...', '0000', '1000'), 0)).toBe('hint');
    expect(starsweepMotion(m('x...'), m('*...', '0000', '1000'), 0)).toBe('hint');
  });

  it('clearing a cell plays nothing', () => {
    expect(starsweepMotion(m('x...'), m('....'), 0)).toBeNull();
    expect(starsweepMotion(m('*...', '1000'), m('....'), 0)).toBeNull();
  });

  it('lists only the changed cells (a double tap: black star → played star; auto-cross ×s pop)', () => {
    expect(starsweepChanges(m('....'), m('o.xx'))).toEqual([[0, 'pop'], [2, 'pop'], [3, 'pop']]);
    expect(starsweepChanges(m('o.xx'), m('*.xx'))).toEqual([[0, 'right']]);
    expect(starsweepChanges(m('*.xx', '1000'), m('*...', '1000'))).toEqual([[2, null], [3, null]]);
    expect(starsweepChanges(m('....'), m('.........', '000000000', '000000000'))).toEqual([]);
  });
});

describe('Starsweep region seams', () => {
  // 3 × 3: region 0 = top-left L, region 1 = right column, region 2 = bottom row minus the corner
  const regions = '001001221';
  it('marks edges and region borders', () => {
    expect(cellSeams(3, regions, 0)).toEqual({ top: true, right: false, bottom: false, left: true });
    expect(cellSeams(3, regions, 1)).toEqual({ top: true, right: true, bottom: false, left: false });
    expect(cellSeams(3, regions, 4)).toEqual({ top: false, right: true, bottom: true, left: false });
    expect(cellSeams(3, regions, 8)).toEqual({ top: false, right: true, bottom: true, left: true });
  });
});
