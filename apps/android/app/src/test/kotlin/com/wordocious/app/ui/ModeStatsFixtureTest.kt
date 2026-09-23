package com.wordocious.app.ui

import com.wordocious.app.data.ModeStats
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Mode-stats parity guard (Android side): ModeStats.modeAggregates / statLines /
 * statPanels must match the web registry (lib/mode-stats.ts) for every fixture
 * case, so the profile grid reads the same on every platform. Regenerate:
 * apps/server/node_modules/.bin/tsx apps/web/scripts/gen-mode-stats-fixtures.ts
 */
class ModeStatsFixtureTest {
    @Serializable private data class Totals(val wins: Int, val losses: Int, val totalGames: Int, val bestScore: Int, val fastestTime: Int, val streak: Int, val bestStreak: Int)
    @Serializable private data class Line(val label: String, val value: String)
    @Serializable private data class Panels(val guessDistribution: Boolean, val solveTime: Boolean, val topWords: Boolean, val openerYield: Boolean, val positionAccuracy: Boolean, val stageBreakdown: Boolean)
    @Serializable private data class Case(
        val dbKey: String,
        val semantics: String,
        val guessBase: Int,
        val totals: Totals,
        val matches: List<ModeStats.MatchRow> = emptyList(),
        val aggregates: ModeStats.ModeAggregates? = null,
        val lines: List<Line>,
        val panels: Panels,
    )

    private fun load(): List<Case> {
        val text = javaClass.classLoader!!.getResource("fixtures/mode-stats-fixtures.json")!!.readText()
        return Json { ignoreUnknownKeys = true }.decodeFromString(text)
    }

    @Test
    fun mode_stats_match_shared_fixtures() {
        val cases = load()
        assertTrue(cases.isNotEmpty())
        for (c in cases) {
            val t = ModeStats.Totals(c.totals.wins, c.totals.losses, c.totals.totalGames, c.totals.bestScore, c.totals.fastestTime, c.totals.streak, c.totals.bestStreak)
            val agg = ModeStats.modeAggregates(c.dbKey, c.matches, c.guessBase)
            c.aggregates?.let { assertEquals("aggregates(${c.dbKey})", it, agg) }
            val got = ModeStats.statLines(c.dbKey, t, c.semantics, c.guessBase, agg)
            assertEquals("lines(${c.dbKey})", c.lines.map { it.label to it.value }, got.map { it.label to it.value })
            val p = ModeStats.statPanels(c.dbKey, c.semantics)
            assertEquals("panels(${c.dbKey})",
                listOf(c.panels.guessDistribution, c.panels.solveTime, c.panels.topWords, c.panels.openerYield, c.panels.positionAccuracy, c.panels.stageBreakdown),
                listOf(p.guessDistribution, p.solveTime, p.topWords, p.openerYield, p.positionAccuracy, p.stageBreakdown))
        }
    }

    @Test
    fun every_custom_game_has_an_empty_case_and_a_matches_case() {
        val cases = load()
        for (key in listOf("SUDOKU", "REGIONS", "LADDER", "SCRAMBLE", "WORDSEARCH", "HUB", "CROSSWORD", "CRYPTOGRAM", "GROUPS")) {
            val mine = cases.filter { it.dbKey == key }
            assertTrue("$key empty", mine.any { it.totals.totalGames == 0 && it.matches.isEmpty() })
            assertTrue("$key matches", mine.any { it.matches.size >= 3 })
            for (c in mine) {
                assertEquals("$key has eight cells", 8, c.lines.size)
                for (l in c.lines) assertTrue("$key label \"${l.label}\" fits the grid", l.label.length <= 12)
            }
        }
    }

    @Test
    fun aggregates_are_order_independent() {
        val rows = load().first { it.dbKey == "HUB" && it.matches.isNotEmpty() }.matches
        assertEquals(ModeStats.modeAggregates("HUB", rows, 1), ModeStats.modeAggregates("HUB", rows.reversed(), 1))
    }

