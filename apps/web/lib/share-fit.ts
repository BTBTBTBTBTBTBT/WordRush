// The share image fitted to its puzzle (docs/FINISH_SPEC.md S2 + S3): pure
// layout math every share renderer (lib/share-image.ts, lib/vs-share-image.ts)
// draws from. The canvas is 1080 wide and exactly as tall as its content —
// title art, one info line, the board block, the stat windows and the cast
// wordmark — clamped between 4:5 (1350) and 9:16 (1920); a board too tall for
// that is scaled down by height. The cast row (the ten heroes W·O·R·D·O·C·I·O·U·S
// standing together, the Home header's .castrow) is the only wordmark.
// No DOM, no canvas: unit-tested in share-fit.test.ts.

import { castAspect } from './cast-moves';
import { CAST, type MascotId } from './mascots';
import type {
  ShareCryptogramInput, ShareImageInput, ShareLeaderboardInput, ShareScrambleInput,
} from './share-image';

// ── Canvas ──────────────────────────────────────────────────────────────────

export const SHARE_W = 1080;
/** 4:5 — the shortest card. */
export const SHARE_H_MIN = 1350;
/** 9:16 — the tallest card. */
export const SHARE_H_MAX = 1920;
/** The board block fills ~88% of the width. */
export const BOARD_W = Math.round(SHARE_W * 0.88);
/** The gap between boards in a multi-board grid (~4% of the width). */
export const MULTI_GAP = Math.round(SHARE_W * 0.04);
/** Title art: ~70% of the width, never taller than this. */
export const TITLE_MAX_W = Math.round(SHARE_W * 0.7);
export const TITLE_MAX_H = 200;
/** The lettered title's height when the art didn't load. */
export const TITLE_FALLBACK_H = 96;

/** Vertical rhythm of every card (canvas px). */
export const SHARE_SPACE = {
  top: 40,
  /** Title → info line (or the header rows that replace it). */
  titleGap: 16,
  /** The compact info line. */
  info: 44,
  /** Header → board. */
  headGap: 28,
  /** Board → stat windows. */
  boardGap: 34,
  /** The three stat windows. */
  stats: 136,
  /** Last block → cast row. */
  castGap: 44,
  /** Cast row → "wordocious.com". */
  urlGap: 14,
  url: 28,
  bottom: 30,
} as const;

export function clampShareHeight(h: number): number {
  return Math.max(SHARE_H_MIN, Math.min(SHARE_H_MAX, Math.ceil(h)));
}

/** The title art's drawn height, fit inside TITLE_MAX_W × TITLE_MAX_H (fallback lettering when null). */
export function titleBoxHeight(natural: readonly [number, number] | null, maxW = TITLE_MAX_W, maxH = TITLE_MAX_H): number {
  if (!natural || !natural[0] || !natural[1]) return TITLE_FALLBACK_H;
  const [w, h] = natural;
  return Math.round(h * Math.min(maxW / w, maxH / h));
}

// ── The cast wordmark (S3) ──────────────────────────────────────────────────

/** The Home header's .castrow: margin-right -2.2% of the row, even characters lifted 7 px on ~46 px characters. */
export const CAST_ROW = { widthFrac: 0.9, overlap: 0.022, liftFrac: 7 / 46, shadowFrac: 0.1 } as const;

