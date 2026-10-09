package com.wordocious.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Item 41: parity with packages/core/src/whats-new.test.ts. */
class WhatsNewTest {
    private fun decide(
        live: Boolean = true, seen: List<String>? = emptyList(), signedIn: Boolean = true,
        onboarded: Boolean? = true, created: String? = "2026-08-01T10:00:00Z",
    ) = WhatsNew.decision(live, seen, signedIn, onboarded, created)

    @Test fun sixPagesInOrder() {
        assertEquals(listOf("season", "alive", "order", "invites", "widgets", "packs"), WhatsNew.PAGES.map { it.id })
        WhatsNew.PAGES.forEach { assertEquals(it.title, it.title.uppercase()) }
    }

    @Test fun widgetsAreAnAppFeature() {
        assertFalse(WhatsNew.pages("web").map { it.id }.contains("widgets"))
        assertTrue(WhatsNew.pages("ios").map { it.id }.contains("widgets"))
        assertEquals(6, WhatsNew.pages("android").size)
    }

    @Test fun existingPlayerGetsTheTour() = assertEquals(WhatsNew.Decision.SHOW, decide())

    @Test fun brandNewPlayerNeverSeesItAndTheKeyIsRecorded() {
        assertEquals(WhatsNew.Decision.RECORD, decide(created = "${WhatsNew.CUTOFF}T00:00:00Z"))
        assertEquals(WhatsNew.Decision.RECORD, decide(created = "2026-11-02T00:00:00Z"))
        assertEquals(WhatsNew.Decision.RECORD, decide(onboarded = false))
    }

    @Test fun seenOffGuestNothing() {
        assertEquals(WhatsNew.Decision.NONE, decide(seen = listOf(WhatsNew.KEY)))
        assertEquals(WhatsNew.Decision.NONE, decide(live = false))
        assertEquals(WhatsNew.Decision.NONE, decide(signedIn = false))
    }

    @Test fun waitsWhileLoading() {
        assertEquals(WhatsNew.Decision.WAIT, decide(seen = null))
        assertEquals(WhatsNew.Decision.WAIT, decide(onboarded = null))
    }
}
