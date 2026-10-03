package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** FINISH_SPEC BG: Stats content = scope × game. */
class StatsNavTest {
    private val today = StatsScope.TODAY
    private val all = StatsScope.ALL_TIME

    @Test fun defaultIsTodayOverview() {
        assertEquals(StatsView(today, null), StatsNav.DEFAULT)
        assertEquals(StatsCell.TODAY_OVERVIEW, StatsNav.cell(StatsNav.DEFAULT))
    }

    @Test fun eachOfTheFourCells() {
        assertEquals(StatsCell.TODAY_OVERVIEW, StatsNav.cell(StatsView(today, null)))
        assertEquals(StatsCell.TODAY_GAME, StatsNav.cell(StatsView(today, "QUORDLE")))
        assertEquals(StatsCell.ALL_TIME_OVERVIEW, StatsNav.cell(StatsView(all, null)))
        assertEquals(StatsCell.ALL_TIME_GAME, StatsNav.cell(StatsView(all, "QUORDLE")))
        // The Sweep tile is its scope's overview.
        assertEquals(StatsCell.ALL_TIME_OVERVIEW, StatsNav.cell(StatsView(all, RAIL_SWEEP)))
    }

    @Test fun toggleKeepsTheGame() {
        val v = StatsNav.toggle(StatsView(today, "QUORDLE"), all)
        assertEquals(StatsView(all, "QUORDLE"), v)
        assertEquals(StatsCell.ALL_TIME_GAME, StatsNav.cell(v))
    }

    @Test fun pickKeepsTheScopeAndReTapClearsTheGame() {
        val picked = StatsNav.pick(StatsView(all, null), "SCRAMBLE")
        assertEquals(StatsView(all, "SCRAMBLE"), picked)
        assertEquals(StatsView(all, "OCTORDLE"), StatsNav.pick(picked, "OCTORDLE"))
        assertEquals(StatsView(all, null), StatsNav.pick(picked, "SCRAMBLE"))
    }

    @Test fun swipeChangesOnlyTheGame() {
        val games = listOf("DUEL", "QUORDLE", "OCTORDLE")
        assertEquals(StatsView(all, "DUEL"), StatsNav.swipe(StatsView(all, null), games, forward = true))
        assertEquals(StatsView(all, null), StatsNav.swipe(StatsView(all, "DUEL"), games, forward = false))
        assertNull(StatsNav.swipe(StatsView(all, null), games, forward = false))
        assertNull(StatsNav.swipe(StatsView(all, "OCTORDLE"), games, forward = true))
    }

    @Test fun jumpsFromTheTodayCard() {
        assertEquals(StatsView(today, "DUEL"), StatsNav.jump(StatsView(today, null), "DUEL"))
        assertEquals(StatsView(all, null), StatsNav.jump(StatsView(today, "DUEL"), RAIL_ALL))
    }
}
