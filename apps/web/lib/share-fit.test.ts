import { describe, it, expect } from 'vitest';
import {
  BOARD_W, CAST_ROW, MULTI_CHROME, MULTI_GAP, MULTI_TILE_GAP, SHARE_H_MAX, SHARE_H_MIN, SHARE_W, TITLE_FALLBACK_H, TITLE_MAX_H, TITLE_MAX_W,
  boardBlockHeight, castRowLayout, clampShareHeight, cryptoGeometry, gridGeometry, multiArrangements,
  multiGeometry, planShareCard, shareCastRow, shareFixedHeight, titleBoxHeight, vsBodyGeometry,
  SHARE_SPACE, VS_AVATAR_BLOCK, titleFitsCard, titleRect,
} from './share-fit';
import { ART_SIZE } from './art';
import { MODES } from './modes.generated';
import { gameShareArt } from './share-look';
import { shareCardArt, shareCardPlan } from './share-image';
import { planVsShareCard } from './vs-share-image';
import { SHARE_SAMPLES, VS_SHARE_SAMPLE } from './share-samples';
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

  it('title art fits the card width inside 90 px margins, never taller than its cap', () => {
    expect(titleBoxHeight([1200, 232])).toBe(Math.round(232 * (TITLE_MAX_W / 1200)));
    expect(titleBoxHeight([900, 312])).toBe(TITLE_MAX_H);
    expect(TITLE_MAX_W).toBe(SHARE_W - 180);
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

describe('title art sits fully on the card (founder 10-06: CLASSIC was cut off at the top)', () => {
  it('every game card keeps its whole title box inside the canvas, above the info line', () => {
    for (const { id, input } of SHARE_SAMPLES) {
      const art = shareCardArt(input);
      const nats: Array<readonly [number, number] | null> = [art.title ? ART_SIZE[art.title as keyof typeof ART_SIZE] ?? null : null, null];
      for (const nat of nats) {
        const { plan, titleH } = shareCardPlan(input, nat);
        const r = titleRect(nat, plan.titleTop, titleH);
        expect(titleFitsCard(r, plan.height, plan.headTop), `${id} ${nat ? 'art' : 'fallback'}`).toBe(true);
        expect(r.y, id).toBeGreaterThanOrEqual(SHARE_SPACE.top - 0.5);
        expect(plan.height, id).toBeGreaterThanOrEqual(SHARE_H_MIN);
        expect(plan.height, id).toBeLessThanOrEqual(SHARE_H_MAX);
        // Nothing below the title runs off the card either.
        expect(plan.urlY, id).toBeLessThan(plan.height);
      }
    }
  });

  it('every game title art is drawn whole: the full art scaled to fit, centered, never cropped', () => {
    for (const { id, input } of SHARE_SAMPLES) {
      const name = shareCardArt(input).title;
      expect(name, id).toBeTruthy();
      const nat = ART_SIZE[name as keyof typeof ART_SIZE];
      expect(nat, id).toBeTruthy();
      const r = titleRect(nat, 40);
      // Same aspect as the art (no crop, no stretch) and centered between the margins.
      expect(r.w / r.h, id).toBeCloseTo(nat[0] / nat[1], 3);
      expect(r.x + r.w / 2, id).toBeCloseTo(SHARE_W / 2, 3);
      expect(r.w <= TITLE_MAX_W + 0.5 && r.h <= TITLE_MAX_H + 0.5, id).toBe(true);
      // Wide titles use the card width (with margins); tall ones the height cap.
      expect(Math.max(r.w / TITLE_MAX_W, r.h / TITLE_MAX_H), id).toBeCloseTo(1, 2);
    }
  });

  it('the VS card keeps its title inside too', () => {
    const nat = ART_SIZE['art-title-vs'];
    for (const n of [nat, null]) {
      const { plan, titleH } = planVsShareCard(VS_SHARE_SAMPLE, n, null, VS_AVATAR_BLOCK);
      expect(titleFitsCard(titleRect(n, plan.titleTop, titleH), plan.height, plan.headTop)).toBe(true);
      expect(plan.urlY).toBeLessThan(plan.height);
    }
  });

  it('every game in the catalog has a sample card', () => {
    const covered = new Set(SHARE_SAMPLES.map((s) => s.input.mode));
    for (const m of MODES.filter((x) => x.dbKey && x.title !== 'VS' && gameShareArt(x.title as never).title)) {
      expect(covered.has(m.title as never), m.title).toBe(true);
    }
  });

  it('a title outside the margins or above the card fails the check', () => {
    expect(titleFitsCard({ x: 40, y: 40, w: 1000, h: 200 }, 1500)).toBe(false);
    expect(titleFitsCard({ x: 100, y: -20, w: 800, h: 200 }, 1500)).toBe(false);
    expect(titleFitsCard({ x: 100, y: 40, w: 800, h: 200 }, 1500, 200)).toBe(false);
    expect(titleFitsCard({ x: 100, y: 40, w: 800, h: 200 }, 1500)).toBe(true);
  });
});
