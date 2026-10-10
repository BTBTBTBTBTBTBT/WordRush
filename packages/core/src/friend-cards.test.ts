import { describe, expect, it } from 'vitest';
import { applyFriendlyMove, newFriendlyState } from './friendly-games';
import { allFriendsLabel, cardPresence, friendsLayout, raceBadge, raceBadgeLines, theirTurnLine, tileWord, waitingHeadline, type CardFriend, type CardGame } from './friend-cards';

const f = (id: string, username: string, online = false, activity: string | null = null): CardFriend => ({ id, username, online, activity });
const rps = newFriendlyState('rps');
const g = (id: string, opponentId: string, yourTurn: boolean, updatedAt: string): CardGame =>
  ({ id, kind: 'rps', opponentId, opponentName: opponentId, me: 'a', state: rps, yourTurn, updatedAt });

describe('friend cards', () => {
  it('says the count once, singular and plural', () => {
    expect(waitingHeadline(0)).toBe('');
    expect(waitingHeadline(1)).toBe('1 game waiting on you');
    expect(waitingHeadline(6)).toBe('6 games waiting on you');
    expect(theirTurnLine(3, 'Johnny')).toBe('3 waiting on Johnny');
    expect(theirTurnLine(0, 'Johnny')).toBe('');
    expect(allFriendsLabel(12)).toBe('All friends · 12');
  });

  it('presence folds into the card', () => {
    expect(cardPresence(false, 'Classic')).toBeNull();
    expect(cardPresence(true, 'Classic')).toBe('playing Classic');
    expect(cardPresence(true, null)).toBe('on now');
  });

  it('tile words say what waits, in plain words', () => {
    expect(tileWord('rps', rps, 'a', true)).toBe('Pick rock, paper or scissors');
    expect(tileWord('rps', rps, 'a', false)).toBe('Waiting for their pick');
    expect(tileWord('pass', newFriendlyState('pass'), 'a', true)).toBe('Your guess (1 of 6)');
    const ghost = applyFriendlyMove(newFriendlyState('ghost'), 'a', { kind: 'ghost', letter: 'G' }, { isWord: () => false, hasPrefix: () => true });
    if (!ghost.ok) throw new Error('ghost move');
    expect(tileWord('ghost', ghost.state, 'b', true)).toBe('Add a letter to G');
    expect(tileWord('ghost', newFriendlyState('ghost'), 'a', true)).toBe('Start the word: add a letter');
    expect(tileWord('chain', newFriendlyState('chain'), 'a', false)).toBe('Waiting for their word');
    expect(tileWord('chain', newFriendlyState('chain'), 'a', true)).toBe('Start the chain with any word');
  });

  it('race badges: flawless / sweep for all 8, plus the day streak past 1', () => {
    expect(raceBadge(null, null, null)).toBeNull();
    expect(raceBadge(3, 2, 40)).toBe('40-DAY STREAK');
    expect(raceBadge(8, 0, 0)).toBe('SWEEP');
    expect(raceBadge(8, 0, 1)).toBe('SWEEP');
    expect(raceBadge(8, 3, 89)).toBe('FLAWLESS · 89-DAY STREAK');
    expect(raceBadge(undefined, undefined, 26)).toBe('26-DAY STREAK');
    expect(raceBadge(0, 0, 2)).toBe('2-DAY STREAK');
    expect(raceBadgeLines('FLAWLESS · 89-DAY STREAK')).toEqual(['FLAWLESS', '89-DAY STREAK']);
    expect(raceBadgeLines('SWEEP')).toEqual(['SWEEP']);
    expect(raceBadgeLines(null)).toEqual([]);
  });

  it('puts online friends first, then waiting turns, and files the rest under All friends', () => {
    const { cards, rest } = friendsLayout(
      [f('a', 'Aaron'), f('z', 'Zed'), f('m', 'Mo', true), f('q', 'cara')],
      [g('1', 'z', true, '2026-10-09T10:00:00Z'), g('2', 'a', false, '2026-10-09T12:00:00Z')],
    );
    expect(cards.map((c) => c.name)).toEqual(['Mo', 'Zed', 'Aaron']);
    expect(rest).toEqual(['cara']);
  });

  it('groups six games into one card, your turn newest first, their turn collapsed', () => {
    const games = [
      g('1', 'j', true, '2026-10-09T10:00:00Z'), g('2', 'j', true, '2026-10-09T11:00:00Z'), g('3', 'j', false, '2026-10-09T09:00:00Z'),
      g('4', 'j', false, '2026-10-09T12:00:00Z'),
    ];
    const { cards } = friendsLayout([f('j', 'johnnyauer', true, 'Classic')], games);
    expect(cards).toHaveLength(1);
    expect(cards[0].headline).toBe('2 games waiting on you');
    expect(cards[0].presence).toBe('playing Classic');
    expect(cards[0].tiles.map((t) => t.gameId)).toEqual(['2', '1']);
    expect(cards[0].theirTurn.map((t) => t.gameId)).toEqual(['4', '3']);
    expect(cards[0].theirTurnLine).toBe('2 waiting on johnnyauer');
  });

  it('keeps a game with someone who left the list', () => {
    const { cards } = friendsLayout([], [g('1', 'gone', true, '2026-10-09T10:00:00Z')]);
    expect(cards[0].friendId).toBe('gone');
  });
});
