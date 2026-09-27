package com.wordocious.app.ui

/**
 * The stats glossary (Stats + Friends redesign D2, founder 2026-09-26) — the
 * Android twin of web lib/stat-labels.ts (and iOS StatLabels.swift). The audit
 * found four naming systems for the same ideas across ~60 stats; one word per
 * idea from here on, and every surface that shows one routes its label through
 * this object.
 *
 *   Win Streak     consecutive WINS (any play type) — profiles.current_streak, user_stats.streak
 *   Daily Streak   consecutive days with a daily played — profiles.daily_login_streak
 *   Sweep Streak   consecutive days with every sweep daily played — daily_bonuses
 *   Clean          a win with no hints
 *   Perfect        a win at the mode's perfect count (guessBase)
 *   Top X%         percentile of TODAY's field you beat — the leaderboard badge
 *                  formula (Format.topPercentLabel); the Stats "Standing" pill
 *                  averages it over the dailies you played
 */
object StatLabels {
    const val winStreak = "Win Streak"
    const val bestWinStreak = "Best Win Streak"
    /** The 8-cell game grid (≤ 12 chars) shows this beside "Win Streak", where "Win" is implied. */
    const val bestStreakShort = "Best Streak"
    const val longestWinStreak = "Longest Win Streak"
    const val dailyStreak = "Daily Streak"
    const val bestDailyStreak = "Best Daily Streak"
    const val sweepStreak = "Sweep Streak"
    const val clean = "Clean"
    const val perfect = "Perfect"
    const val standing = "Standing"
}
