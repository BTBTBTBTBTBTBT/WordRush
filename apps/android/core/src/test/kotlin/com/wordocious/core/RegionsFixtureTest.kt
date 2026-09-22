package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-platform parity guard for the Starsweep engine (More Games §18b): the
 * generator, reducer and matches-row round trip must match
 * packages/core/src/games/regions.ts byte for byte, or two platforms would
 * serve different boards on the same date.
 */
class RegionsFixtureTest {
    private fun loadFixture(name: String): String =
        javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    private data class Gen(val seed: String, val n: Int, val regions: String, val solution: String, val sizes: List<Int>, val rerolls: Int, val unique: Boolean)
    private data class Act(val type: String, val cell: Int?, val value: Boolean?, val now: Double?)
    private data class Expect(
        val board: String, val hintMask: String, val wrongMask: String, val mistakes: Int, val hintsUsed: Int,
        val status: String, val autoCross: Boolean, val historyLength: Int, val endTime: Double?,
    )
    private data class Row(val solutions: List<String>, val guesses: List<String>)
    private data class Recon(val n: Int, val regions: String, val solution: String, val board: String, val hintMask: String, val solved: Boolean)
    private data class Script(val name: String, val seed: String, val n: Int, val actions: List<Act>, val expect: Expect, val row: Row, val reconstruct: Recon?)
    private data class Ruled(val cell: Int, val cells: List<Int>)
    private data class Size(val day: String, val n: Int)
    private data class Fixtures(val generation: List<Gen>, val reducer: List<Script>, val ruledOut: List<Ruled>, val sizes: List<Size>, val malformed: Recon?)

    private fun action(a: Act): RegionsAction = when (a.type) {
        "TAP" -> RegionsAction.Tap(a.cell!!)
        "ERASE" -> RegionsAction.Erase(a.cell!!)
        "UNDO" -> RegionsAction.Undo
        "HINT" -> RegionsAction.Hint(a.cell)
        "SET_AUTO_CROSS" -> RegionsAction.SetAutoCross(a.value!!)
        "FINISH" -> RegionsAction.Finish((a.now ?: 0.0).toLong())
        else -> error("unknown action ${a.type}")
    }

    @Test
    fun generation_matches_shared_fixtures() {
        val f = Gson().fromJson(loadFixture("regions-fixtures.json"), Fixtures::class.java)
        assertTrue(f.generation.isNotEmpty())
        for (c in f.generation) {
            val p = generateRegions(c.seed, c.n)
            assertNotNull("nil board ${c.seed} ${c.n}", p)
            assertEquals("regions(${c.seed}, ${c.n})", c.regions, p!!.regions)
            assertEquals("solution(${c.seed})", c.solution, p.solution)
            assertEquals("sizes(${c.seed})", c.sizes, p.sizes)
            assertEquals("rerolls(${c.seed})", c.rerolls, p.rerolls)
            val reg = IntArray(p.regions.length) { p.regions[it] - '0' }
            assertEquals(c.unique, countRegionsSolutions(c.n, reg) == 1)
        }
    }

    @Test
    fun reducer_scripts_match_shared_fixtures() {
        val f = Gson().fromJson(loadFixture("regions-fixtures.json"), Fixtures::class.java)
        assertTrue(f.reducer.isNotEmpty())
        for (sc in f.reducer) {
            val p = generateRegions(sc.seed, sc.n)!!
            var s = RegionsState.create(p, 0)
            for (a in sc.actions) s = regionsReduce(s, action(a), 1000)
            assertEquals("${sc.name} board", sc.expect.board, s.board)
            assertEquals("${sc.name} hintMask", sc.expect.hintMask, s.hintMask)
            assertEquals("${sc.name} wrongMask", sc.expect.wrongMask, s.wrongMask)
            assertEquals("${sc.name} mistakes", sc.expect.mistakes, s.mistakes)
            assertEquals("${sc.name} hintsUsed", sc.expect.hintsUsed, s.hintsUsed)
            assertEquals("${sc.name} status", sc.expect.status, s.status.key)
            assertEquals("${sc.name} autoCross", sc.expect.autoCross, s.autoCross)
            assertEquals("${sc.name} history", sc.expect.historyLength, s.history.size)
            assertEquals("${sc.name} endTime", sc.expect.endTime?.toLong(), s.endTime)
            val (solutions, guesses) = regionsMatchRow(s)
            assertEquals(sc.row.solutions, solutions); assertEquals(sc.row.guesses, guesses)
            val r = reconstructRegions(solutions, guesses)
            assertEquals(sc.reconstruct?.board, r?.board); assertEquals(sc.reconstruct?.solved, r?.solved); assertEquals(sc.reconstruct?.n, r?.n)
        }
        assertNull(f.malformed); assertNull(reconstructRegions(listOf("nope"), emptyList()))
    }

    @Test
    fun ruled_out_and_sizes_match_shared_fixtures() {
        val f = Gson().fromJson(loadFixture("regions-fixtures.json"), Fixtures::class.java)
        val p = generateRegions("daily-2026-10-03-REGIONS", 8)!!
        for (r in f.ruledOut) assertEquals("ruledOut(${r.cell})", r.cells, regionsRuledOut(8, p.regions, r.cell))
        for (s in f.sizes) assertEquals("size(${s.day})", s.n, regionsSizeForDay(s.day))
        assertEquals(9, regionsSizeForSeed("unlimited-REGIONS-1-9"))
        assertEquals(1, regionsDailyNumber(REGIONS_DAILY_EPOCH))
    }
}
