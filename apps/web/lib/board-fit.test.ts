import { describe, expect, it } from 'vitest';
import { BOARD_FIT, CROSSWORD_FIT, crosswordCell, crosswordCellFonts, fitBoard, fitBoardGrid, tileFontPx } from './board-fit';

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

// FINISH_SPEC BI18: Crosswordocious fits one screen in play (founder 10-03).
describe('crosswordCell', () => {
  const chrome = { x: 19, y: 23 }; // trayChrome(8): padding + border each side, plus the lip
  const fits = (cell: number, w: number, h: number, cols: number, rows: number) => {
    expect(cell * cols + 3 * (cols - 1) + chrome.x).toBeLessThanOrEqual(w - 2 * CROSSWORD_FIT.side);
    expect(cell * rows + 3 * (rows - 1) + chrome.y).toBeLessThanOrEqual(h - CROSSWORD_FIT.vPad);
  };

  it('sizes a 10 × 11 daily from the HEIGHT left on a 375 × 667 phone (band ≈ 304 px)', () => {
    // width alone would give 30; the height is the limit: (304 − 23 − 8 − 30) / 11 = 22.1 → 22
    const cell = crosswordCell(375, 304, 10, 11, chrome);
    expect(cell).toBe(22);
    fits(cell, 375, 304, 10, 11);
  });

  it('grows on taller phones and caps at 42 px', () => {
    const c390 = crosswordCell(390, 410, 10, 11, chrome);
    expect(c390).toBeGreaterThan(22);
    fits(c390, 390, 410, 10, 11);
    expect(crosswordCell(560, 900, 10, 11, chrome)).toBe(CROSSWORD_FIT.maxCell);
  });

  it('handles non-square and smaller grids (width-limited when wide)', () => {
    const wide = crosswordCell(375, 400, 10, 9, chrome);
    fits(wide, 375, 400, 10, 9);
    expect(crosswordCell(375, 311, 7, 7, chrome)).toBeGreaterThan(crosswordCell(375, 311, 10, 11, chrome));
  });

  it('never drops under the 14 px floor', () => {
    expect(crosswordCell(375, 120, 10, 11, chrome)).toBe(CROSSWORD_FIT.minCell);
    expect(crosswordCell(0, 0, 10, 11, chrome)).toBe(CROSSWORD_FIT.minCell);
  });

  it('scales the letter and the clue number with the cell (unchanged on big cells)', () => {
    expect(crosswordCellFonts(42)).toEqual({ letter: 19, number: 8 });
    expect(crosswordCellFonts(22)).toEqual({ letter: 11, number: 7 });
    const small = crosswordCellFonts(14);
    expect(small.letter).toBe(8);
    expect(small.number).toBe(5);
  });
});
