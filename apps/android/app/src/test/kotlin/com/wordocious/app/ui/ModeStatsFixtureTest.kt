package com.wordocious.app.ui

import com.wordocious.app.data.ModeStats
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Mode-stats parity guard (Android side): ModeStats.lines / panels must match
 * the web registry (lib/mode-stats.ts) for every fixture case, so the profile
 * grid reads the same on every platform. Regenerate: apps/server/node_modules/.bin/tsx apps/web/scripts/gen-mode-stats-fixtures.ts
 */
class ModeStatsFixtureTest {
    @Serializable private data class Totals(val wins: Int, val losses: Int, val totalGames: Int, val bestScore: Int, val fastestTime: Int, val streak: Int, val bestStreak: Int)
    @Serializable private data class Line(val label: String, val value: String)
    @Serializable private data class Panels(val guessDistribution: Boolean, val solveTime: Boolean, val topWords: Boolean, val openerYield: Boolean, val positionAccuracy: Boolean, val stageBreakdown: Boolean)
    @Serializable private data class Case(val dbKey: String, val semantics: String, val guessBase: Int, val totals: Totals, val lines: List<Line>, val panels: Panels)

    @Test
    fun mode_stats_match_shared_fixtures() {
        val text = javaClass.classLoader!!.getResource("fixtures/mode-stats-fixtures.json")!!.readText()
        val cases: List<Case> = Json { ignoreUnknownKeys = true }.decodeFromString(text)
        assertTrue(cases.isNotEmpty())
        for (c in cases) {
            val t = ModeStats.Totals(c.totals.wins, c.totals.losses, c.totals.totalGames, c.totals.bestScore, c.totals.fastestTime, c.totals.streak, c.totals.bestStreak)
            val got = ModeStats.lines(c.dbKey, t, c.semantics, c.guessBase)
            assertEquals("lines(${c.dbKey})", c.lines.map { it.label to it.value }, got.map { it.label to it.value })
            val p = ModeStats.panels(c.dbKey, c.semantics)
            assertEquals("panels(${c.dbKey})",
                listOf(c.panels.guessDistribution, c.panels.solveTime, c.panels.topWords, c.panels.openerYield, c.panels.positionAccuracy, c.panels.stageBreakdown),
                listOf(p.guessDistribution, p.solveTime, p.topWords, p.openerYield, p.positionAccuracy, p.stageBreakdown))
        }
    }
}
