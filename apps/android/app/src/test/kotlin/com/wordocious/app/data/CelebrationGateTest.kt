package com.wordocious.app.data

import com.wordocious.app.data.CelebrationGate.Source
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Late celebrations wait for a calm moment; past-day sweeps are dropped (iOS / web parity). */
class CelebrationGateTest {

    @Test fun `calm only on the Home root with nothing presented and no popup`() {
        assertTrue(CelebrationGate.isCalm(onHomeRoot = true, anythingPresented = false, popupUp = false))
        assertFalse(CelebrationGate.isCalm(onHomeRoot = false, anythingPresented = false, popupUp = false))
        assertFalse(CelebrationGate.isCalm(onHomeRoot = true, anythingPresented = true, popupUp = false))
        assertFalse(CelebrationGate.isCalm(onHomeRoot = true, anythingPresented = false, popupUp = true))
        assertFalse(CelebrationGate.isCalm(onHomeRoot = false, anythingPresented = true, popupUp = true))
    }

    @Test fun `a live result is late only after six seconds`() {
        val t0 = 1_000_000L
        assertFalse(CelebrationGate.isLate(Source.LIVE, t0, t0))
        assertFalse(CelebrationGate.isLate(Source.LIVE, t0, t0 + 6_000))
        assertTrue(CelebrationGate.isLate(Source.LIVE, t0, t0 + 6_001))
        assertTrue(CelebrationGate.isLate(Source.LIVE, t0, t0 + 45_000))
        assertTrue(CelebrationGate.lateAfterSeconds == 6L)
    }

    @Test fun `replays and syncs are always late`() {
        val t0 = 1_000_000L
        assertTrue(CelebrationGate.isLate(Source.REPLAY, t0, t0))
        assertTrue(CelebrationGate.isLate(Source.SYNC, t0, t0))
    }

    @Test fun `a sweep from a past day is dropped`() {
        assertFalse(CelebrationGate.shouldDrop("2026-10-03", "2026-10-03"))
        assertTrue(CelebrationGate.shouldDrop("2026-10-02", "2026-10-03"))
    }

    // ── 2.8 item 52: the celebration fires at the right moment ──

    private val daily = listOf("DUEL", "QUORDLE", "OCTORDLE", "SEQUENCE", "RESCUE", "GAUNTLET", "PROPERNOUNDLE_SWEEP", "DUEL6")
    private val more = listOf("SUDOKU", "REGIONS", "LADDER", "WORDSEARCH", "HUB", "CRYPTOGRAM", "GROUPS", "CROSSWORD", "SCRAMBLE", "PROPERNOUNDLE")
    private val today = "2026-10-09"

    private fun results(keys: List<String>, lost: List<String> = emptyList()) = keys.associateWith { it !in lost }
    private fun due(
        r: Map<String, Boolean>, dataDay: String = today,
        seen: (CelebrationGate.Group) -> CelebrationGate.Tier? = { null },
    ) = CelebrationGate.due(r, daily, more, today, dataDay, seen)

    @Test fun `the last daily finish makes Flawless due immediately from local results`() {
        assertTrue(due(results(daily.take(7))).isEmpty())
        assertTrue(due(results(daily)) == listOf(CelebrationGate.Due(CelebrationGate.Group.DAILY, CelebrationGate.Tier.FLAWLESS, "$today:daily:flawless")))
        assertTrue(due(results(daily, lost = listOf("GAUNTLET"))).map { it.tier } == listOf(CelebrationGate.Tier.SWEEP))
    }

    @Test fun `the tenth puzzle fires the Puzzles celebration and never repeats the dailies`() {
        val seenDaily: (CelebrationGate.Group) -> CelebrationGate.Tier? = { if (it == CelebrationGate.Group.DAILY) CelebrationGate.Tier.FLAWLESS else null }
        assertTrue(due(results(daily + more), seen = seenDaily).map { it.group } == listOf(CelebrationGate.Group.MORE))
        assertTrue(due(results(daily + more.take(9)), seen = seenDaily).isEmpty())
    }

    @Test fun `never twice, flawless upgrade of a seen sweep still fires, restart is due until stored`() {
        val flawlessSeen: (CelebrationGate.Group) -> CelebrationGate.Tier? = { if (it == CelebrationGate.Group.DAILY) CelebrationGate.Tier.FLAWLESS else null }
        val sweepSeen: (CelebrationGate.Group) -> CelebrationGate.Tier? = { if (it == CelebrationGate.Group.DAILY) CelebrationGate.Tier.SWEEP else null }
        assertTrue(due(results(daily), seen = flawlessSeen).isEmpty())
        assertTrue(due(results(daily, lost = listOf("DUEL")), seen = sweepSeen).isEmpty())
        assertTrue(due(results(daily), seen = sweepSeen).map { it.tier } == listOf(CelebrationGate.Tier.FLAWLESS))
        assertTrue(due(results(daily)).size == 1)
    }

    @Test fun `a stale day and zero wins never celebrate`() {
        assertTrue(due(results(daily), dataDay = "2026-10-08").isEmpty())
        assertTrue(due(results(daily, lost = daily)).isEmpty())
    }

    @Test fun `action presents, goes home, waits or drops`() {
        fun act(
            source: Source = Source.LIVE, home: Boolean = true, open: Boolean = false, popup: Boolean = false,
            day: String = today,
        ) = CelebrationGate.action(source, home, open, popup, day, today)
        assertTrue(act() == CelebrationGate.Action.PRESENT)
        assertTrue(act(home = false) == CelebrationGate.Action.GO_HOME_THEN_PRESENT)
        assertTrue(act(open = true) == CelebrationGate.Action.WAIT)
        assertTrue(act(popup = true) == CelebrationGate.Action.WAIT)
        assertTrue(act(home = false, open = true) == CelebrationGate.Action.WAIT)
        assertTrue(act(Source.REPLAY, home = false) == CelebrationGate.Action.WAIT)
        assertTrue(act(Source.SYNC, home = true) == CelebrationGate.Action.PRESENT)
        assertTrue(act(day = "2026-10-08") == CelebrationGate.Action.DROP)
        assertTrue(act(open = true, day = "2026-10-08") == CelebrationGate.Action.DROP)
    }

    @Test fun `NEXT is deferred while a celebration is pending`() {
        assertTrue(CelebrationGate.shouldDeferHandoff(1))
        assertFalse(CelebrationGate.shouldDeferHandoff(0))
    }
}
