package com.wordocious.core

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Doug (Android, 2026-10-05): typing 1-Across in "The Turning Year" (cw-kzdl08), the H landed in the cell
 * where 2-Down starts and "ITE" ran down 2-Down. Mirrors packages/core crossword.test.ts "cursor".
 */
class CrosswordCursorTest {
    private val bank = CrosswordBank.parse(javaClass.classLoader!!.getResource("data/crossword-puzzles.json")!!.readText())!!
    private val p = (bank.daily + bank.extra + bank.holiday.orEmpty().values.flatten()).first { it.id == "cw-kzdl08" }
    private fun at(r: Int, c: Int) = crosswordIndex(p.w, r, c)

    private fun typeWord(word: String, startDir: String): Triple<CrosswordState, CrosswordCursor, List<Int>> {
        var s = createCrosswordState(p, "xw-cursor", 0)
        var cur = CrosswordCursor(at(0, 3), startDir)
        val visited = mutableListOf<Int>()
        for (ch in word) {
            val entry = crosswordActiveEntry(s, cur.cell, cur.dir)
            visited += cur.cell
            s = crosswordReduce(s, CrosswordAction.Set(cur.cell, ch.toString()))
            cur = crosswordCursorAfterType(s, cur.cell, entry) ?: cur
        }
        return Triple(s, cur, visited)
    }

    @Test fun typingWhiteFillsOneAcrossThroughTheCellsWhereDownWordsStart() {
        val (s, cur, visited) = typeWord("WHITE", "A")
        assertEquals(listOf(3, 4, 5, 6, 7), visited)
        assertEquals("WHITE", crosswordEntryCells(s, p.entries[0]).map { s.fill[it] }.joinToString(""))
        assertEquals(CROSSWORD_EMPTY, s.fill[at(1, 4)]) // nothing ran down 2-Down
        assertEquals("A", cur.dir) // complete: on to the next Across with an empty cell (6A)
        assertEquals(6, crosswordActiveEntry(s, cur.cell, cur.dir)?.n)
    }

    @Test fun aStaleDownDirectionNeverTurnsTheWord() {
        val (s, _, visited) = typeWord("WHITE", "D")
        assertEquals(listOf(3, 4, 5, 6, 7), visited)
        assertEquals("WHITE", crosswordEntryCells(s, p.entries[0]).map { s.fill[it] }.joinToString(""))
    }

    @Test fun toggleFlipsOnlyWhereBothPassAndAWordEndFillsItsGapFirst() {
        val s0 = createCrosswordState(p, "xw-cursor", 0)
        assertEquals("D", crosswordToggleDir(s0, at(0, 4), "A"))
        assertEquals("A", crosswordToggleDir(s0, at(0, 5), "A"))
        assertEquals("A", crosswordToggleDir(s0, at(0, 5), "D"))
        val s = crosswordReduce(s0, CrosswordAction.Set(7, "E"))
        assertEquals(CrosswordCursor(3, "A"), crosswordCursorAfterType(s, 7, p.entries[0]))
    }
}
