import { describe, expect, it } from 'vitest';
import { resolveTypedCode, type JoinDeps } from './join-by-code';

const NOW = Date.parse('2026-10-09T12:00:00Z');
const deps = (over: Partial<JoinDeps> = {}): JoinDeps => ({
  challenge: async () => ({ ok: false, status: 404, error: 'Challenge not found' }),
  invite: async () => null,
  vsHref: (m) => `/vs-${m.toLowerCase()}`,
  now: () => NOW,
  ...over,
});

describe('resolveTypedCode', () => {
  it('rejects junk', async () => {
    expect(await resolveTypedCode('hello', deps())).toEqual({ error: 'That does not look like an invite code or link.' });
  });

  it('a race challenge wins over a live invite', async () => {
    const d = deps({ challenge: async () => ({ ok: true }) });
    expect(await resolveTypedCode('ant5 ttzr', d)).toEqual({ href: '/vs/challenge/ANT5TTZR' });
  });

  it('a live invite routes into its mode with the code', async () => {
    const d = deps({ invite: async () => ({ status: 'pending', expires_at: '2026-10-09T13:00:00Z', game_mode: 'DUEL', invite_code: 'ANT5TTZR' }) });
    expect(await resolveTypedCode('https://wordocious.com/vs/ANT5TTZR', d)).toEqual({ href: '/vs-duel?inviteCode=ANT5TTZR' });
  });

  it('closed or expired invites say so', async () => {
    const closed = deps({ invite: async () => ({ status: 'accepted', expires_at: '2026-10-09T13:00:00Z', game_mode: 'DUEL', invite_code: 'ANT5TTZR' }) });
    expect(await resolveTypedCode('ANT5TTZR', closed)).toEqual({ error: 'No match found for that code.' });
    const old = deps({ invite: async () => ({ status: 'pending', expires_at: '2026-10-09T11:00:00Z', game_mode: 'DUEL', invite_code: 'ANT5TTZR' }) });
    expect(await resolveTypedCode('ANT5TTZR', old)).toEqual({ error: 'No match found for that code.' });
  });

  it('a challenge sent to someone else keeps its own message', async () => {
    const d = deps({ challenge: async () => ({ ok: false, status: 403, error: 'This challenge was sent to someone else' }) });
    expect(await resolveTypedCode('ANT5TTZR', d)).toEqual({ error: 'This challenge was sent to someone else' });
  });

  it('a friend link goes to the referral flow', async () => {
    expect(await resolveTypedCode('https://wordocious.com/friend/ABC234', deps())).toEqual({ href: '/join/ABC234' });
  });
});
