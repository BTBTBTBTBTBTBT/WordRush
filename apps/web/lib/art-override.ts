/**
 * Admin Art Library "Preview in app" (admin > Art Library > a piece > Preview in app): the real screens drawn with
 * a candidate piece swapped in. Only app/admin/art/preview (behind the /admin middleware gate) ever fills these
 * maps, with short-lived signed URLs that only the admin API hands out; everywhere else they stay empty, so
 * artSrc / mascotSrc / castArt return the shipped paths unchanged.
 *
 * Keys are art names (`art-game-quordle`, `art-av-eyes-happy`, …) or `mascot-<cast id>` for the hero cast.
 */
export type ArtTrim = readonly [number, number, number, number];

const srcs = new Map<string, string>();
const trims = new Map<string, { size: number; trim: ArtTrim }>();

/** The swapped-in URL for an art key, or undefined (always, outside the admin preview). */
export function artOverride(key: string): string | undefined {
  return srcs.size ? srcs.get(key) : undefined;
}

/** A swapped cast image's square size + alpha box (so the cast row frames it like the shipped art). */
export function artTrimOverride(key: string): { size: number; trim: ArtTrim } | undefined {
  return trims.size ? trims.get(key) : undefined;
}

/** Replace every override (admin preview only). */
export function setArtOverrides(next: Record<string, string>, nextTrims: Record<string, { size: number; trim: ArtTrim }> = {}): void {
  srcs.clear();
  trims.clear();
  for (const [k, v] of Object.entries(next)) srcs.set(k, v);
  for (const [k, v] of Object.entries(nextTrims)) trims.set(k, v);
}
