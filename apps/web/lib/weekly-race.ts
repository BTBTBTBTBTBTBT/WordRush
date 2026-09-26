// The Sunday finish (Stats + Friends redesign D3.3, founder 2026-09-26): the
// weekly friends race is SETTLED once per (viewer, week) on the viewer's first
// visit after their local Monday 00:00 — the same boundary every friends surface
// uses — and written to weekly_race_results by /api/friends with the service
// role. One definition, server-computed. This file holds the pure ranking so
// the server and the tests agree.

export interface WeekEntrant { id: string; points: number }

export interface WeekSettlement {
  rank: number;          // competition rank (ties share)
  points: number;
  circleSize: number;    // friends + me
  winnerId: string | null;
  winnerPoints: number;
}

/** Settle `me` against the circle's points for one week. Null when nobody scored. */
export function settleWeek(entrants: WeekEntrant[], me: string): WeekSettlement | null {
  if (entrants.length === 0 || !entrants.some((e) => e.points > 0)) return null;
  const mine = entrants.find((e) => e.id === me);
  if (!mine) return null;
  const sorted = [...entrants].sort((a, b) => b.points - a.points);
  const rank = sorted.filter((e) => e.points > mine.points).length + 1;
  return { rank, points: mine.points, circleSize: entrants.length, winnerId: sorted[0].id, winnerPoints: sorted[0].points };
}

/** "You finished 2nd of 6" — ordinal helper shared by the banner and the Stats card. */
export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}
