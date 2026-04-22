'use client';

import { evaluateGuess, GameStatus, type BoardState } from '@wordle-duel/core';
import { getTodayLocal } from './daily-service';

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

/**
 * Uppercase tile-state string. Classic/Quordle/etc. produce these directly
 * from the core reducer; ProperNoundle uses lowercase internally and
 * normalizes to this set at the share-image boundary.
 */
export type TileStateString = 'CORRECT' | 'PRESENT' | 'ABSENT' | 'EMPTY';

export type ShareMode =
  | 'Classic'
  | 'QuadWord'
  | 'OctoWord'
  | 'Succession'
  | 'Deliverance'
  | 'Gauntlet'
  | 'ProperNoundle';

interface ShareBase {
  mode: ShareMode;
  won: boolean;
  timeSeconds: number;
  guesses: number;
  maxGuesses: number;
  /** Defaults to today's local date. */
  date?: Date;
}

export interface ShareSingleInput extends ShareBase {
  layout: 'single';
  /** Rows of evaluated tiles, one row per guess. Empty rows are padded automatically. */
  grid: TileStateString[][];
  /** Optional category pill (ProperNoundle only). */
  category?: string;
}

export interface ShareMultiBoard {
  grid: TileStateString[][];
  /** Whether this specific board was solved — drives its green/red border + tint. */
  won: boolean;
}

export interface ShareMultiInput extends ShareBase {
  layout: 'multi';
  /** Per-board tile grids plus each board's win/loss — mirrors the in-app
   *  finished-screen treatment where each board has its own colored border. */
  boards: ShareMultiBoard[];
  boardsSolved: number;
  totalBoards: number;
}

export interface ShareGauntletInput extends ShareBase {
  layout: 'gauntlet';
  stages: Array<{
    name: string;
    status: GameStatus;
    guesses: number;
    boardsSolved: number;
    totalBoards: number;
  }>;
  stagesCompleted: number;
  totalStages: number;
}

export type ShareImageInput = ShareSingleInput | ShareMultiInput | ShareGauntletInput;

// ──────────────────────────────────────────────────────────────────────────
// Palette (matches the in-app tile + chip colors)
// ──────────────────────────────────────────────────────────────────────────

const BG = '#f8f7ff';
const TILE_COLORS: Record<TileStateString, string> = {
  CORRECT: '#16a34a',
  PRESENT: '#eab308',
  ABSENT: '#9ca3af',
  EMPTY: '#e5e7eb',
};
const TILE_BORDER_EMPTY = '#d1d5db';

const MODE_ACCENT: Record<ShareMode, string> = {
  Classic: '#7c3aed',
  QuadWord: '#ec4899',
  OctoWord: '#7e22ce',
  Succession: '#2563eb',
  Deliverance: '#059669',
  Gauntlet: '#d97706',
  ProperNoundle: '#dc2626',
};

const WORDMARK_GRADIENT: [string, string] = ['#a78bfa', '#ec4899'];
const FOOT_COLOR = '#9ca3af';
const TEXT_DARK = '#1a1a2e';
const TEXT_MUTED = '#6b7280';

// Win/Loss pill (same as profile + leaderboard pills we shipped earlier).
const WIN_BG = '#dcfce7';
const WIN_FG = '#16a34a';
const LOSS_BG = '#fee2e2';
const LOSS_FG = '#dc2626';

// Softer tint used behind a board's tile grid so the colored border has a
// subtle fill to match the in-app finished screen.
const BOARD_WIN_TINT = '#f0fdf4'; // green-50
const BOARD_LOSS_TINT = '#fef2f2'; // red-50

// ──────────────────────────────────────────────────────────────────────────
// Helpers — BoardState → normalized grid
// ──────────────────────────────────────────────────────────────────────────

