// Small service-role query helpers shared by the api/admin/* routes. Server
// only (every caller has already passed verifyAdmin and holds the
// getAdminSupabase client); nothing here touches a key or returns one.

import type { SupabaseClient } from '@supabase/supabase-js';

/** A PostgREST select with `{ count: 'exact', head: true }` (any thenable count response). */
type CountResponse = { count: number | null; error: unknown };

/**
 * The row count of a head query, or null when the query fails (a table or
 * column that isn't applied yet). Null renders as "—" with a note, never as 0.
 */
export async function headCount(q: PromiseLike<CountResponse>): Promise<number | null> {
  try {
    const r = await q;
    return r.error ? null : (r.count ?? 0);
  } catch {
    return null;
  }
}

/** Run `fn` over `items` a few at a time (keeps ~100 parallel count queries polite). */
export async function inBatches<T, R>(items: readonly T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

/** id → username for a set of profile ids (batched under PostgREST's URL limits). */
export async function usernames(admin: SupabaseClient, ids: readonly (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, string>();
  for (let i = 0; i < unique.length; i += 150) {
    const { data } = await admin.from('profiles').select('id, username').in('id', unique.slice(i, i + 150));
    for (const r of (data ?? []) as Array<{ id: string; username: string | null }>) out.set(r.id, r.username ?? r.id.slice(0, 8));
  }
  return out;
}

export const isoDaysAgo = (n: number, nowMs = Date.now()) => new Date(nowMs - n * 86400000).toISOString();
export const utcDay = (d: Date = new Date()) => d.toISOString().slice(0, 10);
