package com.wordocious.app.data

import com.wordocious.app.data.PendingRecords.Part
import com.wordocious.app.data.PendingRecords.WriteOutcome
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The pending-queue decisions behind GameResultsService.record(): a write that
 * timed out (ktor, socket, or a coroutine withTimeout) is NEVER settled; only a
 * landed write or a permanently rejected daily row settles its part; queued
 * payloads surface as today's completions for Home.
 */
class PendingRecordsDecisionTest {

    private fun payload(
        mode: String = "SCRAMBLE", seed: String = "daily-2026-10-02-SCRAMBLE", won: Boolean = true,
        guessCount: Int = 7, timeSeconds: Int = 140, totalBoards: Int = 5, userId: String = "u1",
        dailyDone: Boolean = false,
    ) = PendingRecords.Payload(
        userId = userId, gameModeName = mode, seed = seed, savedAt = 0L, won = won,
        guessCount = guessCount, timeSeconds = timeSeconds, boardsSolved = if (won) totalBoards else 0,
        totalBoards = totalBoards, solutions = emptyList(), guesses = emptyList(), hintsUsed = 0,
        dailyDone = dailyDone,
    )

    private fun timeoutCancellation(): TimeoutCancellationException = runBlocking {
        try { withTimeout(1) { delay(1_000) }; error("no timeout") } catch (e: TimeoutCancellationException) { e }
    }

    @Test
    fun anyThrowableIsPendingOnlySuccessLands() {
        assertEquals(WriteOutcome.LANDED, PendingRecords.outcomeOf(null))
        val errors = listOf(
            io.ktor.client.plugins.HttpRequestTimeoutException("https://x/rest/v1/daily_results", 15_000L),
            java.net.SocketTimeoutException("timeout"),
            timeoutCancellation(),
            kotlinx.coroutines.CancellationException("left the screen"),
            IllegalStateException("5xx"),
        )
        for (e in errors) assertEquals(e::class.simpleName, WriteOutcome.PENDING, PendingRecords.outcomeOf(e))
    }

    @Test
    fun timedOutWritesLeaveThePayloadQueued() = with(PendingRecords) {
        // Outage: matches landed, user_stats / profiles / daily_results timed out.
        val p = payload()
            .after(Part.STATS, outcomeOf(java.net.SocketTimeoutException()))
            .after(Part.MATCH, outcomeOf(null))
            .after(Part.XP, outcomeOf(timeoutCancellation()))
            .after(Part.DAILY, outcomeOf(io.ktor.client.plugins.HttpRequestTimeoutException("u", 15_000L)))
        assertEquals(setOf(Part.STATS, Part.XP, Part.DAILY), p.outstandingParts())
        assertFalse(p.allDone())
        // Next drain lands everything → released.
        val done = p.after(Part.STATS, WriteOutcome.LANDED).after(Part.XP, WriteOutcome.LANDED)
            .after(Part.DAILY, WriteOutcome.LANDED)
        assertTrue(done.allDone())
    }

    @Test
    fun unlimitedSeedHasNoDailyPart() = with(PendingRecords) {
        val p = payload(seed = "unl-123").after(Part.STATS, WriteOutcome.LANDED)
            .after(Part.MATCH, WriteOutcome.LANDED).after(Part.XP, WriteOutcome.LANDED)
        assertTrue(p.allDone())
    }

    @Test
    fun rejectedDailySettlesItsPart() = with(PendingRecords) {
        // Implausible: SCRAMBLE win in 3 s / 2 guesses (floor 5 guesses, 12 s).
        assertTrue(dailyPermanentlyRejected("SCRAMBLE", true, 2, 3, 5))
        // Unknown mode: no DailyScoring config.
        assertTrue(dailyPermanentlyRejected("NOT_A_MODE", false, 3, 60, 1))
        assertFalse(dailyPermanentlyRejected("SCRAMBLE", true, 7, 140, 5))
        val p = payload().after(Part.DAILY, WriteOutcome.REJECTED)
        assertFalse(Part.DAILY in p.outstandingParts())
    }

    @Test
    fun queuedPayloadsBecomeTodaysCompletions() {
        val today = "2026-10-02"
        val payloads = listOf(
            payload(),                                                           // today, unconfirmed → counts
            payload(mode = "DUEL", seed = "daily-2026-10-01-DUEL", totalBoards = 1), // yesterday → no
            payload(mode = "HUB", seed = "daily-2026-10-02-HUB", dailyDone = true),   // row confirmed → no
            payload(mode = "LADDER", seed = "daily-2026-10-02-LADDER", userId = "other", totalBoards = 1), // other account
            payload(mode = "SUDOKU", seed = "unl-9"),                             // unlimited → no
        )
        val q = PendingRecords.todayCompletions(payloads, "U1", today)
        assertEquals(setOf("SCRAMBLE"), q.keys)
        assertTrue(q.getValue("SCRAMBLE").completed)
        assertTrue(q.getValue("SCRAMBLE").score > 0.0)
    }

    @Test
    fun mergeNeverDowngradesAServerWin() {
        val c = { m: String, won: Boolean -> DailyCompletionsService.Completion(m, won, 5, 100, if (won) 1000.0 else 0.0) }
        val server = mapOf("DUEL" to c("DUEL", true), "QUORDLE" to c("QUORDLE", false))
        val queued = mapOf("DUEL" to c("DUEL", false), "QUORDLE" to c("QUORDLE", true), "SCRAMBLE" to c("SCRAMBLE", true))
        val m = PendingRecords.mergeCompletions(server, queued)
        assertTrue(m.getValue("DUEL").completed)
        assertTrue(m.getValue("QUORDLE").completed)
        assertTrue("SCRAMBLE" in m)
    }
}
