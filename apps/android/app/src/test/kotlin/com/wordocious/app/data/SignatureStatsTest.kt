package com.wordocious.app.data

import org.junit.Assert.assertEquals
import org.junit.Test

/** Mirrors apps/web/lib/signature-stats.test.ts — the same rows, the same four facts and the same trend. */
class SignatureStatsTest {
    @Test
    fun bestDayBestWeekComebacksAndPerfects() {
        val rows = listOf(
            SignatureStats.MatchFact("2026-09-21", "DUEL", won = true, guessCount = 6),      // Mon — comeback
            SignatureStats.MatchFact("2026-09-21", "QUORDLE", won = true, guessCount = 4),   // perfect (base 4)
            SignatureStats.MatchFact("2026-09-22", "DUEL", won = true, guessCount = 1),      // perfect
            SignatureStats.MatchFact("2026-09-22", "DUEL_6", won = false, guessCount = 7),
            SignatureStats.MatchFact("2026-09-28", "DUEL", won = true, guessCount = 3),      // next week
        )
        val s = SignatureStats.computeSignature(rows)
        assertEquals(SignatureStats.DayWins("2026-09-21", 2), s.bestDay)
        assertEquals(SignatureStats.WeekWins("2026-09-21", 3), s.bestWeek)
        assertEquals(1, s.comebacks)
        assertEquals(2, s.perfectGames)
    }

    @Test
    fun weekStartIsTheMonday() {
        assertEquals("2026-09-21", SignatureStats.localWeekStartOf("2026-09-21"))
        assertEquals("2026-09-21", SignatureStats.localWeekStartOf("2026-09-27"))
        assertEquals("2026-09-28", SignatureStats.localWeekStartOf("2026-09-28"))
    }

    @Test
    fun standingTrendAveragesTheBadgePercentilePerDayAndSkipsOnePlayerFields() {
        val mine = listOf(
            SignatureStats.DailyRow("2026-09-25", "DUEL", 900.0),
            SignatureStats.DailyRow("2026-09-25", "QUORDLE", 500.0),
            SignatureStats.DailyRow("2026-09-26", "DUEL", 100.0),
        )
        val field = mine + listOf(
            SignatureStats.DailyRow("2026-09-25", "DUEL", 950.0),
            SignatureStats.DailyRow("2026-09-25", "DUEL", 800.0),
            SignatureStats.DailyRow("2026-09-25", "DUEL", 700.0),
            SignatureStats.DailyRow("2026-09-25", "QUORDLE", 400.0),
        )
        val t = SignatureStats.computeStandingTrend(mine, field)
        // DUEL: 1 better of 4 → Top 25%; QUORDLE: 0 better of 2 → Top 1%; avg 13. 09-26 has a field of one → skipped.
        assertEquals(listOf(SignatureStats.StandingPoint("2026-09-25", 13, 2)), t)
    }
}
