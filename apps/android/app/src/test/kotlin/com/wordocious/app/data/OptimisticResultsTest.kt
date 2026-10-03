package com.wordocious.app.data

import com.wordocious.app.data.LeaderboardService.LeaderboardEntry
import com.wordocious.app.data.OptimisticResults.LocalResult
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * BI19: a finished daily shows at once (Home W/L, the player's own leaderboard row), survives a
 * relaunch, and the server wins silently once it lists the player.
 */
class OptimisticResultsTest {
    private val today = "2026-10-03"
    private val me = "me-uuid"

    private fun result(mode: String = "DUEL", won: Boolean = true, score: Double = 80.0, time: Int = 90, day: String = today) =
        LocalResult(
            userId = me, day = day, gameMode = mode, completed = won, guessCount = 4,
            timeSeconds = time, score = score, username = "brian",
        )

    private fun row(id: String, score: Double, time: Int) =
        LeaderboardEntry(userId = id, compositeScore = score, timeSeconds = time, completed = true)

    @Test fun `a finish makes Home W and L visible synchronously from the local store`() {
        val store = OptimisticResults.Store(MemoryKeyValueStore())
        store.apply(result("DUEL", won = true), today)
        store.apply(result("SCRAMBLE", won = false, score = 12.0), today)
        // No suspension, no network: the very next read has both.
        val home = OptimisticResults.completionsFor(store.all(today), me, today)
        assertEquals(true, home["DUEL"]?.completed)
        assertEquals(false, home["SCRAMBLE"]?.completed)
        // Another user's / another day's results never show.
        assertTrue(OptimisticResults.completionsFor(store.all(today), "someone-else", today).isEmpty())
    }

    @Test fun `optimistic results survive a relaunch`() {
        val kv = MemoryKeyValueStore()
        OptimisticResults.Store(kv).apply(result("DUEL"), today)
        val relaunched = OptimisticResults.Store(kv)
        assertEquals(80.0, relaunched.get(me, today, "DUEL")!!.score, 0.0)
        // A past day is dropped on read.
        assertTrue(relaunched.all("2026-10-04").isEmpty())
        assertNull(OptimisticResults.Store(kv).get(me, today, "DUEL"))
    }

    @Test fun `the best result is kept`() {
        var m = OptimisticResults.applyLocalResult(emptyMap(), result(score = 80.0))
        m = OptimisticResults.applyLocalResult(m, result(score = 60.0))
        assertEquals(80.0, m.values.single().score, 0.0)
        m = OptimisticResults.applyLocalResult(m, result(won = false, score = 95.0))
        assertTrue(m.values.single().completed)
        m = OptimisticResults.applyLocalResult(m, result(score = 99.0))
        assertEquals(99.0, m.values.single().score, 0.0)
    }

    @Test fun `the leaderboard merge places the local row in rank order`() {
        val server = listOf(row("a", 95.0, 60), row("b", 80.0, 70), row("c", 80.0, 120), row("d", 40.0, 30))
        val merged = OptimisticResults.mergeLeaderboard(server, result(score = 80.0, time = 90), me)
        assertEquals(listOf("a", "b", me, "c", "d"), merged.map { it.userId })
        val mine = merged[2]
        assertTrue(mine.isOptimistic)
        assertTrue(OptimisticResults.isMe(mine, me))
        assertEquals("brian", mine.username)
        // Exact ties go after the server's rows (they were first).
        val tie = OptimisticResults.mergeLeaderboard(listOf(row("b", 80.0, 90)), result(score = 80.0, time = 90), me)
        assertEquals(listOf("b", me), tie.map { it.userId })
        // An empty board is just the player; a last place goes at the end.
        assertEquals(listOf(me), OptimisticResults.mergeLeaderboard(emptyList(), result(), me).map { it.userId })
        assertEquals(me, OptimisticResults.mergeLeaderboard(server, result(score = 1.0), me).last().userId)
        // A full page the row would fall past is left alone (the rank window covers it).
        assertEquals(server, OptimisticResults.mergeLeaderboard(server, result(score = 1.0), me, limit = 4))
    }

    @Test fun `the server copy wins once it lists the player`() {
        val server = listOf(row("a", 95.0, 60), row(me, 70.0, 100))
        val merged = OptimisticResults.mergeLeaderboard(server, result(score = 80.0), me)
        assertEquals(server, merged)
        assertFalse(merged.any { it.isOptimistic })
    }

    @Test fun `the server reconcile replaces the local row`() {
        val kv = MemoryKeyValueStore()
        val store = OptimisticResults.Store(kv)
        store.apply(result("DUEL"), today)
        store.apply(result("SCRAMBLE"), today)
        // A server copy without the player keeps it…
        store.reconcile(me, today, "DUEL", serverHasUser = false)
        assertTrue(store.get(me, today, "DUEL") != null)
        // …one with the player drops it — and only that mode.
        store.reconcile(me, today, "DUEL", serverHasUser = true)
        assertNull(store.get(me, today, "DUEL"))
        assertTrue(store.get(me, today, "SCRAMBLE") != null)
        // Persisted: a relaunch sees the reconciled state.
        assertNull(OptimisticResults.Store(kv).get(me, today, "DUEL"))
        // The board then shows the server row only.
        val server = listOf(row(me, 70.0, 100))
        assertEquals(server, OptimisticResults.mergeLeaderboard(server, store.get(me, today, "DUEL"), me))
    }

    @Test fun `the overall board gets the player's row once every sweep mode is known`() {
        val keys = setOf("DUEL", "SCRAMBLE")
        val local = OptimisticResults.applyLocalResult(emptyMap(), result("DUEL", score = 50.4, time = 60))
        val server = listOf(LeaderboardService.SweepEntry(userId = "a", totalScore = 200.0, totalTime = 100, rank = 1))
        // One mode still unknown → no row.
        assertEquals(server, OptimisticResults.mergeSweep(server, local, me, today, keys))
        // The other mode is already on the server → the row goes in, at its rank.
        val serverDone = mapOf("SCRAMBLE" to DailyCompletionsService.Completion("SCRAMBLE", true, 3, 40, 70.0))
        val merged = OptimisticResults.mergeSweep(server, local, me, today, keys, serverDone)
        assertEquals(listOf("a", me), merged.map { it.userId })
        assertEquals(120.0, merged[1].totalScore, 0.0)
        assertEquals(100, merged[1].totalTime)
        assertTrue(merged[1].isFlawless)
    }
}
