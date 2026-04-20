'use client';

import { useMemo } from 'react';
import { useAuth } from './auth-context';

const ANON_KEY = 'wordocious-anon-presence-id';

/**
 * Stable identifier for presence-counting. The server dedupes the LIVE
 * count by this value, so a single person shows as 1 no matter how many
 * tabs/sockets they have open:
 *
 * - Signed-in users: `u:<supabase-user-id>`. Consistent across tabs and
 *   devices, so "Alice on her phone + laptop" = 1.
 * - Anonymous visitors: `a:<localStorage-UUID>`. Persists per browser
 *   profile; clearing storage or using incognito mints a fresh id (treated
 *   as a new visitor, which is the best we can do without sign-in).
 *
 * The prefix keeps the two namespaces from colliding — an anon UUID that
 * happens to look like a uuid user id can't accidentally dedupe against
 * a real signed-in user.
 */
export function getPresenceId(userId: string | undefined | null): string {
  if (userId) return `u:${userId}`;
  if (typeof window === 'undefined') return '';
  let anon = localStorage.getItem(ANON_KEY);
  if (!anon) {
    anon = `a:${crypto.randomUUID()}`;
    localStorage.setItem(ANON_KEY, anon);
  }
  return anon;
}

export function usePresenceId(): string {
  const { user } = useAuth();
  return useMemo(() => getPresenceId(user?.id), [user?.id]);
}
