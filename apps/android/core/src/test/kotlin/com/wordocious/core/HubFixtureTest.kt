package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-platform parity guard for the Hubbub engine (More Games §12): bank
 * lookups, the integer rank maths, the reducer and the matches-row round trip
 * must match packages/core/src/games/hub.ts byte for byte.
 */
class HubFixtureTest {
    private fun loadFixture(name: String): String = javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    private data class DayCase(val day: String, val id: String?, val number: Int)
    private data class SeedCase(val seed: String, val id: String?)
    private data class Scoring(val points: Int, val max: Int, val rank: Int, val guessCount: Int, val boards: Int)
    private data class WordScore(val w: String, val score: Int)
    private data class Act(val type: String, val word: String?)
    private data class Expect(
        val found: List<String>, val bonusFound: List<String>, val revealed: List<String>, val hinted: List<String>, val points: Int, val hintsUsed: Int,
        val events: List<String>, val status: String, val ended: Boolean, val reject: String?, val endTime: Double?, val rank: Int, val guessCount: Int, val boardsSolved: Int,
    )
    private data class Row(val solutions: List<String>, val guesses: List<String>)
    private data class Recon(val found: List<String>, val bonusFound: List<String>, val revealed: List<String>, val points: Int, val hintsUsed: Int, val rank: Int, val rankName: String, val ended: Boolean, val solved: Boolean)
    private data class Script(val name: String, val id: String, val actions: List<Act>, val expect: Expect, val row: Row, val reconstruct: Recon?)
    private data class Puzzle(val id: String, val letters: String, val words: List<String>, val bonus: List<String>, val pangrams: List<String>, val max: Int)
    private data class Fixtures(
        val epoch: String, val dailyCount: Int, val extraCount: Int, val days: List<DayCase>, val seeds: List<SeedCase>, val puzzle: Puzzle,
        val scoring: List<Scoring>, val thresholds: List<Int>, val scores: List<WordScore>, val reducer: List<Script>, val malformed: Recon?,
    )

    private fun fixtures() = Gson().fromJson(loadFixture("hub-fixtures.json"), Fixtures::class.java)
    private fun puzzle(p: Puzzle) = HubPuzzle(p.id, p.letters, p.words, p.bonus, p.pangrams, p.max)
    private fun action(a: Act): HubAction = when (a.type) {
        "SUBMIT" -> HubAction.Submit(a.word!!)
        "HINT_START" -> HubAction.HintStart
        "HINT_REVEAL" -> HubAction.HintReveal
        "END" -> HubAction.End
        "FINISH" -> HubAction.Finish
        else -> error("unknown action ${a.type}")
    }

    @Test
    fun bank_and_scoring_match_shared_fixtures() {
        val f = fixtures(); val b = HubBank.bundled!!
        assertEquals(f.epoch, b.epoch); assertEquals(f.dailyCount, b.daily.size); assertEquals(f.extraCount, b.extra.size)
        for (c in f.days) { assertEquals("day ${c.day}", c.id, hubPuzzleForDay(b, c.day)?.id); assertEquals(c.number, hubDailyNumber(c.day)) }
        for (c in f.seeds) assertEquals("seed ${c.seed}", c.id, hubPuzzleForSeed(b, c.seed)?.id)
        assertEquals(puzzle(f.puzzle), b.daily[0])
        for (s in f.scoring) {
            assertEquals("rank ${s.points}/${s.max}", s.rank, hubRankIndex(s.points, s.max))
            assertEquals(s.guessCount, hubGuessCount(hubRankIndex(s.points, s.max)))
            assertEquals("boards ${s.points}/${s.max}", s.boards, hubBoardsSolved(s.points, s.max))
        }
        assertEquals(f.thresholds, (0 until 10).map { hubRankThreshold(it, f.puzzle.max) })
        for (w in f.scores) assertEquals("score ${w.w}", w.score, hubWordScore(w.w, f.puzzle.letters))
    }

    @Test
    fun reducer_scripts_match_shared_fixtures() {
        val f = fixtures()
        val p = puzzle(f.puzzle)
        assertTrue(f.reducer.isNotEmpty())
        for (sc in f.reducer) {
            var s = HubState.create(p, "fixture", 0)
            for (a in sc.actions) s = hubReduce(s, action(a), 1000)
            assertEquals("${sc.name} found", sc.expect.found, s.found)
            assertEquals("${sc.name} bonusFound", sc.expect.bonusFound, s.bonusFound)
            assertEquals("${sc.name} revealed", sc.expect.revealed, s.revealed)
            assertEquals("${sc.name} hinted", sc.expect.hinted, s.hinted)
            assertEquals("${sc.name} points", sc.expect.points, s.points)
            assertEquals("${sc.name} hintsUsed", sc.expect.hintsUsed, s.hintsUsed)
            assertEquals("${sc.name} events", sc.expect.events, s.events)
            assertEquals("${sc.name} status", sc.expect.status, s.status.key)
            assertEquals("${sc.name} ended", sc.expect.ended, s.ended)
            assertEquals("${sc.name} reject", sc.expect.reject, s.reject?.key)
            assertEquals("${sc.name} endTime", sc.expect.endTime?.toLong(), s.endTime)
            assertEquals(sc.expect.rank, s.rank); assertEquals(sc.expect.guessCount, s.guessCount); assertEquals(sc.expect.boardsSolved, s.boardsSolved)
            val (solutions, guesses) = hubMatchRow(s)
            assertEquals(sc.row.solutions, solutions); assertEquals(sc.row.guesses, guesses)
            val r = reconstructHub(solutions, guesses)
            assertNotNull(r)
            assertEquals(sc.reconstruct?.found, r!!.found); assertEquals(sc.reconstruct?.bonusFound, r.bonusFound); assertEquals(sc.reconstruct?.revealed, r.revealed)
            assertEquals(sc.reconstruct?.points, r.points); assertEquals(sc.reconstruct?.hintsUsed, r.hintsUsed); assertEquals(sc.reconstruct?.rank, r.rank)
            assertEquals(sc.reconstruct?.rankName, r.rankName); assertEquals(sc.reconstruct?.ended, r.ended); assertEquals(sc.reconstruct?.solved, r.solved)
        }
        assertNull(f.malformed); assertNull(reconstructHub(listOf("x", "ABC", "1"), emptyList()))
    }
}
