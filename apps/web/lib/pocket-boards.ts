// Pocket-game board geometry (founder 10-13, docs/design/brand/2.8/pocket; brief in the same folder). Every board is a piece of art
// with a measured inner content rect (in the art's own pixels); these pure helpers turn a rendered width into the pixel boxes the
// tiles / pieces sit in, so the layout is computed once per width (no per-frame work) and is testable without a DOM.

// ── Tic-Tac-Tile: the lilac "#" slab (art-pocket-ttt-grid, 780 x 776) ───────────────────────────────────────────────────────

export const TTT_GRID_W = 780;
export const TTT_GRID_H = 776;
/** The nine cells between the # bars, [from, to] in art pixels. */
export const TTT_COLS: ReadonlyArray<readonly [number, number]> = [[45, 256], [296, 479], [519, 735]];
export const TTT_ROWS: ReadonlyArray<readonly [number, number]> = [[45, 259], [281, 474], [498, 731]];

/** Cell `i` (0-8, row-major) as a rect in art pixels. */
export function tttCell(i: number): { x: number; y: number; w: number; h: number } {
  const [x0, x1] = TTT_COLS[i % 3];
  const [y0, y1] = TTT_ROWS[Math.floor(i / 3)];
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Where the win strike sits: the middle, length and angle of the line through its three cells (art pixels). */
export function tttStrike(line: readonly [number, number, number]): { cx: number; cy: number; len: number; deg: number; thick: number } {
  const c = (i: number) => { const r = tttCell(i); return { x: r.x + r.w / 2, y: r.y + r.h / 2, w: r.w }; };
  const a = c(line[0]);
  const b = c(line[2]);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, len: Math.hypot(dx, dy) + a.w * 0.85, deg: (Math.atan2(dy, dx) * 180) / Math.PI, thick: 66 };
}

// ── Pass the Puzzle: the puzzle-piece tray (art-pocket-pass-tray, 770 x 914) ────────────────────────────────────────────────

export const PASS_TRAY_W = 770;
export const PASS_TRAY_H = 914;
/** The body's content rect in art pixels (the knobs and notch sit outside it). */
export const PASS_BODY = { x: 62, y: 176, w: 558, h: 653 } as const;

export interface PassGeometry {
  /** Tile size, px. */
  t: number;
  /** Row / column pitch (tile + gap), px. */
  pitch: number;
  /** Left of the ring column and the first tile column, px (from the tray's left edge). */
  ringX: number;
  tileX: number;
  /** Ring marker diameter, px. */
  ring: number;
  /** Top of row 0, px. */
  top: number;
}

/**
 * The 6 guess rows + their ring markers sit CENTERED as one group inside the body rect (founder: "the whole thing doesn't
 * look centered to the puzzle piece"). Units of a tile: ring 0.6, ring-to-tile gap 0.12 (rings sit close), tiles pitch 1.167.
 */
export function passGeometry(width: number, rows = 6, cols = 5): PassGeometry {
  const s = width / PASS_TRAY_W;
  const RING = 0.6;
  const RING_GAP = 0.12;
  const PITCH = 1.167;
  const gu = RING + RING_GAP + (cols - 1) * PITCH + 1;   // group width in tile units
  const hu = (rows - 1) * PITCH + 1;                       // group height in tile units
  const t = 0.86 * Math.min(PASS_BODY.w / gu, PASS_BODY.h / hu) * s;
  const gw = gu * t;
  const gh = hu * t;
  const left = PASS_BODY.x * s + (PASS_BODY.w * s - gw) / 2;
  const top = PASS_BODY.y * s + (PASS_BODY.h * s - gh) / 2;
  return { t, pitch: PITCH * t, ringX: left, tileX: left + (RING + RING_GAP) * t, ring: RING * t, top };
}

// ── Ghost: the ghost tray (art-pocket-ghost-tray, 1200 x 307) ───────────────────────────────────────────────────────────────

export const GHOST_TRAY_W = 1200;
export const GHOST_TRAY_H = 307;
/** The plum panel the fragment's tiles sit in, art pixels. */
export const GHOST_PANEL = { x: 256, y: 101, w: 822, h: 125 } as const;

/** The tile size for `count` slots (tiles + the next-slot) centered in the panel, px; the gap is 14% of a tile; the tile is ~83% of the panel's height (founder 10-13: 80-85%, all three platforms). */
export function ghostTileSize(width: number, count: number): number {
  const s = width / GHOST_TRAY_W;
  const n = Math.max(1, count);
  const byWidth = (GHOST_PANEL.w * s * 0.96) / (n + 0.14 * (n - 1));
  return Math.floor(Math.min(GHOST_PANEL.h * s * 0.83, byWidth));
}

// ── Word Chain: the gold chain frame (art-pocket-chain-board, 1100 x 581) + the staircase ───────────────────────────────────

export const CHAIN_BOARD_W = 1100;
export const CHAIN_BOARD_H = 581;
/** The plum interior (keep tiles inside), art pixels. */
export const CHAIN_INTERIOR = { x: 110, y: 206, w: 875, h: 256 } as const;
/** art-pocket-chain-link is 213 x 458. */
export const CHAIN_LINK_ASPECT = 213 / 458;

