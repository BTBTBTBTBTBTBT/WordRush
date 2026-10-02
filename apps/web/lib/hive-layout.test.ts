import { describe, expect, it } from 'vitest';
import { HEX_H, HEX_W, hiveBox, hiveOffsets } from './hive-layout';

describe('Hubbub honeycomb (FINISH_SPEC J1)', () => {
  it('rings six hexes around the center, clockwise from the top', () => {
    const o = hiveOffsets(1);
    expect(o).toHaveLength(6);
    expect(o[0][0]).toBe(0);
    expect(o[0][1]).toBeCloseTo(-HEX_H);
    expect(o[3][1]).toBeCloseTo(HEX_H);
    expect(o[1][0]).toBeCloseTo(0.75 * HEX_W);
    expect(o[1][1]).toBeCloseTo(-HEX_H / 2);
    expect(o[4][0]).toBeCloseTo(-0.75 * HEX_W);
  });
  it('keeps every neighbor the same distance from the center pattern (no overlap)', () => {
    for (const [dx, dy] of hiveOffsets()) {
      // A flat-top neighbor never overlaps: either straight above/below by a full height, or ¾ width across.
      expect(Math.abs(dx) >= 0.75 * HEX_W - 1e-9 || Math.abs(dy) >= HEX_H - 1e-9).toBe(true);
    }
  });
  it('fits inside the box the layout reserves', () => {
    const [w, h] = hiveBox();
    expect(w).toBeLessThan(3.6);
    expect(h).toBeLessThan(3.3);
  });
});
