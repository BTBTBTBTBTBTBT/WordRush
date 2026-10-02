package com.wordocious.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC AP: when the one-time "Welcome to Pro" screen shows (pure logic). */
class ProWelcomeRulesTest {
    private fun purchase(
        isNewPurchase: Boolean = true,
        alreadyWelcomed: Boolean = false,
        wasProActive: Boolean = false,
        signedIn: Boolean = true,
    ) = ProWelcomeRules.shouldWelcome(ProActivation.PURCHASE, isNewPurchase, alreadyWelcomed, wasProActive, signedIn)

    @Test
    fun first_fresh_purchase_welcomes() {
        assertTrue(purchase())
    }

    @Test
    fun restores_and_launch_reconciles_never_welcome() {
        assertFalse(purchase(isNewPurchase = false))
    }

    @Test
    fun never_twice_for_the_same_account() {
        assertFalse(purchase(alreadyWelcomed = true))
    }

    @Test
    fun buying_while_already_pro_is_not_joining() {
        assertFalse(purchase(wasProActive = true))
    }

    @Test
    fun no_account_no_welcome() {
        assertFalse(purchase(signedIn = false))
    }

    @Test
    fun a_gift_welcomes_on_its_first_activation_only() {
        assertTrue(ProWelcomeRules.shouldWelcome(ProActivation.GIFT, false, false, false, true))
        assertFalse(ProWelcomeRules.shouldWelcome(ProActivation.GIFT, false, true, false, true))
        assertFalse(ProWelcomeRules.shouldWelcome(ProActivation.GIFT, false, false, true, true))
    }

    @Test
    fun the_flag_is_per_account() {
        assertEquals("pro-welcomed:abc", ProWelcomeRules.flagKey("abc"))
        assertTrue(ProWelcomeRules.flagKey("a") != ProWelcomeRules.flagKey("b"))
    }

    @Test
    fun headlines() {
        assertEquals("WELCOME TO PRO!", ProWelcomeRules.headline(ProActivation.PURCHASE))
        assertEquals("YOUR FREE WEEK OF PRO!", ProWelcomeRules.headline(ProActivation.GIFT))
    }

    @Test
    fun thanks_line_names_the_player_when_known() {
        assertEquals("Thanks for joining, Doug! Here's everything you just unlocked.", ProWelcomeRules.thanksLine("Doug"))
        assertEquals("Thanks for joining! Here's everything you just unlocked.", ProWelcomeRules.thanksLine(null))
        assertEquals("Thanks for joining! Here's everything you just unlocked.", ProWelcomeRules.thanksLine("  "))
    }

    @Test
    fun shield_chip_only_when_the_count_went_up() {
        assertEquals(4, ProWelcomeRules.shieldsCredited(1, 5))
        assertNull(ProWelcomeRules.shieldsCredited(3, 3))
        assertNull(ProWelcomeRules.shieldsCredited(3, 2))
        assertNull(ProWelcomeRules.shieldsCredited(null, 4))
        assertNull(ProWelcomeRules.shieldsCredited(2, null))
        assertEquals("Your 4 streak shields are ready", ProWelcomeRules.shieldChip(4))
        assertEquals("Your streak shield is ready", ProWelcomeRules.shieldChip(1))
    }

    @Test
    fun cards_pop_in_70ms_apart() {
        assertEquals(0L, ProWelcomeRules.cardDelayMs(0))
        assertEquals(490L, ProWelcomeRules.cardDelayMs(7))
        assertEquals(570L, ProWelcomeRules.cardDelayMs(1, baseMs = 500L))
    }
}
