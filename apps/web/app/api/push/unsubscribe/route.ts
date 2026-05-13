import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const sb = getAdminSupabase();
  await sb.from('push_subscriptions').delete().eq('user_id', userId);

  return NextResponse.json({ ok: true });
}
