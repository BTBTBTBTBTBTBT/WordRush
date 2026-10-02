// The one-screen finished screen (docs/FINISH_SPEC.md R2) and the Unlimited
// card (R3). Pure helpers.

/**
 * How much to shrink the finished board so it fits the room left after the
 * header, the result strip and the action dock: min(1, room / natural) on
 * both axes, never below `minScale` (then the box clips rather than letting
 * the board vanish).
 */
export function fitScale(room: { width: number; height: number }, natural: { width: number; height: number }, minScale = 0.4): number {
  if (natural.width <= 0 || natural.height <= 0 || room.width <= 0 || room.height <= 0) return 1;
  const s = Math.min(1, room.width / natural.width, room.height / natural.height);
  return Math.max(minScale, Math.round(s * 1000) / 1000);
}

/** The Unlimited route for a mode: its route without ?daily (a fresh puzzle), or null when it has none. */
export function unlimitedHref(dbKey: string, routes: Record<string, string>): string | null {
  const r = routes[dbKey];
  return r ? r.split('?')[0] : null;
}

/** The smallest phone the finished screen must fit without scrolling (iPhone SE, CSS px). */
export const MIN_PHONE_HEIGHT = 667;
