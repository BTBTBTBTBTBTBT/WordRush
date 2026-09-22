import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Public read of app_flags (More Games §7). Returns the raw rows — key,
 * enabled, audience — and lets the client resolve `audience` against its own
 * profile (lib/flags.ts isFlagOn), so ONE cached response serves every viewer.
 * CDN-cached for a minute: a kill switch lands within 60 s everywhere.
 *
 * If the table does not exist yet (Stage 8 not applied) the response is an
 * empty list, which the resolver treats as "catalog decides".
 */
export async function GET() {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('app_flags')
    .select('key, enabled, audience')
    .order('key');
  const flags = error ? [] : (data ?? []);
  return NextResponse.json(
    { flags },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
