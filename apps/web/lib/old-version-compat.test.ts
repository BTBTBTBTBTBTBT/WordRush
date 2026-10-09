import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { cleanInviteCode, isVsCode, parseInvitePath } from '@wordle-duel/core';

// Item 39: 2.7.1 and 2.8 players together. The pure decoding rules (invite links, avatars, reactions, age storage,
// moves) are in packages/core/src/compat-2-7-1.test.ts against the same fixture the native suites read. This file
// covers the web half: the server routes accept what BOTH versions send, the links 2.7.1 apps already handle keep
// working, and a rich push stays readable by a build that predates it.

const verifyUser = vi.fn();
const getAdminSupabase = vi.fn();

vi.mock('@/lib/api-auth', () => ({ verifyUser: (...a: unknown[]) => verifyUser(...a) }));
vi.mock('@/lib/supabase-admin', () => ({ getAdminSupabase: () => getAdminSupabase() }));

import { POST as postAge } from '@/app/api/account/age/route';
import { POST as postGame } from '@/app/api/friends/games/route';
import { POST as postMove } from '@/app/api/friends/games/[id]/move/route';
import { acceptHrefFor, shareUrlFor } from '@/lib/invite-links';
import { buildPayload } from '@/lib/push/apns';
import { fcmMessageBody } from '@/lib/push/fcm';
import { buildRichFields } from '@/lib/push/rich';
import fixtures from '../../../packages/core/src/compat-fixtures.json';

const ME = '11111111-1111-4111-8111-111111111111';
const FRIEND = '22222222-2222-4222-8222-222222222222';
const GAME = '33333333-3333-4333-8333-333333333333';

