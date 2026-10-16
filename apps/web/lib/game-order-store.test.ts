import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { DEFAULT_DAILIES_ORDER, DEFAULT_PUZZLES_ORDER, type GameOrderPrefs } from '@wordle-duel/core';

// Founder 10-15 ("they start in the default order and then clip"): the first paint must already be the stored
// session's player's order, BEFORE auth resolves. The hook is rendered once on the server renderer (no effects,
// no DOM) with a fake localStorage and a stubbed auth that is still loading.

const auth = { user: null as { id: string } | null, profile: null as unknown, loading: true };
const cached = { id: null as string | null };
const flags = { live: true };

vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/use-flags', () => ({ useFlags: () => ({ isLive: () => flags.live }) }));
vi.mock('@/lib/supabase-client', () => ({ supabase: { from: () => ({ update: () => ({ eq: () => Promise.resolve() }) }) } }));
vi.mock('./page-cache', () => ({ cacheUser: () => cached.id }));

const store = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
  clear: () => store.clear(),
};

// Classic (the pinned first daily) stays first; the rest reversed.
const CUSTOM: GameOrderPrefs = { dailies: [DEFAULT_DAILIES_ORDER[0], ...DEFAULT_DAILIES_ORDER.slice(1).reverse()], puzzles: [] };

async function firstPaint(): Promise<{ order: GameOrderPrefs | null; canEdit: boolean; dailies: string[] }> {
  const mod = await import('./game-order-store');
  let seen: { order: GameOrderPrefs | null; canEdit: boolean; dailies: string[] } | null = null;
  function Probe() {
    const api = mod.useGameOrder();
    seen = { order: api.order, canEdit: api.canEdit, dailies: mod.resolvedOrder('dailies', api.order) };
    return null;
  }
  renderToString(createElement(Probe));
  return seen!;
}

describe('game order store: first paint before auth resolves (founder 10-15)', () => {
  beforeEach(() => {
    store.clear();
    (globalThis as { window?: unknown }).window = globalThis;
    (globalThis as { localStorage?: unknown }).localStorage = fakeStorage;
    auth.user = null; auth.profile = null; auth.loading = true;
    cached.id = null; flags.live = true;
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('while auth is loading, the cached session user\'s mirrored order paints first (not the default, not the guest\'s)', async () => {
    const { writeLocalOrder, gameOrderKey } = await import('./game-order-store');
    writeLocalOrder('user-1', CUSTOM);
    writeLocalOrder(null, { dailies: [DEFAULT_DAILIES_ORDER[0], DEFAULT_DAILIES_ORDER[2], DEFAULT_DAILIES_ORDER[1]], puzzles: [] });
    expect(store.has(gameOrderKey('user-1'))).toBe(true);
    cached.id = 'user-1';
    const paint = await firstPaint();
    expect(paint.order).toEqual(CUSTOM);
    expect(paint.dailies).toEqual(CUSTOM.dailies);
    expect(paint.dailies).not.toEqual([...DEFAULT_DAILIES_ORDER]);
  });

  it('once auth resolves to the same user the order is unchanged (no flip after the first paint)', async () => {
    const { writeLocalOrder } = await import('./game-order-store');
    writeLocalOrder('user-1', CUSTOM);
    cached.id = 'user-1';
    const before = await firstPaint();
    auth.user = { id: 'user-1' }; auth.loading = false; auth.profile = { game_order: CUSTOM };
    const after = await firstPaint();
    expect(after.order).toEqual(before.order);
    expect(after.dailies).toEqual(before.dailies);
  });

  it('no cached session: the guest order paints, and with nothing stored the default does', async () => {
    const { writeLocalOrder } = await import('./game-order-store');
    expect((await firstPaint()).dailies).toEqual([...DEFAULT_DAILIES_ORDER]);
    writeLocalOrder(null, CUSTOM);
    expect((await firstPaint()).order).toEqual(CUSTOM);
    // a cached user with no mirror yet falls back to the profile (none while loading) = default order
    store.clear();
    cached.id = 'user-9';
    const paint = await firstPaint();
    expect(paint.order).toBeNull();
    expect(paint.dailies).toEqual([...DEFAULT_DAILIES_ORDER]);
  });

  it('the custom_game_order off-switch forces the default order even with a stored custom one', async () => {
    const { writeLocalOrder } = await import('./game-order-store');
    writeLocalOrder('user-1', CUSTOM);
    cached.id = 'user-1';
    flags.live = false;
    const paint = await firstPaint();
    expect(paint.order).toBeNull();
    expect(paint.canEdit).toBe(false);
    expect(paint.dailies).toEqual([...DEFAULT_DAILIES_ORDER]);
  });

  it('readLocalOrder / writeLocalOrder round-trip per user and ignore junk', async () => {
    const { readLocalOrder, writeLocalOrder, gameOrderKey, resolvedOrder } = await import('./game-order-store');
    expect(gameOrderKey(null)).toBe('wordocious-game-order:guest');
    expect(gameOrderKey('u')).toBe('wordocious-game-order:u');
    writeLocalOrder('u', CUSTOM);
    expect(readLocalOrder('u')).toEqual(CUSTOM);
    expect(readLocalOrder('v')).toBeNull();
    store.set(gameOrderKey('v'), '{not json');
    expect(readLocalOrder('v')).toBeNull();
    writeLocalOrder('u', null);
    expect(readLocalOrder('u')).toBeNull();
    expect(resolvedOrder('puzzles', null)).toEqual([...DEFAULT_PUZZLES_ORDER]);
  });
});
