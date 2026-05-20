'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { fetchTodayDailyCompletions, type DailyCompletion } from '@/lib/daily-service';

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

export function DailyCompletionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [todayDailies, setTodayDailies] = useState<Map<string, DailyCompletion>>(new Map());
  const fetchedRef = useRef<string | null>(null);

  const refreshDailies = useCallback(async () => {
    if (!user) {
      setTodayDailies(new Map());
      return;
    }
    const data = await fetchTodayDailyCompletions(user.id);
    setTodayDailies(data);
    fetchedRef.current = user.id;
  }, [user]);

  // Fetch on mount / user change — but only once per user
  useEffect(() => {
    if (!user) {
      setTodayDailies(new Map());
      fetchedRef.current = null;
      return;
    }
    if (fetchedRef.current === user.id) return;
    refreshDailies().catch(() => {});
  }, [user, refreshDailies]);

  const addCompletion = useCallback((gameMode: string, result: DailyCompletion) => {
    setTodayDailies((prev) => {
      const next = new Map(prev);
      next.set(gameMode, result);
      return next;
    });
  }, []);

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

  return (
    <DailyCompletionsContext.Provider value={{ todayDailies, addCompletion, refreshDailies }}>
      {children}
    </DailyCompletionsContext.Provider>
  );
}

export function useDailyCompletions() {
  return useContext(DailyCompletionsContext);
}
