package com.wordocious.app.ui.vs

import org.junit.Assert.assertEquals
import org.junit.Test

/** Founder 10-02: the VS race clock pauses during the player's own Gauntlet stage card. */
class RaceClockTest {
    @Test fun stageCardTimeIsExcludedFromTheRace() {
        val c = RaceClock()
        c.start(1_000.0)
        assertEquals(10_000L, c.elapsedMs(11_000))
        c.pause(11_000)                       // stage 1 card up
        assertEquals(10_000L, c.elapsedMs(14_000)) // frozen while it shows
        c.resume(16_000)                      // 5 s card (or skipped earlier)
        assertEquals(12_000L, c.elapsedMs(18_000))
        c.pause(20_000); c.pause(21_000)      // a second pause call is a no-op
        c.resume(22_500)
        assertEquals(16_500L, c.elapsedMs(25_000)) // 24 s wall − 5 s − 2.5 s
    }

    @Test fun aNewMatchClearsPausesAndAnUnstartedClockReadsZero() {
        val c = RaceClock()
        assertEquals(0L, c.elapsedMs(5_000))
        c.start(0.0); c.pause(1_000)
        c.start(10_000.0)
        assertEquals(2_000L, c.elapsedMs(12_000))
    }
}
