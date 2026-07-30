import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const userId = params.id;
  const { grant, days } = await request.json();

  const { data: profile } = await admin.from('profiles').select('is_pro, pro_expires_at').eq('id', userId).single();
  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  let updates: Record<string, any>;
  if (grant) {
    // ADD to whatever is already there — never reset from now.
    //
    // This used to compute `now + days` flat, while the button above it reads
    // "Extend Pro" for a user who already has Pro. Gifting a 7-day look at the
    // app to someone holding an annual subscription would have silently cut
    // them from ~300 days to 7. Same Math.max stacking the Stripe fulfillment
    // path uses (lib/payment/stripe-fulfillment.ts).
    const now = Date.now();
    const storedMs = profile.pro_expires_at ? new Date(profile.pro_expires_at).getTime() : 0;
    const base = Math.max(storedMs, now);
    const expiresMs = base + (days || 30) * 86_400_000;
    updates = { is_pro: true, pro_expires_at: new Date(expiresMs).toISOString() };
  } else {
    updates = { is_pro: false, pro_expires_at: null };
  }

  const { data, error } = await admin.from('profiles').update(updates).eq('id', userId).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from('admin_audit_log').insert({
    admin_id: auth.admin.id,
    action: grant ? 'grant_pro' : 'revoke_pro',
    target_user_id: userId,
    details: {
      grant,
      days,
      previous_pro: profile.is_pro,
      previous_expiry: profile.pro_expires_at,
      new_expiry: (data as { pro_expires_at?: string } | null)?.pro_expires_at ?? null,
    },
  });

  return NextResponse.json({ profile: data });
}
