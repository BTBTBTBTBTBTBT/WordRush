package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-platform parity guard for epoch-indexed banks (More Games §11):
 * Bank.indexForDay / indexForSeed must match packages/core/src/bank.ts exactly,
 * or two platforms would serve different puzzles on the same date.
 */
class BankFixtureTest {
    private fun loadFixture(name: String): String =
        javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    private data class DayCase(val day: String, val n: Int, val dayIndex: Int?, val index: Int)
    private data class SeedCase(val seed: String, val n: Int, val avoid: Int?, val index: Int)
    private data class Fixtures(val epoch: String, val days: List<DayCase>, val seeds: List<SeedCase>)

    @Test
    fun bank_indexes_match_shared_fixtures() {
        val f = Gson().fromJson(loadFixture("bank-fixtures.json"), Fixtures::class.java)
        assertTrue(f.days.isNotEmpty()); assertTrue(f.seeds.isNotEmpty())
        for (c in f.days) {
            assertEquals("dayIndex(${c.day})", c.dayIndex, Bank.dayIndex(c.day, f.epoch))
            assertEquals("indexForDay(${c.day}, ${c.n})", c.index, Bank.indexForDay(c.day, c.n, f.epoch))
        }
        for (c in f.seeds) {
            assertEquals("indexForSeed(${c.seed}, ${c.n}, ${c.avoid})", c.index, Bank.indexForSeed(c.seed, c.n, c.avoid))
        }
    }
}
