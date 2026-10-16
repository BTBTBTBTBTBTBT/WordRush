'use client';

// The night style of the share cards (founder 10-16, option B; docs/design/review/share-cards-1016/SPEC.md): the
// finished-game card's head + score-breakdown panel and the leaderboard card's stadium podium + rows. Pure canvas
// drawing over share-canvas.ts primitives; the plan (share-fit.ts) measures every block drawn here.

import {
  BUBBLE_ATLAS_CAP_PX, BUBBLE_ATLAS_METRICS, BUBBLE_ATLAS_RIM_HEX, BUBBLE_CAP_EM, PODIUM_ART, bubbleAtlasCovers, bubbleAtlasLayout, podiumArtStep,
  type PodiumArtStep,
} from '@wordle-duel/core';
import { tintedGlyph } from './bubble-render';
import { alphaHex, softMix } from './soft-surface';
import {
  BD_BAR_H, BD_PAD, BD_ROW_H, BD_TITLE_H, LB_DOTS_H, LB_PILL_H, LB_ROW_GAP, LB_ROW_H, NIGHT_CHIPS_H, NIGHT_HEAD_GAP,
  NIGHT_INFO_H, NIGHT_STATUS_H, breakdownBlockHeight, type lbLayout,
} from './share-fit';
import {
  drawImageContain, drawStatWindows, roundRectPath, setLetterSpacing, shareFont,
} from './share-canvas';
import { shareNightInfoLine, shareStatWindows, shareStatusLine, type ShareBreakdown } from './share-look';
import type { ShareImageInput, ShareLeaderboardRowInput } from './share-image';

const INK = '#FFFFFF';
const LAVENDER = '#C9B8FF';
const SOFT = '#D4C8FA';
const GOLD = '#FFD166';

// ── The finished-game card head ─────────────────────────────────────────────

/** Info line, the lavender status line and the three stat chips, from `top` (NIGHT_HEAD_H tall). */
export function drawNightHead(ctx: CanvasRenderingContext2D, input: ShareImageInput, width: number, top: number, date: Date, points: number | null): void {
  const cx = width / 2;
  // WEEKDAY, MON D · #N · size: caps tracking in #E2D6FF.
  let size = 28;
  const text = shareNightInfoLine(input, date);
  ctx.save();
  const fit = () => { setLetterSpacing(ctx, Math.round(size * 0.14)); ctx.font = shareFont(900, size); };
  fit();
  while (size > 16 && ctx.measureText(text).width > 960) { size -= 1; fit(); }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#E2D6FF';
  ctx.fillText(text, cx, top + NIGHT_INFO_H / 2);
  ctx.restore();

  const status = shareStatusLine(input);
  if (status) {
    ctx.save();
    ctx.font = shareFont(900, 40);
    let px = 40;
    while (px > 22 && ctx.measureText(status).width > 940) { px -= 2; ctx.font = shareFont(900, px); }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = LAVENDER;
    ctx.fillText(status, cx, top + NIGHT_INFO_H + NIGHT_HEAD_GAP + NIGHT_STATUS_H / 2);
    ctx.restore();
  }

  const chipsTop = top + NIGHT_INFO_H + NIGHT_HEAD_GAP + NIGHT_STATUS_H + NIGHT_HEAD_GAP;
  const chipsW = 860;
  drawStatWindows(ctx, shareStatWindows(input, points), (width - chipsW) / 2, chipsTop, chipsW, NIGHT_CHIPS_H, 18);
}

// ── The score breakdown panel (the finished screen's, night) ────────────────

