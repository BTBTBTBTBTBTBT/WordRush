import { describe, expect, it } from 'vitest';
import { STARSWEEP_PIECES } from './art';
import { REGION_COLOR_DIST, generateRegions, regionColorSlots } from '@wordle-duel/core';
import {
  STARSWEEP_TINTS, regionTint, darkTint, starsweepCellLook, starsweepMotion, starsweepChanges, cellSeams,
} from './starsweep-look';

const HEX = /^#[0-9a-f]{6}$/;
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// CIEDE2000 between two #rrggbb colors (the table in core is built on it; this recomputes it from the hex values).
const lab = (hex: string): [number, number, number] => {
  const lin = [1, 3, 5].map((k) => { const c = parseInt(hex.slice(k, k + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  const X = (0.4124564 * lin[0] + 0.3575761 * lin[1] + 0.1804375 * lin[2]) / 0.95047;
  const Y = 0.2126729 * lin[0] + 0.7151522 * lin[1] + 0.072175 * lin[2];
  const Z = (0.0193339 * lin[0] + 0.119192 * lin[1] + 0.9503041 * lin[2]) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const rad = (d: number) => (d * Math.PI) / 180;
function de00(a: [number, number, number], b: [number, number, number]): number {
  const [L1, a1, b1] = a, [L2, a2, b2] = b;
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1 = Math.hypot(a1p, b1), C2 = Math.hypot(a2p, b2);
  const h1 = C1 ? (Math.atan2(b1, a1p) * 180 / Math.PI + 360) % 360 : 0;
  const h2 = C2 ? (Math.atan2(b2, a2p) * 180 / Math.PI + 360) % 360 : 0;
  let dh = 0;
  if (C1 * C2) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin(rad(dh / 2));
  const Lb = (L1 + L2) / 2, Cp = (C1 + C2) / 2;
  let hb = h1 + h2;
  if (C1 * C2) { hb = (h1 + h2) / 2; if (Math.abs(h1 - h2) > 180) hb += h1 + h2 < 360 ? 180 : -180; }
  const T = 1 - 0.17 * Math.cos(rad(hb - 30)) + 0.24 * Math.cos(rad(2 * hb)) + 0.32 * Math.cos(rad(3 * hb + 6)) - 0.2 * Math.cos(rad(4 * hb - 63));
  const Rc = 2 * Math.sqrt(Cp ** 7 / (Cp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2), Sc = 1 + 0.045 * Cp, Sh = 1 + 0.015 * Cp * T;
  const Rt = -Math.sin(rad(2 * 30 * Math.exp(-(((hb - 275) / 25) ** 2)))) * Rc;
  const x = (C2 - C1) / Sc, y = dH / Sh;
  return Math.sqrt(((L2 - L1) / Sl) ** 2 + x ** 2 + y ** 2 + Rt * x * y);
}
const dist = (x: string, y: string) => de00(lab(x), lab(y));

describe('Starsweep region colors', () => {
  it('has nine distinct hues, none plain white', () => {
    expect(STARSWEEP_TINTS).toHaveLength(9);
    expect(STARSWEEP_TINTS.map((t) => t.name)).toEqual(['violet', 'orange', 'green', 'blue', 'yellow', 'pink', 'cyan', 'red', 'slate']);
    expect(new Set(STARSWEEP_TINTS.map((t) => t.face)).size).toBe(9);
    for (const t of STARSWEEP_TINTS) {
      for (const c of [t.face, t.top, t.lip, t.bed, t.deep]) {
        expect(c).toMatch(HEX);
        expect(c).not.toBe('#ffffff');
      }
      // gloss lighter than the face, the lip and bed darker
      expect(lum(t.top)).toBeGreaterThan(lum(t.face));
      expect(lum(t.lip)).toBeLessThan(lum(t.face));
      expect(lum(t.bed)).toBeLessThan(lum(t.face));
    }
  });

  it('picks deterministically by color index and wraps', () => {
    expect(regionTint(0)).toBe(STARSWEEP_TINTS[0]);
    expect(regionTint(4).name).toBe('yellow');
    expect(regionTint(9)).toBe(STARSWEEP_TINTS[0]);
    expect(regionTint(-1)).toBe(STARSWEEP_TINTS[8]);
    expect(new Set(Array.from({ length: 9 }, (_, i) => regionTint(i).name)).size).toBe(9);
  });

  it('dark tints are deeper than the light ones and keep their order', () => {
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

  it('no two colors read alike: every pair is far apart in CIEDE2000, dark and light (founder 10-12: two greens)', () => {
    const faces = (dark: boolean) => STARSWEEP_TINTS.map((t) => (dark ? darkTint(t) : t).face);
    for (const dark of [true, false]) {
      const f = faces(dark);
      for (const n of [7, 8, 9]) {
        let min = 1e9;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) min = Math.min(min, dist(f[i], f[j]));
        expect(min, `${dark ? 'dark' : 'light'} first ${n}`).toBeGreaterThan(dark ? 20 : 17);
      }
    }
  });

  it("core's pairwise table is this palette's dark faces, rounded", () => {
    const f = STARSWEEP_TINTS.map((t) => darkTint(t).face);
    REGION_COLOR_DIST.forEach((row, i) => row.forEach((v, j) => {
      expect(Math.abs(v - dist(f[i], f[j])), `${i},${j}`).toBeLessThan(1.1);
    }));
  });

  it('region color slots give touching regions far-apart colors, better than the plain order', () => {
    let better = 0, total = 0;
    for (const [seed, n] of [['a', 7], ['b', 8], ['c', 9], ['daily-2026-11-11-REGIONS', 7], ['d', 8], ['e', 9], ['unlimited-REGIONS-2', 8], ['f', 7]] as Array<[string, number]>) {
      const p = generateRegions(seed, n)!;
      const slots = regionColorSlots(n, p.regions);
      expect([...slots].sort((x, y) => x - y)).toEqual(Array.from({ length: n }, (_, i) => i));
      const worst = (m: (g: number) => number) => {
        let w = 1e9;
        for (let i = 0; i < n * n; i++) {
          const g = p.regions.charCodeAt(i) - 48;
          for (const k of [i + 1, i + n]) {
            if (k >= n * n || (k === i + 1 && i % n === n - 1)) continue;
            const h = p.regions.charCodeAt(k) - 48;
            if (h !== g) w = Math.min(w, REGION_COLOR_DIST[m(g)][m(h)]);
          }
        }
        return w;
      };
      total++;
      expect(worst((g) => slots[g]), seed).toBeGreaterThanOrEqual(worst((g) => g));
      if (worst((g) => slots[g]) > worst((g) => g)) better++;
      expect(worst((g) => slots[g]), seed).toBeGreaterThanOrEqual(20);
    }
    expect(better).toBeGreaterThan(0);
    expect(total).toBe(8);
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
