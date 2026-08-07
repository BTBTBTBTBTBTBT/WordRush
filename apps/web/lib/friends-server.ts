import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { verifyUser } from './api-auth';

/**
 * FRIENDS — server-side helpers shared by the /api/friends/* routes
 * (bible §207).
 *
 * friendships/friend_taunts have NO client write policies: every mutation
 * flows through these routes with the service role, because
 *   • the pair-block check cannot run client-side (blocks SELECT is
 *     blocker-only), and
 *   • request/accept/taunt/overtake pushes must originate server-side
 *     (lib/push/broadcast.ts).
 * Reads stay client-side (participants SELECT policy) so friends-service
 * caches cheaply, same shape as moderation-service's blocked set.
 */

/** Bearer-authed caller or a ready-made 401. */
export async function requireUser(
  req: NextRequest,
): Promise<{ user: User } | { response: NextResponse }> {
  const user = await verifyUser(req);
  if (!user) {
    return { response: NextResponse.json({ error: 'Sign in required' }, { status: 401 }) };
  }
  return { user };
}

/** True when either side has blocked the other — service-role read of blocks. */
export async function pairBlocked(
  admin: SupabaseClient,
  a: string,
  b: string,
): Promise<boolean> {
  const { data } = await admin
    .from('blocks')
    .select('blocker_id')
    .or(
      `and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`,
    )
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export interface FriendshipRow {
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
  accepted_at: string | null;
}

/** The pair's row in either direction, or null. */
export async function getFriendship(
  admin: SupabaseClient,
  a: string,
  b: string,
): Promise<FriendshipRow | null> {
  const { data } = await admin
    .from('friendships')
    .select('requester_id, addressee_id, status, created_at, accepted_at')
    .or(
      `and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`,
    )
    .maybeSingle();
  return (data as FriendshipRow | null) ?? null;
}

/** Accepted-friend ids for a user (both directions). */
export async function acceptedFriendIds(
  admin: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data } = await admin
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  return (data ?? []).map((r: { requester_id: string; addressee_id: string }) =>
    r.requester_id === userId ? r.addressee_id : r.requester_id,
  );
}

/** True when a and b share an accepted friendship. */
export async function areFriends(
  admin: SupabaseClient,
  a: string,
  b: string,
): Promise<boolean> {
  const row = await getFriendship(admin, a, b);
  return row?.status === 'accepted';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID.test(s);