export function drawBreakdownPanel(ctx: CanvasRenderingContext2D, bd: ShareBreakdown, x: number, top: number, w: number): void {
  const h = breakdownBlockHeight(bd.rows.length);
  ctx.save();
  roundRectPath(ctx, x, top, w, h, 28);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.075)';
  ctx.fill();
  ctx.clip();
  const bar = ctx.createLinearGradient(x, 0, x + w, 0);
  bar.addColorStop(0, '#7c3aed');
  bar.addColorStop(1, '#a855f7');
  ctx.fillStyle = bar;
  ctx.fillRect(x, top, w, BD_BAR_H);
  ctx.restore();

  const padX = 30;
  const titleY = top + BD_BAR_H + BD_TITLE_H / 2;
  ctx.save();
  setLetterSpacing(ctx, 2);
  ctx.font = shareFont(900, 24);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = SOFT;
  ctx.fillText('SCORE BREAKDOWN', x + padX, titleY);
  setLetterSpacing(ctx, 0);
  // total + PTS
  const total = Math.round(bd.total).toLocaleString('en-US');
  ctx.font = shareFont(900, 28);
  const ptsW = ctx.measureText('PTS').width;
  ctx.textAlign = 'right';
  ctx.fillStyle = SOFT;
  ctx.fillText('PTS', x + w - padX, titleY + 8);
  ctx.font = shareFont(900, 58);
  ctx.fillStyle = INK;
  ctx.shadowColor = 'rgba(8, 0, 24, 0.45)';
  ctx.shadowBlur = 8;
  ctx.fillText(total, x + w - padX - ptsW - 10, titleY);
  ctx.restore();

  let y = top + BD_BAR_H + BD_TITLE_H;
  for (const row of bd.rows) {
    const cy = y + BD_ROW_H / 2;
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = shareFont(900, 29);
    ctx.fillStyle = row.accent ? '#A98BFF' : INK;
    ctx.fillText(row.label, x + padX, cy);
    const lw = ctx.measureText(row.label).width;
    if (row.detail) {
      ctx.font = shareFont(700, 23);
      ctx.fillStyle = '#BDAEE6';
      ctx.fillText(row.detail, x + padX + lw + 14, cy + 2);
    }
    const sign = row.value > 0 ? '+' : row.value < 0 ? '−' : '';
    const val = `${sign}${Math.abs(Math.round(row.value)).toLocaleString('en-US')}`;
    ctx.textAlign = 'right';
    ctx.font = shareFont(900, 29);
    ctx.fillStyle = row.value < 0 ? '#FF8FA8' : row.accent ? '#A98BFF' : '#D8CCFF';
    ctx.fillText(val, x + w - padX, cy);
    ctx.restore();
    y += BD_ROW_H;
  }
  void BD_PAD;
}

// ── The leaderboard card ────────────────────────────────────────────────────

/** The info pill under the title: a soft white-10% capsule holding one caps-tracked line. */
export function drawInfoPill(ctx: CanvasRenderingContext2D, text: string, cx: number, top: number, maxW = 1000): void {
  ctx.save();
  let size = 27;
  const fit = () => { setLetterSpacing(ctx, 1); ctx.font = shareFont(800, size); };
  fit();
  while (size > 16 && ctx.measureText(text).width > maxW - 60) { size -= 1; fit(); }
  const tw = ctx.measureText(text).width;
  const pw = tw + 60;
  roundRectPath(ctx, cx - pw / 2, top, pw, LB_PILL_H, LB_PILL_H / 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#E2D6FF';
  ctx.fillText(text, cx, top + LB_PILL_H / 2 + 1);
  ctx.restore();
}

/** Cuts an image's edges to transparent (so the stadium melts into the night): left/right 6%, top 9%, bottom 7%. */
function featheredStage(img: HTMLImageElement, w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const k = 2;
  const c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  const g = c.getContext('2d');
  if (!g) return null;
  g.drawImage(img, 0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  const gx = g.createLinearGradient(0, 0, c.width, 0);
  gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(0.06, '#000'); gx.addColorStop(0.94, '#000'); gx.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gx; g.fillRect(0, 0, c.width, c.height);
  const gy = g.createLinearGradient(0, 0, 0, c.height);
  gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.09, '#000'); gy.addColorStop(0.93, '#000'); gy.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gy; g.fillRect(0, 0, c.width, c.height);
  return c;
}

/** The podium panel's stat lines: the score, then the detail split into at most two lines (parity: PodiumView.detailLines). */
export function podiumDetailLines(detail: string | undefined): string[] {
  if (!detail) return [];
  const parts = detail.split('·').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return parts;
  return [parts[0], parts.slice(1).join(' · ')];
}

export interface PodiumAssets {
  stage: HTMLImageElement | null;
  sleepingR: HTMLImageElement | null;
  /** The standing mascots by row index (null = the step stays empty). */
  mascots: Array<HTMLImageElement | null>;
  /** Each standing player's name in the bubble lettering, by row index (null = plain heavy caps). */
  names: Array<PodiumName | null>;
}

/** A name in the app's bubble lettering: the tinted glyphs composed on one canvas, plus the glow color behind it. */
export interface PodiumName {
  canvas: HTMLCanvasElement;
  /** Natural (cap-unit) aspect of the lettering: width / height. */
  aspect: number;
  /** The player's secondary color: the soft glow behind the name. */
  glow: string;
}

const NAME_SCALE = 2;

/**
 * The app's podium name (PodiumNameAbove): the bubble-lettering atlas (core bubbleAtlasLayout) tinted from the player's
 * name color, composed on one canvas at `px` cap-em. Null when the atlas doesn't cover the text or a glyph fails.
 */
export async function renderBubbleName(text: string, accent: string, glow: string, px: number): Promise<PodiumName | null> {
  if (typeof document === 'undefined' || !text || !bubbleAtlasCovers(text)) return null;
  try {
    const layout = bubbleAtlasLayout(text);
    if (!layout.places.length) return null;
    const cap = px * BUBBLE_CAP_EM * NAME_SCALE;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(layout.width * cap));
    c.height = Math.max(1, Math.ceil((layout.asc + layout.desc) * cap));
    const g = c.getContext('2d');
    if (!g) return null;
    const tint = { top: softMix(accent, 0.55), bottom: accent, rim: BUBBLE_ATLAS_RIM_HEX };
    await Promise.all(layout.places.map(async (p) => {
      const m = BUBBLE_ATLAS_METRICS[p.stem];
      const pxW = Math.max(1, Math.round(Math.min(p.w * cap, m[0] * BUBBLE_ATLAS_CAP_PX)));
      const pxH = Math.max(1, Math.round(Math.min(p.h * cap, m[1] * BUBBLE_ATLAS_CAP_PX)));
      const glyph = await tintedGlyph(p.stem, pxW, pxH, p.y - (layout.asc - 1), p.y + p.h - (layout.asc - 1), tint);
      g.drawImage(glyph, p.x * cap, p.y * cap, p.w * cap, p.h * cap);
    }));
    return { canvas: c, aspect: c.width / c.height, glow };
  } catch {
    return null;
  }
}