const CH_PITCH_X = 1.2;   // letters are spaced (founder: "larger and spaced out more so it doesn't look crammed")
const CH_PITCH_X_LONG = 1.08;  // long words: tighter, so 15 letters still get big tiles
const CH_LONG_LETTERS = 10;
const CH_PITCH_Y = 1.55;  // row pitch: the tile plus room for the link
const CH_MAX_T = 44;
/** Readable minimums: three words in the staircase, then two in the staircase, then (flush-left) whatever fits. */
const CH_MIN_THREE = 22;
const CH_MIN_STAIR = 18;

export interface ChainRow {
  /** Index into the shown words. */
  index: number;
  len: number;
  /** Left of the first tile and top of the row, px inside the interior. */
  x: number;
  y: number;
}
export interface ChainLink {
  /** Center, length, and rotation (deg) of one connector from the previous last letter to the new first letter. */
  cx: number;
  cy: number;
  length: number;
  deg: number;
}
export interface ChainLayout {
  t: number;
  pitchX: number;
  rows: ChainRow[];
  links: ChainLink[];
  /** True when the staircase did not fit and the new words start at the left edge. */
  flush: boolean;
}

/**
 * The Word Chain staircase (chain-mock-large.png): the previous word on top, the newest below it starting directly under the
 * previous word's LAST letter, joined by the link. Shows the last 2 words (3 if they fit). If the staircase is too wide: the tiles
 * shrink to a readable minimum, then the new word starts at the left edge and the link runs (as a short chain) from the previous
 * last letter to the new first letter. `lens` is every word's length, oldest first; `width` x `height` is the interior.
 */
export function chainLayout(lens: number[], width: number, height: number): ChainLayout | null {
  if (lens.length === 0) return null;
  const n = lens.length;
  // Long words (founder 10-13): when either of the two newest words is longer than 10 letters the staircase is skipped: the two
  // rows stack left-aligned across the full interior width (tighter letter pitch) so the tiles stay as large as possible
  // (>= 17 px for 15 letters at 390 wide). The link still runs from the previous last letter to the new first letter.
  const long = lens.slice(-2).some((l) => l > CH_LONG_LETTERS);
  const px = long ? CH_PITCH_X_LONG : CH_PITCH_X;
  const build = (shown: number[], flush: boolean): { t: number; starts: number[] } => {
    // Start offsets in tile units; the word's last letter sits at start + (len - 1) * pitch.
    const starts: number[] = [];
    let wu = 0;
    shown.forEach((len, i) => {
      const s0 = i === 0 || flush ? 0 : starts[i - 1] + (shown[i - 1] - 1) * px;
      starts.push(s0);
      wu = Math.max(wu, s0 + len * px - (px - 1));
    });
    const hu = 1 + CH_PITCH_Y * (shown.length - 1);
    return { t: Math.min(CH_MAX_T, height / hu, width / wu), starts };
  };
  let shown = lens.slice(-Math.min(long ? 2 : 3, n));
  let flush = long && shown.length > 1;
  let b = build(shown, flush);
  if (!long) {
    if (shown.length === 3 && b.t < CH_MIN_THREE) { shown = lens.slice(-2); b = build(shown, false); }
    if (shown.length === 2 && b.t < CH_MIN_STAIR) { flush = true; b = build(shown, true); }
  }
  // A lone first word is just one row; its minimum is whatever fits (a 15-letter word at 360 wide).
  const t = b.t;
  const hu = 1 + CH_PITCH_Y * (shown.length - 1);
  let wu = 0;
  shown.forEach((len, i) => { wu = Math.max(wu, b.starts[i] + len * px - (px - 1)); });
  const offX = long ? 0 : (width - wu * t) / 2;
  const offY = (height - hu * t) / 2;
  const rows: ChainRow[] = shown.map((len, i) => ({ index: n - shown.length + i, len, x: offX + b.starts[i] * t, y: offY + i * CH_PITCH_Y * t }));
  const links: ChainLink[] = [];
  for (let i = 1; i < rows.length; i++) {
    const p = rows[i - 1];
    const q = rows[i];
    // From the bottom edge of the previous last letter (12% in) to the top edge of the new first letter (12% in).
    const ax = p.x + ((p.len - 1) * px + 0.5) * t;
    const ay = p.y + t * 0.88;
    const bx = q.x + 0.5 * t;
    const by = q.y + t * 0.12;
    const dx = bx - ax;
    const dy = by - ay;
    links.push({ cx: (ax + bx) / 2, cy: (ay + by) / 2, length: Math.hypot(dx, dy), deg: (Math.atan2(-dx, dy) * 180) / Math.PI });
  }
  return { t, pitchX: px * t, rows, links, flush };
}

/**
 * The Word Chain typing row: `slots` boxes (the typed letters plus ONE empty next-slot, never 15 empty boxes), shrunk so the
 * row always fits `rowWidth` (360 wide phone: 15 slots still >= 18). The gap is 12% of a tile; the size is capped at `cap`.
 */
export function chainInputTile(rowWidth: number, slots: number, cap = 40): number {
  const n = Math.max(1, slots);
  return Math.floor(Math.min(cap, rowWidth / (n + 0.12 * (n - 1))));
}
