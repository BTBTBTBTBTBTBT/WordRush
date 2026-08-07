import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * PRIVATE PROFILES — server gate tests.
 *
 * Covers the contract the native ports will mirror (docs/private-profiles-spec.md):
 *   private target + anonymous/other caller → 403 { error, private: true }
 *   private target + owner (Bearer)          → full data, private cache
 *   private target + admin (Bearer)          → full data, private cache
 *   public target                            → full data, shared cache
 */

// Test-controlled world: profiles rows, the verified caller, matches rows.
const state = {
  profiles: new Map<string, { is_private?: boolean; is_admin?: boolean }>(),
  user: null as { id: string } | null,
  matches: [] as Array<Record<string, unknown>>,
  // FRIENDS (§207): when true, the caller↔target pair has an accepted
  // friendship row — the gate opens ("private" means "friends only").
  friendsPair: false,
};

vi.mock('@/lib/api-auth', () => ({
  verifyUser: vi.fn(async () => state.user),
}));

vi.mock('@/lib/supabase-admin', () => ({
  getAdminSupabase: () => ({ from: (table: string) => makeQuery(table) }),
}));

// Minimal chainable PostgREST stand-in: enough for the gate's
// profiles.maybeSingle() reads and the matches route's awaited list query.
function makeQuery(table: string) {
  const filters: Record<string, unknown> = {};
  const q: any = {
    select: () => q,
    eq: (col: string, val: unknown) => { filters[col] = val; return q; },
    or: () => q,
    order: () => q,
    limit: () => q,
    not: () => q,
    is: () => q,
    filter: () => q,
    maybeSingle: async () => ({
      data:
        table === 'profiles'
          ? state.profiles.get(filters.id as string) ?? null
          : table === 'friendships'
            ? (state.friendsPair ? { status: 'accepted' } : null)
            : null,
      error: null,
    }),
    then: (resolve: any, reject: any) =>
      Promise.resolve({ data: table === 'matches' ? state.matches : [], error: null }).then(resolve, reject),
  };
  return q;
}

import { NextRequest } from 'next/server';
import { gateProfilePrivacy, privateProfileResponse, privacyCacheHeader } from './profile-privacy';
import { GET as getMatches } from '@/app/api/profile/[id]/matches/route';

const TARGET = '11111111-1111-4111-8111-111111111111';
const VIEWER = '22222222-2222-4222-8222-222222222222';
const req = () => new NextRequest(`http://localhost/api/profile/${TARGET}/matches`);

beforeEach(() => {
  state.profiles.clear();
  state.user = null;
  state.matches = [{ id: 'm1', game_mode: 'DUEL' }];
  state.friendsPair = false;
});

describe('gateProfilePrivacy', () => {
  it('opens with shared cache for a public target', async () => {
    state.profiles.set(TARGET, { is_private: false });
    expect(await gateProfilePrivacy(req(), TARGET)).toEqual({ status: 'open', cache: 'public' });
  });

  it('opens for an unknown profile (routes keep their empty/404 behavior)', async () => {
    expect(await gateProfilePrivacy(req(), TARGET)).toEqual({ status: 'open', cache: 'public' });
  });

  it('gates a private target for anonymous callers', async () => {
    state.profiles.set(TARGET, { is_private: true });
    expect(await gateProfilePrivacy(req(), TARGET)).toEqual({ status: 'private' });
  });

  it('gates a private target for a signed-in non-owner non-admin', async () => {
    state.profiles.set(TARGET, { is_private: true });
    state.profiles.set(VIEWER, { is_admin: false });
    state.user = { id: VIEWER };
    expect(await gateProfilePrivacy(req(), TARGET)).toEqual({ status: 'private' });
  });

  it('opens for the owner, with private cache', async () => {
    state.profiles.set(TARGET, { is_private: true });
    state.user = { id: TARGET };
    expect(await gateProfilePrivacy(req(), TARGET)).toEqual({ status: 'open', cache: 'private' });
  });

  it('opens for an admin, with private cache', async () => {
    state.profiles.set(TARGET, { is_private: true });
    state.profiles.set(VIEWER, { is_admin: true });
    state.user = { id: VIEWER };
    expect(await gateProfilePrivacy(req(), TARGET)).toEqual({ status: 'open', cache: 'private' });
  });

  it('opens for an accepted friend, with private cache (§207: private = friends only)', async () => {
    state.profiles.set(TARGET, { is_private: true });
    state.profiles.set(VIEWER, { is_admin: false });
    state.user = { id: VIEWER };
    state.friendsPair = true;
    expect(await gateProfilePrivacy(req(), TARGET)).toEqual({ status: 'open', cache: 'private' });
  });
});

describe('privateProfileResponse', () => {
  it('is the typed 403 the clients render as the teaser card', async () => {
    const res = privateProfileResponse();
    expect(res.status).toBe(403);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ error: 'This profile is private', private: true });
  });
});

describe('privacyCacheHeader', () => {
  it('keeps the route’s shared-cache policy for public data', () => {
    expect(privacyCacheHeader({ cache: 'public' }, 'public, s-maxage=30')).toBe('public, s-maxage=30');
  });
  it('never lets owner/admin-only data into a shared cache', () => {
    expect(privacyCacheHeader({ cache: 'private' }, 'public, s-maxage=30')).toBe('private, no-store');
  });
});

describe('GET /api/profile/[id]/matches (privacy gating end to end)', () => {
  it('returns 403 { private: true } for a private target', async () => {
    state.profiles.set(TARGET, { is_private: true });
    const res = await getMatches(req(), { params: { id: TARGET } });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'This profile is private', private: true });
  });

  it('returns the full list to the owner, uncached', async () => {
    state.profiles.set(TARGET, { is_private: true });
    state.user = { id: TARGET };
    const res = await getMatches(req(), { params: { id: TARGET } });
    expect(res.status).toBe(200);
    expect((await res.json()).matches).toHaveLength(1);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('returns the full list publicly cached for a public target', async () => {
    state.profiles.set(TARGET, { is_private: false });
    const res = await getMatches(req(), { params: { id: TARGET } });
    expect(res.status).toBe(200);
    expect((await res.json()).matches).toHaveLength(1);
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=30, stale-while-revalidate=120');
  });
});
