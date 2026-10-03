package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC BJ6 symmetric hero: the host geometry pin + the header share rule. */
class HomeHostRulesTest {
    @Test
    fun host_geometry_matches_the_parity_pin() {
        assertEquals(72f, HOME_HOST_BOX.value)
        assertEquals(28f, HOME_HOST_RISE.value)
        // Coordinator 10-03 (no bloat, iOS parity): Home moves down only 16 dp over the compressed
        // banner's 6 dp; the host's other 6 dp overhang the header's empty bottom edge.
        assertEquals(22f, HOME_BANNER_TOP.value)
        assertEquals(16f, HOME_BANNER_TOP.value - 6f)
        assertEquals(6f, HOME_HOST_OVERHANG.value)
        // The strip clears the host's lower 44 dp; with the scene band on top it doesn't need to.
        assertEquals(44f, homeStripTop(sceneBand = false))
        assertEquals(4f, homeStripTop(sceneBand = true))
    }

    @Test
    fun header_share_shows_in_daily_after_a_finished_game_only() {
        assertFalse(homeShareVisible(unlimited = false, playedToday = 0))
        assertTrue(homeShareVisible(unlimited = false, playedToday = 1))
        assertFalse(homeShareVisible(unlimited = true, playedToday = 5))
    }
}
