import { describe, expect, it } from 'vitest';
import { HISTORY_DAYS, LAST_GAME_FRESH_MINUTES } from '@wordle-duel/core';
import { historyIds, lastGameFor, pruneHistory, pushShown } from './home-headline-pool-web';

describe('home_headlines_v2 history (last 10 days of shown ids)', () => {
  it('keeps entries inside the window and drops older or malformed ones', () => {
    const list = [
      { id: 'a', day: '2026-10-16' }, { id: 'b', day: '2026-10-07' }, { id: 'c', day: '2026-10-06' },
      { id: 'd', day: '2026-10-20' }, { id: 7 } as unknown as { id: string; day: string },
    ];
    expect(pruneHistory(list, '2026-10-16').map((e) => e.id)).toEqual(['a', 'b']);
    expect(HISTORY_DAYS).toBe(10);
  });
  it('pushes a shown id once per day and reports the ids', () => {
    const one = pushShown([], 'GOOD MORNING, {name}!', '2026-10-16');
    const same = pushShown(one, 'GOOD MORNING, {name}!', '2026-10-16');
    expect(same).toEqual(one);
    const two = pushShown(same, 'COFFEE\'S ON, {name}', '2026-10-16');
    expect(historyIds(two)).toEqual(['GOOD MORNING, {name}!', 'COFFEE\'S ON, {name}']);
  });
});

describe('last game record → core LastGame', () => {
  const rec = { title: 'Muddle', won: true, at: 1_000_000, record: false };
  it('is fresh inside the reaction window and null after it', () => {
    expect(lastGameFor(rec, 1_000_000 + 3 * 60_000)).toEqual({ title: 'Muddle', won: true, minutesAgo: 3, record: false });
    expect(lastGameFor(rec, 1_000_000 + (LAST_GAME_FRESH_MINUTES + 1) * 60_000)).toBeNull();
    expect(lastGameFor(null, 5)).toBeNull();
  });
});
