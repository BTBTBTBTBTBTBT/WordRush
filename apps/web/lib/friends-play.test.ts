import { describe, it, expect } from 'vitest';
import { FRIENDLY_KINDS, friendsBannerHeadline, friendsBannerClockLine, newFriendlyState, type CellMark, type ChainState, type FriendlyState, type GhostState } from '@wordle-duel/core';
import {
  KIND_COLOR, KIND_GRADIENT, KIND_SHORT, KIND_SUB, activityKeyForPath, bannerModel, bestFriendStreak, chainNeededLetter,
  chainPrecheck, doingLine, friendAction, friendLine, friendsBadgeCount, gameMomentText, gameSubLine, ghostRoundCard, ghostTiles,
  kindForTitle, pocketTitleArt, kindRules, midnightClock, pickerGrid, pickerStatus, nobodyOnLine, onNow, passKeyStates, raceChips,
  reactionChips, rivalryLine, scoreOf, screenHeadline, sortActiveGames, sortForPicker, toggleReaction, tttThreats,
} from './friends-play';

const NOW = Date.parse('2026-10-01T18:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;

describe('presence heartbeat key', () => {
  it('maps game routes to db keys and everything else to null', () => {
    expect(activityKeyForPath('/muddle')).toBe('SCRAMBLE');
    expect(activityKeyForPath('/practice?daily=true')).toBe('DUEL');
    expect(activityKeyForPath('/quadword/vs')).toBe('QUORDLE');
    expect(activityKeyForPath('/vs/live/DUEL_6')).toBe('DUEL_6');
    expect(activityKeyForPath('/vs/live/nope')).toBeNull();
    expect(activityKeyForPath('/friends')).toBeNull();
    expect(activityKeyForPath('/')).toBeNull();
    expect(activityKeyForPath(null)).toBeNull();
  });
});

describe('friend rows', () => {
  const on = { id: '1', username: 'doug', lastSeenAt: ago(30_000), activity: 'Muddle', playedToday: 0 };
  const played = { id: '2', username: 'amy', lastSeenAt: ago(12 * MIN), playedToday: 3, todayPoints: 900 };
  const idle = { id: '3', username: 'zed', lastSeenAt: null, playedToday: 0 };

  it('presence line first, today line otherwise', () => {
    expect(friendLine(on, NOW, 8)).toEqual({ text: 'On now · in Muddle', online: true });
    expect(friendLine(played, NOW, 8)).toEqual({ text: 'Here 12 min ago', online: false });
    expect(friendLine({ ...played, lastSeenAt: ago(2 * 86_400_000) }, NOW, 8).text).toBe('3/8 today');
    expect(friendLine(idle, NOW, 8).text).toBe("Hasn't played today");
  });

  it('one action pill: Play when on, Challenge when played, Nudge otherwise', () => {
    expect(friendAction(on, NOW)).toBe('play');
    expect(friendAction(played, NOW)).toBe('challenge');
    expect(friendAction(idle, NOW)).toBe('nudge');
  });

  it('on now list, doing line and the nobody line', () => {
    const fresh = { ...on, id: '4', username: 'bea', lastSeenAt: ago(5_000), activity: null };
    expect(onNow([idle, on, played, fresh], NOW).map((f) => f.username)).toEqual(['bea', 'doug']);
    expect(doingLine('Muddle')).toBe('in Muddle');
    expect(doingLine(null)).toBe('on now');
    expect(nobodyOnLine([played, idle], NOW)).toBe("Nobody's on right now · amy was here 12 min ago");
    expect(nobodyOnLine([{ ...played, lastSeenAt: ago(3 * 3_600_000) }], NOW)).toBe("Nobody's on right now · amy was here 3 h ago");
    expect(nobodyOnLine([idle], NOW)).toBe("Nobody's on right now");
  });

  it('picker puts online friends first', () => {
    expect(sortForPicker([idle, played, on], NOW).map((f) => f.username)).toEqual(['doug', 'amy', 'zed']);
  });

  it('best friend streak and the rivalry line', () => {
    expect(bestFriendStreak([{ ...on, friendStreak: 3 }, { ...played, friendStreak: 12 }, idle])).toEqual({ name: 'amy', days: 12 });
    expect(bestFriendStreak([idle])).toBeNull();
    expect(rivalryLine({ ...on, h2hW: 5, h2hL: 3, friendStreak: 12 })).toBe('You lead 5–3 · 12-day friend streak');
    expect(rivalryLine({ ...on, h2hW: 1, h2hL: 4 })).toBe('They lead 4–1');
    expect(rivalryLine({ ...on, h2hW: 2, h2hL: 2 })).toBe('Tied 2–2');
    expect(rivalryLine(idle)).toBe('');
  });
});

describe('Friends banner model', () => {
  const me = { id: 'me', username: 'brian', todayPoints: 1200, playedToday: 4 };
  const friends = [
    { id: 'd', username: 'doug', todayPoints: 900 },
    { id: 'a', username: 'amy', todayPoints: 1500 },
    { id: 'z', username: 'zed', todayPoints: 0 },
  ];

  it('ranks like Today’s Race and feeds the core words', () => {
    const { rows, input } = bannerModel(friends, me, []);
    expect(rows.map((r) => r.username)).toEqual(['amy', 'brian', 'doug', 'zed']);
    expect(input).toMatchObject({ friendCount: 3, myRank: 2, myPoints: 1200, leaderName: 'amy', leaderPoints: 1500, nextPoints: 900 });
    expect(friendsBannerHeadline(input)).toBe('AMY LEADS TODAY’S RACE');
    expect(friendsBannerClockLine(input, '05:00:00')).toBe('TODAY’S RACE ENDS IN 05:00:00 · YOU’RE 2ND, 300 BEHIND');
  });

  it('leading: lead over the next one down', () => {
    const { input } = bannerModel(friends, { ...me, todayPoints: 2000 }, ['doug']);
    expect(input).toMatchObject({ myRank: 1, leaderName: 'You', nextPoints: 1500 });
    expect(friendsBannerHeadline(input)).toBe('DOUG IS ON NOW');
    expect(friendsBannerClockLine(input, '01:02:03')).toBe('YOU LEAD BY 500 · ENDS IN 01:02:03');
  });

  it('three chips, with you swapped in when lower than third', () => {
    const { rows } = bannerModel([...friends, { id: 'b', username: 'bea', todayPoints: 1300 }], { ...me, todayPoints: 100 }, []);
    expect(raceChips(rows).map((r) => r.username)).toEqual(['amy', 'bea', 'brian']);
    const { rows: top } = bannerModel(friends, me, []);
    expect(raceChips(top).map((r) => r.username)).toEqual(['amy', 'brian', 'doug']);
  });

  it('clock to local midnight', () => {
    const d = new Date(2026, 9, 1, 21, 30, 15);
    expect(midnightClock(d)).toBe('02:29:45');
  });
});

describe('games list and the tab badge', () => {
  const g = (id: string, yourTurn: boolean, updatedAt: string, status = 'active') => ({ id, yourTurn, updatedAt, status });
  it('your turn first, then the latest move', () => {
    const list = [g('a', false, '2026-10-01T10:00:00Z'), g('b', true, '2026-10-01T09:00:00Z'), g('c', false, '2026-10-01T11:00:00Z')];
    expect(sortActiveGames(list).map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });
  it('badge = pending requests + your-turn active games', () => {
    expect(friendsBadgeCount(2, [g('a', true, ''), g('b', false, ''), g('c', true, '', 'done')])).toBe(3);
    expect(friendsBadgeCount(0, [])).toBe(0);
  });
});

describe('game screen words', () => {
  it('sub line: best-of, live, last result', () => {
    const rps: FriendlyState = { kind: 'rps', picks: {}, rounds: [{ a: 'rock', b: 'scissors', winner: 'a' }], score: { a: 1, b: 0 } };
    expect(gameSubLine(rps, 'a', 'doug', false)).toBe('BEST OF 3 · YOU TOOK ROUND 1');
    expect(gameSubLine(rps, 'b', 'doug', true)).toBe('BEST OF 3 · LIVE, DOUG IS ON · DOUG TOOK ROUND 1');
    const coin: FriendlyState = { kind: 'coin', caller: 'b', rounds: [{ caller: 'a', call: 'heads', flip: 'tails', winner: 'b' }], score: { a: 0, b: 1 }, stake: 'Bragging rights' };
    expect(gameSubLine(coin, 'a', 'amy', false)).toBe('BEST OF 5 · TAILS · AMY WON IT');
    expect(gameSubLine(newFriendlyState('pass'), 'a', 'amy', false)).toBe('ONE BOARD, TAKE TURNS');
    expect(gameSubLine(newFriendlyState('ttt'), 'a', 'amy', false)).toBe('BEST OF 3');
  });

  it('headline covers resign and expiry; scores from my side', () => {
    const s = newFriendlyState('ttt');
    expect(screenHeadline({ state: s, me: 'a', status: 'active', result: null })).toBe('YOUR MOVE');
    expect(screenHeadline({ state: s, me: 'a', status: 'resigned', result: 'win' })).toBe('THEY RESIGNED');
    expect(screenHeadline({ state: s, me: 'b', status: 'resigned', result: 'loss' })).toBe('YOU RESIGNED');
    expect(screenHeadline({ state: s, me: 'a', status: 'expired', result: 'draw' })).toBe('GAME EXPIRED');
    expect(scoreOf({ kind: 'rps', picks: {}, rounds: [], score: { a: 2, b: 1 } }, 'b')).toEqual({ mine: 1, theirs: 2 });
    expect(scoreOf(newFriendlyState('pass'), 'a')).toBeNull();
  });

  it('Tic-Tac-Tile threats: the empty tiles that win now', () => {
    const board: CellMark[] = ['a', 'a', '', 'b', 'b', '', '', '', ''];
    expect(tttThreats(board, 'a')).toEqual([2]);
    expect(tttThreats(board, 'b')).toEqual([5]);
    expect(tttThreats(Array(9).fill('') as CellMark[], 'a')).toEqual([]);
  });

  it('Pass the Puzzle keys keep the best state per letter', () => {
    const states = passKeyStates([
      { word: 'CRANE', tiles: ['ABSENT', 'PRESENT', 'ABSENT', 'ABSENT', 'CORRECT'] },
      { word: 'ROUTE', tiles: ['CORRECT', 'ABSENT', 'ABSENT', 'ABSENT', 'CORRECT'] },
    ]);
    expect(states).toMatchObject({ C: 'absent', R: 'correct', E: 'correct', O: 'absent' });
  });
});

describe('moments and reactions', () => {
  it('toggles my reaction and lists chips in the fixed order', () => {
    const one = toggleReaction(undefined, 'fire', true);
    expect(one).toEqual({ counts: { fire: 1 }, mine: ['fire'] });
    const two = toggleReaction({ counts: { clap: 3, fire: 1 }, mine: [] }, 'clap', true);
    expect(reactionChips(two)).toEqual([{ key: 'clap', count: 4, mine: true }, { key: 'fire', count: 1, mine: false }]);
    const off = toggleReaction(two, 'clap', false);
    expect(off.counts.clap).toBe(3);
    expect(off.mine).toEqual([]);
    expect(toggleReaction(off, 'clap', false)).toEqual(off);
    expect(reactionChips(undefined)).toEqual([]);
  });

  it('game moment text', () => {
    expect(gameMomentText({ me: false, username: 'Doug', kind: 'win', gameTitle: 'Tic-Tac-Tile', otherName: 'you', score: '2–1' })).toBe('Doug beat you at Tic-Tac-Tile (2–1)');
    expect(gameMomentText({ me: true, username: 'brian', kind: 'win', gameTitle: 'Rock Paper Scissors', otherName: 'Amy', score: 'by resignation' })).toBe('You beat Amy at Rock Paper Scissors by resignation');
    expect(gameMomentText({ me: false, username: 'Doug', kind: 'draw', gameTitle: 'Call It', otherName: 'Amy', score: '2–2' })).toBe('Doug and Amy drew at Call It');
    expect(gameMomentText({ me: false, username: 'Doug', kind: 'win', gameTitle: 'Pass the Puzzle', otherName: 'Amy', score: null })).toBe('Doug beat Amy at Pass the Puzzle');
  });

  it('kind from a game title', () => {
    expect(kindForTitle('Call It')).toBe('coin');
    expect(kindForTitle('Pass the Puzzle')).toBe('pass');
    expect(kindForTitle('Classic')).toBeNull();
    expect(kindForTitle(null)).toBeNull();
  });
});

describe('Ghost and Word Chain (spec §9)', () => {
  it('every kind has a color, gradient, sub and short name', () => {
    expect(FRIENDLY_KINDS).toHaveLength(6);
    for (const k of FRIENDLY_KINDS) {
      expect(KIND_COLOR[k]).toMatch(/^#[0-9a-f]{6}$/);
      expect(KIND_GRADIENT[k]).toContain('linear-gradient');
      expect(KIND_SUB[k]).toBeTruthy();
      expect(KIND_SHORT[k]).toBeTruthy();
    }
    expect(KIND_COLOR.ghost).toBe('#9f1239');
    expect(KIND_COLOR.chain).toBe('#059669');
    expect(KIND_SUB.ghost).toBe("Add a letter; don't finish a word");
    expect(KIND_SUB.chain).toBe('Last letter starts the next');
    expect(kindForTitle('Ghost')).toBe('ghost');
    expect(kindForTitle('Word Chain')).toBe('chain');
  });

  const ghost: GhostState = {
    kind: 'ghost', fragment: 'CRA', letters: ['a', 'b', 'a'], turn: 'b', starter: 'a',
    rounds: [{ fragment: 'QZ', loser: 'b', reason: 'dead' }], score: { a: 1, b: 0 },
  };

  it('Ghost tiles know who played each letter', () => {
    expect(ghostTiles(ghost, 'a')).toEqual([{ letter: 'C', mine: true }, { letter: 'R', mine: false }, { letter: 'A', mine: true }]);
    expect(ghostTiles(ghost, 'b').map((t) => t.mine)).toEqual([false, true, false]);
  });

  it('Ghost round card words', () => {
    expect(ghostRoundCard({ fragment: 'CRANE', loser: 'b', reason: 'word' }, 'a', 'Doug')).toEqual({ letters: 'CRANE', text: 'Doug spelled a word', youLost: false });
    expect(ghostRoundCard({ fragment: 'CRANE', loser: 'a', reason: 'word' }, 'a', 'Doug').text).toBe('you spelled a word');
    expect(ghostRoundCard({ fragment: 'QZ', loser: 'a', reason: 'dead' }, 'a', 'Doug')).toEqual({ letters: 'QZ', text: 'no word starts with that', youLost: true });
  });

  const chain: ChainState = {
    kind: 'chain', turn: 'b', score: { a: 5, b: 0 },
    words: [{ by: 'a', word: 'CRANE', points: 5 }],
  };

  it('Word Chain needs the last letter of the newest word', () => {
    expect(chainNeededLetter(newFriendlyState('chain') as ChainState)).toBeNull();
    expect(chainNeededLetter(chain)).toBe('E');
  });

  it('Word Chain precheck uses the core errors (word list left to the server)', () => {
    expect(chainPrecheck(chain, 'b', 'EAT')).toBe('5 to 7 letters, please');
    expect(chainPrecheck(chain, 'b', 'EXCITING')).toBe('5 to 7 letters, please');
    expect(chainPrecheck(chain, 'b', 'TRAIN')).toBe('Start with E');
    expect(chainPrecheck({ ...chain, words: [...chain.words, { by: 'b', word: 'EAGLE', points: 5 }], turn: 'a' }, 'a', 'eagle')).toBe('Already played');
    expect(chainPrecheck(chain, 'b', 'eagle')).toBeNull();
    expect(chainPrecheck(newFriendlyState('chain') as ChainState, 'a', 'ZZZZZ')).toBeNull();
  });

  it('sub lines for Ghost and Word Chain', () => {
    expect(gameSubLine(newFriendlyState('ghost'), 'a', 'doug', false)).toBe('BEST OF 3');
    expect(gameSubLine(ghost, 'a', 'doug', false)).toBe('BEST OF 3 · YOU TOOK ROUND 1');
    expect(gameSubLine(ghost, 'b', 'doug', true)).toBe('BEST OF 3 · LIVE, DOUG IS ON · DOUG TOOK ROUND 1');
    expect(gameSubLine(newFriendlyState('chain'), 'a', 'amy', false)).toBe('FIRST TO 30');
    expect(gameSubLine(chain, 'b', 'amy', false)).toBe('FIRST TO 30 · AMY PLAYED CRANE +5');
    expect(scoreOf(chain, 'b')).toEqual({ mine: 0, theirs: 5 });
  });
});

describe('BJ13 pocket-game friend picker', () => {
  it('prints one rules line per game from the core targets', () => {
    expect(kindRules('rps')).toBe('Best of 3 · first to 2');
    expect(kindRules('ttt')).toBe('Best of 3 · first to 2');
    expect(kindRules('ghost')).toBe('Best of 3 · first to 2');
    expect(kindRules('coin')).toBe('Best of 5 · first to 3');
    expect(kindRules('chain')).toBe('First to 30 points');
    expect(kindRules('pass')).toBe('Six guesses, shared board');
  });
  it('gives each cell one short status', () => {
    const base = { id: 'x', username: 'x' };
    expect(pickerStatus({ ...base, lastSeenAt: ago(30_000) }, NOW)).toEqual({ text: 'On now', online: true });
    expect(pickerStatus({ ...base, lastSeenAt: ago(20 * MIN) }, NOW).text).toBe('20 min ago');
    expect(pickerStatus({ ...base, lastSeenAt: ago(20 * 60 * MIN) }, NOW).text).toBe('20 h ago');
    expect(pickerStatus({ ...base, lastSeenAt: ago(3 * 24 * 60 * MIN), playedToday: 2 }, NOW).text).toBe('Played today');
    expect(pickerStatus({ ...base, h2hW: 5, h2hL: 3 }, NOW).text).toBe('You lead 5–3');
    expect(pickerStatus(base, NOW)).toEqual({ text: 'Away', online: false });
  });
  it('fills the width: 3 across on phones, 4 on the wide sheet, the avatar tile fills its cell', () => {
    expect(pickerGrid(343)).toEqual({ cols: 3, avatar: 109 });
    expect(pickerGrid(370)).toEqual({ cols: 3, avatar: 118 });
    expect(pickerGrid(416)).toEqual({ cols: 4, avatar: 98 });
    expect(pickerGrid(900).avatar).toBeLessThanOrEqual(124);
  });
  it('picks the pocket title art up by name (the four shipped, the rest fall back)', () => {
    expect(pocketTitleArt('rps')).toEqual([993, 229]);
    expect(pocketTitleArt('coin')).not.toBeNull();
    expect(pocketTitleArt('ghost')).toBeNull();
  });
});
