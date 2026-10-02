// FINISH_SPEC AA1: the crowned W in the living cast header (Pro members).
// Pure bits, so they're testable; the component is components/ui/cast-header.tsx
// and the sheet components/pro/pro-crown-sheet.tsx.

export const PRO_CROWN = {
  /** The crown's tilt on W's head (deg). */
  tilt: -8,
  /** The crown's width as a share of W's cell, and how far it sits above the cell top (share of the cell's height). */
  widthPct: 48,
  topPct: -30,
  /** A tiny sparkle twinkles on the crown about this often (ms)… */
  sparkleEveryMs: 8000,
  /** …the first one this long after the header appears (ms)… */
  sparkleFirstMs: 3000,
  /** …and each twinkle lasts this long (ms). */
  sparkleMs: 700,
  /** The tap target over the crown is at least this big (CSS px). */
  minTarget: 32,
} as const;

/**
 * The sheet's renewal line from profiles.pro_expires_at ("Oct 2, 2027"), or
 * null when there's no expiry on file (legacy / admin grants) or it can't be read.
 */
export function proRenewalLabel(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * The crown's tap target: the crown's box grown to at least `min` px a side,
 * same center (box in the header wrapper's coordinates).
 */
export function crownTarget(box: { left: number; top: number; width: number; height: number }, min: number = PRO_CROWN.minTarget): { left: number; top: number; width: number; height: number } {
  const width = Math.max(min, box.width);
  const height = Math.max(min, box.height);
  return {
    left: box.left + box.width / 2 - width / 2,
    top: box.top + box.height / 2 - height / 2,
    width,
    height,
  };
}
