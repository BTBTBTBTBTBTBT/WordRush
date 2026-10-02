import { describe, it, expect } from 'vitest';
import {
  BOARD_W, CAST_ROW, MULTI_CHROME, MULTI_GAP, MULTI_TILE_GAP, SHARE_H_MAX, SHARE_H_MIN, SHARE_W, TITLE_FALLBACK_H, TITLE_MAX_H, TITLE_MAX_W,
  boardBlockHeight, castRowLayout, clampShareHeight, cryptoGeometry, gridGeometry, multiArrangements,
  multiGeometry, planShareCard, shareCastRow, shareFixedHeight, titleBoxHeight, vsBodyGeometry,
} from './share-fit';
import { CAST } from './mascots';
import type { ShareImageInput, TileStateString } from './share-image';

const rows = (r: number, c: number): TileStateString[][] =>
  Array.from({ length: r }, () => Array.from({ length: c }, () => 'ABSENT' as TileStateString));

const GAME_HEAD = { titleH: 180, headH: 44, footH: 136 };

describe('canvas clamp (S2: 4:5 … 9:16)', () => {
  it('clamps the height to [1350, 1920] at width 1080', () => {
    expect(SHARE_W).toBe(1080);
    expect(clampShareHeight(900)).toBe(SHARE_H_MIN);
    expect(clampShareHeight(1500.2)).toBe(1501);
    expect(clampShareHeight(2600)).toBe(SHARE_H_MAX);
    expect(SHARE_H_MIN / SHARE_W).toBeCloseTo(5 / 4);
    expect(SHARE_H_MAX / SHARE_W).toBeCloseTo(16 / 9);
  });

  it('title art fits ~70% of the width, never taller than its cap', () => {
    expect(titleBoxHeight([900, 232])).toBe(Math.round(232 * (TITLE_MAX_W / 900)));
    expect(titleBoxHeight([900, 312])).toBe(TITLE_MAX_H);
    expect(titleBoxHeight(null)).toBe(TITLE_FALLBACK_H);
  });
});

describe('content-height sum + clamp', () => {
  it('a board that fits makes the card exactly the sum of its blocks', () => {
    const plan = planShareCard(GAME_HEAD, () => 600);
    const fixed = shareFixedHeight(GAME_HEAD);
    expect(fixed + 600).toBeGreaterThan(SHARE_H_MIN);
    expect(plan.height).toBe(clampShareHeight(fixed + 600));
    expect(plan.boardH).toBe(600);
    expect(plan.boardScale).toBe(1);
  });

  it('a short card is 4:5 and spreads the slack around the board', () => {
    const plan = planShareCard(GAME_HEAD, () => 100);
    expect(plan.height).toBe(SHARE_H_MIN);
    expect(plan.contentH).toBe(100);
    expect(plan.boardH).toBe(SHARE_H_MIN - shareFixedHeight(GAME_HEAD));
  });

  it('a board taller than 9:16 allows is measured again by height', () => {
    const plan = planShareCard(GAME_HEAD, (maxH) => Math.min(3000, maxH));
    expect(plan.height).toBe(SHARE_H_MAX);
    expect(plan.contentH).toBe(SHARE_H_MAX - shareFixedHeight(GAME_HEAD));
    expect(plan.boardScale).toBeLessThan(1);
  });

  it('blocks stack top to bottom inside the canvas, the url line last', () => {
    const plan = planShareCard(GAME_HEAD, () => 700);
    expect(plan.titleTop).toBeLessThan(plan.headTop);
    expect(plan.headTop).toBeLessThan(plan.boardTop);
    expect(plan.boardTop + plan.boardH).toBeLessThan(plan.footTop);
    expect(plan.footTop + GAME_HEAD.footH).toBeLessThan(plan.castBase - plan.cast.height);
    expect(plan.castBase).toBeLessThan(plan.urlY);
    expect(plan.urlY).toBeLessThan(plan.height);
  });
});

describe('board block sizing', () => {
  it('a single board fills ~88% of the width', () => {
    const g = gridGeometry(6, 5, BOARD_W, 100000, { gap: 10 });
    expect(g.w).toBeLessThanOrEqual(BOARD_W);
    expect(g.w).toBeGreaterThan(BOARD_W - 10);
  });

  it('Classic sizes a card within the clamp at full width', () => {
    const input: ShareImageInput = { layout: 'single', mode: 'Classic', won: true, guesses: 4, maxGuesses: 6, timeSeconds: 40, grid: rows(6, 5) };
    const plan = planShareCard(GAME_HEAD, (h) => boardBlockHeight(input, BOARD_W, h));
    expect(plan.height).toBeGreaterThanOrEqual(SHARE_H_MIN);
    expect(plan.height).toBeLessThanOrEqual(SHARE_H_MAX);
    expect(plan.contentH).toBeLessThanOrEqual(plan.boardH);
  });

  it('ProperNoundle keeps a tile-wide gap between names and still fits the width', () => {
    const g = gridGeometry(6, 12, BOARD_W, 100000, { gap: 10, groups: [6, 6] });
    expect(g.groupGap).toBeGreaterThanOrEqual(g.tile);
    expect(g.gridW).toBeLessThanOrEqual(BOARD_W);
  });

  it('the revealed answer caption is part of the block', () => {
    const plain = gridGeometry(6, 5, BOARD_W, 900, { gap: 10 });
    const cap = gridGeometry(6, 5, BOARD_W, 900, { gap: 10, captionH: 44 });
    expect(cap.h).toBeLessThanOrEqual(900);
    expect(cap.tile).toBeLessThanOrEqual(plain.tile);
  });

  it('Codebreaker wraps whole words and shrinks the cells until it fits', () => {
    const cipher = 'QEB NRFZH YOLTK CLU GRJMP LSBO QEB IXWV ALD XKA QEBK PLJB JLOB TLOAP QL TOXM';
    const g = cryptoGeometry(cipher, BOARD_W, 400);
    expect(g.h).toBeLessThanOrEqual(400);
    expect(g.rows.flat().join(' ')).toBe(cipher);
  });
});

