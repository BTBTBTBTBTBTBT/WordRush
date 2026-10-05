import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';

export const dynamic = 'force-dynamic';

const PAGE = 1000; // PostgREST caps a response at 1,000 rows

/** Every art_assets row, newest first (admin > Content & Ops > Art Library). */
export async function GET(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const assets: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('art_assets')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    assets.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return NextResponse.json({ assets });
}
