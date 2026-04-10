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
  const mode = searchParams.get('mode') || 'DUEL';
  const playType = searchParams.get('play_type') || 'solo';

  const { data, error } = await admin
    .from('daily_results')
    .select('*, profiles!inner(username, avatar_url, is_pro)')
    .eq('day', day)
    .eq('game_mode', mode)
    .eq('play_type', playType)
    .order('composite_score', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data || [], day, mode, playType });
}
