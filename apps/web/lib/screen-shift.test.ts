import { describe, expect, it } from 'vitest';
import { diffBoxes, describeShift, type Boxes } from './screen-shift';

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

describe('diffBoxes (screen-shift harness)', () => {
  const before: Boxes = { board: box(10, 100, 370, 300), keyboard: box(0, 600, 390, 200), header: box(0, 0, 390, 80) };

  it('passes an untouched layout and sub-pixel rounding', () => {
    expect(diffBoxes(before, { ...before, board: box(10.4, 100.6, 370, 300.5) })).toEqual([]);
  });

  it('flags a region that moved more than 1 px', () => {
    const s = diffBoxes(before, { ...before, keyboard: box(0, 606, 390, 200) });
    expect(s).toEqual([{ region: 'keyboard', kind: 'moved', dx: 0, dy: 6, dw: 0, dh: 0 }]);
  });

  it('flags a region that shrank (the Codebreaker board)', () => {
    const s = diffBoxes(before, { ...before, board: box(22, 100, 346, 280) });
    expect(s.map((x) => x.kind).sort()).toEqual(['moved', 'resized']);
  });

  it('lets an allowed region (the piece being played) change', () => {
    expect(diffBoxes(before, { ...before, board: box(10, 100, 370, 340) }, { allowed: ['board'] })).toEqual([]);
  });

  it('flags a region that appeared or vanished', () => {
    expect(diffBoxes({ ...before, toastLine: null }, { ...before, toastLine: box(0, 400, 390, 20) }).map((x) => x.kind)).toEqual(['appeared']);
    expect(diffBoxes(before, { ...before, header: null }).map((x) => x.kind)).toEqual(['vanished']);
  });

  it('describes a shift on one line', () => {
    const [s] = diffBoxes(before, { ...before, keyboard: box(0, 606, 390, 200) });
    expect(describeShift('codebreaker', 'type E', s)).toBe('codebreaker · type E: keyboard moved (dx 0, dy 6, dw 0, dh 0)');
  });
});