    @Test
    fun boards_rebuild_from_the_event_log() {
        fun row(guesses: List<String>, solutions: List<String> = emptyList(), completed: Boolean = true, guessCount: Int = 1) =
            ModeStats.MatchRow(guess_count = guessCount, completed = completed, time_seconds = 100, hints_used = 0, player1_guesses = guesses, solutions = solutions)
        assertEquals(3, ModeStats.boardsFromEvents("SCRAMBLE", row(listOf("0✓BREAD", "1✗PAGER", "1✓PAGER", "2H", "3h__N___"), guessCount = 6)))
        assertEquals(2, ModeStats.boardsFromEvents("GROUPS", row(listOf("x0:A,B,C,D", "+1:A,B,C,D", "+3:E,F,G,H"), guessCount = 5)))
        assertEquals(2, ModeStats.boardsFromEvents("WORDSEARCH", row(listOf("+CAT", "x 0,0>1,1", "?DOG", "+DOG"), guessCount = 11)))
        // Hubbub: TRAIN 5 + RETINAL 14 = 19 of 60 → floor(19 × 20 / 60) = 6.
        assertEquals(6, ModeStats.boardsFromEvents("HUB", row(listOf("+TRAIN", "=TALER", "+RETINAL"), listOf("id", "ATLNEIR", "60", "24", "2"), guessCount = 4)))
        assertEquals(1, ModeStats.boardsFromEvents("SUDOKU", row(emptyList())))
        assertEquals(0, ModeStats.boardsFromEvents("SUDOKU", row(emptyList(), completed = false, guessCount = 4)))
        // A stored boards_solved wins over the rebuild.
        val agg = ModeStats.modeAggregates("HUB", listOf(row(listOf("+TRAIN"), listOf("id", "ATLNEIR", "60"), guessCount = 3).copy(boards_solved = 15, total_boards = 20)), 1)
        assertEquals(15 to 20, agg.boardsSolved to agg.boardsTotal)
        assertEquals("-", ModeStats.avg1(0, 0))
        assertEquals("0.8", ModeStats.avg1(7, 4, 1))
        assertEquals("0.0", ModeStats.avg1(5, 5, 1))
        assertEquals("0.0", ModeStats.avg1(3, 4, 1)) // never negative
    }

    @Test
    fun leaderboard_rows_and_records_read_through_the_semantics() {
        assertEquals("4 Guesses", ModeStats.guessRowLabel("guesses", 1, 4))
        assertEquals("1 Guess", ModeStats.guessRowLabel("guesses", 1, 1))
        assertEquals("0 Mistakes", ModeStats.guessRowLabel("mistakes", 1, 1))
        assertEquals("1 Mistake", ModeStats.guessRowLabel("mistakes", 1, 2))
        assertEquals("5 Checks", ModeStats.guessRowLabel("checks", 5, 5))
        assertEquals("2 Checks", ModeStats.guessRowLabel("checks", 1, 3))
        assertEquals("2 Misses", ModeStats.guessRowLabel("misses", 10, 12))
        assertEquals("Par", ModeStats.guessRowLabel("overPar", 1, 1))
        assertEquals("+2 over par", ModeStats.guessRowLabel("overPar", 1, 3))
        assertEquals("Hubbub", ModeStats.guessRowLabel("rank", 1, 4))
        assertEquals("Fewest Guesses", ModeStats.fewestRecordLabel("guesses"))
        assertEquals("Fewest Mistakes", ModeStats.fewestRecordLabel("mistakes"))
        assertEquals("Fewest Checks", ModeStats.fewestRecordLabel("checks"))
        assertEquals("Best vs Par", ModeStats.fewestRecordLabel("overPar"))
        assertEquals("Fewest Misses", ModeStats.fewestRecordLabel("misses"))
        assertEquals("Best Rank", ModeStats.fewestRecordLabel("rank"))
        assertEquals(ModeStats.BucketRange(4, 7), ModeStats.guessDistributionRange("GROUPS"))
        assertEquals(ModeStats.BucketRange(5, 13), ModeStats.guessDistributionRange("SCRAMBLE"))
        assertNull(ModeStats.guessDistributionRange("DUEL"))
        assertEquals(ModeStats.Noun("check", "checks"), ModeStats.guessNoun("checks"))
        assertEquals("guesses", ModeStats.guessNoun("guesses").many)
    }
}
