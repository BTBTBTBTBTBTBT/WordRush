package com.wordocious.app.ui

import com.wordocious.app.data.ProfileService.RecentMatch
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneOffset

/** Today's Games grouping (founder, 2026-09-29). */
class TodayRowsTest {
    private val me = "me"
    private val day = LocalDate.of(2026, 9, 29)
    private fun m(id: String, mode: String, at: String, daily: Boolean?, won: Boolean = true, time: Double = 60.0, vs: Boolean = false) = RecentMatch(
        id = id, gameMode = mode, player1Id = me, player2Id = if (vs) "them" else null, winnerId = if (won) me else null,
        player1Time = time, createdAt = "2026-09-29T$at:00.000+00:00", daily = daily,
    )
    private fun rows(ms: List<RecentMatch>, pro: Boolean = true) = todayRows(ms, me, pro, ZoneOffset.UTC, day)

    @Test
    fun unlimitedFoldsAtNewestPositionDailiesAndVsStayIndividual() {
        val r = rows(listOf(
            m("u3", "REGIONS", "12:00", false, time = 90.0), m("d1", "DUEL", "11:00", true), m("u2", "REGIONS", "10:00", false, time = 72.0),
            m("v1", "DUEL", "09:00", false, vs = true), m("u1", "REGIONS", "08:00", false, won = false, time = 30.0), m("s1", "SUDOKU", "07:00", false),
            m("n1", "HUB", "06:00", null), m("old", "DUEL", "23:00", true).copy(createdAt = "2026-09-28T23:00:00+00:00"),
        ))
        assertEquals(listOf("unlimited:REGIONS", "d1", "v1", "s1", "n1"), r.map { it.key })
        val g = r[0] as TodayUnlimited
        assertEquals(3, g.games.size); assertEquals(2, g.wins); assertEquals(72, g.bestSeconds)
    }

    @Test
    fun freePlayersSeeNoUnlimitedAndNoWinsMeansNoBest() {
        val ms = listOf(m("u2", "REGIONS", "12:00", false, won = false), m("u1", "REGIONS", "10:00", false, won = false), m("d1", "DUEL", "09:00", true))
        assertEquals(listOf("d1"), rows(ms, pro = false).map { it.key })
        assertEquals(null, (rows(ms)[0] as TodayUnlimited).bestSeconds)
    }
}
