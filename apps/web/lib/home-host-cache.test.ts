import { describe, expect, it } from 'vitest';
import { castPreset } from '@wordle-duel/core';
import {
  HOME_HOST_CACHE_KEY, clearHomeHostCache, homeHostChoiceKey, homeHostInviteAllowed, homeHostLookFor, homeHostTransition,
  pickHomeHostLook, readHomeHostCache, storedSessionHint, writeHomeHostCache, type ListableStorage,
} from './home-host-cache';

function memStorage(seed: Record<string, string> = {}): ListableStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed));
  return {
    data,
    get length() { return data.size; },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

const UPLOADED = 'https://x.supabase.co/storage/v1/object/public/avatars/b/avatar.jpg?t=1';
const cfg = { v: 1, body: 'star', color: 'mint', eyes: 'happy', neck: 'scarf' };
const ALICE = { id: 'alice', username: 'Alice', level: 12, avatar_config: { ...cfg, display: 'mascot' } };
const BOB = { id: 'bob', username: 'Bob', level: 3, avatar_cast_id: 'r' };
const PLAIN = { id: 'carl', username: 'Carl' };
const PHOTO = { id: 'dana', username: 'Dana', avatar_url: UPLOADED, avatar_config: { ...cfg, display: 'photo' } };
const session = (uid: string) => JSON.stringify({ access_token: 'a', refresh_token: 'r', user: { id: uid } });
const NO_SESSION = { expected: false, uid: null };

describe('2.7.1 Home host cache: storage', () => {
  it('round-trips the look, keyed by user id', () => {
    const s = memStorage();
    const look = homeHostLookFor(ALICE, true, s);
    writeHomeHostCache('alice', look, s);
    const got = readHomeHostCache(s);
    expect(got?.uid).toBe('alice');
    expect(got && homeHostChoiceKey(got.choice)).toBe(homeHostChoiceKey(look.choice));
    expect(got).toMatchObject({ initial: 'A', level: 12, pro: true, seeded: null });
  });

  it('caches a photo choice with its url (no W, no mascot body)', () => {
    const s = memStorage();
    writeHomeHostCache('dana', homeHostLookFor(PHOTO, false, s), s);
    expect(readHomeHostCache(s)?.choice).toMatchObject({ kind: 'photo', photoUrl: UPLOADED });
  });

  it('a player with no custom look caches W + their plain seeded mascot', () => {
    const s = memStorage();
    const look = homeHostLookFor(PLAIN, false, s);
    expect(look.choice.kind).toBe('w');
    expect(look.seeded?.display).toBe('mascot');
  });

  it('cleared on sign-out', () => {
    const s = memStorage();
    writeHomeHostCache('alice', homeHostLookFor(ALICE, false, s), s);
    clearHomeHostCache(s);
    expect(s.data.has(HOME_HOST_CACHE_KEY)).toBe(false);
    expect(readHomeHostCache(s)).toBeNull();
  });

  it('junk or blocked storage reads as no cache', () => {
    expect(readHomeHostCache(memStorage({ [HOME_HOST_CACHE_KEY]: '{oops' }))).toBeNull();
    expect(readHomeHostCache(memStorage({ [HOME_HOST_CACHE_KEY]: JSON.stringify({ v: 1, uid: 'x', choice: { kind: 'photo' } }) }))).toBeNull();
    expect(readHomeHostCache(null)).toBeNull();
    const throwing = { ...memStorage(), getItem: () => { throw new Error('blocked'); } };
    expect(readHomeHostCache(throwing)).toBeNull();
  });

  it('reads whose session supabase-js kept on disk', () => {
    expect(storedSessionHint(memStorage({ 'sb-abc-auth-token': session('alice') }))).toEqual({ expected: true, uid: 'alice' });
    expect(storedSessionHint(memStorage({ 'sb-abc-auth-token': 'garbage' }))).toEqual({ expected: true, uid: null });
    expect(storedSessionHint(memStorage({ 'wordocious-guest': '1' }))).toEqual(NO_SESSION);
  });
});

describe('2.7.1 Home host cache: what the host shows', () => {
  const s = memStorage();
  const aliceLook = homeHostLookFor(ALICE, false, s);
  const aliceEntry = { v: 1 as const, uid: 'alice', ...aliceLook };

  it('cached look shown while the profile loads (never W)', () => {
    const p = pickHomeHostLook({ live: null, userId: null, loading: true, session: { expected: true, uid: 'alice' }, cache: aliceEntry });
    expect(p.phase).toBe('cached');
    expect(p.look.choice).toEqual(aliceLook.choice);
    // Auth knows the user but the profile row hasn't landed yet: still the cache.
    expect(pickHomeHostLook({ live: null, userId: 'alice', loading: false, session: NO_SESSION, cache: aliceEntry }).phase).toBe('cached');
  });

  it("another user's entry is ignored", () => {
    const p = pickHomeHostLook({ live: null, userId: null, loading: true, session: { expected: true, uid: 'bob' }, cache: aliceEntry });
    expect(p.phase).toBe('unknown');
    expect(pickHomeHostLook({ live: null, userId: 'bob', loading: false, session: NO_SESSION, cache: aliceEntry }).phase).toBe('unknown');
  });

  it('before the id is known, the entry is honored only when a session is expected', () => {
    expect(pickHomeHostLook({ live: null, userId: null, loading: true, session: { expected: true, uid: null }, cache: aliceEntry }).phase).toBe('cached');
    // No session on disk (a guest / signed out): W as today, never someone's cached look.
    const guest = pickHomeHostLook({ live: null, userId: null, loading: true, session: NO_SESSION, cache: aliceEntry });
    expect(guest.phase).toBe('live');
    expect(guest.look.choice).toEqual({ kind: 'w' });
    expect(pickHomeHostLook({ live: null, userId: null, loading: false, session: { expected: true, uid: 'alice' }, cache: aliceEntry }).look.choice).toEqual({ kind: 'w' });
  });

  it('the live look always wins over the cache', () => {
    const bobLook = homeHostLookFor(BOB, false, s);
    const p = pickHomeHostLook({ live: bobLook, userId: 'bob', loading: false, session: NO_SESSION, cache: aliceEntry });
    expect(p.phase).toBe('live');
    expect(p.look.choice).toEqual({ kind: 'mascot', config: { ...castPreset('r'), display: 'mascot' } });
  });

  it('no bubble while unknown or cached; only once live', () => {
    expect(pickHomeHostLook({ live: null, userId: null, loading: true, session: { expected: true, uid: 'carl' }, cache: null }).phase).toBe('unknown');
    expect(homeHostInviteAllowed('unknown')).toBe(false);
    expect(homeHostInviteAllowed('cached')).toBe(false);
    expect(homeHostInviteAllowed('live')).toBe(true);
  });
});

describe('2.7.1 Home host cache: transition', () => {
  const s = memStorage();
  const a = homeHostChoiceKey(homeHostLookFor(ALICE, false, s).choice);
  const b = homeHostChoiceKey(homeHostLookFor(BOB, false, s).choice);

  it('crossfade only on change', () => {
    expect(homeHostTransition(a, a, true)).toBe('none');
    expect(homeHostTransition(a, b, true)).toBe('crossfade');
    expect(homeHostTransition(null, b, true)).toBe('none');
  });

  it('from an invisible (unknown) host the fade-in carries it, no crossfade', () => {
    expect(homeHostTransition('w', a, false)).toBe('none');
  });

  it('a photo and a mascot with the same config are different looks', () => {
    const c = homeHostLookFor(ALICE, false, s).choice;
    if (c.kind !== 'mascot') throw new Error('expected a mascot');
    expect(homeHostChoiceKey({ kind: 'photo', photoUrl: UPLOADED, config: c.config })).not.toBe(homeHostChoiceKey(c));
  });
});
