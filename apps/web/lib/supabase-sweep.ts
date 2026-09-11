import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * §257: PostgREST caps every un-ranged select at 1,000 rows and reports
 * nothing — the friends weekly race lost whole users to it (Oliver, Michael),
 * and the admin dashboards had been quietly undercounting since daily_results
 * passed 1,000 rows. Any service-role read that can grow past 1,000 rows goes
 * through here: fetch fixed-size pages on a stable order until a short page
 * comes back. The caller supplies the query and appends the `.range` we hand it
 * (after a stable `.order('id')`).
 *
 *   const rows = await sweepAll<{ user_id: string }>((from, to) =>
 *     admin.from('daily_results').select('user_id').eq('day', d).order('id').range(from, to));
 */
export async function sweepAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await page(from, from + PAGE - 1);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/** auth.admin.listUsers has the same 1,000 cap per page — walk every page. */
export async function listAllUsers(admin: SupabaseClient): Promise<User[]> {
  const PER = 1000;
  const out: User[] = [];
  for (let pageNo = 1; ; pageNo++) {
    const { data } = await admin.auth.admin.listUsers({ page: pageNo, perPage: PER });
    const users = data?.users ?? [];
    out.push(...users);
    if (users.length < PER) break;
  }
  return out;
}
