package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** FINISH_SPEC M: what counts on the Friends tab badge and how it reads. */
class FriendsBadgeTest {
    @Test
    fun counts_requests_invites_challenges_and_your_turn_games() {
        val w = FriendsBadge.waitingKeys(listOf("u1", "u2"), listOf("i1"), listOf("ABC"), listOf("g1" to "t1"))
        assertEquals(5, FriendsBadge.unseen(w, emptySet()))
    }

    @Test
    fun opening_friends_clears_it_until_something_new_arrives() {
        val w = FriendsBadge.waitingKeys(listOf("u1"), emptyList(), emptyList(), listOf("g1" to "t1"))
        assertEquals(0, FriendsBadge.unseen(w, w))
        // A new move in the same game counts again; so does a new request.
        val later = FriendsBadge.waitingKeys(listOf("u1", "u3"), emptyList(), emptyList(), listOf("g1" to "t2"))
        assertEquals(2, FriendsBadge.unseen(later, w))
    }

    @Test
    fun label_and_spoken_text() {
        assertEquals("3", FriendsBadge.label(3))
        assertEquals("9", FriendsBadge.label(9))
        assertEquals("9+", FriendsBadge.label(12))
        assertEquals("Friends, 3 new", FriendsBadge.tabLabel(3))
        assertEquals("Friends", FriendsBadge.tabLabel(0))
    }
}
