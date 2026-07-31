import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const { searchParams } = new URL(request.url);
  const day = searchParams.get('day') || new Date().toISOString().split('T')[0];

  const { data, error } = await admin
    .from('daily_seeds')
    .select('*')
    .eq('day', day)
    .order('game_mode');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ seeds: data || [], day });
}

// The POST override handler was removed 2026-08-01 with the admin "Daily Word
// Override" card: it upserted rows no client ever reads (all platforms derive
// daily words from the date hash against bundled lists). GET stays — the admin
// Games page lists the day's seed rows with it.