function fitText(ctx: CanvasRenderingContext2D, text: string, px: number, maxW: number, weight: number, minScale = 0.3): number {
  let s = px;
  ctx.font = shareFont(weight, s);
  while (s > px * minScale && ctx.measureText(text).width > maxW) { s -= 1; ctx.font = shareFont(weight, s); }
  return s;
}

/**
 * A name above a head, bottom edge on `bottomY`: the app's bubble lettering in the player's name color (shrunk to the slot)
 * over a soft glow in their secondary color; heavy outlined caps when the atlas can't draw it.
 */
function drawPodiumName(ctx: CanvasRenderingContext2D, text: string, name: PodiumName | null, cx: number, bottomY: number, px: number, maxW: number, you: boolean): void {
  ctx.save();
  if (name) {
    // Lettering height = (asc + desc) cap-units at this px; fit the slot's width, floor 0.3 of the size.
    let h = (name.canvas.height / NAME_SCALE);
    let w = h * name.aspect;
    const k = Math.min(1, maxW / w);
    w *= k; h *= k;
    const y = bottomY - h;
    // the two soft glows of the app's plate: wide + faint, narrow + strong
    ctx.filter = `blur(${Math.max(4, h * 0.22)}px)`;
    roundRectPath(ctx, cx - w / 2 - 2, y - 2, w + 4, h + 2, h / 2);
    ctx.fillStyle = alphaHex(name.glow, 0.5);
    ctx.fill();
    ctx.filter = `blur(${Math.max(3, h * 0.13)}px)`;
    roundRectPath(ctx, cx - w / 2 + 10, y + 2, w - 20, h - 4, h / 2);
    ctx.fillStyle = alphaHex(name.glow, 0.9);
    ctx.fill();
    ctx.filter = 'none';
    ctx.drawImage(name.canvas, cx - w / 2, y, w, h);
    ctx.restore();
    return;
  }
  const s = fitText(ctx, text, px, maxW, 900);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  const y = bottomY - s * 0.18;
  ctx.shadowColor = you ? 'rgba(255, 90, 180, 0.55)' : 'rgba(255, 196, 60, 0.55)';
  ctx.shadowBlur = s * 0.5;
  ctx.lineWidth = Math.max(4, s * 0.2);
  ctx.strokeStyle = you ? '#8A1456' : '#7A4A06';
  ctx.strokeText(text, cx, y);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = you ? '#FF9ED6' : '#FFE08A';
  ctx.fillText(text, cx, y);
  ctx.restore();
}

