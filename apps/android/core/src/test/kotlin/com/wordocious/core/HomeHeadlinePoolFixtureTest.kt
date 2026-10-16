package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-platform parity guard for the Home headline pool (founder 10-16): the time buckets, the season
 * calendar, the whole copy bank (tags, order, lines) and 1,890 selections must match
 * packages/core/src/home-headline-pool.ts byte for byte, or the platforms would greet the same player differently.
 */
class HomeHeadlinePoolFixtureTest {
    private fun loadFixture(name: String): String =
        javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    private data class Bucket(val hour: Int, val bucket: String)
    private data class Cal(val dateKey: String, val pack: String?, val weekday: Int)
    private data class G(val played: Int, val won: Int, val total: Int) { fun p() = GroupProgress(played, won, total) }
    private data class RS(val sweep: Int, val flawless: Int, val bestSweep: Int?, val bestFlawless: Int?) {
        fun r() = RowStreaks(sweep, flawless, bestSweep ?: 0, bestFlawless ?: 0)
    }
    private data class StreaksIn(val word: RS, val puzzles: RS)
    private data class Last(val title: String, val won: Boolean, val minutesAgo: Int, val record: Boolean?)
    private data class Ctx(
        val name: String, val hour: Int, val dateKey: String, val word: G, val puzzles: G, val streaks: StreaksIn?,
        val unlimited: Boolean?, val nextGame: String?, val lastGame: Last?, val holiday: String?, val slotWidth: Int?,
        val userSeed: String?, val history: List<String>?,
    ) {
        fun c() = HomeHeadlinePool.Context(
            name = name, hour = hour, dateKey = dateKey, word = word.p(), puzzles = puzzles.p(),
            streaks = streaks?.let { HomeHeadlinePool.Streaks(it.word.r(), it.puzzles.r()) },
            unlimited = unlimited ?: false, nextGame = nextGame,
            lastGame = lastGame?.let { HomeHeadlinePool.LastGame(it.title, it.won, it.minutesAgo, it.record ?: false) },
            holiday = holiday, slotWidth = slotWidth?.toDouble(), userSeed = userSeed ?: "", history = history ?: emptyList(),
        )
    }
    private data class Sel(val ctx: Ctx, val text: String, val id: String, val context: String, val bucket: String)
    private data class Fixtures(val buckets: List<Bucket>, val calendar: List<Cal>, val bank: Map<String, List<String>>, val selections: List<Sel>)

    private val f: Fixtures by lazy { Gson().fromJson(loadFixture("home-headline-pool-fixtures.json"), Fixtures::class.java) }

    @Test
    fun buckets_match_shared_fixtures() {
        assertTrue(f.buckets.isNotEmpty())
        for (b in f.buckets) assertEquals("hour ${b.hour}", b.bucket, HomeHeadlinePool.timeBucket(b.hour))
    }

    @Test
    fun calendar_matches_shared_fixtures() {
        assertTrue(f.calendar.isNotEmpty())
        for (c in f.calendar) {
            assertEquals("pack ${c.dateKey}", c.pack, HomeHeadlinePool.headlinePack(c.dateKey))
            assertEquals("weekday ${c.dateKey}", c.weekday, HomeHeadlinePool.weekdayOf(c.dateKey))
        }
    }

    @Test
    fun bank_matches_shared_fixtures() {
        // Gson's LinkedTreeMap keeps the JSON key order, so tags are compared in TS order.
        assertEquals("bank tags", f.bank.keys.toList(), HomeHeadlineBank.pools.map { it.first })
        for ((tag, lines) in f.bank) assertEquals("bank $tag", lines, HomeHeadlineBank.pool(tag))
    }

    @Test
    fun selections_match_shared_fixtures() {
        assertTrue(f.selections.size >= 1000)
        for (s in f.selections) {
            val got = HomeHeadlinePool.select(s.ctx.c())
            assertEquals("text ${s.ctx}", s.text, got.text)
            assertEquals("id ${s.ctx}", s.id, got.id)
            assertEquals("context ${s.ctx}", s.context, got.context)
            assertEquals("bucket ${s.ctx}", s.bucket, got.bucket)
        }
    }
}
