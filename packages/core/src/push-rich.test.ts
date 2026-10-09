import { describe, it, expect } from 'vitest';
import {
  PUSH_TITLE_MAX, richAccent, richCollapseId, richPushTitle, richThread, PUSH_HALLOWEEN_ACCENT, PUSH_DEFAULT_ACCENT,
} from './push-rich';

describe('rich push copy', () => {
  it('titles always fit and read complete', () => {
    expect(richPushTitle('played', 'Ava', 'Hubbub')).toBe('Ava played Hubbub');
    // game name too long for the full phrase: drops the game, keeps a complete sentence
    expect(richPushTitle('played', 'Maximilian', 'Rock Paper Scissors')).toBe('Maximilian played');
    expect(richPushTitle('started', 'Ava', 'Rock Paper Scissors')).toBe('Ava started a game');
    for (const kind of ['played', 'started', 'challenge', 'taunt', 'reaction', 'rematch', 'friendRequest', 'gift', 'looking', 'beatRun', 'tiedRun', 'heldRun', 'accepted', 'nudge', 'shield', 'passed'] as const) {
      for (const name of ['Al', 'Maximilian', 'AVeryLongUsername123', 'AnExtremelyLongUsernameThatOverflows']) {
        expect(richPushTitle(kind, name, 'Pass the Puzzle').length).toBeLessThanOrEqual(PUSH_TITLE_MAX);
      }
    }
  });
  it('falls back to "A friend" and cuts a monster name at a character with an ellipsis', () => {
    expect(richPushTitle('played', '', 'Ghost')).toBe('A friend played Ghost');
    const t = richPushTitle('taunt', 'x'.repeat(40));
    expect(t.endsWith('…')).toBe(true);
    expect(t.length).toBe(PUSH_TITLE_MAX);
  });
  it('groups by game, else friend, and collapses rapid moves', () => {
    expect(richThread({ senderId: 'u1', gameRowId: 'g1' })).toBe('game:g1');
    expect(richThread({ senderId: 'u1' })).toBe('friend:u1');
    expect(richThread({})).toBe('wordocious');
    expect(richCollapseId({ gameRowId: 'g1', kind: 'move' })).toBe('move:g1');
    expect(richCollapseId({ senderId: 'u1', kind: 'taunt' })).toBe('taunt:u1');
    expect(richCollapseId({ kind: 'x' })).toBeUndefined();
  });
  it('accent is the game color, Halloween orange in season', () => {
    expect(richAccent('#0d9488', false)).toBe('#0d9488');
    expect(richAccent('#0d9488', true)).toBe(PUSH_HALLOWEEN_ACCENT);
    expect(richAccent(null, false)).toBe(PUSH_DEFAULT_ACCENT);
    expect(richAccent('red', false)).toBe(PUSH_DEFAULT_ACCENT);
  });
});
