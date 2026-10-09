import { describe, expect, it } from 'vitest';
import { buildInviteRows } from './invites-row';

const live = (code: string, at: string) => ({ id: `id-${code}`, code, gameMode: 'DUEL', inviterId: 'u1', sender: 'Johnny', createdAt: at });
const race = (code: string, at: string) => ({ code, gameMode: 'DUEL', challengerId: 'u2', sender: 'Doug', createdAt: at, raceLine: 'solved in 4 · 1:12' });

describe('buildInviteRows', () => {
  it('merges live invites and race challenges newest first', () => {
    const rows = buildInviteRows({
      live: [live('AAAAAAAA', '2026-10-09T10:00:00Z')],
      races: [race('BBBBBBBB', '2026-10-09T11:00:00Z')],
      dismissed: [],
    });
    expect(rows.map((r) => r.key)).toEqual(['race:BBBBBBBB', 'live:AAAAAAAA']);
    expect(rows[0].raceLine).toBe('solved in 4 · 1:12');
    expect(rows[1].inviteId).toBe('id-AAAAAAAA');
  });

  it('drops the ones declined on this device (case-insensitive)', () => {
    const rows = buildInviteRows({ live: [], races: [race('BBBBBBBB', '2026-10-09T11:00:00Z')], dismissed: ['bbbbbbbb'] });
    expect(rows).toEqual([]);
  });
});
