import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminSupabase } from '@/lib/supabase-admin';

/**
 * Permanently delete the calling user's account (App Store 5.1.1(v)).
 *
 * ORDER MATTERS. `profiles.id` references `auth.users(id) ON DELETE CASCADE`,
 * and every user-owned table cascades (or nulls) from `profiles` — so deleting
 * the AUTH USER alone removes everything downstream.
 *
 * This used to delete the seven data tables first and the auth user last, with
 * no error checking in between. If that final call failed, the user was left
 * with a working login and an account stripped of every stat, result, medal and
 * purchase — unrecoverable, and with no idea why. Deleting the auth user FIRST
 * makes the destructive step atomic: it either takes everything with it or
 * changes nothing, so a failure is safely retryable.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify the user's session from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Create a client with the user's token to verify identity
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = user.id;
    const admin = getAdminSupabase();

    // The one destructive call. Cascades through profiles to daily_results,
    // daily_medals, user_stats, user_achievements, purchases, matches,
    // referrals, device_tokens, push_subscriptions, reports and blocks.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    // Belt and braces: sweep anything the cascade could have missed. Runs after
    // the account is already gone, so a failure here is cosmetic — log it and
    // still report success rather than telling the user a completed deletion
    // failed (they'd retry against an account that no longer exists).
    const sweep = await Promise.allSettled([
      admin.from('user_stats').delete().eq('user_id', userId),
      admin.from('daily_results').delete().eq('user_id', userId),
      admin.from('daily_medals').delete().eq('user_id', userId),
      admin.from('user_achievements').delete().eq('user_id', userId),
      admin.from('purchases').delete().eq('user_id', userId),
      admin.from('device_tokens').delete().eq('user_id', userId),
      admin.from('profiles').delete().eq('id', userId),
      // STORAGE, not just tables. Both buckets are `public = true`, so an
      // avatar left behind stays fetchable at a guessable URL forever — while
      // the privacy policy and the in-app legal text both promise that account
      // deletion removes the user's personal data. Deleting rows and leaving
      // the photograph is the version of this that is worse than not offering
      // deletion at all, because it is stated and untrue.
      admin.storage.from('avatars').remove([`${userId}/avatar.jpg`]),
      admin.storage.from('share-images').list(userId).then(async (r) => {
        const files = (r.data ?? []).map((f) => `${userId}/${f.name}`);
        if (files.length) await admin.storage.from('share-images').remove(files);
      }),
    ]);
    const leftovers = sweep.filter((r) => r.status === 'rejected');
    if (leftovers.length > 0) {
      console.error('[account-delete] post-cascade sweep had failures:', leftovers);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
