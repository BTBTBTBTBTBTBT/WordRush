// The Leaderboard page title (founder, 2026-10-01): "a fun word play like
// Friday's Finest … switching those up by the days". One alliterative title per
// weekday; a holiday day swaps in "<HOLIDAY> HEROES". Pure, so web, iOS and
// Android read the same words on the same local day (leaderboard-title-fixtures.json).

const WEEKDAY_TITLES = [
  'SUNDAY SUPERSTARS',
  'MONDAY MASTERS',
  'TUESDAY TITANS',
  'WEDNESDAY WIZARDS',
  'THURSDAY THUNDER',
  'FRIDAY’S FINEST',
  'SATURDAY STARS',
] as const;

/** `day` is the player's local YYYY-MM-DD; `holiday` the day's holiday name, if any. */
export function leaderboardTitle(day: string, holiday?: string | null): string {
  const h = (holiday ?? '').trim();
  if (h) return `${h.toUpperCase()} HEROES`;
  const [y, m, d] = day.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAY_TITLES[weekday];
}
