package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** FINISH_SPEC AS7: the streak popup's flawless section and the live headline copy (AR). */
class StreakSummaryTest {
    private val none = StreakSummary(0, 0, 0, 0, 0, 0)

    @Test fun neverAchievedFlawlessStreaksAreHidden() {
        assertEquals(emptyList<StreakSummary.FlawlessRow>(), none.flawlessRows())
    }

    @Test fun aRowShowsWhenCurrentOrBestIsAboveZero() {
        val brokenRun = none.copy(wordFlawlessBest = 4)
        assertEquals(listOf(StreakSummary.FlawlessRow("WORDOCIOUS FLAWLESS", 0, 4)), brokenRun.flawlessRows())
        val live = none.copy(puzzlesFlawless = 2)
        assertEquals(listOf(StreakSummary.FlawlessRow("PUZZLES FLAWLESS", 2, 2)), live.flawlessRows())
        assertEquals(2, none.copy(wordFlawless = 1, puzzlesFlawlessBest = 3).flawlessRows().size)
    }

    @Test fun mergeKeepsCachedValuesOnAFailedFetchAndBestNeverTrailsCurrent() {
        val cached = none.copy(wordSweep = 5, wordFlawless = 3)
        val merged = cached.merge(wordFlawless = 6, wordFlawlessBest = 4)
        assertEquals(5, merged.wordSweep)
        assertEquals(6, merged.wordFlawless)
        assertEquals(6, merged.wordFlawlessBest)
        assertEquals(cached.copy(wordFlawlessBest = 3), cached.merge())
    }

    @Test fun liveHeadlineCopy() {
        assertEquals("YOU'RE #3 TODAY", rankHeadline(3, friends = false))
        assertEquals("YOU'RE #2 AMONG FRIENDS", rankHeadline(2, friends = true))
        assertEquals("YOU'RE #7", rankHeadline(7, friends = false, totalNoun = "SWEEPERS"))
        assertEquals("1,280 WINS · 74% WIN RATE · 6 STREAK", statsSummaryHeadline(1280, 1730, 6))
        assertEquals("1 WIN · 100% WIN RATE", statsSummaryHeadline(1, 1, 1))
        val items = listOf(com.wordocious.app.ui.game.stripCount("4", "guesses"))
        assertEquals("SOLVED IN 4 GUESSES", com.wordocious.app.ui.game.stripHeadline(true, items))
        assertEquals("SO CLOSE", com.wordocious.app.ui.game.stripHeadline(false, items))
    }
}
