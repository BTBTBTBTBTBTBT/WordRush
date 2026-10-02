// Hubbub's honeycomb (docs/FINISH_SPEC.md J1): the seven hive letters as
// glossy flat-top hexagons (public/art/art-piece-hex*.webp — the hexagon
// fills ~95% of its square image's width and ~82% of its height), the
// required center letter in the middle and the six others around it. Pure:
// offsets in units of the tile (the square image's side).

/** The hexagon's share of its square image: width (point to point) and height (flat to flat). */
export const HEX_W = 0.95;
export const HEX_H = 0.82;
/** Breathing room between neighbors. */
export const HIVE_GAP = 1.06;

/**
 * The six outer positions around the center, clockwise from the top, as
 * (dx, dy) in tile units: top, upper right, lower right, bottom, lower left,
 * upper left. Flat-top neighbors sit straight above / below (one hex height)
 * and on the diagonals (¾ hex width across, half a height up or down).
 */
export function hiveOffsets(gap: number = HIVE_GAP): Array<[number, number]> {
  const dx = 0.75 * HEX_W * gap;
  const dy = HEX_H * gap;
  return [[0, -dy], [dx, -dy / 2], [dx, dy / 2], [0, dy], [-dx, dy / 2], [-dx, -dy / 2]];
}

/** The honeycomb's bounding box in tile units (width, height). */
export function hiveBox(gap: number = HIVE_GAP): [number, number] {
  return [1 + 2 * 0.75 * HEX_W * gap, 1 + 2 * HEX_H * gap];
}
