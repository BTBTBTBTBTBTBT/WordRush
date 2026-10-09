import { describe, expect, it } from 'vitest';
import { FRIENDLY_KINDS } from './friendly-games';
import { POCKET_HELP, mergeTutorialsSeen, pocketTutorialKey, shouldAutoShowTutorial, tutorialShouldRecordSeen, withTutorialSeen } from './pocket-help';
import { idleBit, keepyLine, waitClock, waitedSeconds, waitingStatusLine } from './waiting-room';

describe('pocket help', () => {
  it('has three steps, a win rule and the turns promise for every pocket game', () => {
    for (const k of FRIENDLY_KINDS) {
      const h = POCKET_HELP[k];
      expect(h.steps).toHaveLength(3);
      expect(h.key).toBe(pocketTutorialKey(k));
      expect(h.win.length).toBeGreaterThan(10);
      expect(h.turns).toContain('3 days');
      for (const s of h.steps) {
        expect(s.picture.art.length).toBeGreaterThan(0);
        for (const a of s.picture.art) expect(a).toMatch(/^art-pocket-/);
      }
    }
  });

  it('uses American spelling', () => {
    const text = JSON.stringify(POCKET_HELP);
    expect(text).not.toMatch(/colour|centre|grey|neighbour|favour/i);
  });

  it('auto-shows once per game per player, never while loading, never when switched off', () => {
    expect(shouldAutoShowTutorial({ live: true, seen: [], key: 'hub' })).toBe(true);
    expect(shouldAutoShowTutorial({ live: true, seen: ['hub'], key: 'hub' })).toBe(false);
    expect(shouldAutoShowTutorial({ live: false, seen: [], key: 'hub' })).toBe(false);
    expect(shouldAutoShowTutorial({ live: true, seen: null, key: 'hub' })).toBe(false);
  });

  it('never auto-shows to a player with results in the game, and records it quietly', () => {
    expect(shouldAutoShowTutorial({ live: true, seen: [], key: 'hub', hasResults: true })).toBe(false);
    expect(tutorialShouldRecordSeen({ live: true, seen: [], key: 'hub', hasResults: true })).toBe(true);
    expect(tutorialShouldRecordSeen({ live: true, seen: ['hub'], key: 'hub', hasResults: true })).toBe(false);
    expect(tutorialShouldRecordSeen({ live: true, seen: [], key: 'hub', hasResults: false })).toBe(false);
    expect(tutorialShouldRecordSeen({ live: true, seen: null, key: 'hub', hasResults: true })).toBe(false);
  });

  it('seen lists stay sorted, unique and merge across devices', () => {
    expect(withTutorialSeen(['pocket-ttt'], 'hub')).toEqual(['hub', 'pocket-ttt']);
    expect(withTutorialSeen(['hub'], 'hub')).toEqual(['hub']);
    expect(mergeTutorialsSeen(['a', 'c'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});

describe('waiting room words', () => {
  it('has one status line with a real ellipsis', () => {
    expect(waitingStatusLine({ kind: 'friend', name: '@Johnny' })).toBe('Waiting for Johnny…');
    expect(waitingStatusLine({ kind: 'friend' })).toBe('Waiting for your friend…');
    expect(waitingStatusLine({ kind: 'random' })).toBe('Finding you an opponent…');
  });

  it('counts a real clock', () => {
    expect(waitClock(0)).toBe('0:00');
    expect(waitClock(65)).toBe('1:05');
    expect(waitClock(3725)).toBe('1:02:05');
    expect(waitClock(-3)).toBe('0:00');
    expect(waitedSeconds(1000, 8999)).toBe(7);
    expect(waitedSeconds(5000, 1000)).toBe(0);
  });

  it('keepy-uppy and idle bits', () => {
    expect(keepyLine(0, 0)).toBe('Tap to bounce the tile');
    expect(keepyLine(5, 4)).toBe('5 · new best!');
    expect(idleBit(3)).toBeNull();
    expect(idleBit(6)).toBe('checks its watch');
    expect(idleBit(12)).toBe('yawns');
  });
});
