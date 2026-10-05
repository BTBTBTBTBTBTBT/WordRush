import { describe, expect, it } from 'vitest';
import { ladderFit, LADDER_TILE } from './ladder-fit';
import { trayChrome } from './tray-fit';

/** The tray's height for a fit, as LadderPlayBoard lays it out. */
function height(f: ReturnType<typeof ladderFit>, rungs: number, showEnd: boolean, label = 14) {
  const c = trayChrome();
  const rows = rungs + 1 + (showEnd ? 1 : 0);
  const children = rows + (showEnd ? 1 : 0);
  return c.top + c.bottom + rows * f.tile + (showEnd ? label : 0) + (children - 1) * f.gap;
}

describe('ladderFit (Doug 10-05: the target never leaves the board)', () => {
  it('keeps the full tile on a tall phone', () => {
    const f = ladderFit(390, 600, 4, true);
    expect(f.tile).toBe(LADDER_TILE.max);
    expect(f.scrolls).toBe(false);
  });

  it("shrinks Doug's ladder into a short slot", () => {
    const f = ladderFit(390, 280, 4, true);
    expect(f.scrolls).toBe(false);
    expect(height(f, 4, true)).toBeLessThanOrEqual(280);
  });

  it('fits every ladder length or scrolls only the rungs', () => {
    for (let h = 160; h <= 700; h += 20) {
      for (let rungs = 1; rungs <= 14; rungs++) {
        const f = ladderFit(375, h, rungs, true);
        expect(f.tile).toBeGreaterThanOrEqual(LADDER_TILE.min);
        if (!f.scrolls) expect(height(f, rungs, true)).toBeLessThanOrEqual(h);
      }
    }
  });

  it('never runs wider than the slot', () => {
    const f = ladderFit(300, 900, 2, true);
    expect(f.tile * 5 + 16 + 2 * trayChrome().x).toBeLessThanOrEqual(300);
  });
});
