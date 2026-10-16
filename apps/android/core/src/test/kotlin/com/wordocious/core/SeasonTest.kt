package com.wordocious.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import com.google.gson.Gson
import java.time.LocalDate

/** FINISH_SPEC X: the Halloween window is Oct 9 – Oct 31 inclusive, every year (local date). */
class SeasonTest {
    @Test fun halloweenWindowEdges() {
        for (year in listOf(2025, 2026, 2027, 2028)) {
            assertNull(currentSeason(LocalDate.of(year, 10, 8)))
            assertEquals("halloween", currentSeason(LocalDate.of(year, 10, 9)))
            assertEquals("halloween", currentSeason(LocalDate.of(year, 10, 24)))
            assertEquals("halloween", currentSeason(LocalDate.of(year, 10, 31)))
            assertNull(currentSeason(LocalDate.of(year, 11, 1)))
        }
    }

    @Test fun everyDayOfTheYearOutsideTheWindowIsNull() {
        var d = LocalDate.of(2028, 1, 1) // a leap year
        var inSeason = 0
        while (d.year == 2028) {
            if (currentSeason(d) != null) inSeason++
            d = d.plusDays(1)
        }
        assertEquals(23, inSeason) // Oct 9..31
    }

    @Test fun stringOverload() {
        assertEquals("halloween", currentSeason("2026-10-24"))
        assertEquals("halloween", currentSeason("2026-10-31T00:00:00"))
        assertNull(currentSeason("2026-11-01T00:00:00"))
        assertNull(currentSeason("2026-10-02"))
        assertNull(currentSeason("not a date"))
    }

    /** Founder 10-16: Thanksgiving Nov 14 – Nov 29 by the calendar; a NOT-READY season never activates for the public. */
    @Test fun thanksgivingWindowAndReadyGate() {
        assertEquals("halloween", calendarSeason(LocalDate.of(2026, 10, 31)))
        assertNull(calendarSeason(LocalDate.of(2026, 11, 1)))
        assertNull(calendarSeason(LocalDate.of(2026, 11, 13)))
        assertEquals("thanksgiving", calendarSeason(LocalDate.of(2026, 11, 14)))
        assertEquals("thanksgiving", calendarSeason(LocalDate.of(2026, 11, 26)))
        assertEquals("thanksgiving", calendarSeason(LocalDate.of(2026, 11, 29)))
        assertNull(calendarSeason(LocalDate.of(2026, 11, 30)))
        assertFalse(Season.isReady(Season.THANKSGIVING))
        assertTrue(Season.isReady(Season.HALLOWEEN))
        assertFalse(Season.isReady("bogus"))
        for (day in listOf("2026-11-14", "2026-11-20", "2026-11-26", "2026-11-29")) {
            assertEquals(day, "thanksgiving", calendarSeason(day))
            assertNull("not-ready season must stay off: $day", currentSeason(day))
        }
        assertEquals("halloween", currentSeason("2026-10-31"))
        // The admin picker (SeasonSkins.pick validates against Season.ids) accepts every window, ready or not.
        assertEquals(listOf("halloween", "thanksgiving"), Season.ids)
    }

    private data class DayCase(val date: String, val season: String?, val calendar: String?)
    private data class WindowRow(val id: String, val start: List<Int>, val end: List<Int>, val ready: Boolean)
    private data class Fixtures(val days: List<DayCase>, val windows: List<WindowRow>)

    /** Parity: packages/core SEASON_WINDOWS + currentSeason / calendarSeason (level-season-fixtures.json `days` + `windows`). */
    @Test fun matchesSharedFixture() {
        val raw = javaClass.classLoader!!.getResource("fixtures/level-season-fixtures.json")!!.readText(Charsets.UTF_8)
        val f = Gson().fromJson(raw, Fixtures::class.java)
        for (c in f.days) {
            assertEquals(c.date, c.season, currentSeason(c.date))
            assertEquals(c.date, c.calendar, calendarSeason(c.date))
        }
        assertEquals(f.windows.map { listOf(it.id, it.start, it.end, it.ready) },
            Season.windows.map { listOf(it.id, listOf(it.startMonth, it.startDay), listOf(it.endMonth, it.endDay), it.ready) })
    }
}