/**
 * Evaluate every row of a BoardState into tile-state grids. Prefilled
 * guesses (Deliverance) appear first, followed by the player's guesses.
 * Empty rows are padded with EMPTY so every board in a multi-board share
 * has the same total row count the player saw in-app — specifically
 * `prefilledGuesses.length + maxGuesses`, since `maxGuesses` is the player
 * guess budget *excluding* prefills (see reducer.ts where the LOST check
 * uses `newGuesses.length >= board.maxGuesses`). Without including the
 * prefill count in the pad target, Deliverance boards would render at
 * different heights depending on how far each player got, and downstream
 * drawBoardCard would size tiles differently per board — the "funky sizes"
 * bug the share image had.
 */
export function boardToGrid(board: BoardState): TileStateString[][] {
  const width = board.solution.length;
  const rows: TileStateString[][] = [];
  const prefillCount = board.prefilledGuesses?.length ?? 0;

  if (board.prefilledGuesses?.length) {
    for (const p of board.prefilledGuesses) {
      rows.push(p.evaluation.tiles.map(t => t.state as TileStateString));
    }
  }
  for (const guess of board.guesses) {
    const ev = evaluateGuess(board.solution, guess);
    rows.push(ev.tiles.map(t => t.state as TileStateString));
  }
  const totalRows = prefillCount + board.maxGuesses;
  while (rows.length < totalRows) {
    rows.push(Array(width).fill('EMPTY'));
  }
  return rows;
}

// ──────────────────────────────────────────────────────────────────────────
// Drawing primitives
// ──────────────────────────────────────────────────────────────────────────

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  state: TileStateString,
): void {
  drawRoundRect(ctx, x, y, size, size, Math.max(4, size * 0.12));
  ctx.fillStyle = TILE_COLORS[state];
  ctx.fill();
  if (state === 'EMPTY') {
    ctx.strokeStyle = TILE_BORDER_EMPTY;
    ctx.lineWidth = Math.max(1, size * 0.025);
    ctx.stroke();
  }
}

/**
 * Paint a board: optional colored "card" (tinted background + thick border)
 * matching the in-app finished-screen treatment, then the tile grid inside.
 * When `won` is null the card is omitted — used for single-board layouts that
 * rely on the header Win/Loss pill instead.
 */
function drawBoardCard(
  ctx: CanvasRenderingContext2D,
  grid: TileStateString[][],
  centerX: number,
  centerY: number,
  maxWidth: number,
  maxHeight: number,
  won: boolean | null,
): void {
  if (!grid.length) return;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!cols) return;

  const cardPad = won === null ? 0 : 12;
  const borderWidth = won === null ? 0 : 3;

  const gap = 4;
  const innerMaxW = maxWidth - cardPad * 2 - borderWidth * 2;
  const innerMaxH = maxHeight - cardPad * 2 - borderWidth * 2;
  const tileFromWidth = (innerMaxW - gap * (cols - 1)) / cols;
  const tileFromHeight = (innerMaxH - gap * (rows - 1)) / rows;
  const tile = Math.floor(Math.min(tileFromWidth, tileFromHeight));
  const totalW = cols * tile + gap * (cols - 1);
  const totalH = rows * tile + gap * (rows - 1);

  if (won !== null) {
    // Colored card behind the tile grid — matches in-app finished board look.
    const cardW = totalW + cardPad * 2;
    const cardH = totalH + cardPad * 2;
    const cardX = centerX - cardW / 2;
    const cardY = centerY - cardH / 2;
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.fillStyle = won ? BOARD_WIN_TINT : BOARD_LOSS_TINT;
    ctx.fill();
    ctx.strokeStyle = won ? WIN_FG : LOSS_FG;
    ctx.lineWidth = borderWidth;
    ctx.stroke();
  }

  const x0 = centerX - totalW / 2;
  const y0 = centerY - totalH / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      drawTile(ctx, x0 + c * (tile + gap), y0 + r * (tile + gap), tile, grid[r][c]);
    }
  }
}

function drawWinLossPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  won: boolean,
): { width: number; height: number } {
  const label = won ? 'Win' : 'Loss';
  const bg = won ? WIN_BG : LOSS_BG;
  const fg = won ? WIN_FG : LOSS_FG;
  ctx.font = '700 22px "Nunito", system-ui, -apple-system, sans-serif';
  const labelW = ctx.measureText(label).width;
  const padX = 16;
  const padY = 8;
  const width = labelW + padX * 2;
  const height = 22 + padY * 2;
  drawRoundRect(ctx, x, y, width, height, 10);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + width / 2, y + height / 2 + 1);
  return { width, height };
}

function drawCategoryPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  color: string,
): { width: number; height: number } {
  ctx.font = '700 18px "Nunito", system-ui, -apple-system, sans-serif';
  const w = ctx.measureText(label).width + 24;
  const h = 30;
  drawRoundRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  return { width: w, height: h };
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ──────────────────────────────────────────────────────────────────────────
// Header / footer
// ──────────────────────────────────────────────────────────────────────────

function drawHeader(
  ctx: CanvasRenderingContext2D,
  input: ShareImageInput,
  width: number,
): { bottomY: number } {
  // Wordmark
  ctx.save();
  const wordmarkY = 72;
  ctx.font = '900 56px "Nunito", system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const gradient = ctx.createLinearGradient(width / 2 - 200, wordmarkY - 48, width / 2 + 200, wordmarkY + 8);
  gradient.addColorStop(0, WORDMARK_GRADIENT[0]);
  gradient.addColorStop(1, WORDMARK_GRADIENT[1]);
  ctx.fillStyle = gradient;
  ctx.fillText('WORDOCIOUS', width / 2, wordmarkY);
  ctx.restore();

  // Mode name in mode accent color
  const modeY = wordmarkY + 60;
  ctx.font = '900 38px "Nunito", system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = MODE_ACCENT[input.mode];
  const modeLabel = input.mode.toUpperCase();
  ctx.fillText(modeLabel, width / 2, modeY);

  // Metadata line
  const metaY = modeY + 48;
  const date = input.date ?? new Date(getTodayLocal() + 'T00:00:00');
  const dateStr = formatShortDate(date);
  const timeStr = formatTime(input.timeSeconds);

  let statsText: string;
  if (input.layout === 'gauntlet') {
    statsText = `${input.stagesCompleted}/${input.totalStages} stages · ${input.guesses} guesses · ${timeStr} · ${dateStr}`;
  } else if (input.layout === 'multi') {
    const guessDisplay = input.won ? `${input.guesses}/${input.maxGuesses}` : `X/${input.maxGuesses}`;
    statsText = `${input.boardsSolved}/${input.totalBoards} boards · ${guessDisplay} · ${timeStr} · ${dateStr}`;
  } else {
    const guessDisplay = input.won ? `${input.guesses}/${input.maxGuesses}` : `X/${input.maxGuesses}`;
    statsText = `${guessDisplay} · ${timeStr} · ${dateStr}`;
  }

  ctx.font = '700 24px "Nunito", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = TEXT_MUTED;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const statsWidth = ctx.measureText(statsText).width;

  // ProperNoundle: category pill before stats
  let categoryPillW = 0;
  let pillGap = 0;
  const pillBlockHeight = 38;
  if (input.layout === 'single' && input.category) {
    pillGap = 12;
  }

  const winPill = { width: 0, height: 38 };
  // Measure win/loss pill without drawing
  ctx.font = '700 22px "Nunito", system-ui, -apple-system, sans-serif';
  const pillLabel = input.won ? 'Win' : 'Loss';
  const pillLabelW = ctx.measureText(pillLabel).width;
  winPill.width = pillLabelW + 32;

  if (input.layout === 'single' && input.category) {
    ctx.font = '700 18px "Nunito", system-ui, -apple-system, sans-serif';
    categoryPillW = ctx.measureText(input.category).width + 24;
  }

  const pillSpacing = 12;
  const blockWidth =
    statsWidth +
    (categoryPillW > 0 ? categoryPillW + pillSpacing : 0) +
    pillSpacing +
    winPill.width;
  const blockStartX = width / 2 - blockWidth / 2;

  // stats text
  ctx.font = '700 24px "Nunito", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = TEXT_MUTED;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(statsText, blockStartX, metaY);

  let cursorX = blockStartX + statsWidth + pillSpacing;

  if (input.layout === 'single' && input.category) {
    const pill = drawCategoryPill(ctx, cursorX, metaY - 15, input.category, MODE_ACCENT[input.mode]);
    cursorX += pill.width + pillSpacing;
  }

  drawWinLossPill(ctx, cursorX, metaY - 19, input.won);

  return { bottomY: metaY + pillBlockHeight };
}

function drawFooter(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.font = '700 22px "Nunito", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = FOOT_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('wordocious.com', width / 2, height - 40);
}

// ──────────────────────────────────────────────────────────────────────────
// Board-area drawing per layout
// ──────────────────────────────────────────────────────────────────────────

function drawSingle(
  ctx: CanvasRenderingContext2D,
  input: ShareSingleInput,
  width: number,
  headerBottom: number,
  footerTop: number,
): void {
  const areaHeight = footerTop - headerBottom;
  const centerX = width / 2;
  const centerY = headerBottom + areaHeight / 2;
  const maxWidth = width - 160;
  const maxHeight = areaHeight - 80;
  // Single-board modes: card matches the header Win/Loss pill so the border
  // echoes the result in the body too — same treatment as multi-board.
  drawBoardCard(ctx, input.grid, centerX, centerY, maxWidth, maxHeight, input.won);
}

function drawMulti(
  ctx: CanvasRenderingContext2D,
  input: ShareMultiInput,
  width: number,
  headerBottom: number,
  footerTop: number,
): void {
  const n = input.boards.length;
  if (!n || !input.boards[0].grid.length) return;

  // Match the in-app finished-screen arrangement:
  //   4 boards → 2 cols × 2 rows (Quordle / Succession / Deliverance)
  //   8 boards → 4 cols × 2 rows (Octordle)
  const cols = n <= 4 ? 2 : 4;
  const rows = 2;

  // Use the *max* row/col count across all boards to compute a single tile
  // size that every board renders at. drawBoardCard later re-derives its own
  // tile size from each board's grid — feeding it a uniform row count
  // (via boardToGrid's pad-to-prefill+maxGuesses) keeps the sizes matched.
  // Guarding here against a stray board being taller/wider defends against
  // future modes that pack boards with mismatched dimensions.
  const boardCols = Math.max(5, ...input.boards.map(b => b.grid[0]?.length ?? 0));
  const boardRows = Math.max(1, ...input.boards.map(b => b.grid.length));

  // Layout constants — must match drawBoardCard so the pre-compute here
  // produces the same `tile` value the card's internal math will pick.
  const cardPad = 12;
  const borderWidth = 3;
  const tileGap = 4;

  // Inter-board gaps. The previous version divided the canvas into equal
  // cells and centered each board inside its cell — at tile sizes the
  // boards ended up small and the intra-cell slack compounded into a huge
  // "sea" between them. Now we size boards to their natural height
  // constraint and place them directly with a known gap, so the 2×2 grid
  // packs tightly with modest outer margin instead of two lonely columns.
  const rowGap = 20;
  const colGap = 16;
  const verticalPad = 32;
  const minHorizontalPad = 40;

  const areaHeight = footerTop - headerBottom - verticalPad * 2;

  // Tile size derives from whichever axis is tighter. Boards are typically
  // tall-and-narrow (5×9, 5×10, 5×13), so the row budget binds — the width
  // clamp is only there for defensive over-wide inputs.
  const perRowHeight = (areaHeight - rowGap * (rows - 1)) / rows;
  const tileFromHeight =
    (perRowHeight - cardPad * 2 - borderWidth * 2 - tileGap * (boardRows - 1)) / boardRows;
  const availW = width - minHorizontalPad * 2 - colGap * (cols - 1);
  const perColWidth = availW / cols;
  const tileFromWidth =
    (perColWidth - cardPad * 2 - borderWidth * 2 - tileGap * (boardCols - 1)) / boardCols;
  const tile = Math.max(8, Math.floor(Math.min(tileFromHeight, tileFromWidth)));

  const boardW = boardCols * tile + (boardCols - 1) * tileGap + cardPad * 2 + borderWidth * 2;
  const boardH = boardRows * tile + (boardRows - 1) * tileGap + cardPad * 2 + borderWidth * 2;

  const totalW = cols * boardW + (cols - 1) * colGap;
  const totalH = rows * boardH + (rows - 1) * rowGap;
  const startX = (width - totalW) / 2;
  const startY = headerBottom + verticalPad + (areaHeight - totalH) / 2;

  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellCenterX = startX + col * (boardW + colGap) + boardW / 2;
    const cellCenterY = startY + row * (boardH + rowGap) + boardH / 2;
    const board = input.boards[i];
    drawBoardCard(ctx, board.grid, cellCenterX, cellCenterY, boardW, boardH, board.won);
  }
}

