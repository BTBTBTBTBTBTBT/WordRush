// The stats glossary (Stats + Friends redesign D2, founder 2026-09-26). The
// audit found four naming systems for the same ideas across ~60 stats. One
// word per idea from here on — every surface that shows one of these routes
// its label through this table, and the iOS/Android twins (StatLabels.swift /
// StatLabels.kt) carry the same strings.
//
//   Win Streak     consecutive WINS (any play type) — profiles.current_streak, user_stats.streak
//   Daily Streak   consecutive days with a daily played — profiles.daily_login_streak
//   Sweep Streak   consecutive days with every sweep daily played — daily_bonuses
//   Clean          a win with no hints
//   Perfect        a win at the mode's perfect count (guessBase)
//   Top X%         percentile of TODAY's field you beat — the leaderboard badge
//                  formula (lib/format.ts topPercentLabel); the Stats "Standing"
//                  pill averages it over the dailies you played
export const STAT_LABELS = {
  winStreak: 'Win Streak',
  bestWinStreak: 'Best Win Streak',
  /** The 8-cell game grid (≤ 12 chars) shows this beside "Win Streak", where "Win" is implied. */
  bestStreakShort: 'Best Streak',
  longestWinStreak: 'Longest Win Streak',
  dailyStreak: 'Daily Streak',
  bestDailyStreak: 'Best Daily Streak',
  sweepStreak: 'Sweep Streak',
  clean: 'Clean',
  perfect: 'Perfect',
  standing: 'Standing',
} as const;

export type StatLabelKey = keyof typeof STAT_LABELS;
