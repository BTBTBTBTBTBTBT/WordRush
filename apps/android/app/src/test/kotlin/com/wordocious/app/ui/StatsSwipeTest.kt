package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Founder 10-02: only a clearly horizontal swipe changes the Stats page (vertical scroll wins). */
class StatsSwipeTest {
    private val t = 70f

    @Test fun clearlyHorizontalSwipesSwitch() {
        assertEquals(true, statsSwipeForward(-120f, 20f, t))  // left = forward
        assertEquals(false, statsSwipeForward(140f, -30f, t)) // right = back
        assertEquals(true, statsSwipeForward(-70f, 35f, t))   // exactly 2:1 at the threshold
    }

    @Test fun diagonalScrollsTapsAndShortDragsNeverSwitch() {
        assertNull(statsSwipeForward(-90f, 300f, t)) // a slightly diagonal vertical scroll
        assertNull(statsSwipeForward(-100f, 60f, t)) // not twice as wide as tall
        assertNull(statsSwipeForward(-60f, 0f, t))   // too short
        assertNull(statsSwipeForward(0f, 0f, t))     // a tap
    }
}
