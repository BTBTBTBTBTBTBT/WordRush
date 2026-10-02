package com.wordocious.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * The bot cast (FINISH_SPEC D1–D2) must match packages/core/src/bot-cast.ts
 * exactly: the ten-rung order, each bot's tier and solve range, the legacy id
 * and ladder migration, and the Bot of the Day rotation.
 */
class BotCastTest {
    @Test
    fun ladder_order_is_the_cast() {
        assertEquals(
            listOf("rip", "ivy", "ollie", "opal", "cosmo", "umi", "ozzy", "dewey", "scoot", "webster"),
            VsLobby.LADDER_BOTS,
        )
        assertEquals((1..10).toList(), BotCast.MEMBERS.map { it.rung })
        assertEquals(listOf("r", "i", "o1", "o2", "c", "u", "o3", "d", "s", "w"), BotCast.MEMBERS.map { it.castId })
        assertEquals(
            listOf("Rip", "Ivy", "Ollie", "Opal", "Cosmo", "Umi", "Ozzy", "Dewey", "Scoot", "Webster"),
            BotCast.MEMBERS.map { it.name },
        )
    }

    @Test
    fun tiers_and_guess_ranges() {
        val tiers = BotCast.MEMBERS.associate { it.id to it.tier }
        assertEquals(listOf("rip", "ivy", "ollie"), tiers.filterValues { it == BotCastTier.EASY }.keys.toList())
        assertEquals(listOf("opal", "cosmo", "ozzy"), tiers.filterValues { it == BotCastTier.MEDIUM }.keys.toList())
        assertEquals(listOf("dewey", "scoot", "webster"), tiers.filterValues { it == BotCastTier.HARD }.keys.toList())
        assertEquals(listOf("umi"), tiers.filterValues { it == BotCastTier.ADAPTIVE }.keys.toList())
        val ranges = BotCast.MEMBERS.associate { it.id to it.guesses }
        assertEquals(6..6, ranges["rip"]); assertEquals(5..6, ranges["ivy"]); assertEquals(5..5, ranges["ollie"])
        assertEquals(4..5, ranges["opal"]); assertEquals(4..5, ranges["cosmo"]); assertNull(ranges["umi"])
        assertEquals(4..5, ranges["ozzy"]); assertEquals(3..4, ranges["dewey"]); assertEquals(2..4, ranges["scoot"])
        assertEquals(2..3, ranges["webster"])
    }

    @Test
    fun solve_lines() {
        assertEquals("Solves in 6", BotCast.solveLine(BotCast.member("rip")!!))
        assertEquals("Solves in 5–6", BotCast.solveLine(BotCast.member("ivy")!!))
        assertEquals("Matches your form", BotCast.solveLine(BotCast.member("umi")!!))
        assertEquals("Solves in 2–3", BotCast.solveLine(BotCast.member("webster")!!))
    }

    @Test
    fun legacy_ids_map_by_difficulty() {
        assertEquals("ivy", BotCast.canonicalId("rook"))
        assertEquals("opal", BotCast.canonicalId("lexi"))
        assertEquals("dewey", BotCast.canonicalId("nova"))
        assertEquals("umi", BotCast.canonicalId("adapt"))
        assertEquals("scoot", BotCast.canonicalId("scoot"))
        assertEquals("ghost", BotCast.canonicalId("ghost"))
        assertEquals("daily", BotCast.canonicalId("daily"))
        assertEquals("Opal", BotCast.member("lexi")?.name)
        assertNull(BotCast.member("ghost"))
        assertNull(BotCast.member(null))
        assertNull(BotCast.member(""))
    }

    @Test
    fun legacy_ladder_progress_migrates() {
        assertEquals(listOf(0, 2, 4, 7, 10), (0..4).map { BotCast.migrateLegacyLadderCleared(it) })
        assertEquals(0, BotCast.migrateLegacyLadderCleared(-3))
        assertEquals(10, BotCast.migrateLegacyLadderCleared(9))
    }

    @Test
    fun legacy_ids_still_fold_into_the_ladder() {
        // An old "rook" game counts as Ivy: it moves the ladder only when Ivy is next.
        assertEquals(BotLadderState(0, 0), ladderAfterGame(BotLadderState(0, 0), "rook", true))
        assertEquals(BotLadderState(1, 1), ladderAfterGame(BotLadderState(1, 0), "rook", true))
        assertEquals(BotLadderState(10, 0), ladderAfterGame(BotLadderState(10, 0), "webster", true))
        assertEquals("Clear Rip to unlock", ladderRungs(BotLadderState(0, 0))[1].line)
        assertEquals("PEOPLE 1–0 · BOTS 2–0 · LADDER 3/10", vsRecordLine(WinLoss(1, 0), WinLoss(2, 0), 3))
        assertEquals("PEOPLE 1–0 · BOTS 2–0 · LADDER CLEARED", vsRecordLine(WinLoss(1, 0), WinLoss(2, 0), 10))
    }

    @Test
    fun bot_of_the_day_rotates_with_the_day_host() {
        // 2026-10-04 is a Sunday.
        val week = (4..10).map { BotCast.botOfTheDay("2026-10-%02d".format(it)).id }
        assertEquals(listOf("ozzy", "dewey", "ivy", "umi", "scoot", "opal", "ollie"), week)
        // The host letters: Mon D, Tue I, Wed U, Thu S, Fri O2, Sat O1, Sun O3.
        assertEquals(listOf("o3", "d", "i", "u", "s", "o2", "o1"), (4..10).map { BotCast.botOfTheDay("2026-10-%02d".format(it)).castId })
        assertEquals("ozzy", BotCast.botOfTheDay("not a day").id)
    }
}
