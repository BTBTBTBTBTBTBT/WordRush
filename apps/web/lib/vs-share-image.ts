/**
 * VS result share image in the finishing look (docs/FINISH_SPEC.md E1, S2,
 * S3): the VS wallpaper, the VS BATTLE title art, one compact info line
 * (date · mode + W / L badge), the YOU WIN! / YOU LOSE / DRAW lettering, then
 * the head-to-head — each player's name (winner crowned), their score in a
 * tinted window (purple you, pink them) with a soft number, and up to 2 glossy
 * color-only boards per side — and the cast wordmark (the ten heroes standing
 * together) over "wordocious.com". The canvas is 1080 wide and as tall as that
 * stack (4:5 … 9:16, lib/share-fit.ts). Colors only = no daily-VS spoilers.
 * Every image is optional: a failed load draws the plain fallback in its spot.
 */
import { evaluateGuess } from '@wordle-duel/core';
import type { OpponentGuessLogEntry } from '@/lib/adapters/match-service';
import { ART_SIZE, PAGE_TINTS, artSrc, pageWall, resultMoment, type ArtName } from './art';
import { STAT_TONES, TILE_GLOSS, shareShortDate } from './share-look';
import {
  SHARE_SPACE, SHARE_W, TITLE_MAX_W, VS_AVATAR_BLOCK, VS_AVATAR_PX, VS_BOARD_GAP, VS_NAME_H, VS_WINDOW_H,
  planShareCard, titleBoxHeight, vsBoardGeometry, vsBodyGeometry,
} from './share-fit';
import {
  canvasToPng, drawCastWordmark, drawGlossTile, drawImageContain, drawInfoLine, drawStatWindow,
  drawWallpaper, loadCastImages, loadShareImage, resolveCanvasFontStack, roundRectPath, shareFont,
} from './share-canvas';
import { drawShareAvatar, loadShareAvatar, type ShareAvatar } from './share-avatar';

const LOSS_FG = '#e11d48';
const WIN_FG = '#7c3aed';
const DRAW_FG = '#d97706';
const ME_ACCENT = '#7c3aed';
const OPP_ACCENT = '#db2777';
/** The opponent's window: the pink twin of the purple stat window. */
const OPP_TONE = { tint: '#ffeef7', line: '#fbcfe8', bar: ['#ec4899', '#f9a8d4'] as const, label: '#be185d' };
const VS_INK = '#0f766e';
/** The YOU WIN! / YOU LOSE / DRAW lettering's slot (art) and the fallback pill's. */
const MOMENT_MAX_W = 560;
const MOMENT_MAX_H = 78;
const MOMENT_PILL_H = 72;

export interface VsShareSide {
  name: string;
  score: number;
  won: boolean;
  solved: boolean;
  /** Per board: rows of tile-state strings (colors only). */
  grids: string[][][];
  /** BJ5: the side's resolved avatar (bot cast art, photo, else mascot), drawn above the name. */
  avatar?: ShareAvatar | null;
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

/**
 * Board: tinted panel (lilac won / rose lost) + glossy tile grid.
 * `rows`/`cols` are the SHARED dimensions across both players (short grids are
 * padded with frosted tiles) so the two sides' cards are pixel-identical — a
 * 3-guess win next to a 6-guess loss used to render two differently-sized
 * boards, which read as a layout bug.
 */
function drawBoard(ctx: CanvasRenderingContext2D, grid: string[][], cx: number, top: number, maxSide: number, won: boolean, rows: number, cols: number): number {
  const { tile, gap, pad, cardW, cardH } = vsBoardGeometry(maxSide, rows, cols);
  const x = cx - cardW / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(60, 30, 110, 0.14)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
  roundRectPath(ctx, x, top, cardW, cardH, 18);
  ctx.fillStyle = won ? 'rgba(245, 238, 255, 0.88)' : 'rgba(255, 236, 241, 0.88)';
  ctx.fill();
  ctx.restore();
  roundRectPath(ctx, x, top, cardW, cardH, 18);
  ctx.strokeStyle = won ? 'rgba(124, 58, 237, 0.55)' : 'rgba(225, 29, 72, 0.55)';
  ctx.lineWidth = 3;
  ctx.stroke();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tx = x + pad + c * (tile + gap);
      const ty = top + pad + r * (tile + gap);
      const state = grid[r]?.[c] ?? 'EMPTY';
      const pal = state === 'CORRECT' ? TILE_GLOSS.CORRECT
        : state === 'PRESENT' ? TILE_GLOSS.PRESENT
        : state === 'ABSENT' || state === 'HINT_USED' ? TILE_GLOSS.ABSENT
        : null;
      drawGlossTile(ctx, tx, ty, tile, tile, pal, { gloss: pal === TILE_GLOSS.ABSENT ? 0.3 : undefined });
    }
  }
  return cardH;
}