/** Score + up to two detail lines inside a step's blank panel (dark purple on the satin: core PODIUM_ART.textRgb). */
function drawPanelText(ctx: CanvasRenderingContext2D, step: PodiumArtStep, x0: number, stageTop: number, w: number, stageH: number, score: string, lines: string[]): void {
  const { panel } = step;
  const px = x0 + panel.x0 * w;
  const pw = (panel.x1 - panel.x0) * w;
  const py = stageTop + panel.y0 * stageH;
  const ph = (panel.y1 - panel.y0) * stageH;
  const ink = `rgb(${PODIUM_ART.textRgb.join(',')})`;
  const scorePx = ph * PODIUM_ART.scoreHeight;
  const detailPx = ph * PODIUM_ART.detailHeight;
  const gap = ph * 0.03;
  const n = 1 + lines.length;
  const totalH = scorePx * 1.15 + lines.length * (detailPx * 1.15) + gap * lines.length;
  let y = py + (ph - totalH) / 2;
  ctx.save();
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const sp = fitText(ctx, score, scorePx, pw * 0.88, 900, 0.5);
  ctx.fillText(score, px + pw / 2, y + scorePx * 0.575);
  y += scorePx * 1.15 + gap;
  for (const line of lines) {
    const t = line.toUpperCase();
    fitText(ctx, t, detailPx, pw * 0.88, 800, 0.5);
    ctx.fillText(t, px + pw / 2, y + detailPx * 0.575);
    y += detailPx * 1.15 + gap;
  }
  void sp; void n;
  ctx.restore();
}

/**
 * The one-image stadium podium (core PODIUM_ART), `w` wide with its stage at `top + headroom`: the feathered stage art,
 * a mascot with its feet on each step-top center and a contact shadow, the name above the head (crown hat on #1 rides the
 * mascot), the stats inside the step's panel, and an open spot's sleeping R. Row i stands on step i + 1.
 */
export function drawPodium(
  ctx: CanvasRenderingContext2D,
  lb: ReturnType<typeof lbLayout>,
  rows: readonly ShareLeaderboardRowInput[],
  assets: PodiumAssets,
  cx: number,
  top: number,
  geo: { w: number; stageH: number; headroom: number },
): void {
  const { w, stageH, headroom } = geo;
  const x0 = cx - w / 2;
  const stageTop = top + headroom;
  const k = w / 360;

  if (assets.stage) {
    const feathered = featheredStage(assets.stage, w, stageH);
    if (feathered) ctx.drawImage(feathered, x0, stageTop, w, stageH);
    else ctx.drawImage(assets.stage, x0, stageTop, w, stageH);
  }

  const standing = rows.slice(0, lb.filled);
  standing.forEach((row, i) => {
    const place = (i + 1) as 1 | 2 | 3;
    const step = podiumArtStep(place);
    const first = place === 1;
    const fx = x0 + step.feet.x * w;
    const fy = stageTop + step.feet.y * stageH + PODIUM_ART.plantPt * k;
    const size = Math.round(w * (first ? 0.33 : 0.29));
    // contact shadow
    ctx.save();
    const sw = size * PODIUM_ART.shadowWidth;
    const sh = size * 0.17;
    ctx.translate(fx, fy);
    ctx.scale(1, sh / sw);
    const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, sw / 2);
    sg.addColorStop(0, 'rgba(10, 0, 30, 0.55)');
    sg.addColorStop(0.45, 'rgba(10, 0, 30, 0.3)');
    sg.addColorStop(1, 'rgba(10, 0, 30, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(0, 0, sw / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const img = assets.mascots[i] ?? null;
    const figTop = fy - size;
    if (img) ctx.drawImage(img, fx - size / 2, figTop, size, size);
    const nameGap = Math.max(0, PODIUM_ART.nameGapPt * k - PODIUM_ART.headTop * size);
    const nameBottom = figTop - nameGap + PODIUM_ART.headTop * size * 0;
    drawPodiumName(
      ctx, (row.isYou ? 'YOU' : row.name).toUpperCase(), assets.names[i] ?? null, fx, nameBottom,
      Math.max(14, Math.round(w * (first ? PODIUM_ART.nameSize.gold : PODIUM_ART.nameSize.other))),
      w * (first ? PODIUM_ART.nameWidth.gold : PODIUM_ART.nameWidth.other), !!row.isYou,
    );
    drawPanelText(ctx, step, x0, stageTop, w, stageH, row.scoreDisplay, podiumDetailLines(row.subline));
  });

  for (const place of lb.open) {
    const step = podiumArtStep(place as 1 | 2 | 3);
    const fx = x0 + step.feet.x * w;
    const fy = stageTop + step.feet.y * stageH + PODIUM_ART.openSpot.plantPt * k;
    if (assets.sleepingR) {
      const iw = Math.round(w * PODIUM_ART.openSpot.width);
      const ih = Math.round(iw / PODIUM_ART.openSpot.aspect);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.drawImage(assets.sleepingR, fx - iw / 2, fy - ih, iw, ih);
      ctx.restore();
    }
    drawPanelText(ctx, step, x0, stageTop, w, stageH, 'OPEN SPOT', [`Claim #${place}`]);
  }
}

