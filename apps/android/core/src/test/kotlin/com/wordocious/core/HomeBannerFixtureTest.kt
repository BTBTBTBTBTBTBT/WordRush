package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-platform parity guard for the home banner words (home redesign,
 * 2026-10-01): headline, clock line, row status and streaks must match
 * packages/core/src/home-banner.ts exactly, or the three platforms would
 * greet the same player differently.
 */
class HomeBannerFixtureTest {
    private fun loadFixture(name: String): String =
        javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    private data class G(val played: Int, val won: Int, val total: Int) {
        fun p() = GroupProgress(played, won, total)
    }
    private data class Headline(val word: G, val puzzles: G, val hour: Int, val name: String, val unlimited: Boolean, val headline: String)
    private data class Clock(val word: G, val puzzles: G, val clock: String, val unlimited: Boolean, val line: String)
    private data class Group(val group: G, val tier: String, val status: String)
    private data class D(val played: Int, val won: Int)
    private data class Streak(val days: Map<String, D>, val total: Int, val today: String, val sweep: Int, val flawless: Int)
    private data class Totals(val days: Map<String, D>, val total: Int, val sweepDays: Int, val flawlessDays: Int, val bestSweep: Int, val bestFlawless: Int)
    private data class StreakLine(val kind: String, val days: Int, val best: Int, val dateKey: String, val line: String?)
    private data class RS(val sweep: Int, val flawless: Int, val bestSweep: Int?, val bestFlawless: Int?) {
        fun r() = RowStreaks(sweep, flawless, bestSweep ?: 0, bestFlawless ?: 0)
    }
    private data class StreaksIn(val word: RS, val puzzles: RS)
    private data class WithStreaks(val word: G, val puzzles: G, val hour: Int, val name: String, val streaks: StreaksIn, val dateKey: String, val headline: String)
    private data class Fixtures(val headlines: List<Headline>, val clocks: List<Clock>, val groups: List<Group>, val streaks: List<Streak>, val totals: List<Totals>,
                                val streakLines: List<StreakLine>, val withStreaks: List<WithStreaks>)

    private val f: Fixtures by lazy { Gson().fromJson(loadFixture("home-banner-fixtures.json"), Fixtures::class.java) }

    @Test
    fun headlines_match_shared_fixtures() {
        assertTrue(f.headlines.isNotEmpty())
        for (c in f.headlines) {
            assertEquals("headline $c", c.headline, bannerHeadline(c.word.p(), c.puzzles.p(), c.hour, c.name, c.unlimited))
        }
    }

    @Test
    fun streak_lines_match_shared_fixtures() {
        assertTrue(f.streakLines.isNotEmpty())
        for (c in f.streakLines) {
            val k = if (c.kind == "flawless") StreakHeadline.Kind.FLAWLESS else StreakHeadline.Kind.SWEEP
            assertEquals("streak $c", c.line, StreakHeadline.line(k, c.days, c.best, c.dateKey))
        }
        for (c in f.withStreaks) {
            assertEquals("banner $c", c.headline,
                bannerHeadline(c.word.p(), c.puzzles.p(), c.hour, c.name, false, c.streaks.word.r(), c.streaks.puzzles.r(), c.dateKey))
        }
    }

    @Test
    fun clock_lines_match_shared_fixtures() {
        assertTrue(f.clocks.isNotEmpty())
        for (c in f.clocks) {
            assertEquals("clock $c", c.line, bannerClockLine(c.word.p(), c.puzzles.p(), c.clock, c.unlimited))
        }
    }

    @Test
    fun groups_match_shared_fixtures() {
        assertTrue(f.groups.isNotEmpty())
        for (c in f.groups) {
            assertEquals("tier $c", c.tier, groupTier(c.group.p()).raw)
            assertEquals("status $c", c.status, groupStatus(c.group.p()))
        }
    }

    @Test
    fun streaks_match_shared_fixtures() {
        assertTrue(f.streaks.isNotEmpty())
        for (c in f.streaks) {
            val days = c.days.mapValues { DayTally(it.value.played, it.value.won) }
            val s = dayStreaks(days, c.total, c.today)
            assertEquals("sweep ${c.today} ${c.total}", c.sweep, s.sweep)
            assertEquals("flawless ${c.today} ${c.total}", c.flawless, s.flawless)
            assertEquals(c.flawless, groupStreak(BannerTier.FLAWLESS, s))
            assertEquals(c.sweep, groupStreak(BannerTier.SWEEP, s))
        }
    }

    @Test
    fun day_run_totals_match_shared_fixtures() {
        assertTrue(f.totals.isNotEmpty())
        for (c in f.totals) {
            val days = c.days.mapValues { DayTally(it.value.played, it.value.won) }
            assertEquals("totals ${c.total} ${c.days.keys}", DayRunTotals(c.sweepDays, c.flawlessDays, c.bestSweep, c.bestFlawless), dayRunTotals(days, c.total))
        }
    }

    @Test
    fun shift_day_crosses_month_and_year() {
        assertEquals("2026-03-01", shiftDay("2026-02-28", 1))
        assertEquals("2025-12-31", shiftDay("2026-01-01", -1))
        assertEquals("2024-02-29", shiftDay("2024-03-01", -1))
        assertEquals("5 PLAYED TODAY", unlimitedGroupStatus(5))
    }
}
