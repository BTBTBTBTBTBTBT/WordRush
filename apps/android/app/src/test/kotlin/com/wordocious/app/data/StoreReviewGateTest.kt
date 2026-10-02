package com.wordocious.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC AI: the store review eligibility rule. */
class StoreReviewGateTest {
    private val day = 86_400_000L
    private val now = 1_800_000_000_000L

    @Test fun eligible_after_three_days_never_asked() {
        assertTrue(ReviewGate.isEligible(now, now - 3 * day, null, lastResultWasLoss = false))
        assertTrue(ReviewGate.isEligible(now, now - 400 * day, 0L, lastResultWasLoss = false))
    }

    @Test fun never_in_the_first_three_days() {
        assertFalse(ReviewGate.isEligible(now, now, null, false))
        assertFalse(ReviewGate.isEligible(now, now - 3 * day + 1, null, false))
        assertFalse(ReviewGate.isEligible(now, null, null, false))
        assertFalse(ReviewGate.isEligible(now, 0L, null, false))
    }

    @Test fun at_most_once_per_120_days() {
        val first = now - 365 * day
        assertFalse(ReviewGate.isEligible(now, first, now - day, false))
        assertFalse(ReviewGate.isEligible(now, first, now - 120 * day + 1, false))
        assertTrue(ReviewGate.isEligible(now, first, now - 120 * day, false))
    }

    @Test fun never_after_a_loss() {
        assertFalse(ReviewGate.isEligible(now, now - 30 * day, null, lastResultWasLoss = true))
    }

    @Test fun streak_milestones_are_multiples_of_seven() {
        assertFalse(ReviewGate.isStreakMilestone(0))
        assertFalse(ReviewGate.isStreakMilestone(6))
        assertTrue(ReviewGate.isStreakMilestone(7))
        assertFalse(ReviewGate.isStreakMilestone(8))
        assertTrue(ReviewGate.isStreakMilestone(14))
        assertTrue(ReviewGate.isStreakMilestone(70))
    }

    @Test fun first_play_is_the_earliest_known_stamp() {
        assertNull(ReviewGate.firstPlay(null, null))
        assertEquals(5L, ReviewGate.firstPlay(5L, null))
        assertEquals(3L, ReviewGate.firstPlay(5L, 3L))
        assertEquals(5L, ReviewGate.firstPlay(5L, 0L))
    }
}
