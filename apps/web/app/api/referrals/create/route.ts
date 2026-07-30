import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyUser } from '@/lib/api-auth';
import { isProActive } from '@/lib/pro';
import { MAX_PENDING_INVITES } from '@/lib/referral-service';

export const dynamic = 'force-dynamic';

// Same unambiguous alphabet as VS invites (invite-service.ts) — no 0/O/1/I/l.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode(length = 8): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Create a referral invite. Capped at MAX_PENDING_INVITES outstanding
 * (pending + unexpired) — a slot frees when an invite is redeemed or expires.
 */
export async function POST(req: NextRequest) {
  const user = await verifyUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = getAdminSupabase();

  // Gifting Pro is itself a Pro benefit. This is the authoritative gate: the
  // three client panels hide themselves, but a hidden button is not a gate —
  // without this a free account could POST here directly and mint 7-day Pro
  // trials, which is exactly what shipped. `maybeSingle` + `isProActive` fails
  // closed: a missing profile row or a lapsed expiry is not Pro.
  const { data: me } = await sb.from('profiles')
    .select('is_pro, pro_expires_at')
    .eq('id', user.id)
    .maybeSingle();
  if (!isProActive(me)) {
    return NextResponse.json(
      { error: 'Gifting Pro is a Pro feature. Subscribe to gift 7-day trials to friends.' },
      { status: 403 },
    );
  }

  const { count } = await sb.from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('inviter_id', user.id)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString());
  if ((count ?? 0) >= MAX_PENDING_INVITES) {
    return NextResponse.json(
      { error: `You already have ${MAX_PENDING_INVITES} open invites. Slots free up when a friend joins.` },
      { status: 409 },
    );
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode();
    const { data, error } = await sb.from('referrals')
      .insert({ inviter_id: user.id, code })
      .select('code')
      .single();
    if (!error && data) {
      return NextResponse.json({ code: data.code, url: `https://wordocious.com/join/${data.code}` });
    }
    if (error && error.code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: 'Could not generate a unique code' }, { status: 500 });
}