const json = (url: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

/** A supabase-js style chain that records every update and resolves like a query. */
function fakeAdmin(opts: { row?: unknown } = {}) {
  const updates: Array<{ table: string; values: Record<string, unknown>; eqs: Array<[string, unknown]> }> = [];
  const admin = {
    from(table: string) {
      const chain: any = {
        select: () => chain,
        eq: (c: string, v: unknown) => { cur?.eqs.push([c, v]); return chain; },
        maybeSingle: async () => ({ data: opts.row ?? null }),
        then: (res: (v: unknown) => unknown) => res({ error: null, data: [] }),
      };
      let cur: (typeof updates)[number] | null = null;
      chain.update = (values: Record<string, unknown>) => { cur = { table, values, eqs: [] }; updates.push(cur); return chain; };
      return chain;
    },
  };
  return { admin, updates };
}

beforeEach(() => {
  verifyUser.mockReset();
  getAdminSupabase.mockReset();
});

describe('age route: a 2.7.1 account has no flag and is asked on its first 2.8 launch', () => {
  it('refuses the unsigned', async () => {
    verifyUser.mockResolvedValue(null);
    expect((await postAge(json('/api/account/age', { year: 1990 }))).status).toBe(401);
  });

  it('an empty body, a string year or a future year is a 400 and never touches the database', async () => {
    verifyUser.mockResolvedValue({ id: ME });
    getAdminSupabase.mockImplementation(() => { throw new Error('no database call for a bad body'); });
    for (const body of [{}, { year: '1990' }, { year: 1990.5 }, { year: 3000 }, { year: null }]) {
      expect((await postAge(json('/api/account/age', body))).status, JSON.stringify(body)).toBe(400);
    }
    const bad = new NextRequest('http://localhost/api/account/age', { method: 'POST', body: 'not json' });
    expect((await postAge(bad)).status).toBe(400);
  });

  it('a pass sets the flag only on an account that has not already passed or failed in the other direction', async () => {
    verifyUser.mockResolvedValue({ id: ME });
    const { admin, updates } = fakeAdmin();
    getAdminSupabase.mockReturnValue(admin);
    const res = await postAge(json('/api/account/age', { year: 1990 }));
    expect(await res.json()).toEqual({ ok: true });
    expect(updates[0].values).toMatchObject({ age_confirmed_13: true, age_under13_at: null });
    expect(updates[0].eqs).toContainEqual(['id', ME]);
    expect(updates[0].eqs).toContainEqual(['age_confirmed_13', false]);
  });

  it('an under answer never demotes an account that already passed', async () => {
    verifyUser.mockResolvedValue({ id: ME });
    const { admin, updates } = fakeAdmin();
    getAdminSupabase.mockReturnValue(admin);
    const year = new Date().getFullYear() - 5;
    const res = await postAge(json('/api/account/age', { year }));
    expect(await res.json()).toEqual({ ok: false, under: true });
    expect(updates[0].values).toHaveProperty('age_under13_at');
    expect(updates[0].eqs).toContainEqual(['age_confirmed_13', false]);
  });
});

describe('pocket games: the same routes serve both versions', () => {
  it('starting a game of a kind this server does not run is a 400, not a crash', async () => {
    verifyUser.mockResolvedValue({ id: ME });
    getAdminSupabase.mockImplementation(() => { throw new Error('no database call for a bad kind'); });
    for (const body of [{ kind: 'chess-2-9', friendId: FRIEND }, { friendId: FRIEND }, { kind: 'rps' }, { kind: 'rps', friendId: ME }]) {
      expect((await postGame(json('/api/friends/games', body))).status, JSON.stringify(body)).toBe(400);
    }
  });

  const rpsRow = {
    id: GAME, kind: 'rps', player_a: ME, player_b: FRIEND, status: 'active', winner: null, secret: null,
    state: { kind: 'rps', picks: {}, rounds: [], score: { a: 0, b: 0 } },
    a_seen_at: null, b_seen_at: null, created_at: '2026-10-09T12:00:00.000Z', updated_at: '2026-10-09T12:00:00.000Z',
  };

  it('a move for another game kind, or without a kind, is a 400 and leaves the game alone', async () => {
    verifyUser.mockResolvedValue({ id: ME });
    const { admin, updates } = fakeAdmin({ row: rpsRow });
    getAdminSupabase.mockReturnValue(admin);
    for (const move of [{ kind: 'chess-2-9', pick: 'e4' }, {}, { kind: 'ttt', cell: 3 }]) {
      const res = await postMove(json(`/api/friends/games/${GAME}/move`, { move }), { params: { id: GAME } });
      expect(res.status, JSON.stringify(move)).toBe(400);
    }
    expect(updates).toEqual([]);
    const noMove = await postMove(json(`/api/friends/games/${GAME}/move`, {}), { params: { id: GAME } });
    expect(noMove.status).toBe(400);
  });
});

describe('invite links: the links 2.7.1 apps already open keep working', () => {
  it('the legacy accept targets are unchanged', () => {
    expect(acceptHrefFor({ variant: 'live', code: 'ANT5TTZR' })).toBe('/vs/join/ANT5TTZR');
    expect(acceptHrefFor({ variant: 'race', code: 'ANT5TTZR' })).toBe('/vs/challenge/ANT5TTZR');
    expect(acceptHrefFor({ variant: 'friend', code: 'ABC234' })).toBe('/join/ABC234');
  });

  it('with branded_invites off the shared link is the 2.7.1 link; on, the one-link form', () => {
    expect(shareUrlFor(false, 'live', 'ANT5TTZR')).toBe('https://wordocious.com/vs/join/ANT5TTZR');
    expect(shareUrlFor(false, 'race', 'ANT5TTZR')).toBe('https://wordocious.com/vs/challenge/ANT5TTZR');
    expect(shareUrlFor(true, 'live', 'ANT5TTZR')).toBe('https://wordocious.com/vs/ANT5TTZR');
    expect(shareUrlFor(true, 'race', 'ANT5TTZR')).toBe('https://wordocious.com/vs/ANT5TTZR');
  });

  it('every link either version shares reads back as the same invite', () => {
    for (const code of ['ANT5TTZR', 'K7M2PQ9X']) {
      for (const branded of [true, false]) for (const v of ['live', 'race'] as const) {
        expect(parseInvitePath(shareUrlFor(branded, v, code)), `${branded} ${v}`).toEqual({ kind: 'vs', code });
      }
      expect(isVsCode(cleanInviteCode(code.toLowerCase()))).toBe(true);
    }
  });

  const aasa = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', '.well-known', 'apple-app-site-association'), 'utf8'));
  const patterns: string[] = aasa.applinks.details[0].components.map((c: { '/': string }) => c['/']);
  const manifest = fs.readFileSync(path.join(__dirname, '..', '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');

  it('iOS universal links still claim the 2.7.1 paths (a 2.7.1 app was installed expecting them)', () => {
    for (const p of ['/vs/join/*', '/vs/challenge/*', '/auth/reset*', '/auth/confirm*']) expect(patterns).toContain(p);
    expect(patterns).toContain('/vs/????????');
  });

  it('Android app links still claim the 2.7.1 paths', () => {
    for (const p of ['/vs/join/', '/vs/challenge/', '/join/', '/auth/reset', '/auth/confirm']) {
      expect(manifest, p).toContain(`android:pathPrefix="${p}"`);
    }
  });
});

describe('rich push: an older build still gets the plain alert it always did', () => {
  const rich = buildRichFields({
    senderId: 'u1', senderName: 'Ava', gameId: 'pocket-rps', gameTitle: 'Rock Paper Scissors', gameRowId: 'g1',
    kind: 'move', url: '/friends/games/g1', score: '1-0', accentHex: '#16a34a',
  }, false);

  it('carries every key the native readers need, as strings', () => {
    for (const k of (fixtures as any).push.required as string[]) {
      expect(typeof (rich.fields as any)[k], k).toBe('string');
    }
    expect(rich.fields.senderAvatar.startsWith('https://')).toBe(true);
    expect(rich.fields.gameImage.startsWith('https://')).toBe(true);
    expect(['0', '1']).toContain(rich.fields.halloween);
  });

  it('APNs: removing the 2.8-only keys leaves exactly the 2.7.1 payload', () => {
    const base = { token: 't', title: 'Ava played Rock Paper Scissors', body: 'Your turn', url: '/friends/games/g1' };
    const plain = JSON.parse(buildPayload(base));
    const withRich = JSON.parse(buildPayload({ ...base, rich: rich.fields, collapseId: rich.collapseId }));
    const stripped = { ...withRich, aps: { ...withRich.aps } };
    delete stripped.rich;
    for (const k of ['mutable-content', 'thread-id', 'category', 'interruption-level']) delete stripped.aps[k];
    expect(stripped).toEqual(plain);
    expect(plain.aps.alert).toEqual({ title: base.title, body: base.body });
  });

  it('FCM: a build without the rich handler gets the system-drawn notification and the tap url', () => {
    const body = fcmMessageBody({ token: 't', title: 'Ava played Rock Paper Scissors', body: 'Your turn', url: '/friends/games/g1', rich: rich.fields, richCapable: false });
    expect(body.notification).toMatchObject({ title: 'Ava played Rock Paper Scissors', body: 'Your turn' });
    expect(body.data).toEqual({ url: '/friends/games/g1' });
  });

  it('FCM: the data-only message is only ever sent to a build that said it draws it', () => {
    const body = fcmMessageBody({ token: 't', title: 'Ava', body: 'Your turn', rich: rich.fields, richCapable: true });
    expect(body.notification).toBeUndefined();
    expect(body.data?.rich).toBe('1');
  });

  it('an unknown tap url (a route this build lacks) is still just a string the app may ignore', () => {
    const p = JSON.parse(buildPayload({ token: 't', title: 'a', body: 'b', url: '/something/new-in-2-9' }));
    expect(p.url).toBe('/something/new-in-2-9');
  });
});
