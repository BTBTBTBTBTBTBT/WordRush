import { describe, expect, it } from 'vitest';
import {
  CHAIN_INTERIOR, PASS_BODY, PASS_TRAY_W, TTT_GRID_H, TTT_GRID_W, chainInputTile, chainLayout, ghostTileSize, passGeometry, tttCell, tttStrike,
} from './pocket-boards';

describe('Tic-Tac-Tile grid cells', () => {
  it('sit between the # bars, inside the slab', () => {
    for (let i = 0; i < 9; i++) {
      const c = tttCell(i);
      expect(c.x).toBeGreaterThanOrEqual(45);
      expect(c.y).toBeGreaterThanOrEqual(45);
      expect(c.x + c.w).toBeLessThanOrEqual(735);
      expect(c.y + c.h).toBeLessThanOrEqual(731);
      expect(c.x + c.w).toBeLessThanOrEqual(TTT_GRID_W);
      expect(c.y + c.h).toBeLessThanOrEqual(TTT_GRID_H);
    }
    // the bars: cells never overlap the vertical bar at x 256-296
    expect(tttCell(0).x + tttCell(0).w).toBe(256);
    expect(tttCell(1).x).toBe(296);
  });
  it('strikes run through the end cells (rows, columns, diagonals)', () => {
    const row = tttStrike([0, 1, 2]);
    expect(row.deg).toBeCloseTo(0, 5);
    expect(row.cy).toBeCloseTo(152, 0);
    const col = tttStrike([0, 3, 6]);
    expect(col.deg).toBeCloseTo(90, 5);
    const diag = tttStrike([0, 4, 8]);
    expect(diag.deg).toBeGreaterThan(40);
    expect(diag.deg).toBeLessThan(50);
    expect(row.len).toBeGreaterThan(tttCell(2).x + tttCell(2).w - tttCell(0).x - 100);
  });
});

describe('Pass the Puzzle group', () => {
  it('centers rings + tiles in the body rect', () => {
    for (const w of [300, 340, 400]) {
      const g = passGeometry(w);
      const s = w / PASS_TRAY_W;
      const left = g.ringX;
      const right = g.tileX + 4 * g.pitch + g.t;
      const top = g.top;
      const bottom = g.top + 5 * g.pitch + g.t;
      expect(left - PASS_BODY.x * s).toBeCloseTo(PASS_BODY.x * s + PASS_BODY.w * s - right, 3);
      expect(top - PASS_BODY.y * s).toBeCloseTo(PASS_BODY.y * s + PASS_BODY.h * s - bottom, 3);
      expect(left).toBeGreaterThan(PASS_BODY.x * s);
      expect(right).toBeLessThan((PASS_BODY.x + PASS_BODY.w) * s);
    }
  });
  it('keeps the ring close to the tiles (gap about 12% of a tile)', () => {
    const g = passGeometry(340);
    expect((g.tileX - (g.ringX + g.ring)) / g.t).toBeCloseTo(0.12, 5);
  });
});

describe('Ghost tiles', () => {
  it('shrink as the fragment grows and always fit the panel', () => {
    let prev = Infinity;
    for (let n = 1; n <= 10; n++) {
      const t = ghostTileSize(340, n);
      expect(t).toBeLessThanOrEqual(prev);
      expect(n * t + (n - 1) * 0.14 * t).toBeLessThanOrEqual((822 * 340) / 1200);
      prev = t;
    }
  });
});

describe('Word Chain staircase', () => {
  const W = CHAIN_INTERIOR.w * (340 / 1100) * 0.94;
  const H = CHAIN_INTERIOR.h * (340 / 1100) * 0.92;
  it('is empty with no words', () => { expect(chainLayout([], W, H)).toBeNull(); });
  it('puts the newest word under the previous last letter, joined by one upright link', () => {
    const l = chainLayout([5, 5], W, H)!;
    expect(l.flush).toBe(false);
    expect(l.rows).toHaveLength(2);
    const lastCx = l.rows[0].x + 4 * l.pitchX + l.t / 2;
    expect(l.rows[1].x + l.t / 2).toBeCloseTo(lastCx, 5);
    expect(l.links).toHaveLength(1);
    expect(l.links[0].deg).toBeCloseTo(0, 5);
    expect(l.rows[1].y).toBeGreaterThan(l.rows[0].y + l.t);
  });
  it('stays inside the interior for every length pair, tiles stay readable', () => {
    for (let a = 5; a <= 15; a++) for (let b = 5; b <= 15; b++) {
      const l = chainLayout([a, b], W, H)!;
      expect(l.t).toBeGreaterThanOrEqual(14);
      for (const r of l.rows) {
        expect(r.x).toBeGreaterThanOrEqual(-0.5);
        expect(r.x + (r.len - 1) * l.pitchX + l.t).toBeLessThanOrEqual(W + 0.5);
        expect(r.y).toBeGreaterThanOrEqual(-0.5);
        expect(r.y + l.t).toBeLessThanOrEqual(H + 0.5);
      }
    }
  });
  it('falls back to the left edge when the staircase will not fit, link still joins the two letters', () => {
    const l = chainLayout([15, 15], W, H)!;
    expect(l.flush).toBe(true);
    expect(l.rows[1].x).toBeCloseTo(l.rows[0].x, 5);
    expect(Math.abs(l.links[0].deg)).toBeGreaterThan(45);
  });
  it('long words (> 10 letters) stack left-aligned, no staircase, tiles >= 17 px for 15 letters at 390 wide', () => {
    const w = CHAIN_INTERIOR.w * (358 / 1100) * 0.97;
    const h = CHAIN_INTERIOR.h * (358 / 1100) * 0.92;
    for (const pair of [[15, 13], [11, 5], [5, 12]]) {
      const l = chainLayout(pair, w, h)!;
      expect(l.rows).toHaveLength(2);
      expect(l.rows[1].x).toBeCloseTo(l.rows[0].x, 5);
      expect(l.rows[0].x).toBeGreaterThanOrEqual(-0.5);
      for (const r of l.rows) expect(r.x + (r.len - 1) * l.pitchX + l.t).toBeLessThanOrEqual(w + 0.5);
    }
    expect(chainLayout([15, 13], w, h)!.t).toBeGreaterThanOrEqual(17);
    // 5 + 5 keeps the staircase
    expect(chainLayout([5, 5], w, h)!.flush).toBe(false);
  });
  it('shows three words only when they stay big enough', () => {
    expect(chainLayout([5, 5, 5], W, H)!.rows).toHaveLength(2);
    const big = chainLayout([5, 5, 5], CHAIN_INTERIOR.w * (480 / 1100), CHAIN_INTERIOR.h * (480 / 1100))!;
    expect(big.rows.length).toBe(3);
    expect(big.rows.map((r) => r.index)).toEqual([0, 1, 2]);
  });
});

describe('Word Chain typing row', () => {
  it('fits one row up to 15 letters on a 360 wide phone and tiles never grow past the cap', () => {
    const row = 360 - 32;
    let prev = Infinity;
    for (let n = 1; n <= 15; n++) {
      const t = chainInputTile(row, n);
      expect(t).toBeLessThanOrEqual(40);
      expect(t).toBeLessThanOrEqual(prev);
      expect(n * t + (n - 1) * 0.12 * t).toBeLessThanOrEqual(row);
      prev = t;
    }
    expect(chainInputTile(row, 15)).toBeGreaterThanOrEqual(18);
  });
});
