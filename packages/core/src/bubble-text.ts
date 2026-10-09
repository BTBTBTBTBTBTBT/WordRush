// 2.8 item 6 (founder 10-06/10-07): the bubble-lettering renderer's PURE half, decided
// identically on web, iOS and Android (ports: apps/ios/Sources/Core/BubbleText.swift,
// apps/android/core/.../BubbleText.kt; pinned by bubble-text-fixtures.json).
//
// A headline is drawn from the glyph atlas (A–Z 0–9 ★ ! ? , ' · - &, tinted per word) —
// or, until the atlas art lands, from the live headline font through the SAME API. Either
// way the fit rule is the same and lives here:
//   1. one line when the text fits the slot at >= minSize; the size SCALES UP to fill the
//      slot (capped at maxSize), never past it;
//   2. else a BALANCED wrap (the split whose widest line is narrowest) into 2 lines, then
//      3 if 2 still can't reach minSize;
//   3. a single word wider than the slot is hard-split by characters;
//   4. NEVER an ellipsis, never a clip: whatever the lines, `size` is chosen so the widest
//      line fits the slot (it may drop under minSize only when nothing else can fit).

import { HEADLINE_ADVANCE_EM, HEADLINE_EDGE_EM, HEADLINE_TRACKING_EM, headlineFontSize, headlineLayout, headlineWidthEm } from './headline-tokens';

/** The glyphs the atlas draws (uppercase; anything else falls back to the live font). */
export const BUBBLE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789★!?,'·-&";

/** Advance widths for the atlas-only characters (em); every other character uses the live font's table. */
const BUBBLE_EXTRA_ADVANCE_EM: Readonly<Record<string, number>> = { '★': 0.9, '&': 0.78, '’': 0.269 };
const FALLBACK_EM = 1.128;

/**
 * The atlas manifest. `ready` flips to true in the commit that drops the glyph PNGs in
 * (web public/art/bubble/<name>.png, iOS asset catalog bubble-<name>, Android drawable
 * bubble_<name>); until then every platform draws the live font. `name` maps a character
 * to its asset stem; kerning pairs adjust the gap (em, usually negative) between two glyphs.
 */
export const BUBBLE_ATLAS = {
  ready: false,
  version: 1,
  kerningEm: {} as Readonly<Record<string, number>>,
} as const;

const GLYPH_NAMES: Readonly<Record<string, string>> = {
  '★': 'star', '!': 'bang', '?': 'ask', ',': 'comma', "'": 'apos', '’': 'apos', '·': 'dot', '-': 'dash', '&': 'amp',
};

/** The asset stem for a character ("a".."z", "0".."9", "star", "bang"…), or null when the atlas has no glyph. */
export function bubbleGlyphName(ch: string): string | null {
  const up = ch.toUpperCase();
  if (Array.from(up).length !== 1 || !(BUBBLE_GLYPHS.includes(up) || up === '’')) return null;
  return GLYPH_NAMES[up] ?? up.toLowerCase();
}

/** True when every non-space character of `text` has an atlas glyph (and the atlas is ready). */
export function bubbleAtlasCovers(text: string): boolean {
  if (!BUBBLE_ATLAS.ready) return false;
  for (const ch of text) if (ch !== ' ' && bubbleGlyphName(ch) === null) return false;
  return true;
}

/** The lettering width of `text` in em: advances + tracking + the 0.24 em outline / edge. */
export function bubbleWidthEm(text: string): number {
  let w = 0;
  for (const ch of text.toUpperCase()) {
    w += (BUBBLE_EXTRA_ADVANCE_EM[ch] ?? HEADLINE_ADVANCE_EM[ch] ?? FALLBACK_EM) + HEADLINE_TRACKING_EM;
  }
  return Math.round((w + HEADLINE_EDGE_EM) * 1000) / 1000;
}

/** Width in thousandths of an em (exact integers, so every port compares identically). */
function milli(text: string): number {
  return Math.round(bubbleWidthEm(text) * 1000);
}

export interface BubbleFit {
  /** The lines, top to bottom. */
  lines: string[];
  /** The lettering size (px / pt / dp), the same for every line; the widest line fits the slot. */
  size: number;
  /** True when the text needed more than one line. */
  wrapped: boolean;
}

export interface BubbleFitOptions {
  /** The largest size (the slot's height or the design cap). Default 38. */
  maxSize?: number;
  /** One line is kept only while it can stay at or above this size. Default 26. */
  minSize?: number;
  /** The most lines before a hard character split. Default 3. */
  maxLines?: number;
}

export const BUBBLE_MAX_SIZE = 38;
export const BUBBLE_MIN_SIZE = 26;
/** The smallest size ever returned (below it only when a hard split still can't fit). */
const FLOOR_SIZE = 8;

function sizeFor(slotWidth: number, widestMilli: number, maxSize: number): number {
  if (!(widestMilli > 0)) return maxSize;
  return Math.max(FLOOR_SIZE, Math.min(maxSize, Math.floor((slotWidth * 1000) / widestMilli)));
}