/**
 * S2: the VS card sized to its content (pure — share-fit.test.ts checks the
 * title box sits inside the card). Boards on BOTH sides share one grid size.
 */
export function planVsShareCard(
  input: VsShareInput,
  titleNat: readonly [number, number] | null,
  momentNat: readonly [number, number] | null,
  headExtra = 0,
) {
  const titleH = titleBoxHeight(titleNat);
  const momentH = momentNat
    ? Math.round(momentNat[1] * Math.min(MOMENT_MAX_W / momentNat[0], MOMENT_MAX_H / momentNat[1]))
    : MOMENT_PILL_H;
  const headH = SHARE_SPACE.info + 12 + momentH;
  const allShown = [...input.me.grids.slice(0, 2), ...input.opponent.grids.slice(0, 2)];
  const sharedRows = Math.max(1, ...allShown.map((g) => g.length));
  const sharedCols = Math.max(1, ...allShown.map((g) => g[0]?.length ?? 5));
  const shownN = Math.min(Math.max(input.me.grids.length, input.opponent.grids.length), 2);
  const hasMore = input.me.grids.length > 2 || input.opponent.grids.length > 2;
  const plan = planShareCard(
    { titleH, headH, footH: 0 },
    (maxH) => vsBodyGeometry(shownN, sharedRows, sharedCols, maxH, hasMore, headExtra).h,
  );
  return { plan, titleH, momentH, shownN, hasMore, sharedRows, sharedCols };
}

