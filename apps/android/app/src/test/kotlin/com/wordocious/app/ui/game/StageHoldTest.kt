package com.wordocious.app.ui.game

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC AU3 / AU2. */
class StageHoldTest {
    @Test fun stageCardStaysUpAtLeastFiveSeconds() {
        assertTrue(GauntletLook.stageHoldMs(isVersus = false) >= 5000)
        assertEquals(5000, GauntletLook.stageHoldMs(isVersus = true)) // founder 10-02: VS = solo
    }

    @Test fun compactRankLineHasNoDuplicates() {
        assertEquals("of 5 · 2,005 pts · 4 guesses · 48s", com.wordocious.app.ui.compactRankLine(5, false, "2,005", "Solved in 4 guesses · 48s"))
        assertEquals("of 3 friends · 1 mistake · 1m 2s", com.wordocious.app.ui.compactRankLine(3, true, null, "Solved · 1 mistake · 1m 2s"))
        assertEquals("of 9", com.wordocious.app.ui.compactRankLine(9, false, null, null))
    }
}
