import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetLiveSwitchCacheForTests, liveSwitchOn, publishGameChange, restBroadcast } from './friendly-live-server';

const row = { id: 'g1', player_a: 'a', player_b: 'b', status: 'active' as const, updated_at: '2026-10-09T12:00:00.000+00:00' };

function fakeAdmin(flag: { enabled: boolean; audience: string } | null) {
  const rpc = vi.fn().mockResolvedValue({ data: 2, error: null });
  const admin: any = {
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: flag ? { key: 'live_play', ...flag } : null }) }) }) }),
  };
  return { admin, rpc };
}

beforeEach(() => {
  __resetLiveSwitchCacheForTests();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
});
afterEach(() => vi.restoreAllMocks());

describe('live play server publish', () => {
  it('broadcasts the receiver view on fg:<id> and bumps the backup ping', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { admin, rpc } = fakeAdmin({ enabled: true, audience: 'all' });
    await publishGameChange(admin, row, 'a', { id: 'g1', yourTurn: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://x.supabase.co/realtime/v1/api/broadcast');
    const msg = JSON.parse(init.body).messages[0];
    expect(msg).toMatchObject({ topic: 'fg:g1', event: 'move', private: false });
    expect(msg.payload).toMatchObject({ by: 'a', updatedAt: row.updated_at, game: { yourTurn: true } });
    expect(rpc).toHaveBeenCalledWith('bump_friendly_game_ping', { p_game: 'g1', p_a: 'a', p_b: 'b', p_status: 'active', p_by: 'a' });
  });

  it('does nothing when the live_play switch is off', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { admin, rpc } = fakeAdmin({ enabled: false, audience: 'all' });
    await publishGameChange(admin, row, 'a', {});
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails open when the flag row is missing, and never throws when Realtime is down', async () => {
    const { admin } = fakeAdmin(null);
    expect(await liveSwitchOn(admin)).toBe(true);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    await expect(publishGameChange(admin, row, 'a', {})).resolves.toBeUndefined();
    expect(await restBroadcast('fg:g1', 'move', {})).toBe(false);
  });
});
