import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyUser } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  // Token, not body: taking `userId` from the request let anyone delete any
  // other player's push subscription and quietly turn off their reminders.
  const user = await verifyUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = user.id;

  const sb = getAdminSupabase();
  await sb.from('push_subscriptions').delete().eq('user_id', userId);

  return NextResponse.json({ ok: true });
}
