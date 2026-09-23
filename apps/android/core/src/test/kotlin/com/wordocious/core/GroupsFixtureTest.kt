package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-platform parity guard for the Kindred engine (More Games §14): bank
 * lookups (holiday and plain), the seeded tile deal, the reducer and the
 * matches-row round trip must match packages/core/src/games/groups.ts byte
 * for byte.
 */
class GroupsFixtureTest {
    private fun loadFixture(name: String): String = javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    private data class DayCase(val day: String, val id: String?, val plainId: String?, val number: Int)
    private data class SeedCase(val seed: String, val id: String?)
    private data class Group(val tier: Int, val label: String, val words: List<String>)
    private data class Puzzle(val id: String, val groups: List<Group>, val holiday: String?)
    private data class Order(val seed: String, val tiles: List<String>)
    private data class Act(val type: String, val word: String?)
    private data class PairTarget(val tier: Int, val pair: List<String>)
    private data class Expect(
        val tiles: List<String>, val solvedTiers: List<Int>, val selected: List<String>, val mistakes: Int, val submissions: Int, val hintsUsed: Int,
        val revealedTiers: List<Int>, val pairs: List<List<String>>, val wrongSets: List<String>, val shuffles: Int, val lastResult: String?, val events: List<String>,
        val status: String, val ended: Boolean, val endTime: Double?, val guessCount: Int, val boardsSolved: Int, val labelTarget: Int?, val pairTarget: PairTarget?,
    )
    private data class Row(val solutions: List<String>, val guesses: List<String>)
    private data class Recon(
        val groups: List<Group>, val solvedTiers: List<Int>, val mistakes: Int, val oneAways: Int, val submissions: Int, val hintsUsed: Int,
        val revealedTiers: List<Int>, val pairs: List<List<String>>, val solved: Boolean,
    )
    private data class Script(val name: String, val id: String, val actions: List<Act>, val expect: Expect, val row: Row, val reconstruct: Recon?)
    private data class Fixtures(
        val epoch: String, val dailyCount: Int, val extraCount: Int, val holidayKeys: List<String>, val days: List<DayCase>, val seeds: List<SeedCase>,
        val puzzle: Puzzle, val orders: List<Order>, val reducer: List<Script>, val malformed: List<Recon?>,
    )

    private fun fixtures() = Gson().fromJson(loadFixture("groups-fixtures.json"), Fixtures::class.java)
    private fun group(g: Group) = GroupsGroup(g.tier, g.label, g.words)
    private fun puzzle(p: Puzzle) = GroupsPuzzle(p.id, p.groups.map { group(it) }, p.holiday)
    private fun action(a: Act): GroupsAction = when (a.type) {
        "TOGGLE" -> GroupsAction.Toggle(a.word!!)
        "DESELECT" -> GroupsAction.Deselect
        "SHUFFLE" -> GroupsAction.Shuffle
        "SUBMIT" -> GroupsAction.Submit
        "HINT_LABEL" -> GroupsAction.HintLabel
        "HINT_PAIR" -> GroupsAction.HintPair
        "FINISH" -> GroupsAction.Finish
        else -> error("unknown action ${a.type}")
    }

    @Test
    fun bank_and_tile_order_match_shared_fixtures() {
        val f = fixtures(); val b = GroupsBank.bundled!!; val h = HolidayTable.bundled!!
        assertEquals(f.epoch, b.epoch); assertEquals(f.dailyCount, b.daily.size); assertEquals(f.extraCount, b.extra.size)
        assertEquals(f.holidayKeys, b.holiday!!.keys.toList())
        assertTrue(f.days.isNotEmpty())
        for (c in f.days) {
            assertEquals("day ${c.day}", c.id, groupsPuzzleForDay(b, c.day, h)?.id)
            assertEquals("plain day ${c.day}", c.plainId, groupsPuzzleForDay(b, c.day, null)?.id)
            assertEquals("number ${c.day}", c.number, groupsDailyNumber(c.day))
        }
        for (c in f.seeds) assertEquals("seed ${c.seed}", c.id, groupsPuzzleForSeed(b, c.seed)?.id)
        assertEquals(puzzle(f.puzzle), b.daily[0])
        val p = puzzle(f.puzzle)
        assertTrue(f.orders.isNotEmpty())
        for (o in f.orders) {
            assertEquals("order ${o.seed}", o.tiles, groupsTileOrder(p, o.seed))
            assertEquals("initial tiles ${o.seed}", o.tiles, createGroupsState(p, o.seed, 0).tiles)
        }
        val init = createGroupsState(p, "fixture", 0)
        assertEquals(GroupsStatus.PLAYING, init.status); assertEquals(0, init.mistakes); assertNull(init.endTime); assertNull(init.lastResult)
        assertEquals(listOf(1, 2, 3, 4), init.groups.map { it.tier })
    }

