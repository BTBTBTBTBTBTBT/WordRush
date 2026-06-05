package com.wordocious.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ProperNoundleTest {

    @Test
    fun normalize_strips_spaces_and_diacritics() {
        assertEquals("taylorswift", ProperNoundle.normalize("Taylor Swift"))
        assertEquals("beyonce", ProperNoundle.normalize("Beyoncé"))
        assertEquals("o'brien", ProperNoundle.normalize("O'Brien"))
    }

    @Test
    fun evaluate_two_pass() {
        val win = ProperNoundle.evaluate("taylorswift", "taylorswift")
        assertTrue(ProperNoundle.isWin(win))
        // length mismatch → all absent
        assertTrue(ProperNoundle.evaluate("abc", "abcd").all { it == TileState.ABSENT })
    }

    @Test
    fun wordGroups_from_display() {
        assertEquals(listOf(6, 5), ProperNoundle.wordGroups("Taylor Swift"))
    }

    @Test
    fun dailyPuzzle_deterministic_and_present() {
        val a = ProperNoundle.dailyPuzzle("2026-06-05")
        val b = ProperNoundle.dailyPuzzle("2026-06-05")
        assertNotNull(a)
        assertEquals(a, b) // same date → same puzzle
        assertTrue(a!!.answer.length <= 15)
    }

    @Test
    fun puzzleForSeed_deterministic() {
        val a = ProperNoundle.puzzleForSeed("daily-2026-06-05-PROPERNOUNDLE_VS")
        val b = ProperNoundle.puzzleForSeed("daily-2026-06-05-PROPERNOUNDLE_VS")
        assertNotNull(a)
        assertEquals(a, b)
    }
}
