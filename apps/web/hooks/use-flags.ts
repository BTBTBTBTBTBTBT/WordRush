'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth-context';
import { isFlagOn, indexFlags, type AppFlag } from '@/lib/flags';

const CACHE_KEY = 'wordocious-app-flags';

function readCache(): Record<string, AppFlag> | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, AppFlag>) : undefined;
  } catch { return undefined; }
}

async function fetchFlags(): Promise<Record<string, AppFlag>> {
  const r = await fetch('/api/flags');
  if (!r.ok) throw new Error(`flags ${r.status}`);
  const j = (await r.json()) as { flags: AppFlag[] };
  const idx = indexFlags(j.flags ?? []);
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(idx)); } catch {}
  return idx;
}

/**
 * The remote flags for this viewer (plan §7). `isOn(flagKey)` is what every
 * mode list filters on. Three states:
 *   loading with nothing cached → flagged modes HIDDEN (no flash of a tester
 *                                 game for a player who shouldn't see it)
 *   unreachable, nothing cached → flagged modes shown (catalog decides)
 *   loaded / cached             → the shared resolver
 * Revalidates on focus, i.e. when the tab comes back to the foreground.
 */
export function useFlags(): { isOn: (flagKey: string | null | undefined) => boolean; loading: boolean } {
  const { profile } = useAuth();
  const { data, error, isLoading } = useSWR('app-flags', fetchFlags, {
    fallbackData: typeof window !== 'undefined' ? readCache() : undefined,
    revalidateOnFocus: true,
    dedupingInterval: 60_000,
    errorRetryCount: 2,
  });
  const viewer = { isAdmin: !!profile?.is_admin, role: profile?.role ?? null };
  const flags = data ?? (error ? null : undefined);
  const isOn = useCallback((flagKey: string | null | undefined) => {
    if (!flagKey) return true;
    if (flags === undefined) return false;   // still loading, nothing cached
    return isFlagOn(flagKey, flags, viewer);
  }, [flags, viewer.isAdmin, viewer.role]); // eslint-disable-line react-hooks/exhaustive-deps
  return { isOn, loading: isLoading && flags === undefined };
}
