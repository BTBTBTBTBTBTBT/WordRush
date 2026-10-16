import { describe, expect, it } from 'vitest';
import { nextTimeOfDayChange, timeOfDay, timeOfDayAt } from './time-of-day';

describe('time of day (10-16 schedule: morning 5-10, day 10-16, evening 16-19, night 19-5)', () => {
  it('maps every hour', () => {
    const want = (h: number) => (h >= 19 || h < 5 ? 'night' : h >= 16 ? 'evening' : h >= 10 ? 'day' : 'morning');
    for (let h = 0; h < 24; h++) expect(timeOfDay(h)).toBe(want(h));
  });
  it('edges and wrap', () => {
    expect(timeOfDay(4.99)).toBe('night');
    expect(timeOfDay(5)).toBe('morning');
    expect(timeOfDay(9.99)).toBe('morning');
    expect(timeOfDay(10)).toBe('day');
    expect(timeOfDay(16)).toBe('evening');
    expect(timeOfDay(19)).toBe('night');
    expect(timeOfDay(24)).toBe('night');
    expect(timeOfDay(-1)).toBe('night');
  });
  it('reads a Date in local time', () => {
    expect(timeOfDayAt(new Date(2026, 10, 20, 9, 59))).toBe('morning');
    expect(timeOfDayAt(new Date(2026, 10, 20, 10, 0))).toBe('day');
  });
  it('the next change is the next boundary, strictly after now', () => {
    const n = (y: number, m: number, d: number, h: number, mi = 0) => nextTimeOfDayChange(new Date(y, m - 1, d, h, mi));
    expect(n(2026, 11, 20, 3)).toEqual(new Date(2026, 10, 20, 5));
    expect(n(2026, 11, 20, 5)).toEqual(new Date(2026, 10, 20, 10));
    expect(n(2026, 11, 20, 18, 59)).toEqual(new Date(2026, 10, 20, 19));
    expect(n(2026, 11, 20, 19)).toEqual(new Date(2026, 10, 21, 5));
    expect(n(2026, 12, 31, 23, 59)).toEqual(new Date(2027, 0, 1, 5));
  });
});
