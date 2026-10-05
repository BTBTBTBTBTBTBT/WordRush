package com.wordocious.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import com.google.gson.Gson
import java.time.LocalDate

/** FINISH_SPEC X: the Halloween window is Oct 17 – Nov 1 inclusive, every year (local date). */
class SeasonTest {
    @Test fun halloweenWindowEdges() {
        for (year in listOf(2025, 2026, 2027, 2028)) {
            assertNull(currentSeason(LocalDate.of(year, 10, 16)))
            assertEquals("halloween", currentSeason(LocalDate.of(year, 10, 17)))
            assertEquals("halloween", currentSeason(LocalDate.of(year, 10, 24)))
            assertEquals("halloween", currentSeason(LocalDate.of(year, 10, 31)))
            assertEquals("halloween", currentSeason(LocalDate.of(year, 11, 1)))
            assertNull(currentSeason(LocalDate.of(year, 11, 2)))
        }
    }

    @Test fun everyDayOfTheYearOutsideTheWindowIsNull() {
        var d = LocalDate.of(2028, 1, 1) // a leap year
        var inSeason = 0
        while (d.year == 2028) {
            if (currentSeason(d) != null) inSeason++
            d = d.plusDays(1)
        }
        assertEquals(16, inSeason) // Oct 17..31 (15) + Nov 1
    }

    @Test fun stringOverload() {
        assertEquals("halloween", currentSeason("2026-10-24"))
        assertEquals("halloween", currentSeason("2026-11-01T00:00:00"))
        assertNull(currentSeason("2026-10-02"))
        assertNull(currentSeason("not a date"))
    }

    private data class DayCase(val date: String, val season: String?)
    private data class WindowRow(val id: String, val start: List<Int>, val end: List<Int>)
    private data class Fixtures(val days: List<DayCase>, val windows: List<WindowRow>)

    /** Parity: packages/core SEASON_WINDOWS + currentSeason (level-season-fixtures.json `days` + `windows`). */
    @Test fun matchesSharedFixture() {
        val raw = javaClass.classLoader!!.getResource("fixtures/level-season-fixtures.json")!!.readText(Charsets.UTF_8)
        val f = Gson().fromJson(raw, Fixtures::class.java)
        for (c in f.days) assertEquals(c.date, c.season, currentSeason(c.date))
        assertEquals(f.windows.map { listOf(it.id, it.start, it.end) },
            Season.windows.map { listOf(it.id, listOf(it.startMonth, it.startDay), listOf(it.endMonth, it.endDay)) })
    }
}
