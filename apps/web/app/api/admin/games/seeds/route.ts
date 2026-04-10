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

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const { day, game_mode, seed, solutions } = await request.json();

  if (!day || !game_mode || !seed) {
    return NextResponse.json({ error: 'day, game_mode, and seed are required' }, { status: 400 });
  }

  // Upsert — override if exists, create if not
  const { data, error } = await admin
    .from('daily_seeds')
    .upsert(
      { day, game_mode, seed, solutions: solutions || [] },
      { onConflict: 'day,game_mode' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('admin_audit_log').insert({
    admin_id: auth.admin.id,
    action: 'override_daily_seed',
    details: { day, game_mode, seed },
  });

  return NextResponse.json({ seed: data });
}
