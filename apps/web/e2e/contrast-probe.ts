// The in-page half of the season contrast sweep (e2e/season-contrast.test.ts). `collectText` runs in
// the browser: every visible run of text with its painted color (alpha × ancestor opacity), its size /
// weight and its line boxes in page coordinates. `HIDE_TEXT_CSS` then makes all text transparent so a
// screenshot shows only what sits BEHIND the text (walls, cards, gradients, art); the Node half
// samples those pixels inside each line box and checks the text color against them.

export interface TextRun {
  text: string;
  /** A short CSS-ish path to the element, for the report. */
  path: string;
  color: [number, number, number, number];
  fontSize: number;
  fontWeight: number;
  /** Line boxes in page (document) coordinates. */
  rects: { x: number; y: number; w: number; h: number }[];
}

/** Makes every glyph transparent (and drops shadows / outlines that would still show). */
export const HIDE_TEXT_CSS = `
*, *::before, *::after {
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
  -webkit-text-stroke-color: transparent !important;
  text-shadow: none !important;
  text-decoration-color: transparent !important;
  caret-color: transparent !important;
}
input::placeholder, textarea::placeholder { color: transparent !important; }
`;

/** Freezes motion so the pixels are stable (animations land on their resting style). */
export const STILL_CSS = `
*, *::before, *::after {
  animation: none !important;
  transition: none !important;
  scroll-behavior: auto !important;
}
`;

/** Browser-side: gather the visible text runs. Self-contained (serialized by page.evaluate). */
export function collectText(): TextRun[] {
  const out: TextRun[] = [];
  const parse = (c: string): [number, number, number, number] | null => {
    const m = c.match(/^rgba?\(([^)]+)\)$/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p[3] ?? 1];
  };
  const pathOf = (el: Element): string => {
    const parts: string[] = [];
    let e: Element | null = el;
    for (let i = 0; e && i < 4; i++, e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      const cls = (typeof e.className === 'string' ? e.className : '').split(/\s+/).filter(Boolean).slice(0, 3);
      if (cls.length) s += '.' + cls.join('.');
      parts.unshift(s);
    }
    return parts.join(' > ');
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Map<Element, TextRun>();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text || !/[\p{L}\p{N}]/u.test(text)) continue;
    const el = n.parentElement;
    if (!el || el.closest('script, style, noscript, svg, [hidden], option')) continue;
    // aria-hidden text is decoration or a painted duplicate (wallpaper glyph tiles, the lettering's
    // stroke layer): WCAG 1.4.3 exempts pure decoration; its accessible twin is checked instead.
    if (el.closest('[aria-hidden="true"]')) continue;
    // Inactive controls are exempt from WCAG 1.4.3.
    if (el.closest(':disabled, [aria-disabled="true"]')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || cs.display === 'none') continue;
    // Gradient-filled lettering (background-clip: text) is painted art, not a flat ink.
    let clipText = false;
    let opacity = 1;
    for (let e: Element | null = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      opacity *= parseFloat(s.opacity || '1');
      if (s.backgroundClip === 'text' || (s as unknown as Record<string, string>).webkitBackgroundClip === 'text') clipText = true;
    }
    if (clipText || opacity < 0.05) continue;
    const fill = cs.webkitTextFillColor && cs.webkitTextFillColor !== cs.color ? cs.webkitTextFillColor : cs.color;
    const color = parse(fill);
    if (!color || color[3] * opacity < 0.05) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    // Only line boxes that are on top: text under a popup / sheet (or scrolled out of its clip box)
    // isn't what the player reads; the popup's own text is checked instead.
    const onTop = (r: DOMRect) => {
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
    };
    const rects = [...range.getClientRects()]
      .filter((r) => r.width >= 2 && r.height >= 4 && onTop(r))
      .map((r) => ({ x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }));
    if (!rects.length) continue;
    // Clipped away (sr-only, overflow-hidden 1px boxes).
    const box = el.getBoundingClientRect();
    if (box.width <= 1 || box.height <= 1) continue;
    const prev = seen.get(el);
    if (prev) {
      prev.text = (prev.text + ' ' + text).slice(0, 80);
      prev.rects.push(...rects);
      continue;
    }
    const run: TextRun = {
      text: text.slice(0, 80),
      path: pathOf(el),
      color: [color[0], color[1], color[2], color[3] * opacity],
      fontSize: parseFloat(cs.fontSize),
      fontWeight: parseInt(cs.fontWeight, 10) || 400,
      rects,
    };
    seen.set(el, run);
    out.push(run);
  }
  return out;
}
