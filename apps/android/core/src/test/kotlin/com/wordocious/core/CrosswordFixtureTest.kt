package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-platform parity guard for the Crosswordocious engine (More Games §13):
 * bank lookups (holiday and plain), the layout helpers, the reducer and the
 * matches-row round trip must match packages/core/src/games/crossword.ts byte
 * for byte.
 */
class CrosswordFixtureTest {
    private fun loadFixture(name: String): String = javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    private data class DayCase(val day: String, val id: String?, val plainId: String?, val number: Int)
    private data class SeedCase(val seed: String, val id: String?)
    private data class Entry(val n: Int, val dir: String, val r: Int, val c: Int, val answer: String, val clue: String)
    private data class Puzzle(val id: String, val title: String, val theme: String, val w: Int, val h: Int, val entries: List<Entry>, val holiday: String?)
    private data class EntryCells(val n: Int, val dir: String, val cells: List<Int>)
    private data class GuessCount(val checks: Int, val guessCount: Int)
    private data class Act(val type: String, val cell: Int?, val letter: String?, val n: Int?, val dir: String?)
    private data class Expect(
        val fill: String, val locked: String, val revealed: String, val checks: Int, val hintsUsed: Int, val lastWrong: List<Int>, val events: List<String>,
        val status: String, val ended: Boolean, val endTime: Double?, val guessCount: Int, val correct: Int, val total: Int,
    )
    private data class Row(val solutions: List<String>, val guesses: List<String>)
    private data class Recon(
        val id: String, val title: String, val w: Int, val h: Int, val solution: String, val answers: List<String>,
        val fill: String, val revealed: String, val checks: Int, val correct: Int, val total: Int, val hintsUsed: Int, val revealedPuzzle: Boolean, val solved: Boolean,
    )
    private data class Script(val name: String, val id: String, val actions: List<Act>, val expect: Expect, val row: Row, val reconstruct: Recon?)
    private data class Fixtures(
        val epoch: String, val dailyCount: Int, val extraCount: Int, val holidayKeys: List<String>, val days: List<DayCase>, val seeds: List<SeedCase>,
        val puzzle: Puzzle, val solution: String, val entryCells: List<EntryCells>, val guessCounts: List<GuessCount>, val reducer: List<Script>, val malformed: List<Recon?>,
    )

    private fun fixtures() = Gson().fromJson(loadFixture("crossword-fixtures.json"), Fixtures::class.java)
    private fun entry(e: Entry) = CrosswordEntry(e.n, e.dir, e.r, e.c, e.answer, e.clue)
    private fun puzzle(p: Puzzle) = CrosswordPuzzle(p.id, p.title, p.theme, p.w, p.h, p.entries.map { entry(it) }, p.holiday)
    private fun action(a: Act): CrosswordAction = when (a.type) {
        "SET" -> CrosswordAction.Set(a.cell!!, a.letter!!)
        "CLEAR" -> CrosswordAction.Clear(a.cell!!)
        "CHECK" -> CrosswordAction.Check
        "REVEAL_LETTER" -> CrosswordAction.RevealLetter(a.cell!!)
        "REVEAL_WORD" -> CrosswordAction.RevealWord(a.n!!, a.dir!!)
        "REVEAL_PUZZLE" -> CrosswordAction.RevealPuzzle
        "FINISH" -> CrosswordAction.Finish
        else -> error("unknown action ${a.type}")
    }
    private fun assertRecon(label: String, x: Recon, r: CrosswordReconstruction) {
        assertEquals("$label id", x.id, r.id)
        assertEquals("$label title", x.title, r.title)
        assertEquals("$label w", x.w, r.w)
        assertEquals("$label h", x.h, r.h)
        assertEquals("$label solution", x.solution, r.solution)
        assertEquals("$label answers", x.answers, r.answers)
        assertEquals("$label fill", x.fill, r.fill)
        assertEquals("$label revealed", x.revealed, r.revealed)
        assertEquals("$label checks", x.checks, r.checks)
        assertEquals("$label correct", x.correct, r.correct)
        assertEquals("$label total", x.total, r.total)
        assertEquals("$label hintsUsed", x.hintsUsed, r.hintsUsed)
        assertEquals("$label revealedPuzzle", x.revealedPuzzle, r.revealedPuzzle)
        assertEquals("$label solved", x.solved, r.solved)
    }

