import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyUser } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  // Identify the subscriber from the token, never the body. With `userId`
  // accepted as a POST field and no auth, anyone could upsert against another
  // account's row (onConflict: user_id) and point that person's push
  // notifications at their OWN endpoint — reading someone else's nudges, or
  // simply silencing them.
  const user = await verifyUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { subscription } = await req.json();
  if (!subscription) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  const userId = user.id;

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
