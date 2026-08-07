import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/friends-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/friends — the caller's whole friends world in one round trip:
 * accepted friends (with profile chrome), incoming pending requests, and
 * outgoing pending ids. friends-service caches this per session on all
 * three platforms (the moderation-service pattern).
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('friendships')
    .select(
      `requester_id, addressee_id, status, created_at, accepted_at,
       requester:profiles!friendships_requester_id_fkey(id, username, avatar_url, level),
       addressee:profiles!friendships_addressee_id_fkey(id, username, avatar_url, level)`,
    )
    .or(`requester_id.eq.${me},addressee_id.eq.${me}`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Prof = { id: string; username: string; avatar_url: string | null; level: number };
  const friends: Array<Prof & { since: string | null }> = [];
  const incoming: Array<Prof & { requestedAt: string }> = [];
  const outgoing: string[] = [];

  for (const row of (data ?? []) as any[]) {
    const other: Prof = row.requester_id === me ? row.addressee : row.requester;
    if (!other) continue; // profile vanished mid-join; FK cascade will clean up
    if (row.status === 'accepted') {
      friends.push({ ...other, since: row.accepted_at });
    } else if (row.addressee_id === me) {
      incoming.push({ ...other, requestedAt: row.created_at });
    } else {
      outgoing.push(row.addressee_id);
    }
  }

  friends.sort((a, b) => a.username.localeCompare(b.username));
  incoming.sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));

  return NextResponse.json(
    { friends, incoming, outgoing },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
