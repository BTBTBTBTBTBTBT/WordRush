import { beforeEach, describe, expect, it } from 'vitest';
import { __resetAvatarColumnsMemoForTests } from './avatar-fields-server';
import { createAvatarDirectory, isProfileId, type AvatarLookupClient } from './avatar-lookup';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const PROFILES = [
  { id: A, username: 'Ukrainian Cyclone', avatar_url: 'https://lh3.googleusercontent.com/a/x', accent_color: '#f97316', level: 12, is_pro: false, pro_expires_at: null, avatar_cast_id: null, avatar_frame: null, avatar_config: null },
  { id: B, username: 'BMT', avatar_url: 'https://x.supabase.co/storage/v1/object/public/avatars/b/a.jpg', accent_color: null, level: 40, is_pro: true, pro_expires_at: null, avatar_cast_id: null, avatar_frame: 'gold', avatar_config: { v: 1, body: 'star', display: 'photo' } },
];

function fakeClient() {
  const calls: Array<{ columns: string; by: string; values: string[] }> = [];
  const client: AvatarLookupClient = {
    from: () => ({
      select: (columns: string) => ({
        in: (by: 'id' | 'username', values: string[]) => {
          calls.push({ columns, by, values });
          const data = PROFILES.filter((p) => values.includes(by === 'id' ? p.id : p.username));
          return Promise.resolve({ data, error: null });
        },
      }),
    }),
  };
  return { client, calls };
}

describe('avatar directory (BJ5 safety net)', () => {
  beforeEach(() => __resetAvatarColumnsMemoForTests());

  it('batches every queued id into one profiles read and caches the answer', async () => {
    const { client, calls } = fakeClient();
    const dir = createAvatarDirectory(() => client, () => {});
    dir.request('id', A);
    dir.request('id', B);
    dir.request('id', A);
    expect(dir.get('id', A)).toBeUndefined();
    await dir.flush();
    expect(calls).toHaveLength(1);
    expect(calls[0].by).toBe('id');
    expect(calls[0].values.sort()).toEqual([A, B]);
    expect(calls[0].columns).toContain('avatar_config');
    expect(calls[0].columns).toContain('accent_color');
    expect(dir.get('id', B)).toMatchObject({ username: 'BMT', avatar_frame: 'gold', is_pro: true, level: 40 });
    // The same row answers by username too.
    expect(dir.get('username', 'bmt')?.id).toBe(B);
    // Cached: asking again reads nothing.
    dir.request('id', A);
    await dir.flush();
    expect(calls).toHaveLength(1);
  });

  it('looks up name-only rows by username; unknown players cache as null', async () => {
    const { client, calls } = fakeClient();
    const dir = createAvatarDirectory(() => client, () => {});
    dir.request('username', 'Ukrainian Cyclone');
    dir.request('username', 'Nobody');
    await dir.flush();
    expect(calls[0]).toMatchObject({ by: 'username' });
    expect(dir.get('username', 'ukrainian cyclone')?.accent_color).toBe('#f97316');
    expect(dir.get('id', A)?.username).toBe('Ukrainian Cyclone');
    expect(dir.get('username', 'Nobody')).toBeNull();
  });

  it('never looks up bot / race / solo pseudo-ids', async () => {
    const { client, calls } = fakeClient();
    const dir = createAvatarDirectory(() => client, () => {});
    dir.request('id', 'cpu:medium:o1');
    dir.request('id', `race:${A}`);
    await dir.flush();
    expect(calls).toHaveLength(0);
    expect(isProfileId(A)).toBe(true);
    expect(isProfileId('solo')).toBe(false);
  });

  it('notifies listeners once per batch, and forget() drops a row', async () => {
    const { client } = fakeClient();
    const dir = createAvatarDirectory(() => client, () => {});
    let n = 0;
    const off = dir.subscribe(() => { n++; });
    dir.request('id', A);
    dir.request('id', B);
    await dir.flush();
    expect(n).toBe(1);
    dir.forget('id', A);
    expect(dir.get('id', A)).toBeUndefined();
    expect(dir.get('username', 'ukrainian cyclone')).toBeUndefined();
    off();
  });

  it('a failing read caches nobody as found and never throws', async () => {
    const client: AvatarLookupClient = { from: () => ({ select: () => ({ in: () => Promise.reject(new Error('down')) }) }) };
    const dir = createAvatarDirectory(() => client, () => {});
    dir.request('id', A);
    await expect(dir.flush()).resolves.toBeUndefined();
    expect(dir.get('id', A)).toBeNull();
  });
});
