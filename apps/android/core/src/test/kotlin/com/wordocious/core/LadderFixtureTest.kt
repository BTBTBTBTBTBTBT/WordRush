package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-platform parity guard for the Letter Ladder engine (More Games §15):
 * bank lookups, the reducer, the BFS hint and the matches-row round trip must
 * match packages/core/src/games/ladder.ts byte for byte.
 */
class LadderFixtureTest {
    private fun loadFixture(name: String): String = javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    private data class DayCase(val day: String, val id: String?, val number: Int)
    private data class SeedCase(val seed: String, val id: String?)
    private data class Act(val type: String, val word: String?)
    private data class Expect(
        val words: List<String>, val hintMask: String, val moves: Int, val hintsUsed: Int, val events: List<String>,
        val status: String, val reject: String?, val endTime: Double?, val guessCount: Int,
    )
    private data class Row(val solutions: List<String>, val guesses: List<String>)
    private data class Recon(val words: List<String>, val hintMask: String, val moves: Int, val hintsUsed: Int, val solved: Boolean, val par: Int, val path: List<String>)
    private data class Script(val name: String, val id: String, val actions: List<Act>, val expect: Expect, val row: Row, val reconstruct: Recon?)
    private data class DictHint(val id: String, val from: String, val end: String, val next: String?)
    private data class Neigh(val word: String, val neighbours: List<String>)
    private data class Puzzle(val id: String, val start: String, val end: String, val par: Int, val path: List<String>)
    private data class Fixtures(
        val epoch: String, val dailyCount: Int, val extraCount: Int, val days: List<DayCase>, val seeds: List<SeedCase>,
        val allowed: List<String>, val puzzle: Puzzle, val reducer: List<Script>, val dictHints: List<DictHint>, val neighbours: List<Neigh>, val malformed: Recon?,
    )

    private fun fixtures() = Gson().fromJson(loadFixture("ladder-fixtures.json"), Fixtures::class.java)
    private fun bank(): LadderBank = LadderBank.bundled!!
    private fun fullAllowed(): Set<String> {
        val text = javaClass.classLoader!!.getResourceAsStream("data/allowed.json")!!.bufferedReader().use { it.readText() }
        return Gson().fromJson(text, Array<String>::class.java).map { it.uppercase() }.filter { it.length == 5 }.toHashSet()
    }
    private fun action(a: Act): LadderAction = when (a.type) {
        "SUBMIT" -> LadderAction.Submit(a.word!!)
        "UNDO" -> LadderAction.Undo
        "HINT" -> LadderAction.Hint
        "FINISH" -> LadderAction.Finish
        else -> error("unknown action ${a.type}")
    }

    @Test
    fun bank_lookups_match_shared_fixtures() {
        val f = fixtures(); val b = bank()
        assertEquals(f.epoch, b.epoch); assertEquals(f.dailyCount, b.daily.size); assertEquals(f.extraCount, b.extra.size)
        for (c in f.days) {
            assertEquals("day ${c.day}", c.id, ladderPuzzleForDay(b, c.day)?.id)
            assertEquals("number ${c.day}", c.number, ladderDailyNumber(c.day))
        }
        for (c in f.seeds) assertEquals("seed ${c.seed}", c.id, ladderPuzzleForSeed(b, c.seed)?.id)
        assertEquals(LadderPuzzle(f.puzzle.id, f.puzzle.start, f.puzzle.end, f.puzzle.par, f.puzzle.path), b.daily[0])
    }

    @Test
    fun reducer_scripts_match_shared_fixtures() {
        val f = fixtures()
        val allowed = f.allowed.toHashSet()
        val p = LadderPuzzle(f.puzzle.id, f.puzzle.start, f.puzzle.end, f.puzzle.par, f.puzzle.path)
        assertTrue(f.reducer.isNotEmpty())
        for (sc in f.reducer) {
            var s = LadderState.create(p, "fixture", 0)
            for (a in sc.actions) s = ladderReduce(s, action(a), allowed, 1000)
            assertEquals("${sc.name} words", sc.expect.words, s.words)
            assertEquals("${sc.name} hintMask", sc.expect.hintMask, s.hintMask)
            assertEquals("${sc.name} moves", sc.expect.moves, s.moves)
            assertEquals("${sc.name} hintsUsed", sc.expect.hintsUsed, s.hintsUsed)
            assertEquals("${sc.name} events", sc.expect.events, s.events)
            assertEquals("${sc.name} status", sc.expect.status, s.status.key)
            assertEquals("${sc.name} reject", sc.expect.reject, s.reject?.key)
            assertEquals("${sc.name} endTime", sc.expect.endTime?.toLong(), s.endTime)
            assertEquals("${sc.name} guessCount", sc.expect.guessCount, s.guessCount)
            val (solutions, guesses) = ladderMatchRow(s)
            assertEquals(sc.row.solutions, solutions); assertEquals(sc.row.guesses, guesses)
            val r = reconstructLadder(solutions, guesses)
            assertNotNull(r)
            assertEquals(sc.reconstruct?.words, r!!.words); assertEquals(sc.reconstruct?.hintMask, r.hintMask)
            assertEquals(sc.reconstruct?.moves, r.moves); assertEquals(sc.reconstruct?.hintsUsed, r.hintsUsed)
            assertEquals(sc.reconstruct?.solved, r.solved); assertEquals(sc.reconstruct?.par, r.par); assertEquals(sc.reconstruct?.path, r.path)
        }
        assertNull(f.malformed); assertNull(reconstructLadder(listOf("nope"), emptyList()))
    }

    @Test
    fun hints_over_the_full_dictionary_match_shared_fixtures() {
        val f = fixtures(); val allowed = fullAllowed(); val b = bank()
        for (h in f.dictHints) {
            val q = b.daily.first { it.id == h.id }
            val avoid = if (h.from == q.start) setOf(q.start) else q.path.take(2).toSet()
            assertEquals("hint ${h.id} from ${h.from}", h.next, ladderNextStep(h.from, h.end, allowed, avoid))
        }
        for (n in f.neighbours) assertEquals("neighbours ${n.word}", n.neighbours, ladderNeighbours(n.word, allowed))
    }
}
