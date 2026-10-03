import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { sweepAll } from '@/lib/supabase-sweep';
import { headCount } from '@/lib/admin/admin-queries';
import { avatarAdoption, type AvatarProfileRow } from '@/lib/admin/admin-aggregates';

export const dynamic = 'force-dynamic';

/**
 * admin > Progression > Avatars: mascot-maker adoption (FINISH_SPEC AN). Reads
 * profiles.avatar_config / avatar_cast_id / avatar_frame (docs/sql/
 * 20261002-avatar-cast.sql). If those columns aren't applied yet the page
 * says so instead of showing zeros. Read-only.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const probe = await admin.from('profiles').select('avatar_config, avatar_cast_id, avatar_frame').limit(1);
  if (probe.error) {
    return NextResponse.json({
      applied: false,
      note: 'profiles.avatar_config / avatar_cast_id / avatar_frame are not in the database yet (docs/sql/20261002-avatar-cast.sql).',
    });
  }

  const [players, withPhoto, rows] = await Promise.all([
    headCount(admin.from('profiles').select('id', { count: 'exact', head: true })),
    headCount(admin.from('profiles').select('id', { count: 'exact', head: true }).not('avatar_url', 'is', null)),
    // Only rows that saved something: a mascot, a cast pick or a frame.
    sweepAll<AvatarProfileRow & { id: string }>((f, t) =>
      admin
        .from('profiles')
        .select('id, avatar_config, avatar_url, avatar_cast_id, avatar_frame')
        .or('avatar_config.not.is.null,avatar_cast_id.not.is.null,avatar_frame.not.is.null')
        .order('id')
        .range(f, t),
    ),
  ]);

  return NextResponse.json({ applied: true, players, withPhoto, adoption: avatarAdoption(rows) });
}
