'use client';

// Canvas pieces every share card draws in the finishing look (docs/FINISH_SPEC.md
// E1, S2, S3; finishing-touches mockup `.sharecard`): the wallpaper, title art,
// the glossy game-kit tile, the three tinted stat windows with soft numbers,
// the compact info line with its W / L badge, and the cast wordmark — the ten
// heroes standing together over "wordocious.com". Shared by lib/share-image.ts
// and lib/vs-share-image.ts. Every image is optional: when one fails to load,
// the card draws its plain fallback there.

import { CAST, MASCOT_LETTER, type MascotId } from './mascots';
import { activeSeason, castArt, castImageSources, reflowCastRow, seasonOfSrc } from './season';
import type { CastRowLayout } from './share-fit';
import {
  FROSTED_TILE, SHARE_SITE, SOFT_INK, STAT_TONES, TILE_GLOSS, glossFrom,
  type GlossPalette, type ShareInfo, type StatWindow,
} from './share-look';

// next/font registers Nunito under a HASHED family applied to <body>; the
// literal "Nunito" never exists in document.fonts, so canvas silently drew in
// the system fallback (founder caught it, Aug 7). Resolve the real stack from
// the body's computed style at render time.
let FONT_STACK = '"Nunito", system-ui, -apple-system, sans-serif';

/** Reads the page's real (hashed) Nunito stack; returns the stack the cards draw with. */
export function resolveCanvasFontStack(): string {
  if (typeof document !== 'undefined' && document.body) {
    try {
      const fam = getComputedStyle(document.body).fontFamily;
      if (fam && fam.length > 0) FONT_STACK = fam;
    } catch { /* keep fallback */ }
  }
  return FONT_STACK;
}

/** A canvas font string in the share stack. */
export function shareFont(weight: number, px: number): string {
  return `${weight} ${px}px ${FONT_STACK}`;
}

/** Canvas `letterSpacing` is newer; set it where supported, ignore elsewhere. */
export function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number): void {
  try { (ctx as unknown as { letterSpacing?: string }).letterSpacing = `${px}px`; } catch { /* older engines */ }
}

// ── Images ──────────────────────────────────────────────────────────────────

const cache = new Map<string, Promise<HTMLImageElement | null>>();

/**
 * Loads an image for the canvas, trying each src in turn when one errors;
 * null on failure, or once `timeoutMs` passes (a slow network never holds the
 * share sheet up for long: a timeout doesn't go on to the next src).
 */
export function loadShareImage(srcs: string[], timeoutMs = 2000): Promise<HTMLImageElement | null> {
  const key = srcs.join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  const tryOne = (src: string) => new Promise<{ img: HTMLImageElement | null; timedOut: boolean }>((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve({ img: null, timedOut: true }), timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve({ img, timedOut: false }); };
    img.onerror = () => { clearTimeout(timer); resolve({ img: null, timedOut: false }); };
    img.src = src;
  });
  const p = (async () => {
    for (const src of srcs) {
      const { img, timedOut } = await tryOne(src);
      if (img) return img;
      if (timedOut) break;
    }
    return null;
  })();
  // A failure is not cached, so the next share tries again.
  p.then((img) => { if (!img) cache.delete(key); });
  cache.set(key, p);
  return p;
}

// ── Primitives ──────────────────────────────────────────────────────────────

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
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

/** Draws an image fit inside the box (never stretched), centered. Returns the drawn height. */
export function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  top: number,
  maxW: number,
  maxH: number,
  natural?: readonly [number, number],
): number {
  const [nw, nh] = natural ?? [img.naturalWidth || img.width, img.naturalHeight || img.height];
  if (!nw || !nh) return 0;
  const scale = Math.min(maxW / nw, maxH / nh);
  const w = nw * scale;
  const h = nh * scale;
  ctx.drawImage(img, cx - w / 2, top + (maxH - h) / 2, w, h);
  return h;
}

/**
 * The card background: the wallpaper cover-fit over the whole card, or — when
 * it didn't load — the soft diagonal tint it is painted in.
 */
