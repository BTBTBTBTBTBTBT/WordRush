'use client';

import { useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useFlags } from '@/hooks/use-flags';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { getTodayLocal } from '@/lib/daily-service';
import { celebrationDue, type CelebrationGroup, type CelebrationTier } from '@/lib/celebration-gate';
import { moreDailyModes } from '@/lib/more-games';
import { MORE_GAME_MODES, SWEEP_MODES } from '@/lib/modes.generated';

// 2.8 item 52: how many Flawless / Sweep celebrations are due RIGHT NOW from local results (the server never
// delays them). The finished screens' handoffs (NEXT daily, Leaderboard, Keep playing) read it: while one is due they
// go Home FIRST, where the celebration plays, instead of starting the next game and celebrating after it.

/** The tier already celebrated today for a group (Home writes these keys when it shows one). */
export function seenCelebrationTier(group: CelebrationGroup, today: string): CelebrationTier | null {
  try {
    const key = group === 'daily' ? `wordocious-sweep-celebrated-${today}` : `wordocious-more-sweep-celebrated-${today}`;
    const v = localStorage.getItem(key);
    return v === 'flawless' || v === 'sweep' ? v : null;
  } catch {
    return null;
  }
}

export function useCelebrationPending(): number {
  const { user } = useAuth();
  const { todayDailies, dailiesDay } = useDailyCompletions();
  const { isOn } = useFlags();
  return useMemo(() => {
    if (!user) return 0;
    const today = getTodayLocal();
    return celebrationDue({
      results: todayDailies,
      dailyKeys: SWEEP_MODES.map((m) => m.dbKey as string),
      moreKeys: moreDailyModes(MORE_GAME_MODES.filter((m) => isOn(m.flagKey))).map((m) => m.dbKey as string),
      today,
      dataDay: dailiesDay,
      seen: (g) => seenCelebrationTier(g, today),
    }).length;
  }, [user, todayDailies, dailiesDay, isOn]);
}
