'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { fetchTodayDailyCompletions, getTodayLocal, type DailyCompletion } from '@/lib/daily-service';
import { mergePendingCompletions, pendingTodayCompletions, preferCompletion } from '@/lib/pending-records';
import {
  applyLocalResult,
  localResultsFor,
  mergeCompletions,
  pruneStore,
  reconcile,
  updateResultStore,
} from '@/lib/optimistic-results';
import { cacheUser } from '@/lib/page-cache';

/**
 * Server (or cached) completions plus today's results still sitting in the
 * pending-record queue (finished during an outage, daily row not confirmed):
 * Home must keep those cards completed across a reload. A row the server
 * already has always stands — a queued result never downgrades it.
 */
function withPending(map: Map<string, DailyCompletion>, userId: string | undefined): Map<string, DailyCompletion> {
  if (!userId) return map;
  const today = getTodayLocal();
  // BI19: plus the optimistic store (lib/optimistic-results.ts) — every finish
  // is written there before any network, so the W / L survives a reload even
  // when the pending-record payload has already been cleared.
  const local = localResultsFor(updateResultStore((st) => pruneStore(st, today)), userId, today);
  return mergeCompletions(mergePendingCompletions(map, pendingTodayCompletions(userId, today)), local);
}

/**
 * A guest has no user id; their finishes go into the same optimistic store
 * (BI19) under this local key, so Home flips the moment a guest finishes a
 * daily and keeps it across a reload. Never sent anywhere.
 */
export const GUEST_RESULTS_ID = 'guest';

/** BI19: the server's rows for today landed — drop the local entries it now has (the server wins silently). */
function reconcileLocal(server: Map<string, DailyCompletion>, userId: string): void {
  const today = getTodayLocal();
  updateResultStore((st) => reconcile(pruneStore(st, today), userId, today, server.keys()));
}

