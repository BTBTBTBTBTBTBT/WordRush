import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { studioFixtureMode } from '@/lib/admin/studio-db';
import { parsePauseBody } from '@/lib/admin/studio';

export const dynamic = 'force-dynamic';

/** "Pause all posting": { paused } -> { paused }. The publisher skips everything while it is on. */
export async function POST(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;

  const parsed = parsePauseBody(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (studioFixtureMode()) return NextResponse.json({ paused: parsed.paused, fixture: true });

  const now = new Date().toISOString();
  const { error } = await getAdminSupabase().from('social_settings').upsert({
    id: 1, paused: parsed.paused, paused_by: parsed.paused ? auth.admin.id : null, paused_at: parsed.paused ? now : null, updated_at: now,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ paused: parsed.paused });
}
