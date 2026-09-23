package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-platform parity guard for the Muddle engine (More Games §5): bank
 * lookups (holiday and plain), the tray helpers, the reducer and the
 * matches-row round trip must match packages/core/src/games/scramble.ts byte
 * for byte.
 */
class ScrambleFixtureTest {
    private fun loadFixture(name: String): String = javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    private data class DayCase(val day: String, val id: String?, val plainId: String?, val number: Int)
    private data class SeedCase(val seed: String, val id: String?)
    private data class Word(val answer: String, val scramble: String, val circled: List<Int>)
    private data class Final(val answer: String, val pattern: List<Int>)
    private data class Puzzle(val id: String, val words: List<Word>, val final: Final, val caption: String, val altText: String, val cartoon: String?, val holiday: String?)
    private data class Remaining(val pool: String, val entry: String, val left: String)
    private data class Act(val type: String, val row: Int?, val letter: String?)
    private data class Expect(
        val entries: List<String>, val solved: List<Boolean>, val revealed: List<String>, val checks: Int, val mistakes: Int, val hintsUsed: Int,
        val lastRow: Int?, val lastResult: String?, val events: List<String>, val status: String, val ended: Boolean, val endTime: Double?,
        val guessCount: Int, val boardsSolved: Int, val activeRow: Int?, val finalOpen: Boolean,
    )
    private data class Row(val solutions: List<String>, val guesses: List<String>)
    private data class Recon(
        val words: List<String>, val final: String, val solved: List<Boolean>, val checks: Int, val mistakes: Int, val hintsUsed: Int,
        val solvedByHint: List<Int>, val boardsSolved: Int, val lost: Boolean, val won: Boolean,
    )
    private data class Script(val name: String, val id: String, val actions: List<Act>, val expect: Expect, val row: Row, val reconstruct: Recon?)
    private data class Fixtures(
        val epoch: String, val dailyCount: Int, val extraCount: Int, val holidayKeys: List<String>, val days: List<DayCase>, val seeds: List<SeedCase>,
        val puzzle: Puzzle, val finalLetters: String, val finalTray: String, val targets: List<String>, val remaining: List<Remaining>,
        val reducer: List<Script>, val malformed: List<Recon?>,
    )

    private fun fixtures() = Gson().fromJson(loadFixture("scramble-fixtures.json"), Fixtures::class.java)
    private fun puzzle(p: Puzzle) = ScramblePuzzle(
        p.id, p.words.map { ScrambleWord(it.answer, it.scramble, it.circled) }, ScrambleFinal(p.final.answer, p.final.pattern), p.caption, p.altText, p.cartoon, p.holiday,
    )
    private fun action(a: Act): ScrambleAction = when (a.type) {
        "TYPE" -> ScrambleAction.Type(a.row!!, a.letter!!)
        "BACK" -> ScrambleAction.Back(a.row!!)
        "CLEAR" -> ScrambleAction.Clear(a.row!!)
        "REVEAL_LETTER" -> ScrambleAction.RevealLetter(a.row!!)
        "SOLVE_WORD" -> ScrambleAction.SolveWord(a.row!!)
        "FINISH" -> ScrambleAction.Finish
        else -> error("unknown action ${a.type}")
    }
    private fun assertRecon(label: String, x: Recon, r: ScrambleReconstruction) {
        assertEquals("$label words", x.words, r.words)
        assertEquals("$label final", x.final, r.final)
        assertEquals("$label solved", x.solved, r.solved)
        assertEquals("$label checks", x.checks, r.checks)
        assertEquals("$label mistakes", x.mistakes, r.mistakes)
        assertEquals("$label hintsUsed", x.hintsUsed, r.hintsUsed)
        assertEquals("$label solvedByHint", x.solvedByHint, r.solvedByHint)
        assertEquals("$label boardsSolved", x.boardsSolved, r.boardsSolved)
        assertEquals("$label lost", x.lost, r.lost)
        assertEquals("$label won", x.won, r.won)
    }

