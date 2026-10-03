package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The Stats page order through the shared picker (FINISH_SPEC C3). */
class StatsPageOrderTest {
    private val words = listOf("DUEL", "GAUNTLET", "QUORDLE", "DUEL_7")
    private val puzzles = listOf("SUDOKU", "LADDER")

    @Test
    fun orderIsTodayAllTimeThenWordsSweepPuzzles() {
        assertEquals(
            listOf(RAIL_TODAY, RAIL_ALL, "DUEL", "GAUNTLET", "QUORDLE", "DUEL_7", RAIL_SWEEP, "SUDOKU", "LADDER"),
            statsPageOrder(words, puzzles),
        )
        assertEquals(listOf(RAIL_TODAY, RAIL_ALL, "DUEL", "SUDOKU"), statsPageOrder(listOf("DUEL"), listOf("SUDOKU"), withSweep = false))
    }

    @Test
    fun swipeMovesOneItemAndStopsAtTheEnds() {
        val order = statsPageOrder(words, puzzles)
        assertEquals(RAIL_ALL, statsSwipeTarget(order, RAIL_TODAY, forward = true))
        assertEquals("DUEL", statsSwipeTarget(order, RAIL_ALL, forward = true))
        assertEquals(RAIL_SWEEP, statsSwipeTarget(order, "DUEL_7", forward = true))
        assertEquals("SUDOKU", statsSwipeTarget(order, RAIL_SWEEP, forward = true))
        assertNull(statsSwipeTarget(order, RAIL_TODAY, forward = false))
        assertNull(statsSwipeTarget(order, "LADDER", forward = true))
        assertNull(statsSwipeTarget(order, "UNKNOWN", forward = true))
    }
}
