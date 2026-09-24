import { describe, it, expect } from 'vitest';
import holidayFile from '@/data/propernoundle-holidays.json';
import { HOLIDAY_TABLE } from '@/lib/holidays';
import { holidayOccurrence } from '@wordle-duel/core';
import { getDailyPuzzle, getDailyPuzzleNumber, dailyHolidayKey } from './puzzle-service';
import type { Puzzle } from './types';

// More Games §20: on a calendar holiday the daily comes from
// apps/web/data/propernoundle-holidays.json (the k-th recurrence of the holiday
// takes entry k, wrapping); on every other day the category rotation over the
// main bank is exactly what it was before holidays existed.
const HOLIDAY: Record<string, Puzzle[]> = (holidayFile as { holiday: Record<string, Puzzle[]> }).holiday;
const HOLIDAY_IDS = new Set(Object.values(HOLIDAY).flat().map((p) => p.id));

/** Every calendar date owned by `key`, in calendar order. */
const datesFor = (key: string) => Object.keys(HOLIDAY_TABLE.days).filter((d) => HOLIDAY_TABLE.days[d] === key).sort();

/** A holiday that has entries in the file, Christmas by preference. */
const populatedKey = HOLIDAY.christmas?.length ? 'christmas' : Object.keys(HOLIDAY).find((k) => HOLIDAY[k].length && datesFor(k).length)!;

describe('getDailyPuzzle on a holiday', () => {
  it('the holidays file has at least one holiday with entries that appears in holiday-days.json', () => {
    expect(populatedKey).toBeTruthy();
    expect(datesFor(populatedKey).length).toBeGreaterThan(0);
  });

  it('returns an entry from the holidays file, not the rotation, and names the key', () => {
    const [day] = datesFor(populatedKey);
    const puzzle = getDailyPuzzle(day);
    expect(HOLIDAY[populatedKey]).toContainEqual(puzzle);
    expect(HOLIDAY_IDS.has(puzzle.id)).toBe(true);
    expect(dailyHolidayKey(day)).toBe(populatedKey);
  });

  it('Christmas 2026-12-25 is the second Christmas outing (24th is the first), so it serves entry 1 mod n', () => {
    const entries = HOLIDAY.christmas ?? [];
    if (!entries.length) return; // the file may ship without Christmas; the data-driven tests above cover the rule
    expect(HOLIDAY_TABLE.days['2026-12-25']).toBe('christmas');
    expect(holidayOccurrence('2026-12-25', 'christmas', HOLIDAY_TABLE)).toBe(1);
    expect(getDailyPuzzle('2026-12-25')).toEqual(entries[1 % entries.length]);
    // Pinned pre-holiday rotation pick for that date — displaced, never dated.
    expect(getDailyPuzzle('2026-12-25').id).not.toBe('sci054');
  });

  it('the k-th recurrence of a holiday takes entry k, wrapping round the list', () => {
    for (const key of Object.keys(HOLIDAY)) {
      const entries = HOLIDAY[key];
      if (!entries.length) continue;
      datesFor(key).forEach((day, k) => {
        expect(holidayOccurrence(day, key, HOLIDAY_TABLE)).toBe(k);
        expect(getDailyPuzzle(day), `${key} ${day}`).toEqual(entries[k % entries.length]);
        expect(dailyHolidayKey(day)).toBe(key);
      });
    }
  });

  it('a holiday with two entries alternates them across successive recurrences', () => {
    const key = Object.keys(HOLIDAY).find((k) => HOLIDAY[k].length >= 2 && datesFor(k).length >= 3);
    if (!key) return;
    const [d0, d1, d2] = datesFor(key);
    expect(getDailyPuzzle(d0)).toEqual(HOLIDAY[key][0]);
    expect(getDailyPuzzle(d1)).toEqual(HOLIDAY[key][1]);
    expect(getDailyPuzzle(d2)).toEqual(HOLIDAY[key][2 % HOLIDAY[key].length]);
  });

  it('a calendar holiday the file has no entries for falls through to the rotation', () => {
    const bare = Object.keys(HOLIDAY_TABLE.days).map((d) => HOLIDAY_TABLE.days[d]).find((k) => !HOLIDAY[k]?.length);
    if (!bare) return; // every holiday is populated — nothing to fall through
    const [day] = datesFor(bare);
    expect(dailyHolidayKey(day)).toBeNull();
    expect(HOLIDAY_IDS.has(getDailyPuzzle(day).id)).toBe(false);
  });
});

describe('getDailyPuzzle on an ordinary day', () => {
  // Pinned from the rotation as it stood before the holiday rule was added
  // (epoch 2024-01-01, alphabetical category cycle). These must never move.
  it('2026-03-10 is still puzzle #800, his029 "mesopotamia" (history)', () => {
    expect(HOLIDAY_TABLE.days['2026-03-10']).toBeUndefined();
    expect(dailyHolidayKey('2026-03-10')).toBeNull();
    expect(getDailyPuzzleNumber('2026-03-10')).toBe(800);
    const p = getDailyPuzzle('2026-03-10');
    expect(p.id).toBe('his029');
    expect(p.answer).toBe('mesopotamia');
    expect(p.themeCategory).toBe('history');
  });

  it('2026-09-24 is still puzzle #998, mus050 "twentyonepilots" (music)', () => {
    expect(dailyHolidayKey('2026-09-24')).toBeNull();
    expect(getDailyPuzzleNumber('2026-09-24')).toBe(998);
    const p = getDailyPuzzle('2026-09-24');
    expect(p.id).toBe('mus050');
    expect(p.answer).toBe('twentyonepilots');
  });

  it('the day after a holiday keeps its own rotation slot (the displaced pick is skipped, not shifted)', () => {
    // 2026-07-04 is july4; 2026-07-05 is ordinary and 2026-07-04 as a plain
    // day number was pinned to spo040 "alexovechkin" (sports). The rotation
    // is a pure function of the day number, so 07-05 is the next category in
    // the cycle regardless of what 07-04 served.
    const p = getDailyPuzzle('2026-07-05');
    expect(HOLIDAY_IDS.has(p.id)).toBe(false);
    expect(p.themeCategory).not.toBe('sports');
    expect(getDailyPuzzleNumber('2026-07-05')).toBe(917);
  });
});
