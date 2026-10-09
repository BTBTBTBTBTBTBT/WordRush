package com.wordocious.core

import com.wordocious.core.StatsProfile.PocketGameRow
import com.wordocious.core.StatsProfile.PocketRecord
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Parity guard: StatsProfile must decide exactly like packages/core/src/stats-profile.ts (the same cases as stats-profile.test.ts). */
class StatsProfileTest {
    @Test fun pickerSplitFiveOverFour() {
        val s = StatsProfile.pickerSplit(listOf(1, 2, 3, 4, 5, 6, 7, 8, 9))
        assertEquals(listOf(1, 2, 3, 4, 5), s.top)
        assertEquals(listOf(6, 7, 8, 9), s.bottom)
        assertEquals(emptyList<Int>(), StatsProfile.pickerSplit(listOf(1, 2, 3)).bottom)
        assertEquals(3, StatsProfile.pickerSplit(listOf(1, 2, 3, 4, 5, 6)).top.size)
    }

    @Test fun heroStats() {
        val h = StatsProfile.heroStats(3, 2, 2, 4, 16.0)
        assertEquals(listOf("3–2", "60%", "2", "16s"), h.map { it.value })
        assertEquals("Best 4", h[2].sub)
        assertEquals("crown", h[0].icon)
        val none = StatsProfile.heroStats(0, 0, 0, 0, 0.0)
        assertEquals(listOf("0–0", "—", "0", "—"), none.map { it.value })
        assertNull(none[2].sub)
    }

    @Test fun formatsAndRates() {
        assertEquals("1m 5s", StatsProfile.formatFastest(65.0))
        assertEquals("2m", StatsProfile.formatFastest(120.0))
        assertEquals("—", StatsProfile.formatFastest(0.0))
        assertEquals(60, StatsProfile.winRatePct(26, 17))
        assertEquals(0, StatsProfile.winRatePct(0, 0))
    }

    @Test fun guessChartHiddenUntilAWin() {
        assertFalse(StatsProfile.showGuessDistribution(listOf(0, 0)))
        assertFalse(StatsProfile.showGuessDistribution(emptyList()))
        assertTrue(StatsProfile.showGuessDistribution(listOf(0, 2)))
    }

    @Test fun recordBarAndBotsLine() {
        val b = StatsProfile.recordBar(3, 1)
        assertEquals(0.75, b.winFrac, 0.0001)
        assertEquals(0.25, b.lossFrac, 0.0001)
        assertTrue(StatsProfile.recordBar(0, 0).empty)
        assertEquals("26–17 · 60%", StatsProfile.botsLine(26, 17))
        assertEquals("Beat a bot to start", StatsProfile.botsLine(0, 0))
    }

    @Test fun pocketRecords() {
        val rows = listOf(
            PocketGameRow(FriendlyKind.GHOST, "me", "jo", "done", "me"),
            PocketGameRow(FriendlyKind.GHOST, "jo", "me", "done", "jo"),
            PocketGameRow(FriendlyKind.GHOST, "me", "jo", "resigned", "me"),
            PocketGameRow(FriendlyKind.RPS, "me", "al", "done", null),
            PocketGameRow(FriendlyKind.CHAIN, "me", "al", "done", "me", 14),
            PocketGameRow(FriendlyKind.CHAIN, "me", "al", "done", "me", 9),
            PocketGameRow(FriendlyKind.COIN, "me", "al", "active", null),
            PocketGameRow(FriendlyKind.COIN, "me", "al", "expired", null),
            PocketGameRow(FriendlyKind.TTT, "x", "y", "done", "x"),
        )
        val r = StatsProfile.pocketRecords(rows, "me")
        assertEquals(listOf(FriendlyKind.RPS, FriendlyKind.TTT, FriendlyKind.COIN, FriendlyKind.PASS, FriendlyKind.GHOST, FriendlyKind.CHAIN), r.byKind.map { it.kind })
        val ghost = r.byKind.first { it.kind == FriendlyKind.GHOST }
        assertEquals(PocketRecord(2, 1, 0), ghost.record)
        assertEquals("2–1", StatsProfile.pocketLine(ghost.record))
        assertEquals(1, r.byKind.first { it.kind == FriendlyKind.RPS }.record.draws)
        assertEquals(0, r.byKind.first { it.kind == FriendlyKind.COIN }.record.wins)
        assertEquals(0, r.byKind.first { it.kind == FriendlyKind.TTT }.record.wins)
        assertEquals(PocketRecord(4, 1, 1), r.total)
        assertEquals(PocketRecord(2, 1, 0), r.byFriend.getValue("jo").total)
        assertEquals(PocketRecord(2, 0, 0), r.byFriend.getValue("al").byKind.getValue(FriendlyKind.CHAIN))
        assertEquals("2–0 · best 14", StatsProfile.pocketTileLine(r.byKind.first { it.kind == FriendlyKind.CHAIN }))
        assertEquals("No games yet", StatsProfile.pocketTileLine(r.byKind.first { it.kind == FriendlyKind.PASS }))
        assertEquals("1–1–2", StatsProfile.pocketLine(PocketRecord(1, 1, 2)))
    }

