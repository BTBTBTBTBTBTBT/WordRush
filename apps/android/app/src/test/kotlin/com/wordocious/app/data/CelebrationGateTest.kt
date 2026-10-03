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
}
