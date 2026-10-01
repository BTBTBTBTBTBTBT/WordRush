package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-platform parity guard for the VS overhaul (2026-10-01): the VS banner
 * words, the challenge outcome rule and the bot ladder must match
 * packages/core/src/vs-lobby.ts exactly, or a challenge raced on Android
 * could score differently from the same race on web or iOS.
 */
class VsLobbyFixtureTest {
    private fun loadFixture(name: String): String =
        javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    private data class Banner(
        val name: String, val battle: String, val botOfDay: String, val incomingFrom: String?, val streak: Int,
        val free: Boolean, val headline: String, val clock: String, val status: String,
    )
    private data class WL(val wins: Int, val losses: Int) { fun w() = WinLoss(wins, losses) }
    private data class Record(val people: WL, val bots: WL, val ladder: Int?, val line: String)
    private data class Run(val solved: Boolean, val boardsSolved: Int, val guesses: Int, val timeMs: Long) {
        fun r() = VsRun(solved, boardsSolved, guesses, timeMs)
    }
    private data class Outcome(val me: Run, val them: Run, val outcome: String, val margin: String, val headline: String)
    private data class State(val cleared: Int, val run: Int)
    private data class Rung(val id: String, val state: String, val line: String)
    private data class Ladder(val bot: String, val won: Boolean, val after: State, val rungs: List<Rung>)
    private data class Fixtures(val banners: List<Banner>, val records: List<Record>, val outcomes: List<Outcome>, val ladder: List<Ladder>)

    private val f: Fixtures by lazy { Gson().fromJson(loadFixture("vs-lobby-fixtures.json"), Fixtures::class.java) }

    @Test
    fun banners_match_shared_fixtures() {
        assertTrue(f.banners.isNotEmpty())
        for (c in f.banners) {
            val i = VsBannerInput(c.name, VsDayResult.from(c.battle), VsDayResult.from(c.botOfDay), c.incomingFrom, c.streak)
            assertEquals("headline $c", c.headline, vsBannerHeadline(i))
            val clock = if (c.free) vsBannerClockLine(i, "07:12:40", free = true, challengeLeft = "17H") else vsBannerClockLine(i, "07:12:40")
            assertEquals("clock $c", c.clock, clock)
            assertEquals("status $c", c.status, vsTodayStatus(i.battle, i.botOfDay))
        }
    }

    @Test
    fun records_match_shared_fixtures() {
        assertTrue(f.records.isNotEmpty())
        for (c in f.records) assertEquals("record $c", c.line, vsRecordLine(c.people.w(), c.bots.w(), c.ladder))
    }

    @Test
    fun outcomes_match_shared_fixtures() {
        assertTrue(f.outcomes.isNotEmpty())
        for (c in f.outcomes) {
            val out = vsOutcome(c.me.r(), c.them.r())
            assertEquals("outcome $c", c.outcome, out.raw)
            assertEquals("margin $c", c.margin, vsMargin(c.me.r(), c.them.r()))
            assertEquals("headline $c", c.headline, challengeHeadline(out, "doug"))
        }
    }

    @Test
    fun ladder_folds_match_shared_fixtures() {
        assertTrue(f.ladder.isNotEmpty())
        var s = BotLadderState(0, 0)
        for (c in f.ladder) {
            s = ladderAfterGame(s, c.bot, c.won)
            assertEquals("after ${c.bot} ${c.won}", BotLadderState(c.after.cleared, c.after.run), s)
            assertEquals("rungs ${c.bot} ${c.won}", c.rungs.map { LadderRung(it.id, RungState.values().first { r -> r.raw == it.state }, it.line) }, ladderRungs(s))
        }
    }

    @Test
    fun clock_and_constants() {
        assertEquals("1:05", vsClock(65_000))
        assertEquals("0:00", vsClock(-5))
        assertEquals("1:53", vsClock(112_500))
        assertEquals(9, VsLobby.VS_MODE_ORDER.size)
        assertEquals("THEIR’S RUN HELD!", challengeHeadline(VsOutcome.LOSS, " "))
    }
}
