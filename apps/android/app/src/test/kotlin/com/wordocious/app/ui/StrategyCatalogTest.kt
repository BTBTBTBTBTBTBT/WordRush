package com.wordocious.app.ui

import com.wordocious.core.GameMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** The Strategy guide-family rules (3-platform parity spec): slug map, groups, tip of the day, takeaway. */
class StrategyCatalogTest {
    @Test fun slugMapAndFallback() {
        assertEquals("practice", StrategyCatalog.gameIdFor("best-starting-words"))
        assertEquals("quordle", StrategyCatalog.gameIdFor("multi-board-mastery"))
        assertEquals("regions", StrategyCatalog.gameIdFor("starsweep-playbook"))
        assertEquals("vs", StrategyCatalog.gameIdFor("vs-battle-tactics"))
        assertNull(StrategyCatalog.gameIdFor("modes-explained"))
        assertNull(StrategyCatalog.gameIdFor("beginner-to-sweeper"))
        // Unlisted: "-playbook" stripped, matched against the catalog title.
        assertEquals("octordle", StrategyCatalog.gameIdFor("octoword-playbook"))
        assertEquals("ladder", StrategyCatalog.gameIdFor("letter-ladder"))
        assertNull(StrategyCatalog.gameIdFor("something-new"))
    }

    @Test fun groupsAndOrder() {
        assertEquals(StrategyGroup.DAILIES, StrategyCatalog.groupFor("practice"))
        assertEquals(StrategyGroup.DAILIES, StrategyCatalog.groupFor("vs"))
        assertEquals(StrategyGroup.PUZZLES, StrategyCatalog.groupFor("sudoku"))
        assertEquals(StrategyGroup.EVERY, StrategyCatalog.groupFor(null))
        val slots = StrategyCatalog.arrange(
            listOf("modes-explained", "sudocious-playbook", "best-starting-words", "daily-sweep-guide", "gauntlet-survival"),
        )
        assertEquals(
            listOf("best-starting-words", "gauntlet-survival", "sudocious-playbook", "modes-explained", "daily-sweep-guide"),
            slots.map { it.slug },
        )
        assertEquals(listOf(0, 1), slots.filter { it.gameId == null }.map { it.castIndex })
    }

    @Test fun tipOfTheDay() {
        assertEquals(0L, StrategyCatalog.epochDay(java.time.LocalDate.of(1970, 1, 1)))
        assertEquals(20728L, StrategyCatalog.epochDay(java.time.LocalDate.of(2026, 10, 2)))
        assertEquals((20728 % 20), StrategyCatalog.featuredIndex(20728L, 20))
        assertEquals(0, StrategyCatalog.featuredIndex(5L, 0))
    }

    @Test fun takeaway() {
        val t = StrategyCatalog.takeaway("Open with common letters. Then narrow it down! Done.")!!
        assertEquals("Open with common letters.", t.lead)
        assertEquals("Then narrow it down! Done.", t.rest)
        // A split point before index 20 is skipped.
        val u = StrategyCatalog.takeaway("Short. This one runs past twenty? Yes.")!!
        assertEquals("Short. This one runs past twenty?", u.lead)
        assertEquals("Yes.", u.rest)
        assertNull(StrategyCatalog.takeaway("No sentence break in this paragraph at all."))
        assertEquals("", StrategyCatalog.takeaway("Only one sentence here, really. ")!!.rest)
    }

    @Test fun htpModesAndPlayTargets() {
        assertEquals("practice", StrategyCatalog.htpModeId("Classic — 1 Word, 6 Guesses"))
        assertEquals("vs", StrategyCatalog.htpModeId("VS Battle — Live Matches"))
        assertEquals("more", StrategyCatalog.htpModeId("More Games — Ten Extra Dailies"))
        assertEquals("ladder", StrategyCatalog.htpModeId("Letter Ladder — One Letter at a Time"))
        assertNull(StrategyCatalog.htpModeId("Mystery — Nothing"))
        assertEquals(GameMode.DUEL, StrategyCatalog.dailyModeFor("practice"))
        assertEquals(GameMode.SUDOKU, StrategyCatalog.dailyModeFor("sudoku"))
        assertNull(StrategyCatalog.dailyModeFor("vs"))
        assertNull(StrategyCatalog.dailyModeFor(null))
    }
}
