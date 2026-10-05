import type { getAdminSupabase } from '@/lib/supabase-admin';
import type { ArtFeedback, ArtReviewer } from './art-review';

type Admin = ReturnType<typeof getAdminSupabase>;

/** Server-only reads shared by the Art Library routes (service-role client passed in). */

/** art_reviewers in display order, with each profile's username. */
export async function loadReviewers(admin: Admin): Promise<{ list: ArtReviewer[] } | { error: string }> {
  const { data, error } = await admin.from('art_reviewers').select('profile_id, short_name, sort').order('sort', { ascending: true });
  if (error) return { error: error.message };
  const rows = (data ?? []) as Array<{ profile_id: string; short_name: string; sort: number }>;
  const names = await usernames(admin, rows.map((r) => r.profile_id));
  return { list: rows.map((r) => ({ ...r, username: names.get(r.profile_id) ?? null })) };
}

/** profile id -> username (missing ids are left out). */
export async function usernames(admin: Admin, ids: readonly string[]): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return new Map();
  const { data } = await admin.from('profiles').select('id, username').in('id', unique);
  return new Map(((data ?? []) as Array<{ id: string; username: string | null }>).map((p) => [p.id, p.username]));
}

export const FEEDBACK_COLUMNS = 'id, asset_id, scope, author_id, body, created_at, resolved_at, resolved_by, resolved_note';

/** Attach author usernames to raw art_feedback rows. */
export async function withAuthors(admin: Admin, rows: Array<Omit<ArtFeedback, 'author'>>): Promise<ArtFeedback[]> {
  const names = await usernames(admin, rows.map((r) => r.author_id));
  return rows.map((r) => ({ ...r, author: names.get(r.author_id) ?? null }));
}
