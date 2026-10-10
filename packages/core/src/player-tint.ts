// A player's own mascot-maker colors, for surfaces that wear them (founder 10-09): the podium stat plates (their
// backdrop as the fill, their frame as the border, ink chosen for contrast so the stats always read) and their
// name in the bubble lettering. Pure functions, mirrored by Swift (PlayerTintCore) and Kotlin (PlayerTint) and
// pinned by player-tint-fixtures.json.

import { AVATAR_BACKDROPS, avatarColorHex } from './avatar-config';

export interface PlateHexes {
  /** One color = a flat fill; two or more = a top-left to bottom-right gradient. */
  fill: string[];
  /** One color = flat; two or more = a top to bottom gradient. */
  border: string[];
  borderWidth: number;
  /** True = light (white) ink on a dark fill; false = the dark purple ink on a light fill. */
  lightInk: boolean;
}

function rgb(hex: string): [number, number, number] {
  const s = hex.startsWith('#') ? hex.slice(1) : hex;
  const v = parseInt(s, 16);
  const n = Number.isNaN(v) ? 0 : v;
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

function byteHex(v: number): string {
  return Math.round(v).toString(16).padStart(2, '0');
}

/** Blend two hexes (t = 0 gives a, 1 gives b), returned as lowercase #rrggbb. */
export function mixHex(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  const c = (p: number, q: number) => (p + (q - p) * t) * 255;
  return `#${byteHex(c(x[0], y[0]))}${byteHex(c(x[1], y[1]))}${byteHex(c(x[2], y[2]))}`;
}

/** WCAG relative luminance (0 black ... 1 white). */
export function hexLuminance(hex: string): number {
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const [r, g, b] = rgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** The backdrop's colors ("auto" / unknown = a light tint of the body color, as the avatar tile draws it). */
export function backdropHexes(bg: string, bodyHex: string): string[] {
  const b = AVATAR_BACKDROPS.find((x) => x.id === bg);
  if (b) {
    // A pattern reads as its base color (+ a whisper of its accent): the pattern itself would fight the text.
    return b.kind === 'pattern' ? [b.colors[0], mixHex(b.colors[0], b.colors[1], 0.3)] : [...b.colors];
  }
  return [mixHex(bodyHex, '#ffffff', 0.78)];
}

/** The frame's metal as a border gradient; "none" = a deeper shade of the fill so every plate has an edge. */
export function frameHexes(frame: string, fill: string[]): { colors: string[]; width: number } {
  switch (frame) {
    case 'bronze': return { colors: ['#F0B27A', '#B45309'], width: 2.5 };
    case 'silver': return { colors: ['#F8FAFC', '#94A3B8'], width: 2.5 };
    case 'gold': return { colors: ['#FDE68A', '#D97706'], width: 2.5 };
    case 'platinum': return { colors: ['#E0F2FE', '#64748B'], width: 2.5 };
    case 'diamond': return { colors: ['#A5F3FC', '#818CF8', '#F0ABFC'], width: 2.5 };
    case 'pro': return { colors: ['#F5B82E', '#EC4899', '#8B5CF6'], width: 2.5 };
    default: return { colors: [mixHex(fill[0], '#000000', 0.28)], width: 1.5 };
  }
}

export function plateHexes(bg: string, frame: string, bodyHex: string): PlateHexes {
  const fill = backdropHexes(bg, bodyHex);
  const edge = frameHexes(frame, fill);
  const lum = fill.map(hexLuminance).reduce((a, b) => a + b, 0) / Math.max(1, fill.length);
  return { fill, border: edge.colors, borderWidth: edge.width, lightInk: lum < 0.42 };
}

/** The plate's three inks as CSS-ready colors (heading, muted detail, gold badge). */
export function plateInk(lightInk: boolean): { heading: string; muted: string; badge: string } {
  return lightInk
    ? { heading: '#ffffff', muted: 'rgba(255,255,255,0.82)', badge: '#f5b82e' }
    : { heading: '#2a1650', muted: '#5b4b7a', badge: '#b45309' };
}

function toHsb(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, mx === 0 ? 0 : d / mx, mx];
}

function fromHsb(h: number, s: number, v: number): string {
  const i = Math.floor(h * 6) % 6;
  const f = h * 6 - Math.floor(h * 6);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  return `#${byteHex(r * 255)}${byteHex(g * 255)}${byteHex(b * 255)}`;
}

/** A vivid version of the player's backdrop color, for their name in the bubble lettering (lemon gives a sunny gold). */
export function nameHex(bg: string, bodyHex: string): string {
  const b = AVATAR_BACKDROPS.find((x) => x.id === bg);
  const base = b ? b.colors[b.colors.length - 1] : bodyHex;
  const [h, s, v] = toHsb(base);
  if (s < 0.12) return '#8B5CF6'; // a grey / white backdrop: the brand purple
  return fromHsb(h, Math.max(s, 0.78), Math.max(v, 0.92));
}

/** Convenience: the same two from an AvatarConfig-shaped object (color = swatch id). */
export function plateForConfig(c: { bg?: string; frame?: string; color: string }): PlateHexes {
  return plateHexes(c.bg ?? 'auto', c.frame ?? 'none', avatarColorHex(c.color));
}
export function nameHexForConfig(c: { bg?: string; color: string }): string {
  return nameHex(c.bg ?? 'auto', avatarColorHex(c.color));
}
