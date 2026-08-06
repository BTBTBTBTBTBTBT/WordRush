'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { fetchTodayDailyCompletions, getTodayLocal, type DailyCompletion } from '@/lib/daily-service';

interface DailyCompletionsContextValue {
  todayDailies: Map<string, DailyCompletion>;
  /**
   * The LOCAL day `todayDailies` belongs to (stamped at write time). Consumers
   * that treat a full map as "today is swept" (the celebration modal) MUST
   * check this equals getTodayLocal(): a tab kept alive across local midnight
   * still holds yesterday's map until a refresh lands, and celebrating
   * yesterday's 9/9 with today's once-per-day key is the iOS widget-launch
   * "0/9 DAILY SWEEP" bug.
   */
  dailiesDay: string;
  /** Optimistically add/update a single mode completion without re-fetching */
  addCompletion: (gameMode: string, result: DailyCompletion) => void;
  /** Full refresh from DB */
  refreshDailies: () => Promise<void>;
}

const DailyCompletionsContext = createContext<DailyCompletionsContextValue>({
  todayDailies: new Map(),
  dailiesDay: '',
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
  const { user, loading } = useAuth();
  // Initialise from sessionStorage so the very first render already has data
  const [todayDailies, setTodayDailies] = useState<Map<string, DailyCompletion>>(() => readCache());
  // readCache() is day-guarded, so whatever seeded the initial state is today's.
  const [dailiesDay, setDailiesDay] = useState<string>(() => getTodayLocal());
  const fetchedRef = useRef<string | null>(null);

  // Keep sessionStorage in sync whenever state changes
  const setAndCache = useCallback((mapOrFn: Map<string, DailyCompletion> | ((prev: Map<string, DailyCompletion>) => Map<string, DailyCompletion>)) => {
    setTodayDailies((prev) => {
      const next = typeof mapOrFn === 'function' ? mapOrFn(prev) : mapOrFn;
      writeCache(next);
      return next;
    });
    // Every write path produces data for the CURRENT local day (fetches filter
    // on it; optimistic completions just happened) — restamp the day.
    setDailiesDay(getTodayLocal());
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
      fetchedRef.current = null;
      // Auth has RESOLVED to "no user" (real sign-out or guest bypass) — clear any
      // completions that were cached while a previous account was signed in, so a
      // guest never sees the prior user's daily results. During auth loading `user`
      // is also null but `loading` is true, so we keep the cache then (no flicker).
      if (!loading) {
        setTodayDailies((prev) => (prev.size > 0 ? new Map() : prev));
        try { sessionStorage.removeItem(CACHE_KEY); } catch {}
      }
      return;
    }
    if (fetchedRef.current === user.id) return;
    // If sessionStorage already has today's data, use it immediately
    // and do a silent background refresh.
    const cached = readCache();
    if (cached.size > 0) {
      setTodayDailies(cached);
      setDailiesDay(getTodayLocal());   // readCache() only returns today's data
      fetchedRef.current = user.id;
      // Background refresh to pick up any changes
      fetchTodayDailyCompletions(user.id).then((fresh) => {
        setAndCache(fresh);
      }).catch(() => {});
    } else {
      refreshDailies().catch(() => {});
    }
  }, [user, loading, refreshDailies, setAndCache]);

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
      const { gameMode, won, guesses, timeSeconds, score } = (e as CustomEvent).detail;
      addCompletion(gameMode, { won, guesses, timeSeconds, score: score ?? 0 });
    };
    window.addEventListener('daily-completion', handler);
    return () => window.removeEventListener('daily-completion', handler);
  }, [addCompletion]);

  // Stable context value to avoid unnecessary re-renders
  const value = useMemo(() => ({
    todayDailies,
    dailiesDay,
    addCompletion,
    refreshDailies,
  }), [todayDailies, dailiesDay, addCompletion, refreshDailies]);

  return (
    <DailyCompletionsContext.Provider value={value}>
      {children}
    </DailyCompletionsContext.Provider>
  );
}

export function useDailyCompletions() {
  return useContext(DailyCompletionsContext);
}