const ORDINAL = (n: number): string => {
  const v = n % 100;
  const suf = v >= 11 && v <= 13 ? 'TH' : ({ 1: 'ST', 2: 'ND', 3: 'RD' } as Record<number, string>)[n % 10] ?? 'TH';
  return `${n}${suf}`;
};

/** One compact row (78 px): gold rank, name (+ "· YOU"), points big on the right with the detail under them. */
export function drawNightRow(ctx: CanvasRenderingContext2D, row: ShareLeaderboardRowInput, x: number, y: number, w: number, opts: { numeric?: boolean; rankLine?: string } = {}): void {
  roundRectPath(ctx, x, y, w, LB_ROW_H, 26);
  ctx.fillStyle = row.isYou ? 'rgba(245, 170, 60, 0.20)' : 'rgba(255, 255, 255, 0.085)';
  ctx.fill();
  const cy = y + LB_ROW_H / 2;
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = shareFont(900, 30);
  ctx.fillStyle = GOLD;
  const rank = opts.numeric ? String(row.rank) : ORDINAL(row.rank);
  ctx.fillText(rank, x + 28, cy);
  const nameX = x + 28 + Math.max(90, ctx.measureText(rank).width + 22);

  // right block
  ctx.textAlign = 'right';
  ctx.font = shareFont(900, 36);
  ctx.fillStyle = INK;
  const subline = row.subline ?? '';
  const sy = subline ? cy - 11 : cy;
  ctx.fillText(row.scoreDisplay, x + w - 28, sy);
  let rightW = ctx.measureText(row.scoreDisplay).width;
  if (subline) {
    ctx.font = shareFont(700, 21);
    ctx.fillStyle = SOFT;
    ctx.fillText(subline, x + w - 28, cy + 19);
    rightW = Math.max(rightW, ctx.measureText(subline).width);
  }

  ctx.textAlign = 'left';
  ctx.font = shareFont(900, 24);
  const youW = row.isYou ? ctx.measureText(' · YOU').width : 0;
  ctx.font = shareFont(900, 33);
  let name = row.name;
  const maxW = x + w - 28 - rightW - 24 - nameX - youW;
  while (name.length > 1 && ctx.measureText(name).width > maxW) name = name.slice(0, -1);
  if (name !== row.name) name += '…';
  ctx.fillStyle = INK;
  ctx.fillText(name, nameX, opts.rankLine ? cy - 10 : cy);
  if (row.isYou) {
    const nw = ctx.measureText(name).width;
    ctx.font = shareFont(900, 24);
    ctx.fillStyle = GOLD;
    ctx.fillText(' · YOU', nameX + nw, opts.rankLine ? cy - 9 : cy + 1);
  }
  if (opts.rankLine) {
    ctx.font = shareFont(800, 21);
    ctx.fillStyle = '#F5C46B';
    ctx.fillText(opts.rankLine, nameX, cy + 20);
  }
  ctx.restore();
}

/** The rows under the podium (or the whole list on a records card) and the sharer's own row. */
export function drawNightRows(ctx: CanvasRenderingContext2D, lb: ReturnType<typeof lbLayout>, youRankLine: string | undefined, numeric: boolean, x: number, top: number, w: number): void {
  let y = top;
  for (const row of lb.list) {
    drawNightRow(ctx, row, x, y, w, { numeric });
    y += LB_ROW_H + LB_ROW_GAP;
  }
  if (lb.you) {
    if (lb.gap) {
      ctx.save();
      ctx.font = shareFont(900, 26);
      ctx.fillStyle = SOFT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('• • •', x + w / 2, y - LB_ROW_GAP / 2 + LB_DOTS_H / 2 - 2);
      ctx.restore();
      y += LB_DOTS_H;
    }
    drawNightRow(ctx, lb.you, x, y, w, { numeric, rankLine: youRankLine });
  }
}

export { drawImageContain };
