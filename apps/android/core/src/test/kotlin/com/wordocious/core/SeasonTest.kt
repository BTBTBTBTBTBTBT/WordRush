package com.wordocious.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDate

/** FINISH_SPEC X: the Halloween window is Oct 24 – Nov 1 inclusive, every year (local date). */
class SeasonTest {
    @Test fun halloweenWindowEdges() {
        for (year in listOf(2025, 2026, 2027, 2028)) {
            assertNull(currentSeason(LocalDate.of(year, 10, 23)))
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
        assertEquals(9, inSeason) // Oct 24..31 (8) + Nov 1
    }

    @Test fun stringOverload() {
        assertEquals("halloween", currentSeason("2026-10-24"))
        assertEquals("halloween", currentSeason("2026-11-01T00:00:00"))
        assertNull(currentSeason("2026-10-02"))
        assertNull(currentSeason("not a date"))
    }
}