export async function generateVsShareImage(input: VsShareInput): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  resolveCanvasFontStack();
  try { await (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready; } catch { /* best effort */ }

  const W = SHARE_W;
  const now = new Date();
  const outcome = input.isDraw ? 'draw' : input.isWin ? 'win' : 'loss';
  const momentName = `art-moment-${resultMoment(outcome)}` as ArtName;
  const [wall, title, moment, castImgs, crownImg, meAvatar, oppAvatar] = await Promise.all([
    loadShareImage([artSrc(pageWall('vs'))]),
    loadShareImage([artSrc('art-title-vs')]),
    loadShareImage([artSrc(momentName)]),
    loadCastImages(),
    // The winner's crown is our 3D crown art, never a phone emoji (FINISH_SPEC AM3).
    loadShareImage([artSrc('art-badge-crown')]),
    loadShareAvatar(input.me.avatar, VS_AVATAR_PX * 2),
    loadShareAvatar(input.opponent.avatar, VS_AVATAR_PX * 2),
  ]);
  // BJ5: both sides get the avatar row when either has one (the columns stay level).
  const headExtra = meAvatar || oppAvatar ? VS_AVATAR_BLOCK : 0;

  // S2: the canvas is as tall as its content.
  const titleNat: readonly [number, number] | null = title
    ? (title.naturalWidth && title.naturalHeight ? [title.naturalWidth, title.naturalHeight] : ART_SIZE['art-title-vs'])
    : null;
  const momentNat: readonly [number, number] | null = moment
    ? (moment.naturalWidth && moment.naturalHeight ? [moment.naturalWidth, moment.naturalHeight] : ART_SIZE[momentName])
    : null;
  const { plan, titleH, momentH, shownN, hasMore, sharedRows, sharedCols } = planVsShareCard(input, titleNat, momentNat, headExtra);
  const H = plan.height;
  const body = vsBodyGeometry(shownN, sharedRows, sharedCols, plan.boardH, hasMore, headExtra);
  const maxSideB = body.maxSide;

  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);

  drawWallpaper(ctx, W, H, wall, PAGE_TINTS.vs.light);

  // VS BATTLE title art (or the words lettered in teal with a white edge).
  if (title && titleNat) {
    drawImageContain(ctx, title, W / 2, plan.titleTop, TITLE_MAX_W, titleH, titleNat);
  } else {
    ctx.save();
    ctx.font = shareFont(900, 76);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    const baseY = plan.titleTop + titleH / 2 + 27;
    ctx.strokeText('VS BATTLE', W / 2, baseY);
    ctx.fillStyle = VS_INK;
    ctx.fillText('VS BATTLE', W / 2, baseY);
    ctx.restore();
  }

  // "FRI, OCT 2 · VS CLASSIC" + W / L badge (no badge on a draw).
  drawInfoLine(
    ctx,
    { text: `${shareShortDate(now)} · ${input.modeLabel}`.toUpperCase(), badge: input.isDraw ? null : input.isWin ? 'W' : 'L' },
    W / 2, plan.headTop + SHARE_SPACE.info / 2, 952, VS_INK,
  );

  // YOU WIN! / YOU LOSE / DRAW lettering, or the old text pill.
  const momentTop = plan.headTop + SHARE_SPACE.info + 12;
  if (moment && momentNat) {
    drawImageContain(ctx, moment, W / 2, momentTop, MOMENT_MAX_W, momentH, momentNat);
  } else {
    const label = input.isDraw ? 'Draw' : input.isWin ? 'Victory' : 'Defeat';
    ctx.save();
    ctx.font = shareFont(900, 30);
    const pw = ctx.measureText(label).width + 48;
    roundRectPath(ctx, W / 2 - pw / 2, momentTop + 10, pw, 52, 26);
    ctx.fillStyle = input.isDraw ? '#fff5df' : input.isWin ? '#f5eeff' : '#ffe4ea';
    ctx.fill();
    ctx.fillStyle = input.isDraw ? DRAW_FG : input.isWin ? WIN_FG : LOSS_FG;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, W / 2, momentTop + 37);
    ctx.restore();
  }

  const sideCX = [W * 0.27, W * 0.73];
  const blockTop = plan.boardTop + Math.max(0, (plan.boardH - body.h) / 2);

  const drawSide = (side: VsShareSide, accent: string, tone: typeof OPP_TONE | undefined, cx: number, avatar: Awaited<ReturnType<typeof loadShareAvatar>>) => {
    let sy = blockTop;
    if (avatar) drawShareAvatar(ctx, avatar, cx - VS_AVATAR_PX / 2, sy, VS_AVATAR_PX);
    sy += headExtra;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = shareFont(900, 30);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    const crowned = side.won && !input.isDraw && crownImg != null;
    const name = side.name.slice(0, crowned ? 19 : 22);
    const CROWN = 38;
    const nameX = crowned ? cx + (CROWN + 6) / 2 : cx;
    ctx.strokeText(name, nameX, sy + VS_NAME_H / 2);
    ctx.fillStyle = accent;
    ctx.fillText(name, nameX, sy + VS_NAME_H / 2);
    if (crowned) {
      const left = nameX - ctx.measureText(name).width / 2 - 6 - CROWN;
      ctx.drawImage(crownImg, left, sy + VS_NAME_H / 2 - CROWN / 2 - 2, CROWN, CROWN);
    }
    ctx.restore();
    sy += VS_NAME_H + 4;

    const winW = 300;
    drawStatWindow(
      ctx,
      { value: side.score.toFixed(2), label: side.solved ? 'SOLVED' : 'NOT SOLVED', tone: 'purple' },
      cx - winW / 2, sy, winW, VS_WINDOW_H,
      { tone: tone ?? STAT_TONES.purple, numberPx: 52 },
    );
    sy += VS_WINDOW_H + 18;

    const shown = side.grids.slice(0, 2);
    for (const grid of shown) {
      const h = drawBoard(ctx, grid, cx, sy, maxSideB, side.won, sharedRows, sharedCols);
      sy += h + VS_BOARD_GAP;
    }
    if (side.grids.length > 2) {
      ctx.save();
      ctx.font = shareFont(800, 22);
      ctx.fillStyle = '#6f5f8f';
      ctx.textAlign = 'center';
      ctx.fillText(`+${side.grids.length - 2} more`, cx, sy + 10);
      ctx.restore();
    }
  };
  drawSide(input.me, ME_ACCENT, undefined, sideCX[0], meAvatar);
  drawSide(input.opponent, OPP_ACCENT, OPP_TONE, sideCX[1], oppAvatar);

  // Center VS — level with the score windows.
  ctx.save();
  ctx.font = shareFont(900, 54);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  const vsY = blockTop + headExtra + VS_NAME_H + 4 + VS_WINDOW_H / 2;
  ctx.strokeText('VS', W / 2, vsY);
  ctx.fillStyle = VS_INK;
  ctx.fillText('VS', W / 2, vsY);
  ctx.restore();

  // S3: the cast IS the wordmark — the ten heroes standing together over "wordocious.com".
  drawCastWordmark(ctx, plan.cast, castImgs, W / 2, plan.castBase, plan.urlY);

  return canvasToPng(canvas);
}
