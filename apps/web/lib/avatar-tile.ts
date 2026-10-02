/**
 * Letter-tile avatars (docs/ART_SPEC.md §20) — the pure color + initials
 * helpers behind components/ui/letter-tile-avatar.tsx. A player with no
 * uploaded photo is drawn as a glossy rounded-square letter tile instead of an
 * initials circle. The same rules are mirrored on iOS and Android so a player's
 * tile is the same color everywhere.
 */

import { ACCENT_COLORS } from './profile-personalization';

/** Cast colors (the ten mascots): a first letter in the cast uses its mascot's color. */
export const CAST_TILE_COLORS: Readonly<Record<string, string>> = {
  W: '#8B2CF5',
  O: '#FF2F91',
  R: '#8E96A8',
  D: '#0A6CFF',
  C: '#00B4BE',
  I: '#4CC77A',
  U: '#9B3DF3',
  S: '#F5A623',
};

/** Every other character: palette[(uppercase char code) mod 9]. */
export const TILE_PALETTE: readonly string[] = [
  '#8B2CF5', '#FF9F1A', '#0A6CFF', '#FF2F91', '#00B4BE', '#4CC77A', '#9B3DF3', '#F5A623', '#F0782C',
];

/** The initials drawn on the tile: first two characters of the name, uppercased (one if the name has one). */
export function tileInitials(name: string | null | undefined): string {
  const chars = Array.from((name ?? '').trim());
  if (chars.length === 0) return '?';
  return chars.slice(0, 2).join('').toUpperCase();
}

/**
 * The tile's base color. The player's chosen profile accent wins (only a real
 * swatch from the personalization palette; null = never set); otherwise the cast
 * color of the name's first character, else the palette by char code mod 9.
 */
export function tileBaseColor(name: string | null | undefined, accent?: string | null): string {
  if (accent) {
    const swatch = ACCENT_COLORS.find((c) => c.hex.toLowerCase() === accent.toLowerCase());
    if (swatch) return swatch.hex;
  }
  const first = (Array.from((name ?? '').trim())[0] ?? '?').toUpperCase();
  const cast = CAST_TILE_COLORS[first];
  if (cast) return cast;
  const code = first.codePointAt(0) ?? 63;
  return TILE_PALETTE[code % TILE_PALETTE.length];
}

function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Darken a hex color by `amount` (0–1) toward black. */
export function darkenHex(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  return toHex([r * (1 - amount), g * (1 - amount), b * (1 - amount)]);
}

/** Lighten a hex color by `amount` (0–1) toward white. */
export function lightenHex(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  return toHex([r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount]);
}

/** `rgba()` string for a hex color at `alpha`. */
export function hexAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface TileColors {
  base: string;
  /** The tile's body / bottom lip: base darkened 22%. */
  edge: string;
  /** Top of the face gradient: base lightened 18%. */
  light: string;
  /** Bottom of the face gradient: base darkened 6%. */
  bottom: string;
}

export function tileColors(name: string | null | undefined, accent?: string | null): TileColors {
  const base = tileBaseColor(name, accent);
  return { base, edge: darkenHex(base, 0.22), light: lightenHex(base, 0.18), bottom: darkenHex(base, 0.06) };
}

/** Corner radius as a fraction of the tile size (shared by rings/overlays that hug the tile). */
export const TILE_RADIUS = 0.24;
