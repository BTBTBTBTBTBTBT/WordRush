package com.wordocious.app.ui

import com.wordocious.app.data.DailyCompletionsService.Completion
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** The Today page's best-moment tile (FINISH_SPEC C3): a soft headline + the line under it. */
class BestMomentTest {
    @Test
    fun noWinsNoMoment() {
        assertNull(bestMomentParts(emptyMap()))
        assertNull(bestMomentParts(mapOf("DUEL" to Completion("DUEL", completed = false, guessCount = 6, timeSeconds = 90))))
    }

    @Test
    fun fastestWinSplitsTheTimeOut() {
        val m = bestMomentParts(mapOf("DUEL" to Completion("DUEL", completed = true, guessCount = 4, timeSeconds = 72)))!!
        assertEquals("1:12", m.big)
        assertEquals("DUEL", m.key)
        assertEquals("Fastest win · Classic", m.small)
        // The one-line form is unchanged.
        assertEquals(m.text to "DUEL", bestMomentToday(mapOf("DUEL" to Completion("DUEL", completed = true, guessCount = 4, timeSeconds = 72))))
        assertEquals("Fastest win: Classic in 1:12", m.text)
    }

    @Test
    fun perfectBeatsFastest() {
        val m = bestMomentParts(mapOf("DUEL" to Completion("DUEL", completed = true, guessCount = 1, timeSeconds = 30)))!!
        assertEquals("Perfect", m.big)
        assertEquals("Classic in 1 guess", m.small)
        assertEquals("Perfect Classic in 1 guess", m.text)
    }
}
