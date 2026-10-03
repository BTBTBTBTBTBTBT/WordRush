package com.wordocious.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Founder 10-03: X'd referral credit notices stay gone (the stored list round-trips). */
class ReferralCreditsTest {
    @Test fun dismissPersistsThroughTheStoredString() {
        val once = ReferralCredits.encode("", listOf("a"))
        // What the next launch reads back.
        assertEquals(setOf("a"), ReferralCredits.decode(once))
        // Server ids + Clear all merge without duplicates.
        val twice = ReferralCredits.encode(once, listOf("a", "b"))
        assertEquals(setOf("a", "b"), ReferralCredits.decode(twice))
        assertEquals(setOf<String>(), ReferralCredits.decode(null))
    }

    @Test fun creditsAndClearAll() {
        assertTrue(ReferralCredits.isCredit("redeemed"))
        assertFalse(ReferralCredits.isCredit("pending"))
        assertTrue(ReferralCredits.showClearAll(listOf("redeemed", "converted", "pending")))
        assertFalse(ReferralCredits.showClearAll(listOf("redeemed", "pending")))
        assertTrue(ReferralCredits.key("u1") != ReferralCredits.key("u2"))
    }
}
