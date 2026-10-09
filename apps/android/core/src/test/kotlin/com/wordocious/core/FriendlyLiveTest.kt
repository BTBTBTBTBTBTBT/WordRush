package com.wordocious.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Live pocket games: the same cases as packages/core/src/friendly-live.test.ts. */
class FriendlyLiveTest {
    private data class V(
        override val id: String = "g1",
        override val me: Side = Side.A,
        override val state: FriendlyState,
        override val active: Boolean = true,
        override val yourTurn: Boolean = true,
        override val updatedAt: String,
    ) : FriendlyLive.View

    private val t1 = "2026-10-09T12:00:00.000+00:00"
    private val t2 = "2026-10-09T12:00:01.000+00:00"
    private val t3 = "2026-10-09T12:00:02.000+00:00"
    private val overlay = { v: V, s: FriendlyState, mine: Boolean -> v.copy(state = s, yourTurn = mine) }

    @Test fun poll_and_topic() {
        assertEquals(2_000L, FriendlyLive.pollIntervalMs(false, true))
        assertEquals(20_000L, FriendlyLive.pollIntervalMs(true, true))
        assertEquals(4_000L, FriendlyLive.pollIntervalMs(true, false))
        assertEquals("fg:abc", FriendlyLive.topic("abc"))
    }

    @Test fun presence() {
        assertEquals(FriendlyLive.PresenceLabel.HERE, FriendlyLive.presenceLabel(true, true, false))
        assertEquals(FriendlyLive.PresenceLabel.THINKING, FriendlyLive.presenceLabel(true, true, true))
        assertEquals(FriendlyLive.PresenceLabel.LEFT, FriendlyLive.presenceLabel(false, true, true))
        assertEquals(FriendlyLive.PresenceLabel.AWAY, FriendlyLive.presenceLabel(false, false, true))
    }

    @Test fun staleness() {
        assertTrue(FriendlyLive.isNewer(null, t1))
        assertFalse(FriendlyLive.isNewer(t2, t1))
        assertFalse(FriendlyLive.isNewer(t1, t1))
        assertTrue(FriendlyLive.isNewer("2026-10-09T12:00:00.000Z", "2026-10-09T12:00:00.500+00:00"))
    }

    @Test fun predict_move() {
        val ttt = TttState()
        val p = FriendlyLive.predictMove(ttt, Side.A, FriendlyMove.Ttt(4)) as TttState
        assertEquals(Side.A, p.board[4])
        assertNull(FriendlyLive.predictMove(ttt, Side.B, FriendlyMove.Ttt(4)))
        assertNotNull(FriendlyLive.predictMove(RpsState(), Side.A, FriendlyMove.Rps(RpsPick.ROCK)))
        assertNull(FriendlyLive.predictMove(RpsState(picks = mapOf(Side.B to RpsPick.HIDDEN)), Side.A, FriendlyMove.Rps(RpsPick.ROCK)))
        assertNotNull(FriendlyLive.predictMove(ChainState(), Side.A, FriendlyMove.Chain("PLANE")))
        assertNull(FriendlyLive.predictMove(ChainState(), Side.A, FriendlyMove.Chain("NO")))
        assertNull(FriendlyLive.predictMove(CoinState(), Side.A, FriendlyMove.Coin(CoinFace.HEADS)))
        assertNull(FriendlyLive.predictMove(PassState(), Side.A, FriendlyMove.Pass("CRANE")))
        assertNull(FriendlyLive.predictMove(GhostState(), Side.A, FriendlyMove.Ghost("Q")))
    }

    @Test fun optimistic_begin_confirm_reject() {
        var s = FriendlyLive.Snapshot(V(state = TttState(), updatedAt = t1))
        val (withMove, attached) = s.beginMove(FriendlyMove.Ttt(0))
        assertTrue(attached)
        s = withMove
        assertFalse(s.displayed(overlay)!!.yourTurn)
        assertFalse("one in flight at a time", s.beginMove(FriendlyMove.Ttt(1)).second)
        val (rolled, did) = s.rejectMove()
        assertTrue(did)
        assertNull((rolled.displayed(overlay)!!.state as TttState).board[0])
        assertFalse(rolled.rejectMove().second)
        // server-decided game: nothing pending
        val coin = FriendlyLive.Snapshot(V(state = CoinState(), updatedAt = t1))
        val (c2, coinAttached) = coin.beginMove(FriendlyMove.Coin(CoinFace.HEADS))
        assertFalse(coinAttached)
        assertNull(c2.pending)
    }

    @Test fun late_reply_never_replaces_newer_broadcast() {
        var s = FriendlyLive.Snapshot(V(state = TttState(), updatedAt = t1))
        s = s.beginMove(FriendlyMove.Ttt(0)).first
        s = s.receive(V(state = TttState(), updatedAt = t3)).snap
        s = s.confirmMove(V(state = TttState(), updatedAt = t2))
        assertEquals(t3, s.confirmed!!.updatedAt)
        assertNull(s.pending)
    }

    @Test fun receive() {
        val s = FriendlyLive.Snapshot(V(state = TttState(), updatedAt = t2, yourTurn = false))
        assertFalse(s.receive(V(state = TttState(), updatedAt = t1)).applied)
        assertFalse(s.receive(V(state = TttState(), updatedAt = t2)).applied)
        val moved = TttState(board = List(9) { if (it == 1) Side.B else null })
        val r = s.receive(V(state = moved, updatedAt = t3, yourTurn = true))
        assertTrue(r.applied)
        assertEquals(FriendlyLive.Change(moved = true, yourTurnStarted = true, ended = false), r.change)
        val over = r.snap.receive(V(state = moved, updatedAt = "2026-10-09T12:00:09.000+00:00", active = false, yourTurn = false))
        assertTrue(over.change.ended)
    }

    @Test fun their_move_while_mine_in_flight_drops_prediction() {
        var s = FriendlyLive.Snapshot(V(state = RpsState(), updatedAt = t1))
        s = s.beginMove(FriendlyMove.Rps(RpsPick.ROCK)).first
        assertNotNull(s.pending)
        s = s.receive(V(state = RpsState(), updatedAt = t2)).snap
        assertNull(s.pending)
    }
}
