/**
 * VS result share image — same canvas + aesthetic as the daily share cards
 * (lib/share-image.ts): #f8f7ff bg, WORDOCIOUS gradient wordmark, accent
 * "VS <MODE>" label, Victory/Defeat/Draw pill, tinted+bordered color-only
 * board cards, wordocious.com footer — with a head-to-head center: each
 * player's name (winner crowned), final score (accent vs dimmed), solved
 * line, and up to 2 boards per side. Colors only = no daily-VS spoilers.
 */
import { evaluateGuess } from '@wordle-duel/core';
import { WIN_FG, BOARD_WIN_TINT } from './tile-theme';
import type { OpponentGuessLogEntry } from '@/lib/adapters/match-service';

const BG = '#f8f7ff';
const TEXT_MUTED = '#6b7280';
const FOOT_COLOR = '#9ca3af';
const WORDMARK = ['#a78bfa', '#ec4899'];
const LOSS_FG = '#dc2626';
const LOSS_BG = '#fee2e2';
const WIN_BG_PILL = '#f5f3ff';
const DRAW_FG = '#d97706';
const DRAW_BG = '#fef3c7';
const BOARD_LOSS_TINT = '#fef2f2';
const ME_ACCENT = '#7c3aed';
const OPP_ACCENT = '#ec4899';
const SOLVED_FG = '#16a34a';
const TILE: Record<string, string> = {
  CORRECT: '#7c3aed',
  PRESENT: '#f59e0b',
  ABSENT: '#9ca3af',
  HINT_USED: '#9ca3af',
  EMPTY: '#e5e7eb',
};

export interface VsShareSide {
  name: string;
  score: number;
  won: boolean;
  solved: boolean;
  /** Per board: rows of tile-state strings (colors only). */
  grids: string[][][];
}

export interface VsShareInput {
  modeLabel: string; // "VS CLASSIC"
  isWin: boolean;
  isDraw: boolean;
  me: VsShareSide;
  opponent: VsShareSide;
}

/** Guess log → per-board grids of tile states (colors only, sorted by board). */
export function logToGrids(guessLog: OpponentGuessLogEntry[], solutions: string[]): string[][][] {
  const byBoard = new Map<number, string[][]>();
  for (const { boardIndex, guess } of guessLog) {
    const solution = solutions[boardIndex];
    const word = guess.toUpperCase();
    let states: string[];
    try {
      states = solution
        ? evaluateGuess(solution.toUpperCase(), word).tiles.map((t: any) => t.state as string)
        : word.split('').map(() => 'ABSENT');
    } catch {
      states = word.split('').map(() => 'ABSENT');
    }
    const rows = byBoard.get(boardIndex) || [];
    rows.push(states);
    byBoard.set(boardIndex, rows);
  }
  return Array.from(byBoard.keys()).sort((a, b) => a - b).map((k) => byBoard.get(k)!);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function font(weight: number, px: number) {
  return `${weight} ${px}px "Nunito", system-ui, -apple-system, sans-serif`;
}

/**
 * Board card: tinted rounded card + tile grid, matching drawBoardCard's look.
 * `rows`/`cols` are the SHARED dimensions across both players (short grids are
 * padded with empty tiles) so the two sides' cards are pixel-identical — a
 * 3-guess win next to a 6-guess loss used to render two differently-sized
 * boards, which read as a layout bug.
 */
function drawBoard(ctx: CanvasRenderingContext2D, grid: string[][], cx: number, top: number, maxSide: number, won: boolean, rows: number, cols: number): number {
  const gap = Math.max(3, maxSide * 0.012);
  const pad = maxSide * 0.04;
  const inner = maxSide - pad * 2;
  const tile = Math.floor(Math.min((inner - gap * (cols - 1)) / cols, (inner - gap * (rows - 1)) / rows));
  const gridW = tile * cols + gap * (cols - 1);
  const gridH = tile * rows + gap * (rows - 1);
  const cardW = gridW + pad * 2;
  const cardH = gridH + pad * 2;
  const x = cx - cardW / 2;

  roundRect(ctx, x, top, cardW, cardH, 18);
  ctx.fillStyle = won ? BOARD_WIN_TINT : BOARD_LOSS_TINT;
  ctx.fill();
  ctx.strokeStyle = won ? WIN_FG : LOSS_FG;
  ctx.lineWidth = 4;
  ctx.stroke();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tx = x + pad + c * (tile + gap);
      const ty = top + pad + r * (tile + gap);
      roundRect(ctx, tx, ty, tile, tile, Math.max(4, tile * 0.12));
      ctx.fillStyle = TILE[grid[r]?.[c] ?? 'EMPTY'] || TILE.EMPTY;
      ctx.fill();
    }
  }
  return cardH;
}