    @Test fun profileActions() {
        fun a(self: Boolean = false, friend: Boolean = false, incoming: Boolean = false, requested: Boolean = false) =
            StatsProfile.profileActions(StatsProfile.friendshipState(self, friend, incoming, requested))
        assertEquals(listOf(StatsProfile.ProfileAction.CHALLENGE, StatsProfile.ProfileAction.POCKET, StatsProfile.ProfileAction.REACT), a(friend = true).row)
        assertEquals(listOf(StatsProfile.ProfileMenuAction.UNFRIEND, StatsProfile.ProfileMenuAction.BLOCK, StatsProfile.ProfileMenuAction.REPORT), a(friend = true).menu)
        assertEquals(listOf(StatsProfile.ProfileAction.ADD_FRIEND), a().row)
        assertEquals(listOf(StatsProfile.ProfileMenuAction.BLOCK, StatsProfile.ProfileMenuAction.REPORT), a().menu)
        assertEquals(listOf(StatsProfile.ProfileAction.REQUESTED), a(requested = true).row)
        assertEquals(listOf(StatsProfile.ProfileAction.ACCEPT, StatsProfile.ProfileAction.DECLINE), a(incoming = true).row)
        assertEquals(emptyList<StatsProfile.ProfileAction>(), a(self = true).row)
        assertEquals(emptyList<StatsProfile.ProfileMenuAction>(), a(self = true).menu)
    }

    @Test fun friendsSinceAndLayout() {
        assertEquals("Friends since Sep 2026", StatsProfile.friendsSinceLine("2026-09-14T12:00:00Z"))
        assertNull(StatsProfile.friendsSinceLine(null))
        assertNull(StatsProfile.friendsSinceLine("nope"))
        assertTrue(StatsProfile.highlightsLayout(0).fold)
        assertTrue(StatsProfile.highlightsLayout(1).fold)
        assertEquals(2, StatsProfile.highlightsLayout(3).shown)
        assertEquals(4, StatsProfile.highlightsLayout(6).shown)
        assertEquals(2, StatsProfile.highlightsLayout(2).shown)
    }

    @Test fun headToHeadLineAndColors() {
        assertEquals("VS 3–1 · Pocket 2–2", StatsProfile.headToHeadLine(PocketRecord(3, 1), PocketRecord(2, 2)))
        assertEquals("Pocket 1–0", StatsProfile.headToHeadLine(PocketRecord(), PocketRecord(1)))
        assertEquals("No games together yet", StatsProfile.headToHeadLine(PocketRecord(), PocketRecord()))
        assertEquals("#2563eb", StatsProfile.sectionTitleColor("Head to Head"))
        assertEquals("#7c3aed", StatsProfile.sectionTitleColor("unknown"))
    }

    @Test fun goProScenes() {
        assertEquals(StatsProfile.ProBenefit.ITEMS, StatsProfile.proBenefitForReason("Pro mascot styles"))
        assertEquals(StatsProfile.ProBenefit.UNLIMITED, StatsProfile.proBenefitForReason("Unlimited QuadWord"))
        assertEquals(StatsProfile.ProBenefit.UNLIMITED, StatsProfile.proBenefitForReason("Unlimited play"))
        assertEquals(StatsProfile.ProBenefit.VS_BOTS, StatsProfile.proBenefitForReason("VS Bots"))
        assertEquals(StatsProfile.ProBenefit.STATS, StatsProfile.proBenefitForReason("Extended stats"))
        assertEquals(StatsProfile.ProBenefit.UNLIMITED, StatsProfile.proBenefitForReason(null))
        assertEquals(5, StatsProfile.PRO_SCENES.values.toSet().size)
    }
}
