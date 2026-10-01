package com.wordocious.app.ui.vs

import com.wordocious.app.data.VsChallengeService
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** §13: the step-in card line after KEEP WAITING pinged (web keepWaitingPingLine parity). */
class KeepWaitingPingLineTest {
    @Test fun failedOrThrottledKeepsTheCardLine() {
        assertNull(keepWaitingPingLine(null))
        assertNull(keepWaitingPingLine(VsChallengeService.Looking(pinged = 4, throttled = true)))
    }

    @Test fun nobodyOptedIn() {
        assertEquals("Nobody has pings on yet. We’ll keep looking.", keepWaitingPingLine(VsChallengeService.Looking(0, false)))
    }

    @Test fun singularAndPlural() {
        assertEquals("We pinged 1 player who plays live.", keepWaitingPingLine(VsChallengeService.Looking(1, false)))
        assertEquals("We pinged 7 players who play live.", keepWaitingPingLine(VsChallengeService.Looking(7, false)))
    }
}
