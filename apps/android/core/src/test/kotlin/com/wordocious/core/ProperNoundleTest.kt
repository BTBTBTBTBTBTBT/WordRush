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

/**
 * Pins ProperNoundle.rebuildRow — the Android half of the hint-row
 * reconstruction fix (web mirror: components/propernoundle/reconstruct.test.ts,
 * iOS mirror: ProperNoundleReconstructTests.swift). The shipped bug: a
 * "Sam Smith" daily played on one platform and viewed on another rendered the
 * revealed I and H stacked at slot 0 in gray, because the recorded positional
 * padding was normalized away before evaluation.
 */
class ProperNoundleRebuildRowTest {
    private val answer = "Sam Smith" // normalizes to "samsmith" — i@5, h@7

    private fun correctIdxs(tiles: List<TileState>): List<Int> =
        tiles.mapIndexedNotNull { i, t -> if (t == TileState.CORRECT) i else null }

    @Test
    fun space_padded_hint_row_keeps_its_slot() {
        // The shape the apps record (ProperNoundleView.reveal / PN screen).
        val row = ProperNoundle.rebuildRow("     i  ", answer)
        assertEquals(listOf(5), correctIdxs(row.tiles))
        assertEquals("I", row.letters[5])
        assertEquals("", row.letters[0])            // the bug put "I" here
        assertEquals(TileState.HINT_USED, row.tiles[0])
        assertEquals(8, row.letters.size)
    }

    @Test
    fun underscore_padded_hint_row_keeps_its_slot() {
        // The shape the web records (use-hints.ts).
        val row = ProperNoundle.rebuildRow("_____i__", answer)
        assertEquals(listOf(5), correctIdxs(row.tiles))
        assertEquals("I", row.letters[5])
    }

    @Test
    fun repeated_revealed_letter_marks_every_occurrence() {
        // "samsmith": s@0,3.
        val row = ProperNoundle.rebuildRow("s  s    ", answer)
        assertEquals(listOf(0, 3), correctIdxs(row.tiles))
    }

    @Test
    fun clue_row_is_full_hint_used_row() {
        // The clue hint records "" — must render a gray row, not an empty one.
        val row = ProperNoundle.rebuildRow("", answer)
        assertEquals(List(8) { TileState.HINT_USED }, row.tiles)
        assertTrue(row.letters.all { it.isEmpty() })
    }

    @Test
    fun real_guesses_still_go_through_the_evaluator() {
        val win = ProperNoundle.rebuildRow("samsmith", answer)
        assertEquals(List(8) { TileState.CORRECT }, win.tiles)
        assertEquals("SAMSMITH", win.letters.joinToString(""))

        val display = ProperNoundle.rebuildRow("Sam Smith", answer)
        assertEquals(List(8) { TileState.CORRECT }, display.tiles)

        val wrong = ProperNoundle.rebuildRow("mithsams", answer)
        assertTrue(wrong.tiles.none { it == TileState.HINT_USED })
        assertTrue(wrong.tiles.any { it != TileState.CORRECT })
    }

    @Test
    fun hint_rows_are_identifiable_for_hint_counting() {
        // The completed cards count hints by HINT_USED tiles — only a hint row
        // can contain one, since the evaluator never emits it.
        assertTrue(ProperNoundle.rebuildRow("     i  ", answer).tiles.contains(TileState.HINT_USED))
        assertTrue(ProperNoundle.rebuildRow("", answer).tiles.contains(TileState.HINT_USED))
        assertTrue(ProperNoundle.rebuildRow("samsmith", answer).tiles.none { it == TileState.HINT_USED })
    }
}
