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

// ── One-screen audit (founder 10-02): the board room every finished screen
// leaves on the two reference phones, from the layout's own numbers. The
// tab bar is calibrated so the SE (Pro daily) room matches the measured
// 351 × 237 (recap-fit.test.ts). ──

export interface Phone { name: string; width: number; height: number; safeTop: number; safeBottom: number }
export const AUDIT_PHONES: Phone[] = [
  { name: '390x844', width: 390, height: 844, safeTop: 47, safeBottom: 34 },
  { name: '375x667', width: 375, height: 667, safeTop: 0, safeBottom: 0 },
];

export const FINISHED_CHROME = {
  /** The docked tab bar above the safe area. */
  tabBar: 74,
  /** Game header: 6 pad + 44 button row + 2 gap + 6 bottom (+ the title art). */
  headerFixed: 58,
  /** Title art cap: 120, or 56 under 700 tall (BA1); never under 44. */
  artCap: 120, artCapShort: 56, artShortBelow: 700, artMin: 44, artInset: 32,
  /** The strip: pt-1 + the chips row; the live headline (+29) only from 740 tall. */
  strip: 30, headline: 29, headlineFrom: 740,
  /** The daily rank badge line under the strip. */
  sub: 26,
  boardTop: 6,
  /** The dock: pt-2 + candy row 40 + gap 8 + the Unlimited card (82 from 740 tall / a 48 row from 700 / BA1: a 38 px chip line under 700) + pb 6. */
  dockFixed: 62, unlimitedTall: 82, unlimitedShort: 48, unlimitedFrom: 740, unlimitedChipBelow: 700, unlimitedChip: 38,
  morePeek: 42,
  sidePad: 24,
} as const;

/** The board room (px) on `phone` for a game whose title art is `artRatio` (h / w). */
export function finishedBoardRoom(phone: Phone, { artRatio, daily = true, more = true, headline = true, compactUnlimited = false }: { artRatio: number; daily?: boolean; more?: boolean; headline?: boolean; compactUnlimited?: boolean }): { width: number; height: number } {
  const c = FINISHED_CHROME;
  const cap = phone.height < c.artShortBelow ? c.artCapShort : c.artCap;
  const art = Math.max(c.artMin, Math.min(cap, (phone.width - c.artInset) * artRatio));
  const tall = phone.height >= c.headlineFrom;
  const used = phone.safeTop + c.tabBar + phone.safeBottom
    + c.headerFixed + art
    + (more ? c.morePeek : 0)
    + c.strip + (tall && headline ? c.headline : 0)
    + (daily ? c.sub : 0)
    + c.boardTop
    + c.dockFixed + (phone.height < c.unlimitedChipBelow ? c.unlimitedChip : tall && !compactUnlimited ? c.unlimitedTall : c.unlimitedShort);
  return { width: phone.width - c.sidePad, height: Math.max(0, Math.round(phone.height - used)) };
}

/** A single board's whole-pixel tile in `room` (tiles `gap` px apart). */
export function singleBoardTile(room: { width: number; height: number }, cols: number, rows: number, gap = 5): number {
  return Math.max(0, Math.floor(Math.min((room.width - (cols - 1) * gap) / cols, (room.height - (rows - 1) * gap) / rows)));
}
