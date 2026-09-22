package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-platform parity guard for the Sudoku engine (More Games §4): the
 * generator, reducer and matches-row round trip must match
 * packages/core/src/games/sudoku.ts byte for byte, or two platforms would serve
 * different givens on the same date.
 */
class SudokuFixtureTest {
    private fun loadFixture(name: String): String =
        javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    private data class Gen(
        val seed: String, val difficulty: String, val givens: String, val solution: String,
        val clues: Int, val rerolls: Int, val unique: Boolean, val singles: Boolean,
    )
    private data class Act(val type: String, val cell: Int?, val digit: Int?, val value: Boolean?, val now: Double?)
    private data class Expect(
        val board: String, val notes: List<Int>, val hintMask: String, val wrongMask: String,
        val mistakes: Int, val hintsUsed: Int, val status: String, val notesMode: Boolean, val historyLength: Int, val endTime: Double?,
    )
    private data class Row(val solutions: List<String>, val guesses: List<String>)
    private data class Recon(val solution: String, val givens: String, val board: String, val hintMask: String, val solved: Boolean)
    private data class Script(
        val name: String, val seed: String, val difficulty: String, val actions: List<Act>, val expect: Expect, val row: Row, val reconstruct: Recon?,
    )
    private data class Fixtures(val generation: List<Gen>, val reducer: List<Script>, val malformed: Recon?)

    private fun action(a: Act): SudokuAction = when (a.type) {
        "PLACE" -> SudokuAction.Place(a.cell!!, a.digit!!)
        "ERASE" -> SudokuAction.Erase(a.cell!!)
        "UNDO" -> SudokuAction.Undo
        "HINT" -> SudokuAction.Hint(a.cell)
        "TOGGLE_NOTES" -> SudokuAction.ToggleNotes
        "NOTE_TOGGLE" -> SudokuAction.NoteToggle(a.cell!!, a.digit!!)
        "SET_AUTO_CLEAR" -> SudokuAction.SetAutoClear(a.value!!)
        "FINISH" -> SudokuAction.Finish((a.now ?: 0.0).toLong())
        else -> error("unknown action ${a.type}")
    }

    @Test
    fun generation_matches_shared_fixtures() {
        val f = Gson().fromJson(loadFixture("sudoku-fixtures.json"), Fixtures::class.java)
        assertTrue(f.generation.isNotEmpty())
        for (c in f.generation) {
            val p = generateSudoku(c.seed, SudokuDifficulty.fromKey(c.difficulty)!!)
            assertEquals("givens(${c.seed}, ${c.difficulty})", c.givens, p.givens)
            assertEquals("solution(${c.seed})", c.solution, p.solution)
            assertEquals("clues(${c.seed})", c.clues, p.clues)
            assertEquals("rerolls(${c.seed})", c.rerolls, p.rerolls)
            assertEquals(c.unique, countSudokuSolutions(sudokuCells(p.givens), 2) == 1)
            assertEquals(c.singles, sudokuSolvableBySingles(sudokuCells(p.givens)))
        }
    }

    @Test
    fun reducer_scripts_match_shared_fixtures() {
        val f = Gson().fromJson(loadFixture("sudoku-fixtures.json"), Fixtures::class.java)
        assertTrue(f.reducer.isNotEmpty())
        for (sc in f.reducer) {
            val p = generateSudoku(sc.seed, SudokuDifficulty.fromKey(sc.difficulty)!!)
            var s = SudokuState.create(p, 0)
            for (a in sc.actions) s = sudokuReduce(s, action(a), 1000)
            assertEquals("${sc.name} board", sc.expect.board, s.board)
            assertEquals("${sc.name} notes", sc.expect.notes, s.notes)
            assertEquals("${sc.name} hintMask", sc.expect.hintMask, s.hintMask)
            assertEquals("${sc.name} wrongMask", sc.expect.wrongMask, s.wrongMask)
            assertEquals("${sc.name} mistakes", sc.expect.mistakes, s.mistakes)
            assertEquals("${sc.name} hintsUsed", sc.expect.hintsUsed, s.hintsUsed)
            assertEquals("${sc.name} status", sc.expect.status, s.status.key)
            assertEquals("${sc.name} notesMode", sc.expect.notesMode, s.notesMode)
            assertEquals("${sc.name} history", sc.expect.historyLength, s.history.size)
            assertEquals("${sc.name} endTime", sc.expect.endTime?.toLong(), s.endTime)
            val (solutions, guesses) = sudokuMatchRow(s)
            assertEquals(sc.row.solutions, solutions); assertEquals(sc.row.guesses, guesses)
            val r = reconstructSudoku(solutions, guesses)
            assertEquals(sc.reconstruct?.board, r?.board); assertEquals(sc.reconstruct?.solved, r?.solved)
            assertEquals(sc.reconstruct?.hintMask, r?.hintMask)
        }
        assertNull(reconstructSudoku(listOf("nope"), emptyList()))
        assertNull(f.malformed)
    }
}
