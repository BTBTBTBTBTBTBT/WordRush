import { describe, expect, it } from 'vitest';
import { BOARD_FIT, fitBoard, fitBoardGrid, tileFontPx } from './board-fit';

// FINISH_SPEC B5: one board-sizing rule for every game.

describe('fitBoard (single boards)', () => {
  it('fills a phone width minus the side margin when height allows', () => {
    // 390 wide, plenty of height: (390 − 16 − 4·5) / 5 = 70.8 → 70
    const f = fitBoard({ width: 390, height: 600, cols: 5, rows: 6 });
    expect(f).toEqual({ tile: 70, w: 370, h: 445, gap: 5 });
  });

  it('is limited by height on a short area and stays square', () => {
    // (300 − 5·5) / 6 = 45.8 → 45
    const f = fitBoard({ width: 390, height: 300, cols: 5, rows: 6 })!;
    expect(f.tile).toBe(45);
    expect(f.h).toBeLessThanOrEqual(300);
    expect(f.w).toBe(45 * 5 + 4 * 5);
  });

  it('caps the tile on a desktop window', () => {
    expect(fitBoard({ width: 1400, height: 1000, cols: 5, rows: 6 })!.tile).toBe(BOARD_FIT.maxTile);
    expect(fitBoard({ width: 1400, height: 1000, cols: 5, rows: 6, maxWidth: 300 })!.w).toBeLessThanOrEqual(300);
  });

  it('handles wider words and leaves vertical room when asked', () => {
    const seven = fitBoard({ width: 390, height: 900, cols: 7, rows: 6 })!;
    expect(seven.w).toBeLessThanOrEqual(390 - 2 * BOARD_FIT.side);
    const padded = fitBoard({ width: 390, height: 300, cols: 5, rows: 6, vPad: 30 })!;
    expect(padded.h).toBeLessThanOrEqual(270);
  });

  it('makes room for extra row width (ProperNoundle word gaps)', () => {
    const plain = fitBoard({ width: 390, height: 600, cols: 12, rows: 6 })!;
    const grouped = fitBoard({ width: 390, height: 600, cols: 12, rows: 6, extraWidth: 14 })!;
    expect(grouped.tile).toBeLessThanOrEqual(plain.tile);
    expect(grouped.w).toBeLessThanOrEqual(390 - 2 * BOARD_FIT.side);
  });

  it('returns null before the area is measured or when nothing fits', () => {
    expect(fitBoard({ width: 0, height: 0, cols: 5, rows: 6 })).toBeNull();
    expect(fitBoard({ width: 40, height: 40, cols: 5, rows: 6 })).toBeNull();
    expect(fitBoard({ width: 300, height: 300, cols: 0, rows: 6 })).toBeNull();
  });
});

describe('fitBoardGrid (multi-board games)', () => {
  it('lays QuadWord out 2 × 2 on a phone and 4 × 1 on a wide window', () => {
    const phone = fitBoardGrid({ width: 370, height: 430, boards: 4, rows: 9 })!;
    expect(phone.cols).toBe(2);
    const wide = fitBoardGrid({ width: 1200, height: 360, boards: 4, rows: 9 })!;
    expect(wide.cols).toBe(4);
  });

  it('keeps OctoWord 4 across on a phone and fits both dimensions', () => {
    const f = fitBoardGrid({ width: 370, height: 520, boards: 8, rows: 13 })!;
    expect(f.cols).toBe(4);
    const lines = Math.ceil(8 / f.cols);
    const boardH = f.tile * 13 + 12 * BOARD_FIT.boardTileGap + BOARD_FIT.boardPad;
    expect(lines * boardH + (lines - 1) * BOARD_FIT.boardGap).toBeLessThanOrEqual(520);
    expect(f.cols * f.boardW + (f.cols - 1) * BOARD_FIT.boardGap).toBeLessThanOrEqual(370);
  });

  it('matches the old Succession / MultiBoard math and caps the tile', () => {
    const f = fitBoardGrid({ width: 2000, height: 2000, boards: 4, rows: 9 })!;
    expect(f.tile).toBe(BOARD_FIT.boardMaxTile);
    expect(f.boardW).toBe(f.tile * 5 + 4 * BOARD_FIT.boardTileGap + BOARD_FIT.boardPad);
    expect(fitBoardGrid({ width: 0, height: 100, boards: 4, rows: 9 })).toBeNull();
  });

  it('leaves room under each board for extra content', () => {
    const plain = fitBoardGrid({ width: 370, height: 400, boards: 4, rows: 9 })!;
    const extra = fitBoardGrid({ width: 370, height: 400, boards: 4, rows: 9, extraBoardHeight: 40 })!;
    expect(extra.tile).toBeLessThanOrEqual(plain.tile);
  });
});

describe('tile glyph size', () => {
  it('is 58% of the tile, never under 8 px', () => {
    expect(tileFontPx(70)).toBe(41);
    expect(tileFontPx(10)).toBe(8);
  });
});
