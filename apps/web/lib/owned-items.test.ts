import { describe, expect, it } from 'vitest';
import { castPreset, enforceAvatarPro, AVATAR_PRO_ONLY, type AvatarConfig } from '@wordle-duel/core';
import { keepOwnedParts } from './avatar-access';
import { grantItems, revokeItems, sanitizeKeys } from './owned-items-server';

const proHead = (AVATAR_PRO_ONLY as unknown as Record<string, readonly string[]>).head[0];
const base = castPreset('w') as AvatarConfig;

describe('owned items save without Pro', () => {
  it('a free player loses a Pro head, unless they own it', () => {
    const picked = { ...base, head: proHead } as AvatarConfig;
    const stripped = enforceAvatarPro(picked, false);
    expect((stripped as unknown as Record<string, unknown>).head).not.toBe(proHead);
    expect((keepOwnedParts(picked, stripped, []) as unknown as Record<string, unknown>).head).not.toBe(proHead);
    expect((keepOwnedParts(picked, stripped, [`head:${proHead}`]) as unknown as Record<string, unknown>).head).toBe(proHead);
  });

  it('owning one part never un-strips another', () => {
    const picked = { ...base, head: proHead, color: 'holo' } as AvatarConfig;
    const stripped = enforceAvatarPro(picked, false);
    const kept = keepOwnedParts(picked, stripped, [`head:${proHead}`]) as unknown as Record<string, unknown>;
    expect(kept.head).toBe(proHead);
    expect(kept.color).toBe((stripped as unknown as Record<string, unknown>).color);
  });
});

describe('admin item keys', () => {
  it('only access-table keys are grantable', () => {
    const { keys, unknown } = sanitizeKeys(['body:classic', 'head:not-a-thing', 'nope', 7, 'body:classic']);
    expect(keys).toEqual(['body:classic']);
    expect(unknown).toEqual(['head:not-a-thing', 'nope']);
  });
});

/** A tiny in-memory stand-in for the two ledger tables. */
function fakeAdmin() {
  const owned: Array<Record<string, unknown>> = [];
  const log: Array<Record<string, unknown>> = [];
  const admin: any = {
    from: (t: string) => {
      if (t === 'owned_items_log') return { insert: async (rows: Array<Record<string, unknown>>) => { log.push(...rows); return { error: null }; } };
      return {
        select: () => ({ eq: () => ({ in: async (_c: string, keys: string[]) => ({ data: owned.filter((r) => keys.includes(r.item_key as string)) }) }) }),
        upsert: async (rows: Array<Record<string, unknown>>) => { for (const r of rows) { const i = owned.findIndex((o) => o.item_key === r.item_key); if (i >= 0) owned[i] = r; else owned.push(r); } return { error: null }; },
        update: (patch: Record<string, unknown>) => ({ eq: () => ({ in: () => ({ is: () => ({ select: async () => {
          const hit = owned.filter((o) => !o.revoked_at); hit.forEach((o) => Object.assign(o, patch));
          return { data: hit.map((o) => ({ item_key: o.item_key, source: o.source })) };
        } }) }) }) }),
      };
    },
  };
  return { admin, owned, log };
}

describe('the ledger', () => {
  it('grants once, logs it, leaves an active purchase alone, and revokes with a log row', async () => {
    const { admin, owned, log } = fakeAdmin();
    owned.push({ user_id: 'u', item_key: 'body:tall', source: 'buy', revoked_at: null });
    const r = await grantItems(admin, 'u', ['body:tall', 'body:wide'], 'admin1');
    expect(r).toEqual({ granted: ['body:wide'], alreadyHad: ['body:tall'] });
    expect(owned.find((o) => o.item_key === 'body:tall')?.source).toBe('buy');
    expect(owned.find((o) => o.item_key === 'body:wide')).toMatchObject({ source: 'grant', granted_by: 'admin1' });
    expect(log).toEqual([{ user_id: 'u', item_key: 'body:wide', action: 'grant', source: 'grant', actor: 'admin1' }]);
    const gone = await revokeItems(admin, 'u', ['body:wide'], 'admin1');
    expect(gone.length).toBeGreaterThan(0);
    expect(log.some((l) => l.action === 'revoke')).toBe(true);
  });
});
