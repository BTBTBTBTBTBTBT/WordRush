package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-platform parity guard for epoch-indexed banks (More Games §11):
 * Bank.indexForDay / indexForSeed must match packages/core/src/bank.ts exactly,
 * or two platforms would serve different puzzles on the same date. The holiday
 * calendar (§20) is pinned the same way: key lookup, the occurrence count and
 * the pick into a 3-entry holiday list.
 */
class BankFixtureTest {
    private fun loadFixture(name: String): String =
        javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    private data class DayCase(val day: String, val n: Int, val dayIndex: Int?, val index: Int)
    private data class SeedCase(val seed: String, val n: Int, val avoid: Int?, val index: Int)
    private data class TableCase(val version: Int, val from: String, val to: String, val dayCount: Int)
    private data class Pick(val key: String, val index: Int, val entry: String)
    private data class HolidayCase(val day: String, val key: String?, val occurrence: Int, val pick: Pick?)
    private data class Fixtures(val epoch: String, val days: List<DayCase>, val seeds: List<SeedCase>, val holidayTable: TableCase, val holidayDays: List<HolidayCase>)

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

    @Test
    fun holiday_lookups_match_shared_fixtures() {
        val f = Gson().fromJson(loadFixture("bank-fixtures.json"), Fixtures::class.java)
        val table = HolidayTable.bundled!!
        assertEquals(f.holidayTable.version, table.version); assertEquals(f.holidayTable.from, table.from); assertEquals(f.holidayTable.to, table.to)
        assertEquals(f.holidayTable.dayCount, table.days.size)
        val three = mapOf("christmas" to listOf("c0", "c1", "c2"), "halloween" to listOf("h0", "h1", "h2"), "mlkday" to listOf("m0", "m1", "m2"))
        assertTrue(f.holidayDays.isNotEmpty())
        for (c in f.holidayDays) {
            val key = holidayKeyForDay(c.day, table)
            assertEquals("holidayKeyForDay(${c.day})", c.key, key)
            assertEquals("holidayOccurrence(${c.day})", c.occurrence, if (key != null) holidayOccurrence(c.day, key, table) else 0)
            val pick = bankHolidayPick(c.day, table, three)
            assertEquals("bankHolidayPick(${c.day})", c.pick?.let { BankHolidayPick(it.key, it.index, it.entry) }, pick)
        }
        assertNull(holidayKeyForDay("2026-12-25", null)); assertEquals(0, holidayOccurrence("2026-12-25", "christmas", null))
        assertNull(bankHolidayPick<String>("2026-12-25", table, null)); assertNull(bankHolidayPick("2026-12-25", table, mapOf("christmas" to emptyList<String>())))
    }
}
