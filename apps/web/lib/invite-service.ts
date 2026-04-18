/**
 * Match invites — create/lookup/update of the match_invites table. The
 * matchmaking Socket.IO server reads the invite_code clients supply
 * when joining the queue; it pairs two users who arrive with the same
 * code into a private lobby regardless of public queue state.
 */

import { supabase } from './supabase-client';

export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';

export interface MatchInvite {
  id: string;
  inviter_id: string;
  invitee_id: string | null;
  invite_code: string;
  game_mode: string;
  status: InviteStatus;
  match_id: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/l — easier to type

function generateInviteCode(length = 8): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Create a new invite. If `inviteeUsername` is provided the invite is
 * targeted at that user (they'll see it in a pending-invites badge);
 * otherwise it's a public-link invite anyone can redeem.
 */
export async function createInvite(params: {
  inviterId: string;
  gameMode: string;
  inviteeUsername?: string;
}): Promise<{ invite: MatchInvite | null; error?: string }> {
  let inviteeId: string | null = null;

  if (params.inviteeUsername) {
    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('id')
      .ilike('username', params.inviteeUsername)
      .maybeSingle();
    if (error) return { invite: null, error: error.message };
    if (!data) return { invite: null, error: 'User not found' };
    if (data.id === params.inviterId) return { invite: null, error: "You can't invite yourself" };
    inviteeId = data.id;
  }

  // Try up to 3 times in the vanishingly small chance of a code collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateInviteCode();
    const { data, error } = await (supabase as any)
      .from('match_invites')
      .insert({
        inviter_id: params.inviterId,
        invitee_id: inviteeId,
        invite_code: code,
        game_mode: params.gameMode,
      })
      .select()
      .single();
    if (!error && data) return { invite: data as MatchInvite };
    if (error && error.code !== '23505') {
      return { invite: null, error: error.message };
    }
  }
  return { invite: null, error: 'Could not generate unique code' };
}

export async function lookupInviteByCode(code: string): Promise<MatchInvite | null> {
  const { data } = await (supabase as any)
    .from('match_invites')
    .select('*')
    .eq('invite_code', code)
    .maybeSingle();
  return (data as MatchInvite) ?? null;
}

export async function lookupInviterUsername(inviterId: string): Promise<string | null> {
  const { data } = await (supabase as any)
    .from('profiles')
    .select('username')
    .eq('id', inviterId)
    .maybeSingle();
  return data?.username ?? null;
}

export async function fetchPendingInvitesForUser(userId: string): Promise<MatchInvite[]> {
  const { data } = await (supabase as any)
    .from('match_invites')
    .select('*')
    .eq('invitee_id', userId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  return (data as MatchInvite[]) ?? [];
}

export async function markInviteAccepted(inviteId: string): Promise<void> {
  await (supabase as any)
    .from('match_invites')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', inviteId);
}

export async function markInviteDeclined(inviteId: string): Promise<void> {
  await (supabase as any)
    .from('match_invites')
    .update({ status: 'declined' })
    .eq('id', inviteId);
}

export async function markInviteCancelled(inviteId: string): Promise<void> {
  await (supabase as any)
    .from('match_invites')
    .update({ status: 'cancelled' })
    .eq('id', inviteId);
}

/**
 * Map a stored game_mode string to the VS page href that accepts an
 * inviteCode query param.
 */
export function vsHrefForMode(gameMode: string): string {
  switch (gameMode) {
    case 'QUORDLE':       return '/quordle/vs';
    case 'OCTORDLE':      return '/octordle/vs';
    case 'SEQUENCE':      return '/sequence/vs';
    case 'RESCUE':        return '/rescue/vs';
    case 'GAUNTLET':      return '/gauntlet/vs';
    case 'PROPERNOUNDLE': return '/propernoundle/vs';
    default:              return '/practice/vs';
  }
}
