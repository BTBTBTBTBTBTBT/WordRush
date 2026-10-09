import { describe, expect, it } from 'vitest';
import { celebrationAction, celebrationDue, shouldDeferHandoff, type CelebrationGroup, type CelebrationTier } from './celebration-gate';

// 2.8 item 52: the Flawless / Sweep celebration fires at the right moment — from local results, once, never late.

const DAILY = ['DUEL', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'GAUNTLET', 'PROPERNOUNDLE_SWEEP', 'DUEL6'];
const MORE = ['SUDOKU', 'REGIONS', 'LADDER', 'WORDSEARCH', 'HUB', 'CRYPTOGRAM', 'GROUPS', 'CROSSWORD', 'SCRAMBLE', 'PROPERNOUNDLE'];
const TODAY = '2026-10-09';

const results = (keys: string[], lost: string[] = []) => new Map(keys.map((k) => [k, { won: !lost.includes(k) }]));
const noneSeen = () => null;
const due = (map: Map<string, { won: boolean }>, seen: (g: CelebrationGroup) => CelebrationTier | null = noneSeen, dataDay = TODAY) =>
  celebrationDue({ results: map, dailyKeys: DAILY, moreKeys: MORE, today: TODAY, dataDay, seen });

describe('celebrationDue — computed from local results the instant the last game finishes', () => {
  it('7 of 8 dailies: nothing; the 8th (won): FLAWLESS is due immediately', () => {
    expect(due(results(DAILY.slice(0, 7)))).toEqual([]);
    const d = due(results(DAILY));
    expect(d).toEqual([{ group: 'daily', tier: 'flawless', token: `${TODAY}:daily:flawless` }]);
  });

  it('the 8th daily lost: a SWEEP, not a flawless', () => {
    expect(due(results(DAILY, ['GAUNTLET']))).toEqual([{ group: 'daily', tier: 'sweep', token: `${TODAY}:daily:sweep` }]);
  });

  it('the 10th puzzle fires the Puzzles celebration; the dailies one is not repeated', () => {
    const all = results([...DAILY, ...MORE]);
    const seenDailyFlawless = (g: CelebrationGroup) => (g === 'daily' ? 'flawless' : null);
    expect(due(all, seenDailyFlawless)).toEqual([{ group: 'more', tier: 'flawless', token: `${TODAY}:more:flawless` }]);
    // 9 of 10 puzzles: still nothing for Puzzles (and an unrelated puzzle never re-fires the dailies)
    expect(due(results([...DAILY, ...MORE.slice(0, 9)]), seenDailyFlawless)).toEqual([]);
  });

  it('never twice: a seen tier suppresses it; a flawless upgrade of a seen sweep still fires; flawless covers sweep', () => {
    expect(due(results(DAILY), (g) => (g === 'daily' ? 'flawless' : null))).toEqual([]);
    expect(due(results(DAILY, ['DUEL']), (g) => (g === 'daily' ? 'sweep' : null))).toEqual([]);
    expect(due(results(DAILY), (g) => (g === 'daily' ? 'sweep' : null)).map((x) => x.tier)).toEqual(['flawless']);
    expect(due(results(DAILY, ['DUEL']), (g) => (g === 'daily' ? 'flawless' : null))).toEqual([]);
  });

  it('after an app restart mid-day: due again until its token is stored, then never', () => {
    const restored = results(DAILY); // the day-keyed cache restored the finished set
    expect(due(restored)).toHaveLength(1);
    expect(due(restored, (g) => (g === 'daily' ? 'flawless' : null))).toEqual([]);
  });

  it('yesterday\'s map in a tab alive across midnight never celebrates; zero wins never celebrates', () => {
    expect(due(results(DAILY), noneSeen, '2026-10-08')).toEqual([]);
    expect(due(results(DAILY, DAILY))).toEqual([]);
  });

  it('both groups complete at once: Daily Sweep first, then Puzzles', () => {
    expect(due(results([...DAILY, ...MORE])).map((x) => x.group)).toEqual(['daily', 'more']);
  });
});

describe('celebrationAction — presents the moment nothing is open, from any screen', () => {
  const base = { source: 'live' as const, onHomeRoot: true, anythingOpen: false, popupUp: false, celebrationDay: TODAY, today: TODAY };

  it('Home root, nothing open: present now', () => {
    expect(celebrationAction(base)).toBe('present');
  });

  it('off Home (the game came from another tab / a deep link / the widget): go Home, then present', () => {
    expect(celebrationAction({ ...base, onHomeRoot: false })).toBe('goHomeThenPresent');
  });

  it('a finished screen / game / dialog / popup still open: wait', () => {
    expect(celebrationAction({ ...base, anythingOpen: true })).toBe('wait');
    expect(celebrationAction({ ...base, popupUp: true })).toBe('wait');
    expect(celebrationAction({ ...base, onHomeRoot: false, anythingOpen: true })).toBe('wait');
  });

  it('a late source (replay / sync) never routes; it waits for calm on Home', () => {
    expect(celebrationAction({ ...base, source: 'replay', onHomeRoot: false })).toBe('wait');
    expect(celebrationAction({ ...base, source: 'sync', onHomeRoot: true })).toBe('present');
  });

  it('a celebration whose day has ended is dropped', () => {
    expect(celebrationAction({ ...base, celebrationDay: '2026-10-08' })).toBe('drop');
    expect(celebrationAction({ ...base, celebrationDay: '2026-10-08', anythingOpen: true })).toBe('drop');
  });
});

describe('NEXT on a finished screen plays the celebration first', () => {
  it('defers a handoff while a celebration is pending, not otherwise', () => {
    expect(shouldDeferHandoff(1)).toBe(true);
    expect(shouldDeferHandoff(2)).toBe(true);
    expect(shouldDeferHandoff(0)).toBe(false);
  });

  it('the path: last daily finishes -> due -> NEXT deferred -> present on Home -> handoff released', () => {
    const after8 = due(results(DAILY));
    expect(after8).toHaveLength(1);
    expect(shouldDeferHandoff(after8.length)).toBe(true);
    // the player closed the finished screen (nothing open) while on the Leaderboard tab
    expect(celebrationAction({ source: 'live', onHomeRoot: false, anythingOpen: false, popupUp: false, celebrationDay: TODAY, today: TODAY })).toBe('goHomeThenPresent');
    // celebrated: the token is stored; the later Puzzle never fires it again
    const afterSeen = due(results([...DAILY, 'SUDOKU']), (g) => (g === 'daily' ? 'flawless' : null));
    expect(afterSeen).toEqual([]);
    expect(shouldDeferHandoff(afterSeen.length)).toBe(false);
  });
});
