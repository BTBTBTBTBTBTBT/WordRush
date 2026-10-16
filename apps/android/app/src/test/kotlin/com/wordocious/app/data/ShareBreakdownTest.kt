package com.wordocious.app.data

import com.wordocious.core.GameMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** The share card's SCORE BREAKDOWN panel reads the same shared DailyScoring numbers as the finished screen. */
class ShareBreakdownTest {
    @Test
    fun theTotalIsTheRecordedComposite() {
        val i = ShareBreakdown.Input(GameMode.DUEL, true, 3, 134, 1, 1, 0, day = "2026-10-16")
        val b = DailyScoring.breakdown("DUEL", true, 3, 134, 1, 1, 0, null, null, "2026-10-16")
        val r = ShareBreakdown.rows(i)
        assertEquals(b.total.toInt(), r.total)
        assertEquals("Win bonus", r.rows.first().label)
        assertEquals(b.basePoints, r.rows.first().value, 0.0)
        assertTrue(r.rows.any { it.label == "Speed bonus" })
        assertTrue(r.rows.any { it.label == "Completion bonus" })
    }

    @Test
    fun aLossReadsDidNotFinishWithoutWinRows() {
        val r = ShareBreakdown.rows(ShareBreakdown.Input(GameMode.DUEL, false, 6, 241, 0, 1, 0, bestCorrectLetters = 2, day = "2026-10-16"))
        assertEquals("Did not finish", r.rows.first().label)
        assertTrue(r.rows.none { it.label == "Win bonus" || it.label == "Speed bonus" })
        assertTrue(r.rows.any { it.label == "Near miss" })
    }
}
