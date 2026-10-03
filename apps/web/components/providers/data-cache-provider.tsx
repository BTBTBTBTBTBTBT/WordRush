'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { useAuth } from '@/lib/auth-context';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { getPersistentSWRCache } from '@/lib/swr-persist';
import { getTodayLocal } from '@/lib/daily-service';
import { afterIntro } from '@/lib/intro';

// BI19 cache-first (founder, 2026-10-03): every data page paints its last
// data at once and refreshes underneath.
//   • The SWR cache is persisted (lib/swr-persist.ts). It is seeded after
//     hydration — before AuthGate first renders the signed-in pages — so a
//     server-rendered public page never mismatches.
//   • Prefetch: right after launch settles (after the intro, when idle) and
//     again a few seconds after each finish, today's Leaderboard boards and
//     the Stats bundle are fetched into those caches. Failures keep whatever
//     is cached. Mount once, wrapping AuthGate.

const provider = () => (typeof window === 'undefined' ? new Map() : getPersistentSWRCache());

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** After a finish, wait for the record writes (the second 'daily-completion' is the confirmed one). */
const AFTER_FINISH_MS = 4000;

export function DataCacheProvider({ children }: { children: React.ReactNode }) {
  useIsomorphicLayoutEffect(() => {
    const cache = getPersistentSWRCache();
    cache.hydrate();
    const flush = () => cache.flush();
    const onHidden = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, []);
  return (
    <SWRConfig value={{ provider }}>
      <DataPrefetcher />
      {children}
    </SWRConfig>
  );
}

function DataPrefetcher() {
  const { user } = useAuth();
  const { todayDailies, dailiesDay } = useDailyCompletions();
  const { mutate } = useSWRConfig();
  const userId = user?.id ?? null;
  // Read at run time (not an effect dependency): which boards to warm.
  const playedRef = useRef<string[]>([]);
  playedRef.current = dailiesDay === getTodayLocal() ? Array.from(todayDailies.keys()) : [];
  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      const day = getTodayLocal();
      // Classic is the board the Leaderboard opens on; plus every game played today.
      const modes = Array.from(new Set(['DUEL', ...playedRef.current]));
      import('@/lib/leaderboard-cache')
        .then((m) => m.prefetchTodayBoards(userId, day, modes))
        .catch(() => {});
      import('@/lib/stats-static')
        .then(async (m) => {
          const data = await m.fetchStatsStatic(userId);
          if (!cancelled) await mutateRef.current(m.statsStaticKey(userId), data, { revalidate: false });
        })
        .catch(() => { /* outage: the cached bundle stays */ });
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const cancelIntro = afterIntro(() => {
      if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 5000 }); else setTimeout(run, 2500);
    });
    let t: ReturnType<typeof setTimeout> | null = null;
    const onFinish = () => {
      if (t) clearTimeout(t);
      t = setTimeout(run, AFTER_FINISH_MS);
    };
    window.addEventListener('daily-completion', onFinish);
    return () => {
      cancelled = true;
      cancelIntro();
      if (t) clearTimeout(t);
      window.removeEventListener('daily-completion', onFinish);
    };
  }, [userId]);

  return null;
}
