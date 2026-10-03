package com.wordocious.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

/** FINISH_SPEC BJ11: the subscription hand-off copy + the lapsed-Pro line (web / iOS parity). */
class SubscriptionCopyTest {
    private val chicago = ZoneId.of("America/Chicago")
    private val now = Instant.parse("2026-10-03T17:00:00Z")

    @Test fun everyHandoffSaysWhatOpens() {
        assertEquals("Opens your Apple subscription settings", SubscriptionCopy.handoff(SubscriptionCopy.Store.APPLE).line)
        assertEquals("Opens your Google Play subscriptions", SubscriptionCopy.handoff(SubscriptionCopy.Store.GOOGLE).line)
        assertEquals("Opens Stripe's secure billing page", SubscriptionCopy.handoff(SubscriptionCopy.Store.STRIPE).line)
        assertEquals("Open Play subscriptions", SubscriptionCopy.handoff(SubscriptionCopy.Store.GOOGLE).cta)
    }

    @Test fun copyHasNoEmojiOrBritishSpelling() {
        val all = SubscriptionCopy.Store.values().joinToString(" ") {
            val h = SubscriptionCopy.handoff(it); "${h.title} ${h.line} ${h.body} ${h.cta}"
        } + SubscriptionCopy.LAPSED_BODY + SubscriptionCopy.playDisclosure("$6.99", "$59.99")
        assertFalse(all.codePoints().anyMatch { it >= 0x1F300 })
        assertFalse(all.contains("cancell", ignoreCase = true))
    }

    @Test fun disclosureCarriesTheLivePrices() {
        val d = SubscriptionCopy.playDisclosure("€7,99", "€64,99")
        assertTrue(d.startsWith("Monthly (€7,99) and Yearly (€64,99) are auto-renewing subscriptions billed through Google Play."))
    }

    @Test fun lapsedLine() {
        assertEquals("Your Pro ended Sep 30, 2026", SubscriptionCopy.lapsedLine("2026-09-30T17:00:00+00:00", false, now, chicago))
        assertNull(SubscriptionCopy.lapsedLine("2026-09-30T17:00:00Z", true, now, chicago))
        assertNull(SubscriptionCopy.lapsedLine("2026-10-30T17:00:00Z", false, now, chicago))
        assertNull(SubscriptionCopy.lapsedLine(null, false, now, chicago))
        assertNull(SubscriptionCopy.lapsedLine("garbage", false, now, chicago))
    }
}
