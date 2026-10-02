import { describe, expect, it } from 'vitest';
import { badgeText, friendsTabLabel, markSeen, unseenCount, waitingKeys } from './friends-badge';

const w = { requests: ['u1'], invites: ['i1'], challenges: ['ABC123'], turns: [{ id: 'g1', updatedAt: '2026-10-02T10:00:00Z' }] };

describe('Friends tab badge (FINISH_SPEC M)', () => {
  it('counts requests + invites + challenges + your-turn games', () => {
    const keys = waitingKeys(w);
    expect(keys).toEqual(['req:u1', 'inv:i1', 'ch:ABC123', 'turn:g1:2026-10-02T10:00:00Z']);
    expect(unseenCount(keys, new Set())).toBe(4);
  });
  it('clears when Friends is opened and returns only for new items', () => {
    const seen = new Set(markSeen(waitingKeys(w)));
    expect(unseenCount(waitingKeys(w), seen)).toBe(0);
    // A new move in the same game is new again; so is a new request.
    const next = { ...w, requests: ['u1', 'u2'], turns: [{ id: 'g1', updatedAt: '2026-10-02T11:00:00Z' }] };
    expect(unseenCount(waitingKeys(next), seen)).toBe(2);
  });
  it('reads 1–9, then 9+, and labels the tab', () => {
    expect(badgeText(3)).toBe('3');
    expect(badgeText(10)).toBe('9+');
    expect(friendsTabLabel(0)).toBe('Friends');
    expect(friendsTabLabel(3)).toBe('Friends, 3 new');
  });
});