interface DailyCompletionsContextValue {
  todayDailies: Map<string, DailyCompletion>;
  /**
   * The LOCAL day `todayDailies` belongs to (stamped at write time). Consumers
   * that treat a full map as "today is swept" (the celebration modal) MUST
   * check this equals getTodayLocal(): a tab kept alive across local midnight
   * still holds yesterday's map until a refresh lands, and celebrating
   * yesterday's full sweep with today's once-per-day key is the iOS widget-launch
   * "0/N DAILY SWEEP" bug.
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

// ---- localStorage cache (day-keyed) ----
// Was localStorage, which dies with the tab — so every fresh visit refetched
// and the "Completed Today" card popped in last, shoving the rank banner and
// the board down (§254). localStorage survives across visits; the day stamp
// below is what keeps it honest, so yesterday's completions never show under
// today's header.
const CACHE_KEY = 'wordocious-daily-completions';

function readCache(): Map<string, DailyCompletion> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
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
    localStorage.setItem(CACHE_KEY, JSON.stringify({ day: getTodayLocal(), data: obj }));
  } catch {}
}

export function DailyCompletionsProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  // Initialize from localStorage so the very first render already has data
  // BI19: plus the returning player's optimistic results (cacheUser() reads
  // the stored session, so this works on the very first frame).
  const [todayDailies, setTodayDailies] = useState<Map<string, DailyCompletion>>(() => withPending(readCache(), cacheUser() ?? GUEST_RESULTS_ID));
  // readCache() is day-guarded, so whatever seeded the initial state is today's.
  const [dailiesDay, setDailiesDay] = useState<string>(() => getTodayLocal());
  const fetchedRef = useRef<string | null>(null);

  // Keep localStorage in sync whenever state changes
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
    try {
      // throwOnError: a failed read (outage) keeps what we have instead of
      // wiping Home's completed cards with an empty map.
      const data = await fetchTodayDailyCompletions(user.id, { throwOnError: true });
      reconcileLocal(data, user.id);
      setAndCache(withPending(data, user.id));
    } catch {
      setAndCache((prev) => withPending(prev, user.id));
    }
    fetchedRef.current = user.id;
  }, [user, setAndCache]);

  // Fetch on mount / user change — but only once per user.
  // If we already have cached data (from localStorage), skip the fetch
  // and just mark the user as fetched so we don't re-fetch on navigation.
  useEffect(() => {
    if (!user) {
      fetchedRef.current = null;
      // Auth has RESOLVED to "no user" (real sign-out or guest bypass) — clear any
      // completions that were cached while a previous account was signed in, so a
      // guest never sees the prior user's daily results. During auth loading `user`
      // is also null but `loading` is true, so we keep the cache then (no flicker).
      if (!loading) {
        try { localStorage.removeItem(CACHE_KEY); } catch {}
        // The guest's OWN finishes today (filed under GUEST_RESULTS_ID) stand.
        const guest = withPending(new Map(), GUEST_RESULTS_ID);
        setTodayDailies((prev) => (prev.size === 0 && guest.size === 0 ? prev : guest));
        setDailiesDay(getTodayLocal());
      }
      return;
    }
    if (fetchedRef.current === user.id) return;
    // If localStorage already has today's data, use it immediately
    // and do a silent background refresh.
    const cached = withPending(readCache(), user.id);
    if (cached.size > 0) {
      setTodayDailies(cached);
      setDailiesDay(getTodayLocal());   // readCache() only returns today's data
      fetchedRef.current = user.id;
      // Background refresh to pick up any changes
      fetchTodayDailyCompletions(user.id, { throwOnError: true }).then((fresh) => {
        reconcileLocal(fresh, user.id);
        setAndCache(withPending(fresh, user.id));
      }).catch(() => {});
    } else {
      refreshDailies().catch(() => {});
    }
  }, [user, loading, refreshDailies, setAndCache]);

  const addCompletion = useCallback((gameMode: string, result: DailyCompletion) => {
    setAndCache((prev) => {
      const next = new Map(prev);
      // Never downgrade (a win beats a loss, then the better score — the
      // daily row keeps the best too).
      next.set(gameMode, preferCompletion(prev.get(gameMode), result));
      return next;
    });
  }, [setAndCache]);

  // Pending-record queue drain: whenever the network or the tab comes back
  // ('online', visible, focus) — not only on Home's load — so a result
  // finished during an outage reaches the server as soon as it can.
  useEffect(() => {
    if (!user?.id) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    import('@/lib/stats-service')
      .then((m) => { if (!cancelled) cleanup = m.installPendingRecordDrainTriggers(user.id); })
      .catch(() => {});
    return () => { cancelled = true; cleanup?.(); };
  }, [user?.id]);

  // Listen for 'daily-completion' events fired by recordGameResult so the
  // cache updates automatically without game components needing to import
  // this context.
  const userId = user?.id;
  useEffect(() => {
    const handler = (e: Event) => {
      const { gameMode, won, guesses, timeSeconds, score, guest } = (e as CustomEvent).detail;
      // A guest's finish (noteGuestDailyFinish) only counts while no one is signed in.
      if (guest && userId) return;
      // BI19: persist the finish locally FIRST (user · day · mode) so a reload,
      // the leaderboard's own row and the Stats Today card all have it before
      // the server confirms. A guest's lands under GUEST_RESULTS_ID.
      const owner = userId ?? (guest ? GUEST_RESULTS_ID : undefined);
      if (owner) {
        const day = getTodayLocal();
        updateResultStore((st) => applyLocalResult(pruneStore(st, day), {
          userId: owner, day, mode: gameMode, won: !!won, guesses: guesses ?? 0, timeSeconds: timeSeconds ?? 0, score: score ?? 0, savedAt: Date.now(),
        }));
      }
      if (guest) {
        // Guest: in memory only — the day-keyed cache belongs to signed-in
        // accounts (a later sign-in must never inherit the guest's cards).
        setTodayDailies((prev) => {
          const next = new Map(prev);
          next.set(gameMode, preferCompletion(prev.get(gameMode), { won, guesses, timeSeconds, score: score ?? 0 }));
          return next;
        });
        setDailiesDay(getTodayLocal());
        return;
      }
      addCompletion(gameMode, { won, guesses, timeSeconds, score: score ?? 0 });
    };
    window.addEventListener('daily-completion', handler);
    return () => window.removeEventListener('daily-completion', handler);
  }, [addCompletion, userId]);

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
