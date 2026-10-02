import { CAST, type MascotId } from './mascots';

// The living cast header (docs/FINISH_SPEC.md A5; keyframes in globals.css
// `.cm.act-*`, from the mockups' .castrow CSS): every 2.6–5 s ONE random
// character — never the same one twice in a row — plays its personality move.
// Off with Reduce Motion (the component never schedules a move then).

/** Each character's move: its CSS class and how long it runs (ms). */
export const CAST_MOVES: Record<MascotId, { cls: string; ms: number; what: string }> = {
  o1: { cls: 'act-o1', ms: 900, what: 'spin 360' },
  w: { cls: 'act-w', ms: 700, what: 'hop + squash' },
  r: { cls: 'act-r', ms: 1600, what: 'nod off + jolt' },
  d: { cls: 'act-d', ms: 760, what: 'double bounce' },
  o2: { cls: 'act-o2', ms: 820, what: 'star pulse + tilt' },
  c: { cls: 'act-c', ms: 1200, what: 'curious lean' },
  i: { cls: 'act-i', ms: 900, what: 'shy wiggle' },
  o3: { cls: 'act-o3', ms: 760, what: 'jump' },
  u: { cls: 'act-u', ms: 1800, what: 'levitate' },
  s: { cls: 'act-s', ms: 700, what: 'dash jitter' },
};

/** The pause between two moves (ms): 2.6–5 s. */
export const CAST_MOVE_GAP = { min: 2600, max: 5000 } as const;
/** The first move waits a little after the header appears (ms). */
export const CAST_FIRST_MOVE = 1200;

/** The next character to move: uniformly random, never `last` again. */
export function pickCastMove(last: MascotId | null, rand: () => number = Math.random): MascotId {
  const pool = last ? CAST.filter((id) => id !== last) : [...CAST];
  const i = Math.min(pool.length - 1, Math.floor(rand() * pool.length));
  return pool[Math.max(0, i)];
}

/** The wait before the next move (ms), in [CAST_MOVE_GAP.min, CAST_MOVE_GAP.max]. */
export function nextCastDelay(rand: () => number = Math.random): number {
  const r = Math.max(0, Math.min(1, rand()));
  return Math.round(CAST_MOVE_GAP.min + r * (CAST_MOVE_GAP.max - CAST_MOVE_GAP.min));
}

/**
 * Where each hero sits inside its 512 px transparent square
 * (public/mascots/<id>.png): the alpha bounding box [x0, y0, x1, y1]. The
 * header draws each character trimmed to its box, so the ten stand edge to
 * edge at one height (the mockups' trimmed images with flex = aspect ratio).
 */
export const MASCOT_ART_SIZE = 512;
export const MASCOT_TRIM: Record<MascotId, TrimBox> = {
  w: [20, 59, 491, 492],
  o1: [20, 29, 491, 492],
  r: [52, 21, 460, 492],
  d: [20, 25, 491, 492],
  o2: [61, 21, 451, 492],
  c: [37, 21, 474, 492],
  i: [145, 21, 367, 492],
  o3: [24, 21, 488, 492],
  u: [20, 39, 491, 492],
  s: [20, 23, 491, 492],
};

/** An art box [x0, y0, x1, y1] inside a square image. */
export type TrimBox = readonly [number, number, number, number];

/** A box's aspect ratio (width / height). */
export function boxAspect([x0, y0, x1, y1]: TrimBox): number {
  return (x1 - x0) / (y1 - y0);
}

/**
 * How to draw a square image of `artSize` px so only `box` shows in a box of
 * the trimmed aspect: the image's size and offset as percentages of that box.
 */
export function boxTrimLayout([x0, y0, x1, y1]: TrimBox, artSize: number): { width: string; left: string; top: string } {
  const bw = x1 - x0;
  const bh = y1 - y0;
  const pct = (n: number) => `${Number(n.toFixed(3))}%`;
  return {
    width: pct((artSize / bw) * 100),
    left: pct((-x0 / bw) * 100),
    top: pct((-y0 / bh) * 100),
  };
}

/** A trimmed character's aspect ratio (width / height of its art box). */
export function castAspect(id: MascotId): number {
  return boxAspect(MASCOT_TRIM[id]);
}

/**
 * How to draw the square art so only its box shows in a box of the trimmed
 * aspect: the image's size and offset as percentages of that box.
 */
export function castTrimLayout(id: MascotId): { width: string; left: string; top: string } {
  return boxTrimLayout(MASCOT_TRIM[id], MASCOT_ART_SIZE);
}
