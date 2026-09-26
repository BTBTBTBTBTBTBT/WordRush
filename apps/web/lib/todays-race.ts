// Today's Race (Stats + Friends redesign D3, founder 2026-09-26): the friend
// leaderboard for TODAY — you and every friend ranked by today's daily points
// (the digest's todayPoints: composite score summed over every daily played
// today, sweep and More Games alike). Ties share a rank (competition ranking),
// then sort alphabetically. Pure, so the three platforms can pin it.

export interface RaceEntrant {
  id: string;
  username: string;
  points: number;
  /** Sweep dailies played today (the "N/8" line). */
  played: number;
  me: boolean;
}

export interface RaceRow extends RaceEntrant { rank: number }

export function rankToday(entrants: RaceEntrant[]): RaceRow[] {
  const sorted = [...entrants].sort((a, b) => b.points - a.points || a.username.localeCompare(b.username));
  const out: RaceRow[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const prev = out[i - 1];
    const rank = prev && prev.points === sorted[i].points ? prev.rank : i + 1;
    out.push({ ...sorted[i], rank });
  }
  return out;
}

/** "Leading by 340" / "120 behind Doug" / "Tied with Doug" / "Play a daily to join the race". */
export function raceStatusLine(rows: RaceRow[]): string {
  const me = rows.find((r) => r.me);
  if (!me) return '';
  if (me.points === 0) return 'Play a daily to join the race';
  const others = rows.filter((r) => !r.me);
  if (others.length === 0) return `${me.points.toLocaleString()} pts today`;
  if (me.rank === 1) {
    const next = others[0];
    return next.points === me.points ? `Tied with ${next.username}` : `Leading by ${(me.points - next.points).toLocaleString()}`;
  }
  const ahead = others.filter((r) => r.points > me.points).sort((a, b) => a.points - b.points)[0];
  return `${(ahead.points - me.points).toLocaleString()} behind ${ahead.username}`;
}
