package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** Mirrors apps/web/lib/todays-race.test.ts — the three platforms pin one ranking. */
class TodaysRaceTest {
    private fun e(username: String, points: Int, me: Boolean = false) =
        RaceEntrant(id = username, username = username, points = points, played = 0, me = me)

    @Test
    fun ranksByPointsTiesShareARankThenAlphabetical() {
        val rows = rankToday(listOf(e("Doug", 900), e("You", 1200, me = true), e("Amy", 900), e("Zed", 0)))
        assertEquals(
            listOf("You" to 1, "Amy" to 2, "Doug" to 2, "Zed" to 4),
            rows.map { it.username to it.rank },
        )
    }

    @Test
    fun statusLineLeadingBehindTiedNotStarted() {
        assertEquals("Leading by 300", raceStatusLine(rankToday(listOf(e("You", 1200, true), e("Doug", 900)))))
        assertEquals("200 behind Doug", raceStatusLine(rankToday(listOf(e("You", 700, true), e("Doug", 900), e("Amy", 1500)))))
        assertEquals("Tied with Doug", raceStatusLine(rankToday(listOf(e("You", 900, true), e("Doug", 900)))))
        assertEquals("Play a daily to join the race", raceStatusLine(rankToday(listOf(e("You", 0, true), e("Doug", 900)))))
        assertEquals("450 pts today", raceStatusLine(rankToday(listOf(e("You", 450, true)))))
    }

    @Test
    fun pointsAreUsGrouped() {
        assertEquals("Leading by 1,340", raceStatusLine(rankToday(listOf(e("You", 2240, true), e("Doug", 900)))))
        assertEquals("", raceStatusLine(rankToday(listOf(e("Doug", 900)))))
    }
}
