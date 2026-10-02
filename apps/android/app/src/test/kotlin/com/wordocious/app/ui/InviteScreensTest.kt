package com.wordocious.app.ui

import com.wordocious.app.ui.friends.FRIENDS_SHIELD_NOTE
import com.wordocious.app.ui.friends.noticeStyle
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/** The friend-invite + gift-a-week-of-Pro screens' pure logic (FINISH_SPEC T1–T4). */
class InviteScreensTest {
    @Test fun codeTilesKeepLettersAndDigitsUppercased() {
        assertEquals(listOf("A", "B", "1", "2", "C", "D"), InviteScreens.codeTiles("ab-12 cd"))
        assertEquals(emptyList<String>(), InviteScreens.codeTiles(null))
        assertEquals(emptyList<String>(), InviteScreens.codeTiles("—"))
    }

    @Test fun codeFromInviteUrlReadsTheTail() {
        assertEquals("AB12CD34", InviteScreens.codeFromInviteUrl("https://wordocious.com/vs/join/ab12cd34"))
        assertEquals("XYZ", InviteScreens.codeFromInviteUrl("https://wordocious.com/join/XYZ/?ref=1"))
        assertNull(InviteScreens.codeFromInviteUrl("https://wordocious.com/profile/abc"))
        assertNull(InviteScreens.codeFromInviteUrl(null))
    }

    @Test fun giftsLeftClampsToTheSlots() {
        assertEquals(3, InviteScreens.giftsLeft(0))
        assertEquals(1, InviteScreens.giftsLeft(2))
        assertEquals(0, InviteScreens.giftsLeft(5))
        assertEquals(3, InviteScreens.giftsLeft(-1))
    }

    @Test fun trackRequestsCelebratesAcceptsOnceAndDropsDeclines() {
        // a was watched and is now a friend → celebrate; b still outgoing → keep; c declined → drop;
        // d newly outgoing → start watching; e a friend never watched → nothing.
        val t = InviteScreens.trackRequests(
            watched = listOf("A", "b", "c"),
            outgoing = setOf("b", "d"),
            friends = listOf("a", "e"),
        )
        assertEquals(listOf("A"), t.accepted)
        assertEquals(listOf("b", "d"), t.watch)
        // Next pass: nothing more to celebrate.
        val next = InviteScreens.trackRequests(t.watch, setOf("b", "d"), listOf("a", "e"))
        assertEquals(emptyList<String>(), next.accepted)
    }

    @Test fun watchedListRoundTrips() {
        val ids = listOf("u-1", "u-2")
        assertEquals(ids, InviteScreens.parseWatched(InviteScreens.formatWatched(ids)))
        assertEquals(emptyList<String>(), InviteScreens.parseWatched(null))
        assertEquals(emptyList<String>(), InviteScreens.parseWatched(" , "))
    }

    @Test fun shieldNoticeWearsTheShieldGuardArt() {
        val style = noticeStyle("${FRIENDS_SHIELD_NOTE}Shield sent to Doug")
        assertNull(style.pose)
        assertNotNull(style.scene)
    }
}
