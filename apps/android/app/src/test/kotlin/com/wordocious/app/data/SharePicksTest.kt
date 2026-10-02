package com.wordocious.app.data

import com.wordocious.app.ui.MascotId
import com.wordocious.app.ui.Mascots
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC E1 / E2 pure picks: the share footer character, the meta parser, the widget's small window. */
class SharePicksTest {

    @Test
    fun footerNeverRepeatsTheTitleHost() {
        for (host in MascotId.entries) {
            val (pick, pose) = SharePicks.footerFor(host)
            assertNotEquals("footer for $host", host, pick)
            assertTrue("pose $pose drawn for $pick", pose in com.wordocious.app.ui.CastPoses.poses(pick))
        }
        // Every game title host (A7: avoid W for Classic).
        for ((key, host) in Mascots.gameHosts) assertNotEquals(key, host, SharePicks.footerFor(host).first)
        assertEquals(MascotId.O1, SharePicks.footerFor(MascotId.W).first)
    }

    @Test
    fun footerSkipsEveryAvoidedMember() {
        // VS: the mode's host and S (the VS host) are both off limits.
        for (host in MascotId.entries) {
            val pick = SharePicks.footerFor(host, setOf(MascotId.S, MascotId.O2)).first
            assertTrue(pick != host && pick != MascotId.S && pick != MascotId.O2)
        }
        assertEquals(MascotId.O1, SharePicks.footerFor(null).first)
    }

    @Test
    fun footerLinesSplitTheHookFromTheSite() {
        assertEquals("Can you beat them?" to "Play free at wordocious.com", SharePicks.footerLines("Can you beat them? Play free at wordocious.com"))
        assertEquals("Today’s board is open" to "wordocious.com", SharePicks.footerLines("Today’s board is open — wordocious.com"))
        assertEquals("5 straight days winning every daily · best 9" to "wordocious.com",
            SharePicks.footerLines("5 straight days winning every daily · best 9 · wordocious.com"))
        assertEquals("Think you can take them?" to "wordocious.com", SharePicks.footerLines("Think you can take them? wordocious.com"))
    }

    @Test
    fun metaLinesBecomeStatsAndDateWords() {
        val sudoku = SharePicks.parseMeta("#12 · Medium · 1 mistake · 3:58")
        assertEquals("#12", sudoku.puzzle)
        assertEquals("3:58", sudoku.time)
        assertEquals(listOf(SharePicks.MetaStat("1", "MISTAKES")), sudoku.stats)
        assertEquals(listOf("Medium"), sudoku.words)

        val ladder = SharePicks.parseMeta("Par 5 · +1 · 2:10")
        assertNull(ladder.puzzle)
        assertEquals(listOf(SharePicks.MetaStat("5", "PAR"), SharePicks.MetaStat("+1", "OVER PAR")), ladder.stats)

        val crossword = SharePicks.parseMeta("#3 · No checks · 12:04")
        assertEquals(listOf(SharePicks.MetaStat("0", "CHECKS")), crossword.stats)

        val hub = SharePicks.parseMeta("#9 · Genius · 45% · 23 words · 2 pangrams")
        assertNull(hub.time)
        assertEquals(listOf("Genius"), hub.words)
        assertEquals(listOf(
            SharePicks.MetaStat("45%", "OF MAX"), SharePicks.MetaStat("23", "WORDS"), SharePicks.MetaStat("2", "PANGRAMS"),
        ), hub.stats)

        val spyglass = SharePicks.parseMeta("10/10 · 1 miss · 2:45")
        assertEquals(listOf(SharePicks.MetaStat("10/10", "FOUND"), SharePicks.MetaStat("1", "MISSES")), spyglass.stats)

        val regions = SharePicks.parseMeta("8 × 8 · Out of mistakes · 1:02:03")
        assertEquals(listOf("8 × 8", "Out of mistakes"), regions.words)
        assertEquals("1:02:03", regions.time)
    }

    @Test
    fun smallWidgetShowsTheWindowWithTheNextGame() {
        val f = false; val t = true
        assertEquals(0..3, SharePicks.smallWindow(listOf(f, f, f, f, f, f, f, f)))
        assertEquals(0..3, SharePicks.smallWindow(listOf(t, t, t, f, f, f, f, f)))
        assertEquals(4..7, SharePicks.smallWindow(listOf(t, t, t, t, f, t, t, t)))
        assertEquals(0..3, SharePicks.smallWindow(listOf(t, t, t, t, t, t, t, t)))
        assertEquals(0..2, SharePicks.smallWindow(listOf(f, f, f)))
    }
}