/** Split `words` into exactly `n` consecutive groups whose widest line is narrowest (ties: smaller sum of squares, then earlier cut). */
function balancedSplit(words: string[], n: number): string[] | null {
  const m = words.length;
  if (n < 1 || m < n) return null;
  const w: number[][] = [];
  for (let i = 0; i < m; i++) {
    w[i] = [];
    for (let j = i; j < m; j++) w[i][j] = milli(words.slice(i, j + 1).join(' '));
  }
  // best[k][j] = [widest, sumSquares, cut] for the first j words in k lines.
  const INF = Number.MAX_SAFE_INTEGER;
  const best: Array<Array<[number, number, number]>> = [];
  for (let k = 0; k <= n; k++) best.push(new Array(m + 1).fill(null).map(() => [INF, INF, -1] as [number, number, number]));
  best[0][0] = [0, 0, -1];
  for (let k = 1; k <= n; k++) {
    for (let j = k; j <= m; j++) {
      for (let c = k - 1; c < j; c++) {
        const prev = best[k - 1][c];
        if (prev[0] === INF) continue;
        const last = w[c][j - 1];
        const widest = Math.max(prev[0], last);
        const sq = prev[1] + last * last;
        const cur = best[k][j];
        if (widest < cur[0] || (widest === cur[0] && sq < cur[1])) best[k][j] = [widest, sq, c];
      }
    }
  }
  const out: string[] = [];
  let j = m;
  for (let k = n; k >= 1; k--) {
    const c = best[k][j][2];
    out.unshift(words.slice(c, j).join(' '));
    j = c;
  }
  return out;
}

/** Break `text` into the fewest character chunks no wider than `maxMilli` (a last resort for one huge word). */
function hardSplit(text: string, maxMilli: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const ch of text) {
    if (cur && milli(cur + ch) > maxMilli) { out.push(cur); cur = ch; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/** The fit for `text` in a slot `slotWidth` wide (see the file header for the rule). */
export function bubbleFit(text: string, slotWidth: number, opts: BubbleFitOptions = {}): BubbleFit {
  const maxSize = opts.maxSize ?? BUBBLE_MAX_SIZE;
  const minSize = Math.min(opts.minSize ?? BUBBLE_MIN_SIZE, maxSize);
  const maxLines = Math.max(2, opts.maxLines ?? 3);
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t || !(slotWidth > 0)) return { lines: [t], size: maxSize, wrapped: false };

  const one = sizeFor(slotWidth, milli(t), maxSize);
  if (one >= minSize) return { lines: [t], size: one, wrapped: false };

  const words = t.split(' ');
  let last: BubbleFit | null = null;
  for (let n = 2; n <= maxLines; n++) {
    const lines = balancedSplit(words, n);
    if (!lines) break;
    const widest = Math.max(...lines.map(milli));
    const size = sizeFor(slotWidth, widest, maxSize);
    last = { lines, size, wrapped: true };
    if (size >= minSize) return last;
  }
  // A word wider than the slot even alone: hard-split it so nothing can clip.
  const longestWord = Math.max(...words.map(milli));
  if (longestWord * minSize > slotWidth * 1000) {
    const maxMilli = Math.floor((slotWidth * 1000) / minSize);
    const lines: string[] = [];
    for (const w of words) {
      if (milli(w) <= maxMilli) lines.push(w);
      else lines.push(...hardSplit(w, maxMilli));
    }
    // Re-join short neighbours greedily so the split doesn't explode the line count.
    const packed: string[] = [];
    for (const l of lines) {
      const joined = packed.length ? `${packed[packed.length - 1]} ${l}` : '';
      if (packed.length && milli(joined) <= maxMilli) packed[packed.length - 1] = joined; else packed.push(l);
    }
    const size = sizeFor(slotWidth, Math.max(...packed.map(milli)), maxSize);
    return { lines: packed, size, wrapped: packed.length > 1 };
  }
  return last ?? { lines: [t], size: one, wrapped: false };
}

export interface HomeHeadlineFit extends BubbleFit {
  /** The lines that carry the player's name when stacked (the gold hero lines). */
  nameLines: number[];
}

/**
 * The Home headline: the player's name keeps its stacked hero lines (headline-tokens.ts
 * `headlineLayout`, founder BJ6), every other headline goes through `bubbleFit` so the long
 * ones ("WORDOCIOUS FLAWLESS! 3 PUZZLES LEFT") wrap instead of truncating. `size` is capped at
 * the device's full size so the slot's height never changes.
 */
export function homeHeadlineFit(text: string, name: string, slotWidth: number): HomeHeadlineFit {
  const size = headlineFontSize(slotWidth);
  const maxEm = slotWidth / size;
  const layout = headlineLayout(text, name, maxEm);
  if (layout.lines.length > 1 || headlineWidthEm(text) <= maxEm) {
    return { lines: layout.lines, size, wrapped: layout.lines.length > 1, nameLines: layout.nameLines };
  }
  const fit = bubbleFit(text, slotWidth, { maxSize: size, minSize: Math.round(size * 0.72) });
  return { ...fit, nameLines: [] };
}
