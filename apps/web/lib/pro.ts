/**
 * Pro-status helper.
 *
 * Every Pro gate in the app must go through this function rather than reading
 * `profile.is_pro` directly. The raw boolean is a write-side marker; it stays
 * `true` even after `pro_expires_at` has passed (because there is no sweep
 * cron today). Reading the boolean alone would let expired users keep Pro.
 *
 * Rules:
 *  - No profile / not logged in / `is_pro` false → not Pro.
 *  - `is_pro: true` with no `pro_expires_at` → legacy / admin grant without
 *    expiry → treat as active (matches historical behaviour).
 *  - `is_pro: true` with an expiry in the future → active.
 *  - `is_pro: true` with an expiry in the past → inactive.
 */
export function isProActive(
  profile:
    | { is_pro?: boolean | null; pro_expires_at?: string | null }
    | null
    | undefined,
): boolean {
  if (!profile?.is_pro) return false;
  if (!profile.pro_expires_at) return true; // legacy rows without expiry
  return new Date(profile.pro_expires_at).getTime() > Date.now();
}
