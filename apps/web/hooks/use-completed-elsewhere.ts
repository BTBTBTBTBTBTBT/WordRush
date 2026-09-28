'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { fetchTodayDailyCompletions, getTodayLocal, type DailyCompletion } from '@/lib/daily-service';

// Founder, 2026-09-28: Brian finished today's Spyglass on his phone, opened
// wordocious.com/spyglass and got an EMPTY puzzle. iOS shows a completed card
// for a custom daily finished on another device; the web More Games titles
// only looked at their localStorage save, so with no local save they started
// a fresh board even though daily_results already held today's result. This
// hook is the missing check: daily mode + no local save + signed in → ask
// daily_results once and hand the game today's completion (or null).
//
// One fetch per (user, local day), shared by every game through a module map,
// so opening ten titles in a row costs one request; the promise is cached so
// two games mounting in the same tick share it too.

const todayCompletionsCache = new Map<string, { at: number; p: Promise<Map<string, DailyCompletion>> }>();
// Short-lived: a daily finished on the phone while this tab sits open should show up on the
// next game open, not only after a reload (founder, 2026-09-28).
const CACHE_TTL_MS = 30_000;

function todayCompletions(userId: string, day: string): Promise<Map<string, DailyCompletion>> {
  const key = `${userId}|${day}`;
  const hit = todayCompletionsCache.get(key);
  let p = hit && Date.now() - hit.at < CACHE_TTL_MS ? hit.p : undefined;
  if (!p) {
    // A failed fetch resolves empty (play proceeds) and is NOT cached, so the
    // next mount retries instead of pinning a transient error for the day.
    p = fetchTodayDailyCompletions(userId).catch(() => {
      todayCompletionsCache.delete(key);
      return new Map<string, DailyCompletion>();
    });
    todayCompletionsCache.set(key, { at: Date.now(), p });
  }
  return p;
}

export interface CompletedElsewhere {
  /** True while auth is still resolving or the daily_results read is in flight — hold the board. */
  checking: boolean;
  /** Today's result for this mode when it exists; null once we know there is none (or when disabled). */
  completion: DailyCompletion | null;
}

/**
 * `enabled` = daily mode AND no local save for today's seed (the game learns
 * that in its restore effect). The signed-in profile comes from the auth
 * context here rather than from the caller so an auth that is still loading
 * reads as `checking` — otherwise the fresh board would flash for the second
 * before the profile lands and then vanish behind the completed card.
 * Signed out (auth resolved, no profile) or disabled → `{checking:false, completion:null}`.
 */
export function useCompletedElsewhere(dbKey: string, enabled: boolean): CompletedElsewhere {
  const { profile, loading } = useAuth();
  const { todayDailies, dailiesDay } = useDailyCompletions();
  const day = getTodayLocal();
  const userId = enabled && profile ? profile.id : null;
  const [resolved, setResolved] = useState<{ key: string; completion: DailyCompletion | null } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    todayCompletions(userId, day).then((map) => {
      if (cancelled) return;
      setResolved({ key: `${userId}|${day}|${dbKey}`, completion: map.get(dbKey) ?? null });
    });
    return () => { cancelled = true; };
  }, [userId, day, dbKey]);

  if (!enabled) return { checking: false, completion: null };
  if (!profile) return { checking: loading, completion: null };

  // Fast path: the home page's completions context already knows today's
  // result for this mode (localStorage-seeded, day-stamped). A positive hit is
  // trustworthy; a miss still waits for the fetch.
  const fromContext = dailiesDay === day ? todayDailies.get(dbKey) : undefined;
  if (fromContext) return { checking: false, completion: fromContext };

  const key = `${profile.id}|${day}|${dbKey}`;
  if (resolved && resolved.key === key) return { checking: false, completion: resolved.completion };
  return { checking: true, completion: null };
}
