package com.wordocious.app.data

import com.wordocious.app.ui.formatGuessStat

/**
 * Per-mode stats registry — port of apps/web/lib/mode-stats.ts (More Games
 * §18). The default profile reproduces the profile screen's eight cells
 * exactly; each custom game adds one profile row when it lands. Pinned by
 * mode-stats-fixtures.json alongside the Swift and TS copies.
 */
object ModeStats {
    data class Totals(
        val wins: Int,
        val losses: Int,
        val totalGames: Int,
        /** Best (lowest) guess_count; 0 = none yet. */
        val bestScore: Int,
        /** Fastest win in seconds; 0 = none yet. */
        val fastestTime: Int,
        val streak: Int,
        val bestStreak: Int,
    )

    data class Line(val label: String, val value: String)

    data class Panels(
        val guessDistribution: Boolean,
        val solveTime: Boolean,
        val topWords: Boolean,
        val openerYield: Boolean,
        val positionAccuracy: Boolean,
        val stageBreakdown: Boolean,
    )

    /** "-" for none, "45s", "2m", "2m 5s" — the grid's compact time (never "0s"). */
    fun statTime(seconds: Int): String {
        if (seconds <= 0) return "-"
        if (seconds < 60) return "${seconds}s"
        val m = seconds / 60; val s = seconds % 60
        return if (s > 0) "${m}m ${s}s" else "${m}m"
    }

    fun winRatePct(wins: Int, totalGames: Int): Int =
        if (totalGames > 0) Math.round(wins.toDouble() / totalGames * 100).toInt() else 0

    private fun defaultLines(t: Totals, semantics: String, guessBase: Int): List<Line> {
        val best = if (t.bestScore > 0) {
            if (semantics == "guesses") t.bestScore.toString() else formatGuessStat(semantics, guessBase, t.bestScore)
        } else "-"
        return listOf(
            Line("Wins", t.wins.toString()),
            Line("Losses", t.losses.toString()),
            Line("Games", t.totalGames.toString()),
            Line("Win Rate", "${winRatePct(t.wins, t.totalGames)}%"),
            Line("Best", best),
            Line("Fastest", statTime(t.fastestTime)),
            Line("Streak", t.streak.toString()),
            Line("Best Streak", t.bestStreak.toString()),
        )
    }

    private val WORD_PANELS = Panels(guessDistribution = true, solveTime = true, topWords = true, openerYield = true, positionAccuracy = true, stageBreakdown = false)
    private val CUSTOM_PANELS = Panels(guessDistribution = false, solveTime = true, topWords = false, openerYield = false, positionAccuracy = false, stageBreakdown = false)
    private val GAUNTLET_PANELS = Panels(guessDistribution = false, solveTime = true, topWords = true, openerYield = true, positionAccuracy = true, stageBreakdown = true)

    fun lines(dbKey: String, totals: Totals, semantics: String = "guesses", guessBase: Int = 1): List<Line> =
        defaultLines(totals, semantics, guessBase)

    fun panels(dbKey: String, semantics: String = "guesses"): Panels =
        if (dbKey == "GAUNTLET") GAUNTLET_PANELS else if (semantics == "guesses") WORD_PANELS else CUSTOM_PANELS
}