function drawGauntlet(
  ctx: CanvasRenderingContext2D,
  input: ShareGauntletInput,
  width: number,
  headerBottom: number,
  footerTop: number,
): void {
  const n = input.stages.length;
  const horizontalPad = 100;
  const areaWidth = width - horizontalPad * 2;
  const areaHeight = footerTop - headerBottom - 40;
  const gap = 20;
  const chipH = Math.floor((areaHeight - gap * (n - 1)) / n);

  for (let i = 0; i < n; i++) {
    const stage = input.stages[i];
    const chipY = headerBottom + 40 + i * (chipH + gap);
    const won = stage.status === GameStatus.WON;
    const borderColor = won ? WIN_FG : LOSS_FG;
    const bgColor = won ? WIN_BG : LOSS_BG;

    // Chip background
    drawRoundRect(ctx, horizontalPad, chipY, areaWidth, chipH, 24);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Stage index
    ctx.font = '900 32px "Nunito", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = won ? WIN_FG : LOSS_FG;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${i + 1}`, horizontalPad + 32, chipY + chipH / 2);

    // Stage name
    ctx.font = '900 30px "Nunito", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = TEXT_DARK;
    ctx.fillText(stage.name, horizontalPad + 80, chipY + chipH / 2 - 12);

    // Stage stats
    ctx.font = '700 20px "Nunito", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = TEXT_MUTED;
    const statsLine = `${stage.boardsSolved}/${stage.totalBoards} boards · ${stage.guesses} guesses`;
    ctx.fillText(statsLine, horizontalPad + 80, chipY + chipH / 2 + 16);

    // Pass/fail mark at right
    ctx.font = '900 56px "Nunito", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = won ? WIN_FG : LOSS_FG;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(won ? '✓' : '✗', horizontalPad + areaWidth - 40, chipY + chipH / 2);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Public entry point
// ──────────────────────────────────────────────────────────────────────────

export async function generateShareImage(input: ShareImageInput): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const isVertical = input.mode === 'OctoWord' || input.mode === 'Gauntlet';
  const width = 1080;
  const height = isVertical ? 1350 : 1080;

  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  // Header
  const { bottomY: headerBottom } = drawHeader(ctx, input, width);

  // Footer Y (top edge of footer region)
  const footerTop = height - 80;

  // Body
  if (input.layout === 'single') {
    drawSingle(ctx, input, width, headerBottom, footerTop);
  } else if (input.layout === 'multi') {
    drawMulti(ctx, input, width, headerBottom, footerTop);
  } else if (input.layout === 'gauntlet') {
    drawGauntlet(ctx, input, width, headerBottom, footerTop);
  }

  // Footer
  drawFooter(ctx, width, height);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
  });
}
