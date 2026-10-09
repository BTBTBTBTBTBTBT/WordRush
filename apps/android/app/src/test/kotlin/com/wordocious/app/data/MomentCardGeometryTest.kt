package com.wordocious.app.data

import org.junit.Assert.assertTrue
import org.junit.Test

/** Item 46: the moment card's body rows sit in order, inside the body, and never run into each other. */
class MomentCardGeometryTest {
    @Test
    fun rowsAreOrderedAndInsideTheBody() {
        for (big in listOf(80f, 160f, 260f)) for (lines in 1..3) for (dots in listOf(false, true)) {
            val g = MomentCard.geometry(big, lines, dots)
            assertTrue("big above label", g.bigCy < g.labelCy)
            assertTrue("label above lines", g.labelCy < g.firstLineCy)
            if (dots) assertTrue("dots below the lines", g.dotsCy > g.firstLineCy + (lines - 1) * 62f - 1f)
            val last = if (dots) g.dotsCy + 20f else g.firstLineCy + (lines - 1) * 62f + 22f
            assertTrue("bottom row inside the body (big=$big lines=$lines dots=$dots)", last <= g.height)
        }
    }

    @Test
    fun theCardKeepsInsideTheShareFrame() {
        // The tallest moment: a 260 px number, three lines and the streak dots, under the hero band.
        val g = MomentCard.geometry(260f, 3, true)
        val body = ShareCard.Body(900f, g.height) {}
        val l = ShareCard.layout(96f, body, hasStats = false, heroBand = com.wordocious.core.ShareHero.band(true))
        assertTrue(l.height in ShareCard.MIN_H..ShareCard.MAX_H)
        assertTrue("the body is not shrunk to fit", l.bodyScale > 0.9f)
    }
}
