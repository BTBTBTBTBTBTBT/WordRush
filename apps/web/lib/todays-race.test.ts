import { describe, it, expect } from 'vitest';
import { rankToday, raceStatusLine } from './todays-race';

const e = (username: string, points: number, me = false) => ({ id: username, username, points, played: 0, me });

describe("Today's Race ranking", () => {
  it('ranks by points, ties share a rank, then alphabetical', () => {
    const rows = rankToday([e('Doug', 900), e('You', 1200, true), e('Amy', 900), e('Zed', 0)]);
    expect(rows.map((r) => [r.username, r.rank])).toEqual([['You', 1], ['Amy', 2], ['Doug', 2], ['Zed', 4]]);
  });
  it('status line: leading, behind, tied, not started', () => {
    expect(raceStatusLine(rankToday([e('You', 1200, true), e('Doug', 900)]))).toBe('Leading by 300');
    expect(raceStatusLine(rankToday([e('You', 700, true), e('Doug', 900), e('Amy', 1500)]))).toBe('200 behind Doug');
    expect(raceStatusLine(rankToday([e('You', 900, true), e('Doug', 900)]))).toBe('Tied with Doug');
    expect(raceStatusLine(rankToday([e('You', 0, true), e('Doug', 900)]))).toBe('Play a daily to join the race');
    expect(raceStatusLine(rankToday([e('You', 450, true)]))).toBe('450 pts today');
  });
});
