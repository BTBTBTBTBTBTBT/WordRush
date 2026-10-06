// WCAG 2.x contrast math (pure). Shared by the season-palette token tests (lib/season-contrast.test.ts)
// and the rendered season contrast sweep (e2e/season-contrast.test.ts).

export type RGBA = [number, number, number, number];

/** '#rgb' | '#rrggbb' | '#rrggbbaa' | 'rgb(a)(…)' → [r, g, b, a] (0-255, alpha 0-1); null when unparseable. */
export function parseColor(c: string): RGBA | null {
  const s = c.trim().toLowerCase();
  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some((p) => Number.isNaN(p))) return null;
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function luminance([r, g, b]: RGBA | [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** `top` (with its alpha) laid over an opaque `bottom`. */
export function over(top: RGBA, bottom: RGBA | [number, number, number]): RGBA {
  const a = top[3];
  return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1) as RGBA;
}

/** Contrast ratio of two colors; a translucent `fg` is first laid over `bg` (bg taken opaque). */
export function contrastRatio(fg: string | RGBA, bg: string | RGBA): number {
  const b = typeof bg === 'string' ? parseColor(bg) : bg;
  const f = typeof fg === 'string' ? parseColor(fg) : fg;
  if (!b || !f) throw new Error(`unparseable color: ${String(fg)} / ${String(bg)}`);
  const bb: RGBA = [b[0], b[1], b[2], 1];
  const ff = f[3] < 1 ? over(f, bb) : f;
  const [hi, lo] = [luminance(ff), luminance(bb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG "large text": ≥ 24 CSS px, or ≥ 18.66 px (14pt) bold. */
export function isLargeText(fontSizePx: number, fontWeight: number): boolean {
  return fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
}

/** The AA minimum for a run of text: 3:1 large / bold-large, 4.5:1 otherwise. */
export function aaMinimum(fontSizePx: number, fontWeight: number): number {
  return isLargeText(fontSizePx, fontWeight) ? 3 : 4.5;
}
