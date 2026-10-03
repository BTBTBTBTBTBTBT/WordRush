'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { announceAchievementUnlocks, fetchUserAchievements } from '@/lib/achievement-service';
import { diffSeen, readSeen, setSeenUser, writeSeen } from '@/lib/achievement-seen';

// FINISH_SPEC BF1: on app open and every return to the app, diff the player's
// earned achievements against the locally stored "seen" set and celebrate any
// unseen ones (server-side awards, another device, a friend's finishing move).
// The first run seeds the set with everything already earned (no flood).
// Renders nothing; mount once inside AuthProvider.

/** Don't refetch more often than this on focus (ms). */
const MIN_GAP_MS = 20_000;

export function AchievementWatcher() {
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const last = useRef(0);

  useEffect(() => {
    setSeenUser(userId);
    if (!userId) return;
    let cancelled = false;
    const check = async (force = false) => {
      const now = Date.now();
      if (!force && now - last.current < MIN_GAP_MS) return;
      last.current = now;
      try {
        const earned = await fetchUserAchievements(userId);
        if (cancelled) return;
        const { fresh, next } = diffSeen(readSeen(userId), earned);
        writeSeen(userId, next);
        announceAchievementUnlocks(fresh);
      } catch { /* offline: try again next focus */ }
    };
    void check(true);
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

  return null;
}
