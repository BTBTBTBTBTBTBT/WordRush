// 2.8 item 6: the bubble-letter glyph tinter (browser only). The atlas PNGs are TINT MAPS, not colored art
// (scripts/build-bubble-atlas.py): R = tint multiplier, G = additive white (highlights), B = rim shade. One
// rule, identical on iOS and Android:  out = clamp(tint(y) * A + Wh + rimColor * Rm).  Each tinted glyph is
// rendered once per (stem, size, tint, rim) and cached, so a headline costs as much as a few images.

import { BUBBLE_ATLAS, BUBBLE_ATLAS_K, BUBBLE_ATLAS_METRICS } from '@wordle-duel/core';

const images = new Map<string, Promise<HTMLImageElement>>();
const tinted = new Map<string, HTMLCanvasElement>();
const MAX_CACHE = 600;

export function loadGlyph(stem: string): Promise<HTMLImageElement> {
  let p = images.get(stem);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `/art/bubble/${stem}.png?v=${BUBBLE_ATLAS.version}`;
    });
    images.set(stem, p);
  }
  return p;
}

/** '#rrggbb' -> [r, g, b] 0..1. */
export function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export interface TintSpec {
  top: string;
  bottom: string;
  rim: string;
}

/**
 * The tinted glyph for `stem` at `pxW` x `pxH` device px. `f0` / `f1` = the tint gradient's position (0 at the cap line,
 * 1 at the baseline) at this glyph's top and bottom edge, so a whole word shares ONE vertical gradient.
 */
export async function tintedGlyph(stem: string, pxW: number, pxH: number, f0: number, f1: number, tint: TintSpec): Promise<HTMLCanvasElement> {
  const key = `${stem}|${pxW}x${pxH}|${f0.toFixed(3)}|${f1.toFixed(3)}|${tint.top}|${tint.bottom}|${tint.rim}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const img = await loadGlyph(stem);
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, pxW);
  cv.height = Math.max(1, pxH);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return cv;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  const data = ctx.getImageData(0, 0, cv.width, cv.height);
  const px = data.data;
  const top = hexRgb(tint.top);
  const bot = hexRgb(tint.bottom);
  const rim = hexRgb(tint.rim);
  const { a: kA, w: kW, r: kR } = BUBBLE_ATLAS_K;
  for (let y = 0; y < cv.height; y++) {
    const f = Math.min(1, Math.max(0, f0 + ((f1 - f0) * (y + 0.5)) / cv.height));
    const tr = top[0] + (bot[0] - top[0]) * f;
    const tg = top[1] + (bot[1] - top[1]) * f;
    const tb = top[2] + (bot[2] - top[2]) * f;
    for (let x = 0; x < cv.width; x++) {
      const i = (y * cv.width + x) * 4;
      if (px[i + 3] === 0) continue;
      const A = (px[i] / 255) * kA;
      const W = (px[i + 1] / 255) * kW;
      const R = (px[i + 2] / 255) * kR;
      px[i] = Math.min(1, tr * A + W + rim[0] * R) * 255;
      px[i + 1] = Math.min(1, tg * A + W + rim[1] * R) * 255;
      px[i + 2] = Math.min(1, tb * A + W + rim[2] * R) * 255;
    }
  }
  ctx.putImageData(data, 0, 0);
  if (tinted.size > MAX_CACHE) tinted.clear();
  tinted.set(key, cv);
  return cv;
}

/** Pre-decode every glyph (idle warm-up so the first headline never draws empty). */
export function warmBubbleGlyphs(): void {
  for (const stem of Object.keys(BUBBLE_ATLAS_METRICS)) void loadGlyph(stem).catch(() => {});
}