    @Test
    fun bank_and_layout_match_shared_fixtures() {
        val f = fixtures(); val b = CrosswordBank.bundled!!; val h = HolidayTable.bundled!!
        assertEquals(f.epoch, b.epoch); assertEquals(f.dailyCount, b.daily.size); assertEquals(f.extraCount, b.extra.size)
        assertEquals(f.holidayKeys, b.holiday!!.keys.toList())
        assertTrue(f.days.isNotEmpty())
        for (c in f.days) {
            assertEquals("day ${c.day}", c.id, crosswordPuzzleForDay(b, c.day, h)?.id)
            assertEquals("plain day ${c.day}", c.plainId, crosswordPuzzleForDay(b, c.day, null)?.id)
            assertEquals("number ${c.day}", c.number, crosswordDailyNumber(c.day))
        }
        for (c in f.seeds) assertEquals("seed ${c.seed}", c.id, crosswordPuzzleForSeed(b, c.seed)?.id)
        assertEquals(puzzle(f.puzzle), b.daily[0])
        val p = puzzle(f.puzzle)
        assertEquals(f.solution, crosswordSolution(p))
        assertEquals(p.w * p.h, f.solution.length)
        assertTrue(f.entryCells.isNotEmpty())
        assertEquals(p.entries.size, f.entryCells.size)
        for (c in f.entryCells) {
            val e = p.entries.first { it.n == c.n && it.dir == c.dir }
            assertEquals("cells ${c.n}${c.dir}", c.cells, crosswordEntryCells(p, e))
            for (cell in c.cells) assertTrue("entriesAt $cell holds ${c.n}${c.dir}", e in crosswordEntriesAt(p, cell))
        }
        assertTrue(f.guessCounts.isNotEmpty())
        for (g in f.guessCounts) assertEquals("guessCount ${g.checks}", g.guessCount, crosswordGuessCount(g.checks))
        val init = createCrosswordState(p, "fixture", 0)
        assertEquals(CrosswordStatus.PLAYING, init.status); assertEquals(0, init.checks); assertEquals(0, init.hintsUsed); assertNull(init.endTime)
        assertEquals(f.solution, init.solution); assertEquals(0, init.correctCount); assertEquals(false, init.solved)
    }

    @Test
    fun reducer_scripts_match_shared_fixtures() {
        val f = fixtures()
        val p = puzzle(f.puzzle)
        assertTrue(f.reducer.isNotEmpty())
        for (sc in f.reducer) {
            assertEquals(sc.id, p.id)
            var s = createCrosswordState(p, "fixture", 0)
            for (a in sc.actions) s = crosswordReduce(s, action(a), 1000)
            val e = sc.expect
            assertEquals("${sc.name} fill", e.fill, s.fill)
            assertEquals("${sc.name} locked", e.locked, s.locked)
            assertEquals("${sc.name} revealed", e.revealed, s.revealed)
            assertEquals("${sc.name} checks", e.checks, s.checks)
            assertEquals("${sc.name} hintsUsed", e.hintsUsed, s.hintsUsed)
            assertEquals("${sc.name} lastWrong", e.lastWrong, s.lastWrong)
            assertEquals("${sc.name} events", e.events, s.events)
            assertEquals("${sc.name} status", e.status, s.status.key)
            assertEquals("${sc.name} ended", e.ended, s.ended)
            assertEquals("${sc.name} endTime", e.endTime?.toLong(), s.endTime)
            assertEquals("${sc.name} guessCount", e.guessCount, s.guessCount)
            assertEquals("${sc.name} correct", e.correct, s.correctCount)
            assertEquals("${sc.name} total", e.total, s.letterCount)
            val (solutions, guesses) = crosswordMatchRow(s)
            assertEquals("${sc.name} solutions", sc.row.solutions, solutions); assertEquals("${sc.name} guesses", sc.row.guesses, guesses)
            val r = reconstructCrossword(solutions, guesses)
            assertNotNull("${sc.name} reconstruct", r); assertNotNull("${sc.name} fixture reconstruct", sc.reconstruct)
            assertRecon("${sc.name} recon", sc.reconstruct!!, r!!)
        }
        // malformed = [no dims in the head, dims that do not match the grid, a well-formed 1x2 row with a letter hint and two checks]
        assertEquals(3, f.malformed.size)
        assertNull(f.malformed[0]); assertNull(f.malformed[1]); assertNotNull(f.malformed[2])
        assertNull(reconstructCrossword(listOf("x|y", "ABC"), emptyList()))
        assertNull(reconstructCrossword(listOf("x|y|2x2", "ABC", "AB"), emptyList()))
        val third = reconstructCrossword(listOf("x|y|1x2", "AB", "AB"), listOf("=A_", "hl.", "c2"))
        assertNotNull("malformed[2]", third)
        assertRecon("malformed[2]", f.malformed[2]!!, third!!)
        assertNull(reconstructCrossword(null, null)); assertNull(reconstructCrossword(emptyList(), emptyList()))
        assertNull(reconstructCrossword(listOf("x|y|1x2", "AB"), emptyList()))
    }
}
