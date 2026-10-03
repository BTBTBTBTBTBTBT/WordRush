package com.wordocious.app.data

import com.wordocious.app.data.HomeStreaksService.QuizAnswer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC BI17 §3: the outage-safe WOTD quiz merge (server rows + this device's history). */
class WotdQuizHistoryTest {
    private val today = "2026-10-03"

    @Test fun serverFailureUsesLocalAlone() {
        val local = mapOf(
            "2026-10-01" to WotdQuizHistory.Entry(0, true, "a"),
            "2026-10-02" to WotdQuizHistory.Entry(1, true, "b"),
            "2026-10-03" to WotdQuizHistory.Entry(2, true, "c"),
        )
        val m = WotdQuizHistory.merge(null, local, today)
        assertEquals(QuizAnswer(2, true), m.today)
        assertEquals(3, m.streak)
        assertFalse(m.serverOk)
        assertTrue(m.localOnly.isEmpty())
    }

    @Test fun serverWinsPerDayAndLocalFillsGaps() {
        val server = mapOf("2026-10-01" to QuizAnswer(0, true), "2026-10-02" to QuizAnswer(1, false))
        val local = mapOf(
            "2026-10-02" to WotdQuizHistory.Entry(2, true, "b"), // server wins: wrong
            "2026-10-03" to WotdQuizHistory.Entry(0, true, "c"), // outage answer: fills the gap
        )
        val m = WotdQuizHistory.merge(server, local, today)
        assertEquals(QuizAnswer(0, true), m.today)
        assertEquals(1, m.streak) // 10-02 was wrong on the server
        assertEquals(setOf("2026-10-03"), m.localOnly.keys)
        assertEquals(3, m.days.size)
        assertEquals(0, m.days.getValue("2026-10-02").won)
    }

    @Test fun nothingAnsweredToday() {
        val m = WotdQuizHistory.merge(mapOf("2026-10-02" to QuizAnswer(0, true)), emptyMap(), today)
        assertNull(m.today)
        assertEquals(1, m.streak) // yesterday's run still counts until today ends
        assertTrue(m.serverOk)
    }

    @Test fun pruneDropsOldDays() {
        val h = mapOf("2025-08-01" to WotdQuizHistory.Entry(0, true), "2026-10-01" to WotdQuizHistory.Entry(0, true))
        assertEquals(setOf("2026-10-01"), WotdQuizHistory.prune(h, "2025-08-29").keys)
    }
}
