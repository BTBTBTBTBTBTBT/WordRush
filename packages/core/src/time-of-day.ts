// Time of day (founder 10-16, docs/design/brand/seasons/time-of-day/NOTES.md v2): while a season shows, its wall, Home stage
// and window surfaces follow the device's LOCAL clock in four slots. Shared by web, iOS and Android; pinned by
// time-of-day-fixtures.json (Swift TimeOfDay.swift, Kotlin TimeOfDay.kt).

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';

/** Every slot, in clock order from dawn (the admin override picker lists them in this order after "Auto"). */
export const TIMES_OF_DAY: readonly TimeOfDay[] = ['morning', 'day', 'evening', 'night'];

/** The slot boundaries (local hours): morning 5–10, day 10–16, evening 16–19, night 19–5. */
export const TIME_OF_DAY_STARTS: readonly { time: TimeOfDay; hour: number }[] = [
  { time: 'morning', hour: 5 },
  { time: 'day', hour: 10 },
  { time: 'evening', hour: 16 },
  { time: 'night', hour: 19 },
];

/** The slot for a local clock hour (0–23; fractional hours and out-of-range values wrap into a day). */
export function timeOfDay(hour: number): TimeOfDay {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 19 || h < 5) return 'night';
  if (h >= 16) return 'evening';
  if (h >= 10) return 'day';
  return 'morning';
}

/** The slot for a Date, read in local time. */
export function timeOfDayAt(date: Date): TimeOfDay {
  return timeOfDay(date.getHours() + date.getMinutes() / 60);
}

/**
 * The next local instant (strictly after `date`) at which the slot changes: 05:00, 10:00, 16:00 or 19:00. The app arms ONE
 * timer to this moment (no polling) and re-reads on foreground.
 */
export function nextTimeOfDayChange(date: Date): Date {
  for (const { hour } of TIME_OF_DAY_STARTS) {
    const t = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0, 0);
    if (t.getTime() > date.getTime()) return t;
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, TIME_OF_DAY_STARTS[0].hour, 0, 0, 0);
}

/** The slot cross-fade, ms (walls, stage and window colors all use the same curve). */
export const TIME_OF_DAY_FADE_MS = 600;