export function drawWallpaper(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  wall: HTMLImageElement | null,
  fallback: readonly [string, string, string],
): void {
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, fallback[0]);
  g.addColorStop(0.5, fallback[1]);
  g.addColorStop(1, fallback[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  if (!wall) return;
  const nw = wall.naturalWidth || wall.width;
  const nh = wall.naturalHeight || wall.height;
  if (!nw || !nh) return;
  const s = Math.max(width / nw, height / nh);
  const w = nw * s;
  const h = nh * s;
  ctx.drawImage(wall, (width - w) / 2, (height - h) / 2, w, h);
}

/**
 * The game kit tile: a rounded square in the darker `edge` color that shows as
 * a thick bottom lip, the face (light → base at 70% → bottom) above it, and a
 * white gloss across the top. `pal` null = the frosted empty tile (never white).
 * Returns the face height (center glyphs in it).
 */
export function drawGlossTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pal: GlossPalette | null,
  opts: { radius?: number; gloss?: number; shadow?: boolean } = {},
): number {
  const r = opts.radius ?? Math.min(w, h) * 0.22;
  const lip = Math.max(2, Math.min(w, h) * 0.07);
  const faceH = h - lip;
  ctx.save();
  if (pal && opts.shadow !== false && w >= 28) {
    ctx.shadowColor = 'rgba(46, 12, 99, 0.22)';
    ctx.shadowBlur = Math.min(14, w * 0.12);
    ctx.shadowOffsetY = Math.min(6, w * 0.05);
  }
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = pal ? pal.edge : FROSTED_TILE.edge;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, x, y, w, faceH, r);
  if (pal) {
    const g = ctx.createLinearGradient(0, y, 0, y + faceH);
    g.addColorStop(0, pal.light);
    g.addColorStop(0.7, pal.base);
    g.addColorStop(1, pal.bot);
    ctx.fillStyle = g;
    ctx.fill();
  } else {
    ctx.fillStyle = FROSTED_TILE.face;
    ctx.fill();
    ctx.strokeStyle = FROSTED_TILE.ring;
    ctx.lineWidth = Math.max(1.5, w * 0.03);
    ctx.stroke();
  }
  const gloss = opts.gloss ?? (pal ? 0.5 : FROSTED_TILE.gloss);
  if (gloss > 0) {
    const gx = x + w * 0.08;
    const gy = y + faceH * 0.06;
    const gh = faceH * 0.38;
    const gg = ctx.createLinearGradient(0, gy, 0, gy + gh);
    gg.addColorStop(0, `rgba(255, 255, 255, ${gloss})`);
    gg.addColorStop(1, 'rgba(255, 255, 255, 0)');
    roundRectPath(ctx, gx, gy, w * 0.84, gh, r * 0.8);
    ctx.fillStyle = gg;
    ctx.fill();
  }
  ctx.restore();
  return faceH;
}

/** A white glyph on a glossy tile face (the reveal variant, ladder start, VS boards). */
export function drawTileGlyph(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, w: number, faceH: number, color = '#ffffff'): void {
  ctx.save();
  ctx.font = shareFont(900, Math.max(10, Math.floor(Math.min(w, faceH) * 0.58)));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (color === '#ffffff') {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowOffsetY = Math.max(1, w * 0.03);
    ctx.shadowBlur = Math.max(1, w * 0.02);
  }
  ctx.fillStyle = color;
  ctx.fillText(ch.toUpperCase(), x + w / 2, y + faceH / 2 + 1);
  ctx.restore();
}

