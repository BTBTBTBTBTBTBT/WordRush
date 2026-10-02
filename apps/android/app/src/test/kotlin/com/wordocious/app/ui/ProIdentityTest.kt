package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId

/** FINISH_SPEC AA: the Pro identity copy + the own-avatar crown rule. */
class ProIdentityTest {
    private val utc = ZoneId.of("UTC")

    @Test fun memberSinceReadsMonthAndYear() {
        assertEquals("Member since October 2026", ProIdentityText.memberSince("2026-10-02T12:00:00+00:00"))
        assertEquals("Member since January 2025", ProIdentityText.memberSince("2025-01-31T23:59:59.123456Z"))
        assertNull(ProIdentityText.memberSince(null))
        assertNull(ProIdentityText.memberSince("garbage"))
        assertNull(ProIdentityText.memberSince("2026-13-01T00:00:00Z"))
    }

    @Test fun renewalLineFormatsTheExpiry() {
        assertEquals("Renews or ends Oct 30, 2026", ProIdentityText.renewalLine("2026-10-30T10:00:00+00:00", utc))
        assertEquals("Renews or ends Nov 2, 2026", ProIdentityText.renewalLine("2026-11-02T10:00:00.5Z", utc))
        // Legacy rows without an expiry, far-future sentinels and junk read as no end date.
        assertEquals("No end date", ProIdentityText.renewalLine(null, utc))
        assertEquals("No end date", ProIdentityText.renewalLine("9999-12-31T00:00:00+00:00", utc))
        assertEquals("No end date", ProIdentityText.renewalLine("not a date", utc))
    }

    @Test fun planLineNamesTheMembership() {
        assertEquals("Wordocious Pro · no end date", ProIdentityText.planLine(null))
        assertTrue(ProIdentityText.planLine("2026-10-30T10:00:00Z").startsWith("Wordocious Pro"))
    }

    @Test fun onlyTheSignedInProPlayersOwnAvatarIsCrowned() {
        assertTrue(ProIdentityText.isOwnPro("brian", "brian", ownProActive = true))
        assertTrue(ProIdentityText.isOwnPro(" Brian ", "brian", ownProActive = true))
        assertFalse(ProIdentityText.isOwnPro("brian", "brian", ownProActive = false))
        assertFalse(ProIdentityText.isOwnPro("jasson", "brian", ownProActive = true))
        assertFalse(ProIdentityText.isOwnPro(null, "brian", ownProActive = true))
        assertFalse(ProIdentityText.isOwnPro("brian", null, ownProActive = true))
        assertFalse(ProIdentityText.isOwnPro("", "", ownProActive = true))
    }
}