export interface CastSlot {
  id: MascotId;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CastRowLayout {
  /** Every character's trimmed height (they all stand at one height). */
  charH: number;
  lift: number;
  /** Row height including the lift. */
  height: number;
  rowW: number;
  slots: CastSlot[];
}

/**
 * The ten heroes in WORDOCIOUS order, trimmed to their art boxes, standing
 * together across `rowW` (each overlaps the next by `overlap` of the row, like
 * the header's negative margin), feet on `baseY`, every second one lifted.
 */
export function castRowLayout(rowW: number, cx: number, baseY: number): CastRowLayout {
  const aspects = CAST.map((id) => castAspect(id));
  const sum = aspects.reduce((a, b) => a + b, 0);
  const step = CAST_ROW.overlap * rowW;
  const charH = (rowW + step * (CAST.length - 1)) / sum;
  const lift = Math.round(charH * CAST_ROW.liftFrac);
  let x = cx - rowW / 2;
  const slots = CAST.map((id, i) => {
    const w = aspects[i] * charH;
    const slot = { id, x, y: baseY - charH - (i % 2 === 1 ? lift : 0), w, h: charH };
    x += w - step;
    return slot;
  });
  return { charH, lift, height: charH + lift, rowW, slots };
}

/** The cast row at its share size (90% of the card). */
export function shareCastRow(cx = SHARE_W / 2, baseY = 0): CastRowLayout {
  return castRowLayout(Math.round(SHARE_W * CAST_ROW.widthFrac), cx, baseY);
}

/** The bottom block: cast row + ground shadow + url line + bottom pad. */
export function castBlockHeight(): number {
  const row = shareCastRow();
  return Math.ceil(row.height + row.charH * CAST_ROW.shadowFrac) + SHARE_SPACE.urlGap + SHARE_SPACE.url + SHARE_SPACE.bottom;
}

// ── The stack ───────────────────────────────────────────────────────────────

export interface ShareStackSpec {
  /** Title art (or lettering) height. */
  titleH: number;
  /** What sits between the title and the board (the info line, chips…); 0 = nothing. */
  headH: number;
  /** What sits between the board and the cast (stat windows, a hook line); 0 = nothing. */
  footH: number;
}

export interface SharePlan {
  width: number;
  height: number;
  titleTop: number;
  /** Top of the head block (info line etc.). */
  headTop: number;
  /** The board's box: content plus any slack (center the board in it). */
  boardTop: number;
  boardH: number;
  /** The board's measured height inside the box. */
  contentH: number;
  /** contentH / natural height: < 1 when the board was scaled down to fit 9:16. */
  boardScale: number;
  footTop: number;
  /** The cast row's feet. */
  castBase: number;
  cast: CastRowLayout;
  /** Center line of "wordocious.com". */
  urlY: number;
}

/** Everything but the board. */
export function shareFixedHeight(spec: ShareStackSpec): number {
  const s = SHARE_SPACE;
  return s.top + spec.titleH
    + (spec.headH > 0 ? s.titleGap + spec.headH : 0)
    + s.headGap
    + (spec.footH > 0 ? s.boardGap + spec.footH : 0)
    + s.castGap
    + castBlockHeight();
}

/**
 * Sizes the card to its content. `measure(maxH)` returns the board block's
 * height when it may be at most `maxH` tall (its width is fixed by the
 * caller, usually BOARD_W). Height = the sum of the blocks, clamped to
 * [SHARE_H_MIN, SHARE_H_MAX]; a board that would overflow is measured again
 * against the room left (scaled by height); a short card spreads its slack
 * around the board.
 */
export function planShareCard(spec: ShareStackSpec, measure: (maxH: number) => number): SharePlan {
  const s = SHARE_SPACE;
  const fixed = shareFixedHeight(spec);
  const room = Math.max(40, SHARE_H_MAX - fixed);
  const natural = Math.max(0, measure(100000));
  const contentH = natural > room ? Math.min(room, Math.max(0, measure(room))) : natural;
  const height = clampShareHeight(fixed + contentH);
  const slack = Math.max(0, height - fixed - contentH);

  const titleTop = s.top;
  const headTop = titleTop + spec.titleH + (spec.headH > 0 ? s.titleGap : 0);
  const boardTop = headTop + spec.headH + s.headGap;
  const boardH = contentH + slack;
  const footTop = boardTop + boardH + (spec.footH > 0 ? s.boardGap : 0);
  const cast = shareCastRow();
  const castTop = footTop + spec.footH + s.castGap;
  const castBase = castTop + cast.height;
  const placed = shareCastRow(SHARE_W / 2, castBase);
  const urlY = castBase + Math.ceil(cast.charH * CAST_ROW.shadowFrac) + s.urlGap + s.url / 2;
  return {
    width: SHARE_W,
    height,
    titleTop,
    headTop,
    boardTop,
    boardH,
    contentH,
    boardScale: natural > 0 ? contentH / natural : 1,
    footTop,
    castBase,
    cast: placed,
    urlY,
  };
}

// ── Board geometry (shared by measure + draw) ───────────────────────────────

export interface GridGeometry {
  tile: number;
  gap: number;
  /** The gap between ProperNoundle's name groups. */
  groupGap: number;
  gridW: number;
  gridH: number;
  /** Outer size including the panel chrome and the answer caption. */
  w: number;
  h: number;
}

/**
 * A tile grid fit inside maxW × maxH: `chrome` = panel padding + border on both
 * sides, `captionH` = the revealed-answer strip under it, `groups` = word
 * lengths when the answer has several words (a tile-wide break between them).
 */
export function gridGeometry(
  rows: number,
  cols: number,
  maxW: number,
  maxH: number,
  o: { gap?: number; groups?: number[] | null; captionH?: number; chrome?: number } = {},
): GridGeometry {
  const r = Math.max(1, rows);
  const c = Math.max(1, cols);
  const gap = o.gap ?? 10;
  const chrome = o.chrome ?? 0;
  const cap = o.captionH ?? 0;
  const groups = o.groups && o.groups.length > 1 ? o.groups : null;
  const innerW = maxW - chrome;
  const innerH = maxH - cap - chrome;
  const t1 = Math.floor(Math.min((innerW - gap * (c - 1)) / c, (innerH - gap * (r - 1)) / r));
  const groupGap = groups ? Math.max(gap * 4, t1) : gap;
  const extra = groups ? (groups.length - 1) * (groupGap - gap) : 0;
  const tile = Math.max(4, Math.floor(Math.min((innerW - gap * (c - 1) - extra) / c, (innerH - gap * (r - 1)) / r)));
  const gridW = c * tile + gap * (c - 1) + extra;
  const gridH = r * tile + gap * (r - 1);
  return { tile, gap, groupGap, gridW, gridH, w: gridW + chrome, h: gridH + chrome + cap };
}

/** The panel around each board of a multi-board grid (padding 12 + border 3, both sides). */
export const MULTI_CHROME = 30;
export const MULTI_TILE_GAP = 5;
/** Height under each board reserved for the revealed answer. */
export const ANSWER_CAPTION_H = 44;

/** The arrangements a multi-board card may take: 4 boards are always a 2×2 (never one row of 4). */
export function multiArrangements(n: number): Array<[cols: number, rows: number]> {
  if (n <= 1) return [[1, 1]];
  if (n === 2) return [[2, 1], [1, 2]];
  if (n <= 4) return [[2, 2]];
  return [[4, Math.ceil(n / 4)], [2, Math.ceil(n / 2)]];
}

export interface MultiGeometry {
  cols: number;
  rows: number;
  board: GridGeometry;
  boardGap: number;
  w: number;
  h: number;
}

/** QuadWord / OctoWord: a tight grid of equal boards, the arrangement that draws the biggest tiles. */
export function multiGeometry(
  n: number,
  boardRows: number,
  boardCols: number,
  maxW: number,
  maxH: number,
  captionH = 0,
  boardGap = MULTI_GAP,
): MultiGeometry {
  const fit = ([cols, rows]: [number, number]): MultiGeometry => {
    const board = gridGeometry(
      boardRows, boardCols,
      (maxW - boardGap * (cols - 1)) / cols,
      (maxH - boardGap * (rows - 1)) / rows,
      { gap: MULTI_TILE_GAP, chrome: MULTI_CHROME, captionH },
    );
    return { cols, rows, board, boardGap, w: cols * board.w + boardGap * (cols - 1), h: rows * board.h + boardGap * (rows - 1) };
  };
  return multiArrangements(n).map(fit).reduce((best, g) => (g.board.tile > best.board.tile ? g : best));
}

/** A square board (Sudocious, Starsweep, Spyglass). */
export function squareSize(maxW: number, maxH: number): number {
  return Math.max(60, Math.floor(Math.min(maxW, maxH)));
}

/** A stack of equal rows (Gauntlet stages, Sweep games, leaderboard rows). */
export function stackGeometry(n: number, maxH: number, natural: number, gap: number, min = 40): { rowH: number; gap: number; h: number } {
  const k = Math.max(1, n);
  const rowH = Math.floor(Math.max(min, Math.min(natural, (maxH - gap * (k - 1)) / k)));
  return { rowH, gap, h: n > 0 ? rowH * n + gap * (n - 1) : 0 };
}

/** Letter Ladder: rows of `cols` tiles. */
export function ladderGeometry(rows: number, cols: number, maxW: number, maxH: number): GridGeometry {
  const g = gridGeometry(rows, cols, maxW, maxH, { gap: 12 });
  if (g.tile <= 176) return g;
  return gridGeometry(rows, cols, Math.min(maxW, cols * 176 + 12 * (cols - 1)), maxH, { gap: 12 });
}

/** Hubbub: the 2-3-2 cluster plus the rank name beneath. */
export const HUB_RANK_H = 104;
export function hubGeometry(maxW: number, maxH: number): { tile: number; gap: number; clusterH: number; h: number } {
  const gap = 18;
  const tile = Math.max(30, Math.floor(Math.min(210, (maxW - gap * 2) / 3, (maxH - HUB_RANK_H - gap * 2) / 3)));
  const clusterH = tile * 3 + gap * 2;
  return { tile, gap, clusterH, h: clusterH + HUB_RANK_H };
}

/** Kindred: four tier bars + the mistake dots. */
export const GROUPS_DOTS_H = 76;
export function groupsGeometry(n: number, maxH: number): { barH: number; gap: number; h: number } {
  const gap = 20;
  const barH = Math.floor(Math.max(40, Math.min(124, (maxH - GROUPS_DOTS_H - gap * (n - 1)) / Math.max(1, n))));
  return { barH, gap, h: n * barH + (n - 1) * gap + GROUPS_DOTS_H };
}

/** Crosswordocious: the w × h silhouette. */
export function crosswordGeometry(w: number, h: number, maxW: number, maxH: number): GridGeometry {
  return gridGeometry(h, w, maxW, maxH, { gap: 6 });
}

export interface CryptoGeometry {
  cell: number;
  gap: number;
  wordGap: number;
  /** Cell + the code letter under it. */
  rowH: number;
  codeH: number;
  rowGap: number;
  rows: string[][];
  h: number;
}

/** A cipher word's drawn width: letters as cells, punctuation as narrow marks. */
export function cipherWordWidth(word: string, cell: number, gap: number): number {
  const letters = [...word].filter((ch) => /[A-Z]/.test(ch)).length;
  return letters * (cell + gap) + (word.length - letters) * (cell * 0.45) - gap;
}

/** Codebreaker: the largest cell whose wrapped rows fit maxW × maxH. */
export function cryptoGeometry(cipher: ShareCryptogramInput['cipher'], maxW: number, maxH: number): CryptoGeometry {
  const words = cipher.split(' ').filter((w) => w.length > 0);
  let best: CryptoGeometry | null = null;
  for (let cell = 84; cell >= 24; cell -= 2) {
    const gap = Math.max(4, Math.round(cell * 0.1));
    const wordGap = Math.round(cell * 0.4);
    const codeH = Math.round(Math.max(26, cell * 0.55));
    const rowH = cell + codeH;
    const rowGap = 12;
    const rows: string[][] = [];
    let cur: string[] = [];
    let curW = 0;
    for (const w of words) {
      const ww = cipherWordWidth(w, cell, gap);
      if (cur.length && curW + wordGap + ww > maxW) { rows.push(cur); cur = []; curW = 0; }
      curW += (cur.length ? wordGap : 0) + ww;
      cur.push(w);
    }
    if (cur.length) rows.push(cur);
    const h = rows.length * rowH + Math.max(0, rows.length - 1) * rowGap;
    best = { cell, gap, wordGap, rowH, codeH, rowGap, rows, h };
    if (h <= maxH) break;
  }
  return best!;
}

/** Muddle: the four jumbles, a divider, then the punchline row. */
export const SCRAMBLE_DIVIDER_H = 40;
export function scrambleGeometry(
  words: ShareScrambleInput['words'],
  pattern: number[],
  maxW: number,
  maxH: number,
): { tile: number; gap: number; rowGap: number; small: number; smallGap: number; wordGap: number; cols: number; h: number } {
  const rows = words.length;
  const cols = Math.max(6, ...words.map((w) => w.length));
  const gap = 12;
  const rowGap = 24;
  const smallGap = 6;
  const wordGap = 26;
  const tile = Math.max(20, Math.floor(Math.min(
    132,
    (maxW - gap * (cols - 1)) / cols,
    (maxH - rowGap * rows - SCRAMBLE_DIVIDER_H) / (rows + 0.78),
  )));
  const letters = pattern.reduce((a, b) => a + b, 0);
  const fitSmall = letters > 0
    ? (maxW - (letters - pattern.length) * smallGap - Math.max(0, pattern.length - 1) * wordGap) / letters
    : tile;
  const small = Math.max(12, Math.floor(Math.min(tile * 0.78, fitSmall)));
  return { tile, gap, rowGap, small, smallGap, wordGap, cols, h: rows * (tile + rowGap) + SCRAMBLE_DIVIDER_H + small };
}

/** Profile card body: name, level line, 2 × 3 stat tiles. */
export const PROFILE_HEAD_H = 166;
export function profileGeometry(maxH: number): { tileH: number; gap: number; h: number } {
  const gap = 22;
  const tileH = Math.floor(Math.max(96, Math.min(176, (maxH - PROFILE_HEAD_H - gap * 2) / 3)));
  return { tileH, gap, h: PROFILE_HEAD_H + tileH * 3 + gap * 2 };
}

/** Leaderboard rows panel. */
export const LB_PANEL_PAD = 16;
export const LB_DIVIDER_H = 46;
export const LB_ROW_MAX = 130;
export function leaderboardPanelGeometry(input: Pick<ShareLeaderboardInput, 'rows' | 'you'>, maxH: number): { rowH: number; dividerH: number; pad: number; nRows: number; h: number } {
  const dividerH = input.you ? LB_DIVIDER_H : 0;
  const nRows = input.rows.length + (input.you ? 1 : 0);
  if (!nRows) return { rowH: 0, dividerH, pad: LB_PANEL_PAD, nRows, h: 0 };
  const rowH = Math.floor(Math.max(72, Math.min(LB_ROW_MAX, (maxH - LB_PANEL_PAD * 2 - dividerH) / nRows)));
  return { rowH, dividerH, pad: LB_PANEL_PAD, nRows, h: rowH * nRows + dividerH + LB_PANEL_PAD * 2 };
}

/** VS: one player's board card (tinted panel + glossy grid) inside a maxSide square. */
export function vsBoardGeometry(maxSide: number, rows: number, cols: number): { tile: number; gap: number; pad: number; cardW: number; cardH: number } {
  const gap = Math.max(3, maxSide * 0.016);
  const pad = maxSide * 0.045;
  const inner = maxSide - pad * 2;
  const tile = Math.max(4, Math.floor(Math.min((inner - gap * (cols - 1)) / cols, (inner - gap * (rows - 1)) / rows)));
  return {
    tile, gap, pad,
    cardW: tile * cols + gap * (cols - 1) + pad * 2,
    cardH: tile * rows + gap * (rows - 1) + pad * 2,
  };
}

/** VS head-to-head: name, score window, then up to two boards per side. */
export const VS_NAME_H = 40;
export const VS_WINDOW_H = 116;
export const VS_BOARD_GAP = 14;
export const VS_MORE_H = 30;
/** The widest a side's board may be (two columns at 27% / 73% of the card). */
export const VS_COL_MAX = 420;
export const VS_HEAD_BLOCK_H = VS_NAME_H + 4 + VS_WINDOW_H + 18;
/** BJ5: each side's resolved avatar above its name (72 px at the 1080 canvas) + its gap. */
export const VS_AVATAR_PX = 72;
export const VS_AVATAR_BLOCK = VS_AVATAR_PX + 8;
export function vsBodyGeometry(
  shownBoards: number,
  rows: number,
  cols: number,
  maxH: number,
  hasMore: boolean,
  /** BJ5: room above each name for the player's avatar (VS_AVATAR_BLOCK when drawn). */
  headExtra = 0,
): { maxSide: number; cardH: number; h: number } {
  const more = hasMore ? VS_MORE_H : 0;
  const head = VS_HEAD_BLOCK_H + headExtra;
  if (shownBoards <= 0) return { maxSide: 0, cardH: 0, h: head + more };
  const budget = maxH - head - more - VS_BOARD_GAP * (shownBoards - 1);
  const maxSide = Math.max(80, Math.min(VS_COL_MAX, budget / shownBoards));
  const { cardH } = vsBoardGeometry(maxSide, rows, cols);
  return { maxSide, cardH, h: head + shownBoards * cardH + VS_BOARD_GAP * (shownBoards - 1) + more };
}

// ── The board block per result layout ───────────────────────────────────────

/** Rows/cols of a multi-board card (every board drawn at the largest board's size). */
export function multiDims(boards: Array<{ grid: unknown[][] }>): { rows: number; cols: number } {
  return {
    rows: Math.max(1, ...boards.map((b) => b.grid.length)),
    cols: Math.max(5, ...boards.map((b) => b.grid[0]?.length ?? 0)),
  };
}

/** Letter Ladder's rows: start, each rung, and the end when it wasn't reached. */
export function ladderRowCount(words: string[], start: string, end: string): number {
  const w = words.length ? words : [start];
  return w.length + (w[w.length - 1] !== end ? 1 : 0);
}

/** The single board's answer-caption strip (revealed losses only). */
export function singleCaptionH(input: { reveal?: boolean; won: boolean; solutionDisplay?: string }): number {
  return input.reveal && !input.won && input.solutionDisplay ? ANSWER_CAPTION_H : 0;
}

/**
 * The height a result card's board block takes at width `maxW` when it may be
 * at most `maxH` tall. Leaderboard / profile / sweep / VS cards size their own
 * bodies (see their geometry above) and return 0 here.
 */
export function boardBlockHeight(input: ShareImageInput, maxW: number, maxH: number): number {
  switch (input.layout) {
    case 'single': {
      const rows = input.grid.length;
      const cols = input.grid[0]?.length ?? 0;
      if (!rows || !cols) return 0;
      return gridGeometry(rows, cols, maxW, maxH, { gap: 10, groups: input.wordGroups, captionH: singleCaptionH(input) }).h;
    }
    case 'multi': {
      if (!input.boards.length || !input.boards[0].grid.length) return 0;
      const { rows, cols } = multiDims(input.boards);
      return multiGeometry(input.boards.length, rows, cols, maxW, maxH, input.reveal ? ANSWER_CAPTION_H : 0).h;
    }
    case 'gauntlet':
      return stackGeometry(input.stages.length, maxH, 118, 18, 56).h;
    case 'sudoku':
    case 'regions':
    case 'wordsearch':
      return squareSize(maxW, maxH);
    case 'ladder': {
      const cols = Math.max(input.start.length, input.end.length, 3);
      return ladderGeometry(ladderRowCount(input.words, input.start, input.end), cols, maxW, maxH).h;
    }
    case 'hub':
      return hubGeometry(maxW, maxH).h;
    case 'cryptogram':
      return cryptoGeometry(input.cipher, maxW, maxH).h;
    case 'groups':
      return groupsGeometry(4, maxH).h;
    case 'crossword':
      return crosswordGeometry(input.w, input.h, maxW, maxH).h;
    case 'scramble':
      return scrambleGeometry(input.words, input.pattern, maxW, maxH).h;
    case 'daily-sweep':
      return stackGeometry(input.games.length, maxH, 112, input.games.length > 8 ? 12 : 16, 48).h;
    case 'profile':
      return profileGeometry(maxH).h;
    case 'leaderboard':
      return leaderboardPanelGeometry(input, maxH).h;
    default:
      return 0;
  }
}
