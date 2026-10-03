import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { grantAchievements } from '@/lib/achievements-server';

export const dynamic = 'force-dynamic';

/**
 * Grant ONE achievement to a player from their admin page: { key }.
 *
 * Goes through the existing server grant (lib/achievements-server
 * grantAchievements — the same service-role path the game endpoints use), so
 * hidden and unknown keys are refused, a key the player already has is a
 * no-op, and the player's own seen-diff celebrates it on their next launch.
 * Every grant is written to admin_audit_log like the Pro / ban actions.
 *
 * There is deliberately NO revoke: no server path deletes an achievement row
 * today, and an unlock the player has already celebrated shouldn't vanish
 * from an admin click.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const userId = params.id;
  const body = (await request.json().catch(() => ({}))) as { key?: unknown };
  const key = typeof body.key === 'string' ? body.key.trim() : '';
  if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });

  const admin = getAdminSupabase();
  const { data: profile } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const granted = await grantAchievements(admin, userId, [key]);
  const { data: existing } = await admin.from('achievements').select('achievement_key').eq('user_id', userId).eq('achievement_key', key).maybeSingle();
  if (granted.length === 0 && !existing) {
    return NextResponse.json({ error: 'Not granted: unknown or hidden achievement' }, { status: 400 });
  }

  if (granted.length > 0) {
    await admin.from('admin_audit_log').insert({
      admin_id: auth.admin.id,
      action: 'grant_achievement',
      target_user_id: userId,
      details: { key },
    });
  }

  return NextResponse.json({ granted: granted.map((g) => g.key), alreadyHad: granted.length === 0 });
}
