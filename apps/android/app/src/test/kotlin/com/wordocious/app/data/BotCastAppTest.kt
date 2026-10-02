package com.wordocious.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC D1–D2 on Android: the ladder migration, the kind / identity mapping of the cast bots. */
class BotCastAppTest {
    @Test
    fun legacy_progress_migrates_once_to_the_cast_ladder() {
        for ((old, new) in listOf(0 to 0, 1 to 2, 2 to 4, 3 to 7, 4 to 10)) {
            val p = CpuProgressionStore.migrateLegacy(CpuProgression(ladderCleared = old, ladderRun = 2, unlocked = setOf("nova", "rook")))
            assertEquals(new, p.ladderCleared)
            assertEquals(0, p.ladderRun)
            assertEquals(setOf("dewey", "ivy"), p.unlocked)
        }
    }

    @Test
    fun cast_bots_play_their_borrowed_tier() {
        assertEquals(CpuKind.EASY, CpuKind.forLadder("rip"))
        assertEquals(CpuKind.EASY, CpuKind.forLadder("ollie"))
        assertEquals(CpuKind.MEDIUM, CpuKind.forLadder("ozzy"))
        assertEquals(CpuKind.ADAPTIVE, CpuKind.forLadder("umi"))
        assertEquals(CpuKind.HARD, CpuKind.forLadder("webster"))
        // Old ids map by difficulty.
        assertEquals(CpuKind.EASY, CpuKind.forLadder("rook"))
        assertEquals(CpuKind.HARD, CpuKind.forLadder("nova"))
        assertEquals(listOf("ivy", "opal", "dewey", "umi"), listOf(CpuKind.EASY, CpuKind.MEDIUM, CpuKind.HARD, CpuKind.ADAPTIVE).map { it.botId })
    }

    @Test
    fun opponent_ids_round_trip_to_the_cast() {
        val scoot = CpuOpponent.identity(CpuOpponent.opponentId(CpuKind.HARD, "scoot"))
        assertEquals("Scoot", scoot.name)
        assertEquals("scoot", scoot.castId)
        assertEquals(2..4, scoot.guesses)
        assertEquals(BotTier.HARD, scoot.tier)
        val umi = CpuOpponent.identity("cpu:umi")
        assertTrue(umi.adaptive)
        val ghost = CpuOpponent.identity(CpuOpponent.opponentId(CpuKind.GHOST))
        assertEquals("Your Ghost", ghost.name)
        assertNull(ghost.castId)
        // The Bot of the Day names its bot; a legacy bare tier maps to its stand-in.
        assertEquals("Dewey", CpuOpponent.identity("cpu:daily:dewey").name)
        assertEquals("Opal", CpuOpponent.identity("cpu:medium").name)
        assertEquals("Ivy", CpuOpponent.identity("cpu:rook").name)
    }

    @Test
    fun personas_name_the_cast() {
        assertEquals("Your Ghost", BotPersonas.name("ghost"))
        assertEquals("Opal", BotPersonas.name("lexi"))
        assertEquals("Boss", BotPersonas.tierWord("webster"))
        assertEquals("Easy · solves in 6", BotPersonas.tierLine("rip"))
        assertEquals("Adaptive · matches your form", BotPersonas.tierLine("umi"))
        for (id in com.wordocious.core.BotCast.IDS) {
            for (e in BotPersonas.BotEvent.entries) assertTrue("$id $e", BotPersonas.line(id, e) != null)
        }
    }
}