    @Test
    fun bank_and_helpers_match_shared_fixtures() {
        val f = fixtures(); val b = ScrambleBank.bundled!!; val h = HolidayTable.bundled!!
        assertEquals(f.epoch, b.epoch); assertEquals(f.dailyCount, b.daily.size); assertEquals(f.extraCount, b.extra.size)
        assertEquals(f.holidayKeys, b.holiday!!.keys.toList())
        assertTrue(f.days.isNotEmpty())
        for (c in f.days) {
            assertEquals("day ${c.day}", c.id, scramblePuzzleForDay(b, c.day, h)?.id)
            assertEquals("plain day ${c.day}", c.plainId, scramblePuzzleForDay(b, c.day, null)?.id)
            assertEquals("number ${c.day}", c.number, scrambleDailyNumber(c.day))
        }
        assertTrue(f.seeds.isNotEmpty())
        for (c in f.seeds) assertEquals("seed ${c.seed}", c.id, scramblePuzzleForSeed(b, c.seed)?.id)
        assertEquals(puzzle(f.puzzle), b.daily[0])
        val p = puzzle(f.puzzle)
        assertEquals(f.finalLetters, scrambleFinalLetters(p))
        assertEquals(f.finalTray, scrambleFinalTray(p))
        val init = createScrambleState(p, "fixture", 0)
        assertEquals(SCRAMBLE_TOTAL_BOARDS, f.targets.size)
        for (r in f.targets.indices) assertEquals("target $r", f.targets[r], scrambleTarget(init, r))
        assertEquals(f.finalTray, scrambleTray(init, SCRAMBLE_FINAL))
        for (r in 0 until SCRAMBLE_WORDS) assertEquals("tray $r", p.words[r].scramble, scrambleTray(init, r))
        assertTrue(f.remaining.isNotEmpty())
        for (c in f.remaining) assertEquals("remaining ${c.pool}/${c.entry}", c.left, scrambleRemaining(c.pool, c.entry))
        assertEquals(ScrambleStatus.PLAYING, init.status); assertEquals(0, init.checks); assertEquals(0, init.mistakes); assertEquals(0, init.hintsUsed)
        assertNull(init.endTime); assertNull(init.lastRow); assertNull(init.lastResult); assertEquals(false, init.finalOpen); assertEquals(0, init.activeRow)
        assertEquals(1, init.guessCount); assertEquals(0, init.boardsSolved)
        assertEquals(listOf("", "", "", "", ""), init.entries)
        assertEquals(p.words.map { "_".repeat(it.answer.length) } + "_".repeat(f.finalLetters.length), init.revealed)
    }

    @Test
    fun reducer_scripts_match_shared_fixtures() {
        val f = fixtures()
        val p = puzzle(f.puzzle)
        assertTrue(f.reducer.isNotEmpty())
        for (sc in f.reducer) {
            assertEquals(sc.id, p.id)
            var s = createScrambleState(p, "fixture", 0)
            for (a in sc.actions) s = scrambleReduce(s, action(a), 1000)
            val e = sc.expect
            assertEquals("${sc.name} entries", e.entries, s.entries)
            assertEquals("${sc.name} solved", e.solved, s.solved)
            assertEquals("${sc.name} revealed", e.revealed, s.revealed)
            assertEquals("${sc.name} checks", e.checks, s.checks)
            assertEquals("${sc.name} mistakes", e.mistakes, s.mistakes)
            assertEquals("${sc.name} hintsUsed", e.hintsUsed, s.hintsUsed)
            assertEquals("${sc.name} lastRow", e.lastRow, s.lastRow)
            assertEquals("${sc.name} lastResult", e.lastResult, s.lastResult?.key)
            assertEquals("${sc.name} events", e.events, s.events)
            assertEquals("${sc.name} status", e.status, s.status.key)
            assertEquals("${sc.name} ended", e.ended, s.ended)
            assertEquals("${sc.name} endTime", e.endTime?.toLong(), s.endTime)
            assertEquals("${sc.name} guessCount", e.guessCount, s.guessCount)
            assertEquals("${sc.name} boardsSolved", e.boardsSolved, s.boardsSolved)
            assertEquals("${sc.name} activeRow", e.activeRow, s.activeRow)
            assertEquals("${sc.name} finalOpen", e.finalOpen, s.finalOpen)
            val (solutions, guesses) = scrambleMatchRow(s)
            assertEquals("${sc.name} solutions", sc.row.solutions, solutions); assertEquals("${sc.name} guesses", sc.row.guesses, guesses)
            val r = reconstructScramble(solutions, guesses)
            assertNotNull("${sc.name} reconstruct", r); assertNotNull("${sc.name} fixture reconstruct", sc.reconstruct)
            assertRecon("${sc.name} recon", sc.reconstruct!!, r!!)
        }
        // malformed = [two solutions, a lowercase punchline, a well-formed row with a wrong try, a letter hint, a hint-solved word and a junk event]
        assertEquals(3, f.malformed.size)
        assertNull(f.malformed[0]); assertNull(f.malformed[1]); assertNotNull(f.malformed[2])
        assertNull(reconstructScramble(listOf("A", "B"), emptyList()))
        assertNull(reconstructScramble(listOf("ABCDE", "ABCDE", "ABCDE", "ABCDE", "ab"), emptyList()))
        val third = reconstructScramble(
            listOf("MOTOR", "EXILED", "BATTEN", "FRAUD", "ABOUT TIME"),
            listOf("0✓MOTOR", "1✗XXXXXX", "2h__T___", "3H", "4✓ABOUTTIME", "junk"),
        )
        assertNotNull("malformed[2]", third)
        assertRecon("malformed[2]", f.malformed[2]!!, third!!)
        assertNull(reconstructScramble(null, null)); assertNull(reconstructScramble(emptyList(), emptyList()))
        assertNull(reconstructScramble(listOf("ABCD", "ABCDE", "ABCDE", "ABCDE", "AB"), emptyList()))
    }
}
