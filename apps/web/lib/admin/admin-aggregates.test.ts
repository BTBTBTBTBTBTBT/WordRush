import { describe, it, expect } from 'vitest';
import { activationFunnel, avatarAdoption, groupHealth, halloweenStatus, pct, pocketSummary, tallyBy } from './admin-aggregates';

describe('tallyBy', () => {
  it('counts, sorts most-common first, skips empty keys', () => {
    expect(tallyBy(['a', 'b', 'a', '', null, 'c', 'b', 'a'], (x) => x)).toEqual([
      { key: 'a', count: 3 },
      { key: 'b', count: 2 },
      { key: 'c', count: 1 },
    ]);
  });
  it('pct is one decimal and safe on zero', () => {
    expect(pct(1, 3)).toBe(33.3);
    expect(pct(5, 0)).toBe(0);
  });
});

describe('avatarAdoption', () => {
  it('tallies saved mascots, display choice and accessories', () => {
    const a = avatarAdoption([
      { avatar_config: { body: 'blob', head: 'crown', display: 'mascot' }, avatar_url: 'https://x/p.png' },
      { avatar_config: { body: 'blob', bg: 'galaxy' }, avatar_url: null },
      // No `display` + a photo on file → the client default is the photo.
      { avatar_config: { body: 'star' }, avatar_url: 'https://x/q.png', avatar_cast_id: 'w', avatar_frame: 'gold' },
      { avatar_config: null, avatar_url: 'https://x/r.png' },
    ]);
    expect(a.saved).toBe(3);
    expect(a.display).toEqual({ mascot: 2, photo: 1 });
    expect(a.withPhoto).toBe(2);
    expect(a.photoOwnersShowingMascot).toBe(1);
    expect(a.accessorized).toBe(1);
    expect(a.parts.body[0]).toEqual({ key: 'blob', count: 2 });
    expect(a.parts.head.find((t) => t.key === 'crown')?.count).toBe(1);
    expect(a.castPicks).toEqual([{ key: 'w', count: 1 }]);
    expect(a.frames).toEqual([{ key: 'gold', count: 1 }]);
  });
  it('junk part values fall back instead of polluting the tallies', () => {
    const a = avatarAdoption([{ avatar_config: { body: 'dragon', head: 'not-a-hat' } }]);
    expect(a.parts.body.map((t) => t.key)).not.toContain('dragon');
    expect(a.parts.head).toEqual([{ key: 'none', count: 1 }]);
  });
});

describe('groupHealth', () => {
  it('counts sweeps (all finished) and flawless (all won) per player', () => {
    const rows = [
      { user_id: 'u1', game_mode: 'A', completed: true },
      { user_id: 'u1', game_mode: 'B', completed: true },
      { user_id: 'u2', game_mode: 'A', completed: true },
      { user_id: 'u2', game_mode: 'B', completed: false },
      { user_id: 'u3', game_mode: 'A', completed: true },
      { user_id: 'u3', game_mode: 'Z', completed: true }, // not in the group
    ];
    const h = groupHealth(rows, ['A', 'B']);
    expect(h.players).toBe(3);
    expect(h.sweeps).toBe(2);
    expect(h.flawless).toBe(1);
    expect(h.perMode).toEqual([
      { mode: 'A', plays: 3, wins: 3 },
      { mode: 'B', plays: 2, wins: 1 },
    ]);
  });
  it('an empty group never counts a sweep', () => {
    expect(groupHealth([{ user_id: 'u', game_mode: 'A', completed: true }], []).sweeps).toBe(0);
  });
});

describe('pocketSummary', () => {
  it('breaks each kind down by status and recency', () => {
    const now = Date.parse('2026-10-02T12:00:00Z');
    const s = pocketSummary(
      [
        { kind: 'rps', status: 'done', created_at: '2026-10-01T00:00:00Z', winner: 'x' },
        { kind: 'rps', status: 'active', created_at: '2026-09-01T00:00:00Z', winner: null },
        { kind: 'ghost', status: 'resigned', created_at: '2026-10-02T00:00:00Z', winner: 'y' },
      ],
      ['rps', 'ttt', 'ghost'],
      now,
    );
    expect(s.map((k) => k.kind)).toEqual(['rps', 'ttt', 'ghost']);
    expect(s[0]).toMatchObject({ total: 2, active: 1, done: 1, last7: 1, decided: 1 });
    expect(s[1].total).toBe(0);
    expect(s[2]).toMatchObject({ resigned: 1, last7: 1 });
  });
});

describe('activationFunnel', () => {
  it('walks signup → mascot → played → returned → friend', () => {
    const steps = activationFunnel(
      [
        { id: 'a', created_at: '', avatar_config: { body: 'blob' } },
        { id: 'b', created_at: '', avatar_config: null },
        { id: 'c', created_at: '', avatar_config: null },
        { id: 'd', created_at: '', avatar_config: { body: 'star' } },
      ],
      new Map([['a', new Set(['2026-10-01', '2026-10-02'])], ['b', new Set(['2026-10-02'])]]),
      new Set(['a']),
    );
    expect(steps.map((s) => s.count)).toEqual([4, 2, 2, 1, 1]);
    expect(steps[1].pct).toBe(50);
  });
});

describe('halloweenStatus', () => {
  it('counts down before the window', () => {
    expect(halloweenStatus('2026-10-02')).toEqual({ active: null, start: '2026-10-09', end: '2026-10-31', daysUntilStart: 7, daysLeft: 0 });
  });
  it('is on Oct 9 through Oct 31 inclusive', () => {
    expect(halloweenStatus('2026-10-09')).toMatchObject({ active: 'halloween', daysLeft: 23 });
    expect(halloweenStatus('2026-10-31')).toMatchObject({ active: 'halloween', daysLeft: 1, start: '2026-10-09' });
  });
  it('rolls to next year after Oct 31', () => {
    expect(halloweenStatus('2026-11-01')).toMatchObject({ active: null, start: '2027-10-09', end: '2027-10-31' });
  });
});
