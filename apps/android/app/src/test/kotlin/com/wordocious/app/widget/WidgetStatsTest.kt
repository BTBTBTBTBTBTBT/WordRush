package com.wordocious.app.widget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Calendar
import java.util.TimeZone

/** FINISH_SPEC AL: the widget's solved / points / countdown math and labels. */
class WidgetStatsTest {

    private fun mode(key: String, played: Boolean, won: Boolean = played) =
        WidgetBridge.ModeEntry(key = key, title = key, glyph = "W", colorHex = "#7C3AED", played = played, won = won)

    private fun snap(day: String, wordPlayed: Int, puzzlesPlayed: Int, points: Int?, puzzlePoints: Int?, rank: Int? = 3) =
        WidgetBridge.Snapshot(
            day = day, streak = 12,
            modes = (0 until 8).map { mode("w$it", it < wordPlayed, won = it % 2 == 0) },
            points = points, seconds = 300, shields = 2,
            puzzles = (0 until 10).map { mode("p$it", it < puzzlesPlayed) },
            puzzlePoints = puzzlePoints, rank = rank,
        )

    @Test
    fun countsEveryDailyAndSumsBothRowsPoints() {
        val s = WidgetStats.dayStats(snap("2026-10-02", 5, 2, 3_000, 420), "2026-10-02")
        assertEquals(7, s.played)          // a loss counts as played, like Home's progress
        assertEquals(18, s.total)
        assertEquals(3_420, s.points)
        assertEquals("7/18", WidgetStats.solvedLabel(s))
        assertEquals("3,420", WidgetStats.pointsLabel(s.points))
    }

    @Test
    fun noGamesYetReadsZeroNotHidden() {
        val s = WidgetStats.dayStats(snap("2026-10-02", 0, 0, null, null), "2026-10-02")
        assertEquals(WidgetStats.DayStats(0, 18, 0), s)
        assertEquals("0/18", WidgetStats.solvedLabel(s))
        assertEquals("0", WidgetStats.pointsLabel(s.points))
    }

    @Test
    fun aStaleDayReadsAsZeros() {
        val s = WidgetStats.dayStats(snap("2026-10-01", 8, 10, 9_999, 5_000), "2026-10-02")
        assertEquals(WidgetStats.DayStats(0, 18, 0), s)
    }

    @Test
    fun midnightRolloverResetsTheDayButKeepsTheStreak() {
        val old = snap("2026-10-01", 8, 10, 9_999, 5_000)
        val rolled = WidgetStats.rollover(old, "2026-10-02")
        assertEquals("2026-10-02", rolled.day)
        assertTrue(rolled.modes.none { it.played || it.won })
        assertTrue(rolled.puzzles!!.none { it.played || it.won })
        assertEquals(0, rolled.points); assertEquals(0, rolled.puzzlePoints); assertEquals(0, rolled.seconds)
        assertNull(rolled.rank)
        assertEquals(12, rolled.streak); assertEquals(2, rolled.shields)
        assertEquals(WidgetStats.DayStats(0, 18, 0), WidgetStats.dayStats(rolled, "2026-10-02"))
        // Same day: untouched.
        val today = snap("2026-10-02", 3, 1, 100, 50)
        assertTrue(WidgetStats.rollover(today, "2026-10-02") === today)
    }

    @Test
    fun pointsAreSumOfRounds() {
        // 1.5 + 1.5 rounds to 2 + 2 = 4 per mode (never round(3.0) = 3), the app's rule.
        assertEquals(4, WidgetStats.pointsSum(listOf(1.5, 1.5)))
        assertEquals(0, WidgetStats.pointsSum(emptyList()))
        assertEquals(1_235, WidgetStats.pointsSum(listOf(1_000.4, 234.6)))
    }

    @Test
    fun talkBackPhrases() {
        val s = WidgetStats.DayStats(5, 18, 3_420)
        assertEquals("5 of 18 puzzles solved today", WidgetStats.solvedPhrase(s))
        assertEquals("3,420 points today", WidgetStats.pointsPhrase(3_420))
        assertEquals("1 point today", WidgetStats.pointsPhrase(1))
        assertEquals("12 day streak", WidgetStats.streakPhrase(12))
        assertEquals("1,234,567", WidgetStats.pointsLabel(1_234_567))
    }

    @Test
    fun countdownTargetsTheNextLocalMidnight() {
        val tz = TimeZone.getTimeZone("America/New_York")
        val now = Calendar.getInstance(tz).apply { clear(); set(2026, Calendar.OCTOBER, 2, 16, 17, 50) }
        assertEquals((7 * 3600 + 42 * 60 + 10) * 1000L, WidgetStats.msToMidnight(now))
        val mid = Calendar.getInstance(tz).apply { timeInMillis = WidgetStats.nextLocalMidnightMillis(now) }
        assertEquals(3, mid.get(Calendar.DAY_OF_MONTH))
        assertEquals(0, mid.get(Calendar.HOUR_OF_DAY))
        // Exactly midnight: the next one is a full day away (always > 0).
        val atMidnight = Calendar.getInstance(tz).apply { clear(); set(2026, Calendar.OCTOBER, 3, 0, 0, 0) }
        assertEquals(24 * 3600 * 1000L, WidgetStats.msToMidnight(atMidnight))
    }
}
