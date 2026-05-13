import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const { userId, subscription } = await req.json();
  if (!userId || !subscription) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const sb = getAdminSupabase();
  const { error } = await sb
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
