package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-platform parity guard for the Spyglass engine (More Games §17): bank
 * lookups, line geometry, the reducer and the matches-row round trip must
 * match packages/core/src/games/wordsearch.ts byte for byte.
 */
class WordsearchFixtureTest {
    private fun loadFixture(name: String): String = javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    private data class DayCase(val day: String, val id: String?, val number: Int)
    private data class SeedCase(val seed: String, val id: String?)
    private data class Act(val type: String, val from: Int?, val to: Int?)
    private data class Expect(
        val found: List<String>, val misses: Int, val hintsUsed: Int, val hinted: List<String>, val events: List<String>,
        val status: String, val endTime: Double?, val guessCount: Int,
    )
    private data class Row(val solutions: List<String>, val guesses: List<String>)
    private data class Recon(val found: List<String>, val misses: Int, val hintsUsed: Int, val revealed: Boolean, val solved: Boolean, val title: String)
    private data class Script(val name: String, val id: String, val actions: List<Act>, val expect: Expect, val row: Row, val reconstruct: Recon?)
    private data class Geo(val from: Int, val to: Int, val line: List<Int>?)
    private data class Place(val w: String, val r: Int, val c: Int, val d: String, val cells: List<Int>)
    private data class Puzzle(val id: String, val theme: String, val family: String, val title: String, val grid: String, val words: List<Place>)
    private data class Fixtures(
        val epoch: String, val dailyCount: Int, val extraCount: Int, val days: List<DayCase>, val seeds: List<SeedCase>,
        val puzzle: Puzzle, val reducer: List<Script>, val geometry: List<Geo>, val placements: List<Place>, val malformed: Recon?,
    )

    private fun fixtures() = Gson().fromJson(loadFixture("wordsearch-fixtures.json"), Fixtures::class.java)
    private fun bank(): WordsearchBank = WordsearchBank.bundled!!
    private fun puzzle(p: Puzzle) = WordsearchPuzzle(p.id, p.theme, p.family, p.title, p.grid, p.words.map { WordsearchPlacement(it.w, it.r, it.c, it.d) })
    private fun action(a: Act): WordsearchAction = when (a.type) {
        "SELECT" -> WordsearchAction.Select(a.from!!, a.to!!)
        "HINT" -> WordsearchAction.Hint
        "REVEAL" -> WordsearchAction.Reveal
        "FINISH" -> WordsearchAction.Finish
        else -> error("unknown action ${a.type}")
    }

    @Test
    fun bank_and_geometry_match_shared_fixtures() {
        val f = fixtures(); val b = bank()
        assertEquals(f.epoch, b.epoch); assertEquals(f.dailyCount, b.daily.size); assertEquals(f.extraCount, b.extra.size)
        for (c in f.days) {
            assertEquals("day ${c.day}", c.id, wordsearchPuzzleForDay(b, c.day)?.id)
            assertEquals("number ${c.day}", c.number, wordsearchDailyNumber(c.day))
        }
        for (c in f.seeds) assertEquals("seed ${c.seed}", c.id, wordsearchPuzzleForSeed(b, c.seed)?.id)
        assertEquals(puzzle(f.puzzle), b.daily[0])
        for (g in f.geometry) assertEquals("line ${g.from}->${g.to}", g.line, wordsearchLine(10, g.from, g.to))
        for (p in f.placements) assertEquals("cells ${p.w}", p.cells, wordsearchCells(10, WordsearchPlacement(p.w, p.r, p.c, p.d)))
    }

    @Test
    fun reducer_scripts_match_shared_fixtures() {
        val f = fixtures()
        val p = puzzle(f.puzzle)
        assertTrue(f.reducer.isNotEmpty())
        for (sc in f.reducer) {
            var s = WordsearchState.create(p, "fixture", 0)
            for (a in sc.actions) s = wordsearchReduce(s, action(a), 1000)
            assertEquals("${sc.name} found", sc.expect.found, s.found)
            assertEquals("${sc.name} misses", sc.expect.misses, s.misses)
            assertEquals("${sc.name} hintsUsed", sc.expect.hintsUsed, s.hintsUsed)
            assertEquals("${sc.name} hinted", sc.expect.hinted, s.hinted)
            assertEquals("${sc.name} events", sc.expect.events, s.events)
            assertEquals("${sc.name} status", sc.expect.status, s.status.key)
            assertEquals("${sc.name} endTime", sc.expect.endTime?.toLong(), s.endTime)
            assertEquals("${sc.name} guessCount", sc.expect.guessCount, s.guessCount)
            val (solutions, guesses) = wordsearchMatchRow(s)
            assertEquals(sc.row.solutions, solutions); assertEquals(sc.row.guesses, guesses)
            val r = reconstructWordsearch(solutions, guesses)
            assertNotNull(r)
            assertEquals(sc.reconstruct?.found, r!!.found); assertEquals(sc.reconstruct?.misses, r.misses)
            assertEquals(sc.reconstruct?.hintsUsed, r.hintsUsed); assertEquals(sc.reconstruct?.revealed, r.revealed)
            assertEquals(sc.reconstruct?.solved, r.solved); assertEquals(sc.reconstruct?.title, r.title)
        }
        assertNull(f.malformed); assertNull(reconstructWordsearch(listOf("nope"), emptyList()))
    }
}