/** A soft number (A2): Nunito Black in #3b1a78 with the white highlight + soft purple shadow. */
export function drawSoftNumber(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  px: number,
  align: CanvasTextAlign = 'center',
): void {
  ctx.save();
  ctx.font = shareFont(900, px);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillText(text, x, y + Math.max(1, px * 0.04));
  ctx.shadowColor = 'rgba(76, 29, 149, 0.18)';
  ctx.shadowBlur = px * 0.2;
  ctx.shadowOffsetY = px * 0.06;
  ctx.fillStyle = SOFT_INK;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** The largest size ≤ `px` at which `text` fits `maxW` in Nunito Black. */
export function fitFontPx(ctx: CanvasRenderingContext2D, text: string, px: number, maxW: number, minPx = 18): number {
  let size = px;
  ctx.save();
  for (; size > minPx; size -= 2) {
    ctx.font = shareFont(900, size);
    if (ctx.measureText(text).width <= maxW) break;
  }
  ctx.restore();
  return size;
}

/**
 * A tinted window (`.sc-stats div`): its tone's wash, soft border, a 2-stop
 * top bar, a soft number and a letterspaced label. Also used one at a time
 * (VS score windows).
 */
export function drawStatWindow(
  ctx: CanvasRenderingContext2D,
  win: StatWindow,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { numberPx?: number; tone?: { tint: string; line: string; bar: readonly [string, string]; label: string } } = {},
): void {
  const t = opts.tone ?? STAT_TONES[win.tone];
  const r = Math.min(34, h * 0.26);
  const bar = Math.max(10, Math.round(h * 0.12));
  ctx.save();
  ctx.shadowColor = 'rgba(60, 30, 110, 0.14)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = t.tint;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  const bg = ctx.createLinearGradient(x, 0, x + w, 0);
  bg.addColorStop(0, t.bar[0]);
  bg.addColorStop(1, t.bar[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, bar);
  ctx.restore();

  roundRectPath(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r - 1.5);
  ctx.strokeStyle = t.line;
  ctx.lineWidth = 3;
  ctx.stroke();

  const cx = x + w / 2;
  const labelPx = Math.max(16, Math.round(h * 0.18));
  const numPx = fitFontPx(ctx, win.value, opts.numberPx ?? Math.round(h * 0.46), w - 28);
  const numY = y + bar + (h - bar - labelPx - 14) / 2 + 2;
  drawSoftNumber(ctx, win.value, cx, numY, numPx);

  ctx.save();
  setLetterSpacing(ctx, Math.round(labelPx * 0.12));
  ctx.font = shareFont(900, labelPx);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = t.label;
  ctx.fillText(win.label, cx, y + h - Math.round(h * 0.14));
  ctx.restore();
}

/** The three windows in a row across the card. */
export function drawStatWindows(ctx: CanvasRenderingContext2D, wins: readonly StatWindow[], x: number, y: number, w: number, h: number, gap = 22): void {
  const each = (w - gap * (wins.length - 1)) / wins.length;
  wins.forEach((win, i) => drawStatWindow(ctx, win, x + i * (each + gap), y, each, h));
}

/** The letterspaced date line under the title art (`.sc-date`). */
export function drawDateLine(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, px = 26, color = '#5b3c96', maxW = 960): void {
  ctx.save();
  let size = px;
  setLetterSpacing(ctx, Math.round(size * 0.14));
  ctx.font = shareFont(900, size);
  while (size > 16 && ctx.measureText(text).width > maxW) {
    size -= 1;
    setLetterSpacing(ctx, Math.round(size * 0.14));
    ctx.font = shareFont(900, size);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = color;
  ctx.fillText(text, cx, y);
  ctx.restore();
}

/** The info line's W / L badge colors: purple win, rose loss. */
const BADGE_GLOSS = { W: TILE_GLOSS.CORRECT, L: glossFrom('#f43f5e') } as const;

/**
 * S2's compact info line: the letterspaced text (shrunk to fit) followed by a
 * small glossy W / L badge, the pair centered on `cx`.
 */
export function drawInfoLine(ctx: CanvasRenderingContext2D, info: ShareInfo, cx: number, y: number, maxW = 952, color = '#5b3c96'): void {
  const badge = info.badge ? 42 : 0;
  const badgeGap = info.badge ? 16 : 0;
  ctx.save();
  let size = 28;
  const fit = () => {
    setLetterSpacing(ctx, Math.round(size * 0.14));
    ctx.font = shareFont(900, size);
  };
  fit();
  while (size > 16 && ctx.measureText(info.text).width > maxW - badge - badgeGap) {
    size -= 1;
    fit();
  }
  const textW = ctx.measureText(info.text).width;
  const x0 = cx - (textW + badgeGap + badge) / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = color;
  ctx.fillText(info.text, x0, y);
  ctx.restore();
  if (!info.badge) return;
  const bx = x0 + textW + badgeGap;
  const by = y - badge / 2;
  const faceH = drawGlossTile(ctx, bx, by, badge, badge, BADGE_GLOSS[info.badge], { radius: badge / 2 });
  drawTileGlyph(ctx, info.badge, bx, by, badge, faceH);
}

/**
 * The ten cast images for the wordmark (null where one failed). FINISH_SPEC X:
 * during the season (or a `?season=` preview) each is the Halloween skin, with
 * the hero as that character's fallback.
 */
export async function loadCastImages(): Promise<Record<MascotId, HTMLImageElement | null>> {
  const season = activeSeason();
  const imgs = await Promise.all(CAST.map((id) => loadShareImage(castImageSources(id, season))));
  return Object.fromEntries(CAST.map((id, i) => [id, imgs[i] ?? null])) as Record<MascotId, HTMLImageElement | null>;
}

/**
 * S3 · the cast IS the wordmark: the ten heroes W·O·R·D·O·C·I·O·U·S standing
 * together (trimmed to their art boxes, overlapping like the Home header's
 * .castrow, every second one lifted) over a soft ground shadow, then one tiny
 * "wordocious.com" line centered on `urlY`. A hero whose image failed draws
 * its letter on a glossy purple tile in its slot, so the word still reads.
 */
export function drawCastWordmark(
  ctx: CanvasRenderingContext2D,
  row: CastRowLayout,
  imgs: Partial<Record<MascotId, HTMLImageElement | null>>,
  cx: number,
  baseY: number,
  urlY: number,
): void {
  const h = row.charH;
  // FINISH_SPEC X: each loaded image is drawn cut to ITS art's box (a skin's
  // or the hero's); when any skin is in, the slots are re-laid to those
  // aspects so the row still stands edge to edge.
  const artOf = (id: MascotId) => {
    const img = imgs[id];
    return castArt(id, img ? seasonOfSrc(img.currentSrc || img.src) : null);
  };
  const skinned = row.slots.some((s) => { const img = imgs[s.id]; return !!img && !!seasonOfSrc(img.currentSrc || img.src); });
  const slots = skinned ? reflowCastRow(row, (id) => artOf(id).aspect).slots : row.slots;
  // The soft ground shadow under the whole row.
  ctx.save();
  const rx = row.rowW * 0.47;
  const ry = Math.max(6, h * 0.1);
  ctx.translate(cx, baseY + ry * 0.2);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(76, 29, 149, 0.30)');
  g.addColorStop(0.6, 'rgba(76, 29, 149, 0.14)');
  g.addColorStop(1, 'rgba(76, 29, 149, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  for (const slot of slots) {
    const img = imgs[slot.id] ?? null;
    ctx.save();
    ctx.shadowColor = 'rgba(60, 30, 110, 0.2)';
    ctx.shadowBlur = Math.max(4, h * 0.09);
    ctx.shadowOffsetY = Math.max(3, h * 0.065);
    const nw = img ? img.naturalWidth || img.width : 0;
    if (img && nw) {
      const art = artOf(slot.id);
      const k = nw / art.artSize;
      const [x0, y0, x1, y1] = art.trim;
      ctx.drawImage(img, x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k, slot.x, slot.y, slot.w, slot.h);
      ctx.restore();
    } else {
      ctx.restore();
      const side = Math.min(slot.w, slot.h) * 0.92;
      const tx = slot.x + (slot.w - side) / 2;
      const ty = slot.y + slot.h - side;
      const faceH = drawGlossTile(ctx, tx, ty, side, side, TILE_GLOSS.CORRECT, { radius: side * 0.24 });
      drawTileGlyph(ctx, MASCOT_LETTER[slot.id], tx, ty, side, faceH);
    }
  }

  ctx.save();
  setLetterSpacing(ctx, 3);
  ctx.font = shareFont(900, 26);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#6d28d9';
  ctx.fillText(SHARE_SITE, cx, urlY);
  ctx.restore();
}

/** Encodes the canvas as the share PNG. */
export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
  });
}
