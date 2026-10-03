// FINISH_SPEC BJ8 (founder 10-03: "I don't ever want the backgrounds to be a
// distraction"): the floating 3D letter tiles are no longer baked into the
// wallpapers (docs/design/brand/walls/calm-walls.py made calm bases). The few that
// remain come from THIS one config — tune counts, sizes and opacities here only.
// iOS: BackdropTiles.swift, Android: ui/BackdropTiles.kt (same numbers).
//
// Games: 4 tiny, faint tiles (0.2) in the side gutters between the header and the
// keyboard, never behind the board or keys. Pages: 6 small tiles (0.35) in the
// 16-px gutters beside the cards and the cast row. Static (no motion), desaturated
// toward the page tint, plain CSS (no blur, no filters on large areas).

export interface BackdropTile {
  /** Which side gutter, and the tile's center offset from that edge (px). */
  leading: boolean;
  inset: number;
  /** Vertical center as a share of the viewport height. */
  y: number;
  size: number;
  rotation: number;
  letter: string;
  color: string;
}

export interface BackdropLook {
  tiles: BackdropTile[];
  opacity: number;
  saturation: number;
  /** How far each face is pulled toward the page accent (0 = its own candy color). */
  tintMix: number;
}

export const BACKDROP_GAME: BackdropLook = {
  tiles: [
    { leading: true, inset: 7, y: 0.24, size: 11, rotation: -12, letter: 'W', color: '#A855F7' },
    { leading: false, inset: 7, y: 0.33, size: 12, rotation: 10, letter: 'O', color: '#F472B6' },
    { leading: true, inset: 6, y: 0.47, size: 10, rotation: 8, letter: 'R', color: '#34D399' },
    { leading: false, inset: 6, y: 0.58, size: 10, rotation: -9, letter: 'D', color: '#FB923C' },
  ],
  opacity: 0.2, saturation: 0.55, tintMix: 0.35,
};

export const BACKDROP_PAGE: BackdropLook = {
  tiles: [
    { leading: true, inset: 9, y: 0.10, size: 14, rotation: -12, letter: 'W', color: '#A855F7' },
    { leading: false, inset: 9, y: 0.16, size: 13, rotation: 11, letter: 'O', color: '#F472B6' },
    { leading: true, inset: 8, y: 0.38, size: 12, rotation: 9, letter: 'R', color: '#34D399' },
    { leading: false, inset: 8, y: 0.52, size: 13, rotation: -10, letter: 'D', color: '#60A5FA' },
    { leading: true, inset: 8, y: 0.70, size: 12, rotation: -7, letter: 'S', color: '#FB923C' },
    { leading: false, inset: 8, y: 0.84, size: 12, rotation: 8, letter: 'Y', color: '#A855F7' },
  ],
  opacity: 0.35, saturation: 0.75, tintMix: 0.25,
};

function hex(c: string): [number, number, number] {
  const h = c.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const css = ([r, g, b]: number[]) => `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

/** A tile's face, lip and top colors: blended toward `accent`, then desaturated. */
export function backdropColors(tile: BackdropTile, look: BackdropLook, accent: string) {
  const blended = mix(hex(tile.color), hex(accent), look.tintMix);
  const l = 0.299 * blended[0] + 0.587 * blended[1] + 0.114 * blended[2];
  const face = blended.map((v) => l + (v - l) * look.saturation);
  return { face: css(face), top: css(mix(face, [255, 255, 255], 0.3)), lip: css(mix(face, [0, 0, 0], 0.3)) };
}
