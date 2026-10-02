import { afterEach, describe, expect, it } from 'vitest';
import {
  AVATAR_COLUMNS, MAX_AVATAR_IDS, NO_AVATAR_FIELDS, RECHECK_MS,
  __resetAvatarColumnsMemoForTests, avatarColumnsAssumedMissing, avatarFieldsOf,
  fetchAvatarFields, mergeAvatarFields, selectWithAvatarColumns, withOwnAvatarFields,
} from './avatar-fields-server';

type Row = Record<string, unknown>;

/**
 * A fake profiles table that behaves like PostgREST: a select naming a column
 * the table lacks fails with 42703 (no rows), otherwise returns the picked
 * columns of the rows whose id is in the list.
 */
function fakeClient(rows: Row[], columns: string[]) {
  const calls: Array<{ columns: string; ids: string[] }> = [];
  const client = {
    calls,
    from(table: 'profiles') {
      expect(table).toBe('profiles');
      return {
        select(cols: string) {
          return {
            in(_col: 'id', ids: string[]) {
              calls.push({ columns: cols, ids });
              const wanted = cols.split(',').map((c) => c.trim());
              const unknown = wanted.find((c) => !columns.includes(c));
              if (unknown) {
                return Promise.resolve({ data: null, error: { code: '42703', message: `column profiles.${unknown} does not exist` } });
              }
              const data = rows
                .filter((r) => ids.includes(r.id as string))
                .map((r) => Object.fromEntries(wanted.map((c) => [c, r[c] ?? null])));
              return Promise.resolve({ data, error: null });
            },
          };
        },
      };
    },
  };
  return client;
}

const FUTURE = new Date(Date.now() + 86_400_000).toISOString();
const PAST = new Date(Date.now() - 86_400_000).toISOString();
const TODAY_COLUMNS = ['id', 'username', 'is_pro', 'pro_expires_at'];
const MIGRATED_COLUMNS = [...TODAY_COLUMNS, 'avatar_cast_id', 'avatar_frame', 'avatar_config'];
const ROWS: Row[] = [
  { id: 'a', username: 'Ann', is_pro: true, pro_expires_at: FUTURE, avatar_cast_id: 'w', avatar_frame: 'gold', avatar_config: { v: 1, body: 'bean' } },
  { id: 'b', username: 'Ben', is_pro: true, pro_expires_at: PAST, avatar_cast_id: null, avatar_frame: null, avatar_config: null },
  { id: 'c', username: 'Cy', is_pro: true, pro_expires_at: null },
  { id: 'd', username: 'Dee', is_pro: false, pro_expires_at: null, avatar_config: ['not', 'an', 'object'] },
];

afterEach(() => __resetAvatarColumnsMemoForTests());

describe('avatarFieldsOf', () => {
  it('reads the columns null-safe and is_pro as ACTIVE Pro', () => {
    expect(avatarFieldsOf(ROWS[0])).toEqual({ avatar_cast_id: 'w', avatar_frame: 'gold', avatar_config: { v: 1, body: 'bean' }, is_pro: true });
    expect(avatarFieldsOf(ROWS[1]).is_pro).toBe(false); // expired
    expect(avatarFieldsOf(ROWS[2])).toEqual({ ...NO_AVATAR_FIELDS, is_pro: true }); // legacy grant, columns missing
    expect(avatarFieldsOf(ROWS[3]).avatar_config).toBeNull(); // arrays are not configs
    expect(avatarFieldsOf(null)).toEqual(NO_AVATAR_FIELDS);
  });

  it('withOwnAvatarFields keeps every other field and drops pro_expires_at', () => {
    const out = withOwnAvatarFields({ id: 'b', username: 'Ben', level: 3, is_pro: true, pro_expires_at: PAST });
    expect(out).toEqual({ id: 'b', username: 'Ben', level: 3, ...NO_AVATAR_FIELDS });
    expect('pro_expires_at' in out).toBe(false);
  });
});