    @Test
    fun reducer_scripts_match_shared_fixtures() {
        val f = fixtures()
        val p = puzzle(f.puzzle)
        assertTrue(f.reducer.isNotEmpty())
        for (sc in f.reducer) {
            assertEquals(sc.id, p.id)
            var s = createGroupsState(p, "fixture", 0)
            for (a in sc.actions) s = groupsReduce(s, action(a), 1000)
            val e = sc.expect
            assertEquals("${sc.name} tiles", e.tiles, s.tiles)
            assertEquals("${sc.name} solvedTiers", e.solvedTiers, s.solved.map { it.tier })
            assertEquals("${sc.name} selected", e.selected, s.selected)
            assertEquals("${sc.name} mistakes", e.mistakes, s.mistakes)
            assertEquals("${sc.name} submissions", e.submissions, s.submissions)
            assertEquals("${sc.name} hintsUsed", e.hintsUsed, s.hintsUsed)
            assertEquals("${sc.name} revealedTiers", e.revealedTiers, s.revealedTiers)
            assertEquals("${sc.name} pairs", e.pairs, s.pairs)
            assertEquals("${sc.name} wrongSets", e.wrongSets, s.wrongSets)
            assertEquals("${sc.name} shuffles", e.shuffles, s.shuffles)
            assertEquals("${sc.name} lastResult", e.lastResult, s.lastResult?.key)
            assertEquals("${sc.name} events", e.events, s.events)
            assertEquals("${sc.name} status", e.status, s.status.key)
            assertEquals("${sc.name} ended", e.ended, s.ended)
            assertEquals("${sc.name} endTime", e.endTime?.toLong(), s.endTime)
            assertEquals("${sc.name} guessCount", e.guessCount, s.guessCount)
            assertEquals("${sc.name} boardsSolved", e.boardsSolved, s.boardsSolved)
            assertEquals("${sc.name} labelTarget", e.labelTarget, s.labelTarget?.tier)
            assertEquals("${sc.name} pairTarget", e.pairTarget?.let { GroupsPairTarget(it.tier, it.pair) }, s.pairTarget)
            val (solutions, guesses) = groupsMatchRow(s)
            assertEquals("${sc.name} solutions", sc.row.solutions, solutions); assertEquals("${sc.name} guesses", sc.row.guesses, guesses)
            val r = reconstructGroups(solutions, guesses)
            assertNotNull("${sc.name} reconstruct", r); assertNotNull("${sc.name} fixture reconstruct", sc.reconstruct)
            val x = sc.reconstruct!!
            assertEquals("${sc.name} recon groups", x.groups.map { group(it) }, r!!.groups)
            assertEquals("${sc.name} recon solvedTiers", x.solvedTiers, r.solvedTiers)
            assertEquals("${sc.name} recon mistakes", x.mistakes, r.mistakes)
            assertEquals("${sc.name} recon oneAways", x.oneAways, r.oneAways)
            assertEquals("${sc.name} recon submissions", x.submissions, r.submissions)
            assertEquals("${sc.name} recon hintsUsed", x.hintsUsed, r.hintsUsed)
            assertEquals("${sc.name} recon revealedTiers", x.revealedTiers, r.revealedTiers)
            assertEquals("${sc.name} recon pairs", x.pairs, r.pairs)
            assertEquals("${sc.name} recon solved", x.solved, r.solved)
        }
        assertEquals(2, f.malformed.size); for (m in f.malformed) assertNull(m)
        assertNull(reconstructGroups(listOf("1|a|A,B,C"), emptyList()))
        assertNull(reconstructGroups(listOf("1|a|A,B,C,D", "2|b|E,F,G,H", "3|c|I,J,K,L"), emptyList()))
        assertNull(reconstructGroups(null, null)); assertNull(reconstructGroups(emptyList(), emptyList()))
    }
}
