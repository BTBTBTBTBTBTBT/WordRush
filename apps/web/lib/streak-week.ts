// The streak popup's week (docs/FINISH_SPEC.md C5): seven day tiles, Monday
// first, filled for each day of THIS week the current streak covers. The run
// ends today when a daily is already done today, otherwise yesterday (the
// streak is still alive until today ends). Pure, local-date math on
// YYYY-MM-DD strings.

/** Day letters, Monday first. */
export const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

function parse(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/**
 * For each weekday of the week holding `today` (Monday first): was it a day of
 * the current `streak`? Days after today are never filled.
 */
export function streakWeek(today: string, streak: number, playedToday: boolean): boolean[] {
  const t = parse(today);
  const mondayOffset = (t.getUTCDay() + 6) % 7; // Monday = 0 … Sunday = 6
  const end = playedToday ? 0 : -1;             // the run's last day, relative to today
  const start = end - Math.max(0, Math.floor(streak)) + 1;
  return WEEK_LETTERS.map((_, i) => {
    const rel = i - mondayOffset;                // this tile relative to today
    return streak > 0 && rel <= 0 && rel >= start && rel <= end;
  });
}

/** How many days of this week the streak covers (for the accessible summary). */
export function streakWeekCount(today: string, streak: number, playedToday: boolean): number {
  return streakWeek(today, streak, playedToday).filter(Boolean).length;
}
