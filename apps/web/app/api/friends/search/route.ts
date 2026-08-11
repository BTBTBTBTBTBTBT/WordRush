import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/friends-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/friends/search?q=ca — username typeahead for the Add-friend field
 * (founder request, Aug 11: typing "ca" should surface Carlie so nobody
 * blind-fires an invite at a stranger with a similar name).
 *
 * Prefix matches first, then substring, capped at 5. Requires auth (no
 * anonymous roster scraping); usernames are already public on leaderboards,
 * so signed-in prefix search leaks nothing new. Excludes self and banned.
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().replace(/^@/, '');
  if (q.length < 2) return NextResponse.json({ users: [] });
  // ilike pattern metacharacters would turn the query into a wildcard probe.
  const esc = q.replace(/[%_\\]/g, (c) => `\\${c}`);

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('profiles')
    .select('id, username, avatar_url, avatar_emoji, level, is_banned')
    .ilike('username', `%${esc}%`)
    .neq('id', me)
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lower = q.toLowerCase();
  const users = (data ?? [])
    .filter((u) => !u.is_banned && u.username)
    .sort((a, b) => {
      const ap = a.username.toLowerCase().startsWith(lower) ? 0 : 1;
      const bp = b.username.toLowerCase().startsWith(lower) ? 0 : 1;
      return ap !== bp ? ap - bp : a.username.localeCompare(b.username);
    })
    .slice(0, 5)
    .map(({ id, username, avatar_url, avatar_emoji, level }) => ({ id, username, avatar_url, avatar_emoji, level }));

  return NextResponse.json({ users }, { headers: { 'Cache-Control': 'private, no-store' } });
}
