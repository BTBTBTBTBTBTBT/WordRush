package com.wordocious.app.ui

import com.wordocious.core.HeadlineTokens.Kind.NAME
import com.wordocious.core.HeadlineTokens.Kind.NUMBER
import com.wordocious.core.HeadlineTokens.Kind.STAR
import com.wordocious.core.HeadlineTokens.Kind.TEXT
import org.junit.Assert.assertEquals
import org.junit.Test

/** FINISH_SPEC AR: the app's headline split (uppercased, core splitter) and the balanced break. */
class HeadlineTokensTest {
    private fun kinds(t: List<com.wordocious.core.HeadlineTokens.Token>) = t.map { it.kind to it.text }

    @Test fun headlinesAreUppercasedBeforeSplitting() {
        assertEquals(
            listOf(TEXT to "WARMING UP ", STAR to "·", TEXT to " ", NUMBER to "3", TEXT to " DOWN"),
            kinds(HeadlineTokens.split("Warming up · 3 down")),
        )
        assertEquals(listOf(NAME to "OLIVER", TEXT to " LEADS"), kinds(HeadlineTokens.split("Oliver leads", listOf("oliver"))))
    }

    @Test fun balancedBreakPicksTheSpaceNearestTheMiddle() {
        assertEquals(-1, HeadlineTokens.balancedBreak("FLAWLESS"))
        assertEquals(6, HeadlineTokens.balancedBreak("OLIVER LEADS"))
        assertEquals(9, HeadlineTokens.balancedBreak("SOLVED IN 4 GUESSES"))
    }
}
