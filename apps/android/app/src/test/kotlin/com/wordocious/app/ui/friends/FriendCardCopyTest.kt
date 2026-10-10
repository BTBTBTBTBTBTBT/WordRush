package com.wordocious.app.ui.friends

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Founder 10-09: the dropdown words, the notes-menu rule and the name color (web friend-card-copy.test.ts / player-tint.test.ts). */
class FriendCardCopyTest {
    @Test fun subtitleListsUpToThreeGames() {
        assertEquals("Ghost, Call It", FriendCardCopy.gamesSubtitle(listOf("Ghost", "Call It")))
        assertEquals("Ghost, Call It, Word Chain", FriendCardCopy.gamesSubtitle(listOf("Ghost", "Call It", "Word Chain")))
    }

    @Test fun subtitleAddsAndMorePastThree() {
        assertEquals("A, B, C and more", FriendCardCopy.gamesSubtitle(listOf("A", "B", "C", "D")))
    }

    @Test fun notesMenuNeedsALongNonDangerTitle() {
        assertFalse(FriendCardCopy.isNotesMenu(listOf("View profile" to false, "Gift a shield" to false)))
        assertTrue(FriendCardCopy.isNotesMenu(listOf("Good luck today, friend!" to false, "Nice" to false)))
        assertFalse(FriendCardCopy.isNotesMenu(listOf("A".repeat(18) to false)))
        assertTrue(FriendCardCopy.isNotesMenu(listOf("A".repeat(19) to false)))
        assertFalse(FriendCardCopy.isNotesMenu(listOf("Remove this person from my list" to true, "Hi" to false)))
    }

    @Test fun nameColorLiftsAPastelBackdropToAVividHue() {
        val c = FriendCardCopy.nameColorArgb("lemon", "purple")
        assertEquals(0xFE, (c shr 16) and 0xFF) // red stays at the 0.996 brightness floor
        assertEquals(0xFF, (c ushr 24) and 0xFF)
    }

    @Test fun nameColorUsesTheLastGradientColorAndGrayTakesPurple() {
        assertTrue(FriendCardCopy.nameColorArgb("ocean", "purple") != FriendCardCopy.nameColorArgb("sunset", "purple"))
        assertEquals(0xFF8B5CF6.toInt(), FriendCardCopy.nameColorArgb("cloud", "purple"))
    }
}
