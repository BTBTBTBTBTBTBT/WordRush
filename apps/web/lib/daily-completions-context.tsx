'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { fetchTodayDailyCompletions, getTodayLocal, type DailyCompletion } from '@/lib/daily-service';

interface DailyCompletionsContextValue {
  todayDailies: Map<string, DailyCompletion>;
  /** Optimistically add/update a single mode completion without re-fetching */
  addCompletion: (gameMode: string, result: DailyCompletion) => void;
  /** Full refresh from DB */
  refreshDailies: () => Promise<void>;
}

const DailyCompletionsContext = createContext<DailyCompletionsContextValue>({
  todayDailies: new Map(),
  addCompletion: () => {},
  refreshDailies: async () => {},
});

// ---- sessionStorage cache ----
// Survives React remounts and soft navigations so the sweep banner
// never flashes on return to the home screen.
const CACHE_KEY = 'wordocious-daily-completions';

function readCache(): Map<string, DailyCompletion> {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    // Invalidate if the cached day doesn't match today
    if (parsed.day !== getTodayLocal()) return new Map();
    return new Map(Object.entries(parsed.data) as [string, DailyCompletion][]);
  } catch {
    return new Map();
  }
}

function writeCache(map: Map<string, DailyCompletion>) {
  try {
    const obj: Record<string, DailyCompletion> = {};
    map.forEach((v, k) => { obj[k] = v; });
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ day: getTodayLocal(), data: obj }));
  } catch {}
}

export function DailyCompletionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Initialise from sessionStorage so the very first render already has data
  const [todayDailies, setTodayDailies] = useState<Map<string, DailyCompletion>>(() => readCache());
  const fetchedRef = useRef<string | null>(null);

  // Keep sessionStorage in sync whenever state changes
  const setAndCache = useCallback((mapOrFn: Map<string, DailyCompletion> | ((prev: Map<string, DailyCompletion>) => Map<string, DailyCompletion>)) => {
    setTodayDailies((prev) => {
      const next = typeof mapOrFn === 'function' ? mapOrFn(prev) : mapOrFn;
      writeCache(next);
      return next;
    });
  }, []);

  const refreshDailies = useCallback(async () => {
    if (!user) {
      setAndCache(new Map());
      return;
    }
    const data = await fetchTodayDailyCompletions(user.id);
    setAndCache(data);
    fetchedRef.current = user.id;
  }, [user, setAndCache]);

  // Fetch on mount / user change — but only once per user.
  // If we already have cached data (from sessionStorage), skip the fetch
  // and just mark the user as fetched so we don't re-fetch on navigation.
  useEffect(() => {
    if (!user) {
      // Don't clear cache on null user during auth loading — the cache
      // is keyed by day so stale data auto-expires.
      fetchedRef.current = null;
      return;
    }
    if (fetchedRef.current === user.id) return;
    // If sessionStorage already has today's data, use it immediately
    // and do a silent background refresh.
    const cached = readCache();
    if (cached.size > 0) {
      setTodayDailies(cached);
      fetchedRef.current = user.id;
      // Background refresh to pick up any changes
      fetchTodayDailyCompletions(user.id).then((fresh) => {
        setAndCache(fresh);
      }).catch(() => {});
    } else {
      refreshDailies().catch(() => {});
    }
  }, [user, refreshDailies, setAndCache]);

  const addCompletion = useCallback((gameMode: string, result: DailyCompletion) => {
    setAndCache((prev) => {
      const next = new Map(prev);
      next.set(gameMode, result);
      return next;
    });
  }, [setAndCache]);

  // Listen for 'daily-completion' events fired by recordGameResult so the
  // cache updates automatically without game components needing to import
  // this context.
  useEffect(() => {
    const handler = (e: Event) => {
      const { gameMode, won, guesses, timeSeconds } = (e as CustomEvent).detail;
      addCompletion(gameMode, { won, guesses, timeSeconds });
    };
    window.addEventListener('daily-completion', handler);
    return () => window.removeEventListener('daily-completion', handler);
  }, [addCompletion]);

  // Stable context value to avoid unnecessary re-renders
  const value = useMemo(() => ({
    todayDailies,
    addCompletion,
    refreshDailies,
  }), [todayDailies, addCompletion, refreshDailies]);

  return (
    <DailyCompletionsContext.Provider value={value}>
      {children}
    </DailyCompletionsContext.Provider>
  );
}

export function useDailyCompletions() {
  return useContext(DailyCompletionsContext);
}
