package com.wordocious.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Same cases as apps/web/lib/invites-row.test.ts. */
class InvitesRowRulesTest {
    private val live = InviteRowItem(InviteRowItem.Variant.LIVE, "AAAAAAAA", "DUEL", "Johnny", "u1", inviteId = "id1", createdAtMs = 1_000L)
    private val race = InviteRowItem(InviteRowItem.Variant.RACE, "BBBBBBBB", "DUEL", "Doug", "u2", raceLine = "solved in 4 · 1:12", createdAtMs = 2_000L)

    @Test fun merges_newest_first() {
        assertEquals(listOf("race:BBBBBBBB", "live:AAAAAAAA"), InvitesRowRules.build(listOf(live, race), emptyList()).map { it.key })
    }

    @Test fun dismissed_is_case_insensitive() {
        assertTrue(InvitesRowRules.build(listOf(race), listOf("bbbbbbbb")).isEmpty())
    }

    @Test fun race_line() {
        assertEquals("solved in 4 · 1:12", InvitesRowRules.raceLine(true, 4, 72_000L))
        assertEquals("a run to beat", InvitesRowRules.raceLine(false, 6, 1_000L))
    }
}
