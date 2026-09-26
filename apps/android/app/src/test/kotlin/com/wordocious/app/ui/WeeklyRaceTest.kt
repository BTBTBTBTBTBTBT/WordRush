package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** Mirrors apps/web/lib/weekly-race.ts ordinal() — the banner and the Stats card say the same words. */
class WeeklyRaceTest {
    @Test
    fun ordinalsIncludingTheTeens() {
        assertEquals("1st", ordinal(1))
        assertEquals("2nd", ordinal(2))
        assertEquals("3rd", ordinal(3))
        assertEquals("4th", ordinal(4))
        assertEquals("11th", ordinal(11))
        assertEquals("12th", ordinal(12))
        assertEquals("13th", ordinal(13))
        assertEquals("21st", ordinal(21))
        assertEquals("22nd", ordinal(22))
        assertEquals("103rd", ordinal(103))
        assertEquals("111th", ordinal(111))
    }

    @Test
    fun weekSpanReadsMondayThroughSunday() {
        assertEquals("Sep 15–Sep 21", weekSpanLabel("2026-09-15"))
        assertEquals("Sep 28–Oct 4", weekSpanLabel("2026-09-28"))
    }
}
