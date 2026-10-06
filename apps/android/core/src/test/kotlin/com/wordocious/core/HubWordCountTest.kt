package com.wordocious.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Doug (Android 2.7, 2026-10-05): the Hubbub header said "8/31 words" while the found-words
 * strip said "18 WORDS" — the strip counted the rarer (bonus) finds too. Every surface now takes
 * its word count from hubWordCount / hubWordsLabel, the strip is headed by a count-free label,
 * and rarer words score but never move the count. Mirrors hub.test.ts and HubWordCountTests.swift.
 */
class HubWordCountTest {
    private val puzzle = HubPuzzle("t", "OFAMYLR", listOf("FOAL", "FORM", "FORMAL", "FORMALLY"), listOf("MORA", "MARO"), listOf("FORMALLY"), 26)

    private fun play(vararg words: String): HubState =
        words.fold(HubState.create(puzzle, "t", 0L)) { s, w -> hubReduce(s, HubAction.Submit(w), 0L) }

    @Test fun headerAndStripShareOneCount() {
        val s = play("FORMALLY", "MORA", "FOAL", "MARO")
        assertEquals(listOf("FORMALLY", "FOAL"), s.found)
        assertEquals(listOf("MORA", "MARO"), s.bonusFound)
        assertEquals(HubWordCount(2, 4), hubWordCount(s))
        assertEquals("2/4 words", hubWordsLabel(s))
        // The strip's heading carries no number, so it can never disagree with the header.
        assertFalse(HUB_FOUND_LABEL.any { it.isDigit() })
    }

    // Prompt 05b (tester video): re-entering a found word says "Already found", never "Not a word we know".
    @Test fun reenteringAFoundWordIsFoundNotNotword() {
        var s = play("FOAL", "MORA")
        for (w in listOf("FOAL", "foal", "MORA", "mora")) assertEquals(w, HubReject.FOUND, hubReduce(s, HubAction.Submit(w), 0L).reject)
        s = hubReduce(s, HubAction.HintReveal, 0L)
        assertEquals(HubReject.FOUND, hubReduce(s, HubAction.Submit(s.revealed.first()), 0L).reject)
        assertEquals(s.points, hubReduce(s, HubAction.Submit("FOAL"), 0L).points)
    }

    @Test fun bonusWordsScoreButNeverMoveTheCount() {
        val before = play("FOAL")
        val after = hubReduce(before, HubAction.Submit("MORA"), 0L)
        assertTrue(after.points > before.points)
        assertEquals(hubWordsLabel(before), hubWordsLabel(after))
        assertTrue(hubIsBonus(after.bonusFound, "MORA"))
        assertFalse(hubIsBonus(after.bonusFound, "FOAL"))
    }
}
