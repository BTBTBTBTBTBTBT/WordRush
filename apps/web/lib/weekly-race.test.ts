import { describe, it, expect } from 'vitest';
import { settleWeek, ordinal } from './weekly-race';

describe('weekly race settlement', () => {
  it('ranks me with competition ranking and names the winner', () => {
    const s = settleWeek([{ id: 'me', points: 900 }, { id: 'doug', points: 1500 }, { id: 'amy', points: 900 }, { id: 'zed', points: 0 }], 'me');
    expect(s).toEqual({ rank: 2, points: 900, circleSize: 4, winnerId: 'doug', winnerPoints: 1500 });
  });
  it('is null when nobody scored or I am not in the circle', () => {
    expect(settleWeek([{ id: 'me', points: 0 }, { id: 'doug', points: 0 }], 'me')).toBeNull();
    expect(settleWeek([{ id: 'doug', points: 10 }], 'me')).toBeNull();
  });
  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
  });
});