describe('fetchAvatarFields / mergeAvatarFields', () => {
  it('after the migration: one query, every field', async () => {
    const client = fakeClient(ROWS, MIGRATED_COLUMNS);
    const map = await fetchAvatarFields(client, ['a', 'b', 'a', null, undefined]);
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].ids).toEqual(['a', 'b']);
    expect(client.calls[0].columns).toContain(AVATAR_COLUMNS);
    expect(map.get('a')).toEqual({ avatar_cast_id: 'w', avatar_frame: 'gold', avatar_config: { v: 1, body: 'bean' }, is_pro: true });
    expect(map.get('b')).toEqual(NO_AVATAR_FIELDS);
  });

  it('before the migration: retries without the avatar columns, then remembers', async () => {
    const client = fakeClient(ROWS, TODAY_COLUMNS);
    const map = await fetchAvatarFields(client, ['a', 'c']);
    expect(client.calls).toHaveLength(2);
    expect(client.calls[1].columns).not.toContain('avatar_');
    expect(map.get('a')).toEqual({ ...NO_AVATAR_FIELDS, is_pro: true });
    expect(map.get('c')).toEqual({ ...NO_AVATAR_FIELDS, is_pro: true });
    expect(avatarColumnsAssumedMissing()).toBe(true);
    // Next response: one query, no avatar columns.
    await fetchAvatarFields(client, ['b']);
    expect(client.calls).toHaveLength(3);
    expect(client.calls[2].columns).not.toContain('avatar_');
  });

  it('probes again after RECHECK_MS and picks the columns up once they exist', async () => {
    const t0 = 1_000_000;
    const before = fakeClient(ROWS, TODAY_COLUMNS);
    await selectWithAvatarColumns((extra) => before.from('profiles').select(`id${extra}`).in('id', ['a']), t0);
    expect(avatarColumnsAssumedMissing(t0 + 1)).toBe(true);
    expect(avatarColumnsAssumedMissing(t0 + RECHECK_MS + 1)).toBe(false);
    const after = fakeClient(ROWS, MIGRATED_COLUMNS);
    const res = await selectWithAvatarColumns((extra) => after.from('profiles').select(`id${extra}`).in('id', ['a']), t0 + RECHECK_MS + 1);
    expect(res.error).toBeNull();
    expect((res.data as Row[])[0].avatar_cast_id).toBe('w');
    expect(avatarColumnsAssumedMissing(t0 + RECHECK_MS + 2)).toBe(false);
  });

  it('works inside an embed column list too', async () => {
    const seen: string[] = [];
    const res = await selectWithAvatarColumns(async (extra) => {
      const sel = `user_id, profiles!inner(username${extra})`;
      seen.push(sel);
      return sel.includes('avatar_') ? { data: null, error: { code: '42703', message: 'column profiles_1.avatar_frame does not exist' } } : { data: [{ ok: 1 }], error: null };
    });
    expect(res.error).toBeNull();
    expect(seen).toEqual([
      'user_id, profiles!inner(username, is_pro, pro_expires_at, avatar_cast_id, avatar_frame, avatar_config)',
      'user_id, profiles!inner(username, is_pro, pro_expires_at)',
    ]);
  });

  it('a real failure is reported, not hidden, and never throws from the lookup', async () => {
    const res = await selectWithAvatarColumns(async () => ({ data: null, error: { code: '57014', message: 'canceling statement' } }));
    expect((res.error as { code: string }).code).toBe('57014');
    const throwing = { from: () => { throw new Error('network'); } };
    await expect(fetchAvatarFields(throwing, ['a'])).resolves.toEqual(new Map());
  });

  it('merges onto rows additively and caps the ids', async () => {
    const client = fakeClient(ROWS, MIGRATED_COLUMNS);
    const merged = await mergeAvatarFields(client, [{ user_id: 'a', score: 9 }, { user_id: 'zz', score: 1 }], (r) => r.user_id);
    expect(merged[0]).toEqual({ user_id: 'a', score: 9, avatar_cast_id: 'w', avatar_frame: 'gold', avatar_config: { v: 1, body: 'bean' }, is_pro: true });
    expect(merged[1]).toEqual({ user_id: 'zz', score: 1, ...NO_AVATAR_FIELDS });

    const many = Array.from({ length: MAX_AVATAR_IDS + 50 }, (_, i) => `id${i}`);
    const big = fakeClient([], MIGRATED_COLUMNS);
    await fetchAvatarFields(big, many);
    expect(big.calls.flatMap((c) => c.ids)).toHaveLength(MAX_AVATAR_IDS);
    expect(big.calls.every((c) => c.ids.length <= 100)).toBe(true);
  });
});
