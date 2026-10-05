import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { parseDecideBody } from '@/lib/admin/art-library';

export const dynamic = 'force-dynamic';

/**
 * Record a founder decision on one asset: { id, status, note? } -> { asset }.
 * A missing note keeps the current one; null or '' clears it.
 */
export async function POST(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;

  const parsed = parseDecideBody(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: parsed.status,
    decided_by: auth.admin.id,
    decided_at: now,
    updated_at: now,
  };
  if (parsed.note !== undefined) patch.note = parsed.note;

  const admin = getAdminSupabase();
  const { data, error } = await admin.from('art_assets').update(patch).eq('id', parsed.id).select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Unknown asset' }, { status: 404 });
  return NextResponse.json({ asset: data });
}
