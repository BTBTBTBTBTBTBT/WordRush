import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from './supabase-admin';
import { verifyUser } from './api-auth';

/**
 * PRIVATE PROFILES — the server-side gate for the public-profile API routes.
 *
 * When profiles.is_private is true, everything that reveals a player's words
 * or strategy is withheld from other players; the routes under
 * /api/profile/[id]/* call this before releasing anything. Callers prove who
 * they are with the same `Authorization: Bearer <access_token>` header the
 * board route already uses — the header is OPTIONAL (anonymous viewers of a
 * public profile still get data), it only matters when the target is private.
 *
 * The gate opens for: public targets, the owner, admins (is_admin), and —
 * since FRIENDS v1 (§207) — accepted friends of the target, which is what
 * makes "private" mean "friends only". Everyone else gets
 * `privateProfileResponse()`:
 *   403 { "error": "This profile is private", "private": true }
 * The client renders the teaser card from the world-readable profiles row —
 * this response carries no profile data on purpose.
 *
 * `cache` tells the route what Cache-Control its SUCCESS response may use:
 * a private profile's full data was released to a specific caller (owner or
 * admin), so it must never land in a shared cache.
 */
export type PrivacyGate =
  | { status: 'open'; cache: 'public' | 'private' }
  | { status: 'private' };

export async function gateProfilePrivacy(
  req: NextRequest,
  targetId: string,
): Promise<PrivacyGate> {
  const admin = getAdminSupabase();
  const { data: target } = await admin
    .from('profiles')
    .select('is_private')
    .eq('id', targetId)
    .maybeSingle();

  // Unknown profile → open, preserving each route's existing empty/404
  // behavior (there is nothing to protect).
  if (!target || !target.is_private) return { status: 'open', cache: 'public' };

  const caller = await verifyUser(req);
  if (caller) {
    if (caller.id === targetId) return { status: 'open', cache: 'private' };
    const { data: me } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', caller.id)
      .maybeSingle();
    if (me?.is_admin) return { status: 'open', cache: 'private' };
    // Accepted friends see the full profile — data released to a specific
    // caller, so success responses must not land in a shared cache.
    const { data: friendRow } = await admin
      .from('friendships')
      .select('status')
      .eq('status', 'accepted')
      .or(
        `and(requester_id.eq.${caller.id},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${caller.id})`,
      )
      .maybeSingle();
    if (friendRow) return { status: 'open', cache: 'private' };
  }

  return { status: 'private' };
}

/** The typed 403 the client turns into the private-profile teaser card. */
export function privateProfileResponse(): NextResponse {
  return NextResponse.json(
    { error: 'This profile is private', private: true },
    { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
  );
}

/**
 * Cache-Control for a route's success response, per the gate's verdict.
 * `publicHeader` is the route's normal shared-cache policy; it is replaced
 * with `private, no-store` when the data was released owner/admin-only.
 */
export function privacyCacheHeader(
  gate: { cache: 'public' | 'private' },
  publicHeader: string,
): string {
  return gate.cache === 'public' ? publicHeader : 'private, no-store';
}