export async function generateVsShareImage(input: VsShareInput): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  try { await (document as any).fonts?.load('900 56px "Nunito"'); } catch { /* best effort */ }

  const W = 1080;
  const H = 1080;
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Wordmark
  const wordmarkY = 72;
  ctx.font = font(900, 56);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const grad = ctx.createLinearGradient(W / 2 - 200, wordmarkY - 48, W / 2 + 200, wordmarkY + 8);
  grad.addColorStop(0, WORDMARK[0]);
  grad.addColorStop(1, WORDMARK[1]);
  ctx.fillStyle = grad;
  ctx.fillText('WORDOCIOUS', W / 2, wordmarkY);

  // Mode label (VS gets the wordmark gradient accent look via mode label color —
  // keep it simple: pink→purple midpoint reads as the VS brand)
  const modeY = wordmarkY + 60;
  ctx.font = font(900, 38);
  ctx.fillStyle = '#0d9488';
  ctx.fillText(input.modeLabel.toUpperCase(), W / 2, modeY);

  // Stats line + result pill
  const metaY = modeY + 48;
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const statsText = `${input.me.score.toFixed(2)} vs ${input.opponent.score.toFixed(2)} · ${dateStr}`;
  const pillLabel = input.isDraw ? 'Draw' : input.isWin ? 'Victory' : 'Defeat';
  ctx.font = font(700, 24);
  const statsW = ctx.measureText(statsText).width;
  ctx.font = font(700, 22);
  const pillW = ctx.measureText(pillLabel).width + 32;
  const blockW = statsW + 12 + pillW;
  const startX = W / 2 - blockW / 2;

  ctx.font = font(700, 24);
  ctx.fillStyle = TEXT_MUTED;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(statsText, startX, metaY);

  const pillX = startX + statsW + 12;
  roundRect(ctx, pillX, metaY - 19, pillW, 38, 10);
  ctx.fillStyle = input.isDraw ? DRAW_BG : input.isWin ? WIN_BG_PILL : LOSS_BG;
  ctx.fill();
  ctx.font = font(700, 22);
  ctx.fillStyle = input.isDraw ? DRAW_FG : input.isWin ? WIN_FG : LOSS_FG;
  ctx.textAlign = 'center';
  ctx.fillText(pillLabel, pillX + pillW / 2, metaY);

  // Head-to-head columns — boards on BOTH sides share one grid size.
  const sideCX = [W * 0.28, W * 0.72];
  const topY = metaY + 80;
  const allShown = [...input.me.grids.slice(0, 2), ...input.opponent.grids.slice(0, 2)];
  const sharedRows = Math.max(1, ...allShown.map((g) => g.length));
  const sharedCols = Math.max(1, ...allShown.map((g) => g[0]?.length ?? 5));
  const multiBoard = input.me.grids.length > 1 || input.opponent.grids.length > 1;
  const drawSide = (side: VsShareSide, accent: string, cx: number) => {
    const highlighted = side.won || input.isDraw;
    let y = topY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(900, 28);
    ctx.fillStyle = accent;
    const crown = side.won && !input.isDraw ? '👑 ' : '';
    ctx.fillText(`${crown}${side.name}`.slice(0, 22), cx, y);
    y += 56;
    ctx.font = font(900, 52);
    ctx.fillStyle = highlighted ? accent : TEXT_MUTED;
    ctx.fillText(side.score.toFixed(2), cx, y);
    y += 40;
    ctx.font = font(700, 20);
    ctx.fillStyle = side.solved ? SOLVED_FG : LOSS_FG;
    ctx.fillText(side.solved ? '✓ Solved' : '✗ Not solved', cx, y);
    y += 28;
    const shown = side.grids.slice(0, 2);
    const maxSide = multiBoard ? 250 : 380;
    for (const grid of shown) {
      const h = drawBoard(ctx, grid, cx, y, maxSide, side.won, sharedRows, sharedCols);
      y += h + 14;
    }
    if (side.grids.length > 2) {
      ctx.font = font(700, 18);
      ctx.fillStyle = TEXT_MUTED;
      ctx.fillText(`+${side.grids.length - 2} more`, cx, y + 8);
    }
  };
  drawSide(input.me, ME_ACCENT, sideCX[0]);
  drawSide(input.opponent, OPP_ACCENT, sideCX[1]);

  // Center VS
  ctx.font = font(900, 34);
  ctx.fillStyle = TEXT_MUTED;
  ctx.textAlign = 'center';
  ctx.fillText('VS', W / 2, topY + 140);

  // Footer
  ctx.font = font(700, 22);
  ctx.fillStyle = FOOT_COLOR;
  ctx.fillText('wordocious.com', W / 2, H - 40);

  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