describe('multi-board 2×2 (S2)', () => {
  it('4 boards are always a 2×2, never one row of 4', () => {
    expect(multiArrangements(4)).toEqual([[2, 2]]);
    const g = multiGeometry(4, 9, 5, BOARD_W, 1000);
    expect([g.cols, g.rows]).toEqual([2, 2]);
    expect(g.boardGap).toBe(MULTI_GAP);
    expect(MULTI_GAP).toBe(Math.round(SHARE_W * 0.04));
    expect(g.w).toBeLessThanOrEqual(BOARD_W);
    expect(g.h).toBeLessThanOrEqual(1000);
  });

  it('8 boards take whichever of 4×2 / 2×4 draws bigger tiles', () => {
    expect(multiArrangements(8)).toEqual([[4, 2], [2, 4]]);
    const g = multiGeometry(8, 13, 5, BOARD_W, 1100);
    expect(['4x2', '2x4']).toContain(`${g.cols}x${g.rows}`);
    for (const [cols, rws] of multiArrangements(8)) {
      const alt = gridGeometry(13, 5, (BOARD_W - MULTI_GAP * (cols - 1)) / cols, (1100 - MULTI_GAP * (rws - 1)) / rws, { gap: MULTI_TILE_GAP, chrome: MULTI_CHROME });
      expect(g.board.tile).toBeGreaterThanOrEqual(alt.tile);
    }
    expect(g.h).toBeLessThanOrEqual(1100);
    expect(g.w).toBeLessThanOrEqual(BOARD_W);
  });

  it('a QuadWord card scales its boards by height to stay inside 9:16', () => {
    const board = { grid: rows(9, 5), won: true };
    const input: ShareImageInput = {
      layout: 'multi', mode: 'QuadWord', won: true, guesses: 8, maxGuesses: 9, timeSeconds: 100,
      boards: [board, board, board, board], boardsSolved: 4, totalBoards: 4,
    };
    const plan = planShareCard(GAME_HEAD, (h) => boardBlockHeight(input, BOARD_W, h));
    expect(plan.height).toBeLessThanOrEqual(SHARE_H_MAX);
    expect(plan.height).toBeGreaterThan(SHARE_H_MAX - 40);
    expect(plan.boardScale).toBeLessThan(1);
    expect(boardBlockHeight(input, BOARD_W, plan.boardH)).toBeLessThanOrEqual(plan.boardH);
  });
});

describe('cast row spacing (S3: the cast IS the wordmark)', () => {
  it('stands W·O·R·D·O·C·I·O·U·S together across exactly the row width', () => {
    const row = castRowLayout(900, 540, 1000);
    expect(row.slots.map((s) => s.id)).toEqual([...CAST]);
    const first = row.slots[0];
    const last = row.slots[row.slots.length - 1];
    expect(first.x).toBeCloseTo(540 - 450);
    expect(last.x + last.w).toBeCloseTo(540 + 450);
  });

  it('each character overlaps the next by 2.2% of the row (the header .castrow margin)', () => {
    const row = castRowLayout(900, 540, 1000);
    for (let i = 1; i < row.slots.length; i++) {
      const prev = row.slots[i - 1];
      expect(row.slots[i].x).toBeCloseTo(prev.x + prev.w - CAST_ROW.overlap * 900);
    }
  });

  it('all stand at one height, every second one lifted', () => {
    const row = castRowLayout(900, 540, 1000);
    row.slots.forEach((s, i) => {
      expect(s.h).toBeCloseTo(row.charH);
      expect(s.y + s.h).toBeCloseTo(i % 2 === 1 ? 1000 - row.lift : 1000);
    });
    expect(row.lift).toBeGreaterThan(0);
  });

  it('spans ~90% of the card, big enough to read', () => {
    const row = shareCastRow();
    expect(row.rowW).toBe(Math.round(SHARE_W * 0.9));
    expect(row.charH).toBeGreaterThan(100);
  });
});

describe('VS head-to-head', () => {
  it('fits two boards a side in the room given', () => {
    const g = vsBodyGeometry(2, 6, 5, 1000, true);
    expect(g.h).toBeLessThanOrEqual(1000);
    expect(g.maxSide).toBeGreaterThan(0);
    expect(vsBodyGeometry(0, 6, 5, 1000, false).cardH).toBe(0);
  });
});
