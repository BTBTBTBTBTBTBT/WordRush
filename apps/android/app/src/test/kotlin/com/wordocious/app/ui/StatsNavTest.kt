package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC BJ1: no Today | All-time toggle — every view is ONE scroll, Today first, All-time beneath. */
class StatsNavTest {
    @Test fun defaultIsOverviewWithBothSections() {
        assertEquals(StatsView(null), StatsNav.DEFAULT)
        assertEquals(listOf(StatsSection.TODAY_OVERVIEW, StatsSection.ALL_TIME_OVERVIEW), StatsNav.sections(StatsNav.DEFAULT))
    }

    @Test fun aGameShowsItsTodayThenItsAllTime() {
        assertEquals(listOf(StatsSection.TODAY_GAME, StatsSection.ALL_TIME_GAME), StatsNav.sections(StatsView("QUORDLE")))
        assertEquals(listOf(StatsSection.TODAY_SWEEP, StatsSection.ALL_TIME_SWEEP), StatsNav.sections(StatsView(RAIL_SWEEP)))
        for (g in listOf(null, "DUEL", RAIL_SWEEP)) {
            val s = StatsNav.sections(StatsView(g))
            assertEquals(2, s.size)
            assertTrue(s[0].name.startsWith("TODAY_"))
            assertTrue(s[1].name.startsWith("ALL_TIME_"))
        }
    }

    @Test fun pickSwapsTheGameAndReTapClearsIt() {
        val picked = StatsNav.pick(StatsNav.DEFAULT, "SCRAMBLE")
        assertEquals(StatsView("SCRAMBLE"), picked)
        assertEquals(StatsView("OCTORDLE"), StatsNav.pick(picked, "OCTORDLE"))
        assertEquals(StatsView(null), StatsNav.pick(picked, "SCRAMBLE"))
    }

    @Test fun swipeWalksTheGames() {
        val games = listOf("DUEL", "QUORDLE", "OCTORDLE")
        assertEquals(StatsView("DUEL"), StatsNav.swipe(StatsView(null), games, forward = true))
        assertEquals(StatsView(null), StatsNav.swipe(StatsView("DUEL"), games, forward = false))
        assertNull(StatsNav.swipe(StatsView(null), games, forward = false))
        assertNull(StatsNav.swipe(StatsView("OCTORDLE"), games, forward = true))
    }

    @Test fun jumpsFromTheTodayCardAndLegacyKeys() {
        assertEquals(StatsView("DUEL"), StatsNav.jump(StatsNav.DEFAULT, "DUEL"))
        assertEquals(StatsView(null), StatsNav.jump(StatsView("DUEL"), RAIL_ALL))
        assertEquals(StatsView(null), StatsNav.jump(StatsView("DUEL"), RAIL_TODAY))
    }
}
