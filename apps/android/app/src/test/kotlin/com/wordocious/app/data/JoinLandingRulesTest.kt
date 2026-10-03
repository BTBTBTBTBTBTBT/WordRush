package com.wordocious.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The native /join/<CODE> landing (web app/join/[code] parity). */
class JoinLandingRulesTest {
    @Test fun codes() {
        assertEquals("ABCD2345", JoinLandingRules.normalize("abcd2345"))
        assertNull(JoinLandingRules.normalize("AB")) // too short
        assertNull(JoinLandingRules.normalize("ABCD01")) // 0 and 1 are never in a code
        assertNull(JoinLandingRules.normalize(null))
    }

    @Test fun lookupStates() {
        assertEquals(JoinLandingRules.Status.READY, JoinLandingRules.status("ok"))
        assertEquals(JoinLandingRules.Status.USED, JoinLandingRules.status("used"))
        assertEquals(JoinLandingRules.Status.EXPIRED, JoinLandingRules.status("expired"))
        assertEquals(JoinLandingRules.Status.NOT_FOUND, JoinLandingRules.status("weird"))
    }

    @Test fun copyAndRetry() {
        assertEquals("Mia sent you a week of Pro!", JoinLandingRules.headline("Mia"))
        assertEquals("A week of Pro, on a friend!", JoinLandingRules.headline(" "))
        // Only a network failure keeps the pending code for another try.
        assertFalse(JoinLandingRules.isFinal("network"))
        assertTrue(JoinLandingRules.isFinal("already_redeemed"))
    }

    @Test fun deepLinkClaimsJoin() {
        val manifest = java.io.File("src/main/AndroidManifest.xml").readText()
        assertTrue(manifest.contains("android:pathPrefix=\"/join/\""))
    }
}
