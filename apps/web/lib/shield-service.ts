import { supabase } from './supabase-client';
import { getTodayLocal, toLocalDayString } from './daily-service';

/**
 * Check if the player's streak is at risk (>20h since last play or missed a day).
 */
export function isStreakAtRisk(lastPlayedAt: string | null): boolean {
  if (!lastPlayedAt) return false;

  const last = new Date(lastPlayedAt);
  const now = new Date();
  const hoursSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60);

  // At risk if >20h since last play AND the calendar day has rolled over
  // in the player's local timezone (matches our daily reset boundary).
  if (hoursSince > 20) {
    return toLocalDayString(last) !== getTodayLocal();
  }

  return false;
}

/**
 * Use a shield to protect the streak. Returns true if successful.
 */
export async function useShield(userId: string): Promise<boolean> {
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('streak_shields, daily_login_streak, last_played_at')
    .eq('id', userId)
    .single() as { data: { streak_shields: number; daily_login_streak: number; last_played_at: string | null } | null };

  if (!profile || profile.streak_shields <= 0) return false;

  // Update shield count and preserve streak by updating last_played_at to now
  await (supabase as any)
    .from('profiles')
    .update({
      streak_shields: profile.streak_shields - 1,
      last_played_at: new Date().toISOString(),
    })
    .eq('id', userId);

  return true;
}

/**
 * Grant the 7-day streak-milestone shield.
 *
 * Delegated to /api/shields/grant-milestone. Shields are a paid benefit (+4 on
 * every Pro renewal) and a referral reward, and nothing in the DB stopped a
 * client from simply writing itself more — so the grant can't live here. The
 * server recomputes the streak from daily_results and keeps its own
 * already-paid ledger, making replays worthless.
 */
export async function grantFreeShield(_userId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;
  try {
    await fetch('/api/shields/grant-milestone', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    // Best-effort: a missed milestone shield must never break result recording.
    // The next call re-derives it from the ledger, so nothing is lost.
  }
}
