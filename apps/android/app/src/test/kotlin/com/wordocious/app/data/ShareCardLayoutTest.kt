package com.wordocious.app.data

import com.wordocious.app.ui.CastCrops
import com.wordocious.app.ui.Mascots
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC S2 / S3: the share card fits its content inside 4:5 … 9:16, and the cast spans ~90%. */
class ShareCardLayoutTest {
    private fun body(w: Float, h: Float, frac: Float = ShareCard.BODY_FRAC) = ShareCard.Body(w, h, frac) {}

    private fun assertOrdered(l: ShareCard.Layout, hasStats: Boolean) {
        assertTrue(l.titleTop < l.infoTop)
        assertTrue(l.infoTop < l.bodyTop)
        assertTrue(l.bodyTop + l.bodyH <= l.statsTop + 0.5f)
        if (hasStats) assertTrue(l.statsTop + ShareFinish.STATS_H <= l.castBaseline - l.castFigH)
        assertTrue(l.castBaseline < l.urlTop)
        assertTrue("url line inside the card", l.urlTop + ShareCard.URL_H <= l.height + 1f)
    }

    @Test
    fun shortContentIsClampedTo4by5WithTheRestInTheGaps() {
        // A two-guess Classic board: 5 tiles wide, 2 rows.
        val l = ShareCard.layout(titleH = 170f, body = body(544f, 211f), hasStats = true)
        assertEquals(ShareCard.MIN_H, l.height)
        assertEquals(ShareCard.W * ShareCard.BODY_FRAC, l.bodyW, 0.5f)
        assertOrdered(l, true)
        // No dead band at the bottom: the url line sits within the last gaps.
        assertTrue(l.height - (l.urlTop + ShareCard.URL_H) < 120f)
    }

    @Test
    fun fittingContentIsItsOwnHeight() {
        // A square Sudoku body (0.88 width square).
        val l = ShareCard.layout(titleH = 170f, body = body(950f, 950f), hasStats = true)
        assertTrue(l.height in ShareCard.MIN_H..ShareCard.MAX_H)
        assertEquals(ShareCard.W * ShareCard.BODY_FRAC, l.bodyW, 0.5f)
        assertEquals(l.bodyW, l.bodyH, 0.5f)
        assertEquals(l.height.toFloat(), l.urlTop + ShareCard.URL_H + ShareCard.BOTTOM, 1f)
        assertOrdered(l, true)
    }

    @Test
    fun tallBoardsScaleByHeightToStayInside9by16() {
        // An OctoWord-like column of boards far taller than wide.
        val l = ShareCard.layout(titleH = 170f, body = body(950f, 4000f), hasStats = true)
        assertEquals(ShareCard.MAX_H, l.height)
        assertTrue(l.bodyW < ShareCard.W * ShareCard.BODY_FRAC)
        assertEquals(4000f / 950f, l.bodyH / l.bodyW, 0.01f)
        assertOrdered(l, true)
    }

    @Test
    fun noStatsDropsTheirBlock() {
        val with = ShareCard.layout(170f, body(950f, 900f), hasStats = true)
        val without = ShareCard.layout(170f, body(950f, 900f), hasStats = false)
        assertTrue(without.height < with.height || without.height == ShareCard.MIN_H)
        assertOrdered(without, false)
    }

    @Test
    fun narrowBodiesKeepTheirWidthFraction() {
        val l = ShareCard.layout(170f, body(720f, 560f, frac = 0.66f), hasStats = true)
        assertEquals(ShareCard.W * 0.66f, l.bodyW, 0.5f)
    }

    @Test
    fun theCastWordmarkSpans90PercentWithTheTuck() {
        val span = ShareCard.W * ShareCard.CAST_FRAC
        val h = ShareCard.castFigureHeight(span)
        val widths = Mascots.cast.sumOf { (CastCrops.crops.getValue(it).aspect * h).toDouble() }.toFloat()
        val drawn = widths - ShareCard.CAST_OVERLAP * h * (Mascots.cast.size - 1)
        assertEquals(span, drawn, 0.5f)
        // Big enough to read: each figure is about a tenth of the card wide.
        assertTrue(h > ShareCard.W * 0.09f)
        assertEquals(10, Mascots.cast.size)
    }

    /** Title art aspects (web lib/art.ts ART_SIZE — the same art ships ×3). */
    private val titles = mapOf(
        "classic" to 1200f / 305, "gauntlet" to 1200f / 273, "quadword" to 1200f / 275,
        "octoword" to 1200f / 255, "succession" to 1200f / 290, "deliverance" to 1200f / 254,
        "six" to 1200f / 268, "seven" to 1200f / 239, "propernoundle" to 1200f / 210,
        "sudocious" to 1200f / 436, "muddle" to 1200f / 329, "hubbub" to 1200f / 325,
        "crosswordocious" to 1200f / 302, "kindred" to 1200f / 321, "letterladder" to 1200f / 252,
        "codebreaker" to 1200f / 237, "spyglass" to 1200f / 314, "starsweep" to 1200f / 271,
        "vs" to 572f / 95, "dailies" to 894f / 260, "puzzles" to 909f / 251, "stats" to 740f / 273,
        "undecodable" to 0f,
    )

    @Test
    fun everyGameTitleSitsWholeOnItsCard() {
        // Founder 10-06: the CLASSIC title was cut off at the top of the share card.
        val bodies = listOf(body(544f, 211f), body(950f, 950f), body(950f, 4000f), body(720f, 560f, 0.66f), body(300f, 2600f))
        for ((name, a) in titles) {
            for (b in bodies) for (stats in listOf(true, false)) {
                val l = ShareCard.layout(ShareCard.titleHeight(a), b, hasStats = stats)
                val r = ShareCard.titleRect(a, l)
                assertTrue("$name ${b.w}x${b.h}", ShareCard.titleFits(r, l))
                assertTrue(name, r.top >= ShareCard.TOP - 0.5f)
                assertOrdered(l, stats)
                if (a > 0f) {
                    // The whole art: its own aspect, centered, one side at its cap.
                    assertEquals(name, a, (r.right - r.left) / (r.bottom - r.top), 0.01f)
                    assertEquals(name, ShareCard.W / 2f, (r.left + r.right) / 2f, 0.01f)
                    val k = maxOf((r.right - r.left) / ShareCard.TITLE_MAX_W, (r.bottom - r.top) / ShareCard.TITLE_MAX_H)
                    assertEquals(name, 1f, k, 0.001f)
                }
            }
        }
        assertEquals(900f, ShareCard.TITLE_MAX_W, 0f)
    }

    @Test
    fun aTitleOutsideTheMarginsFailsTheCheck() {
        val l = ShareCard.layout(170f, body(950f, 900f), hasStats = true)
        assertTrue(!ShareCard.titleFits(ShareCard.Box(40f, l.titleTop, 1040f, l.titleTop + 170f), l))
        assertTrue(!ShareCard.titleFits(ShareCard.Box(100f, -10f, 980f, 160f), l))
        assertTrue(ShareCard.titleFits(ShareCard.Box(100f, l.titleTop, 980f, l.titleTop + 170f), l))
    }

    @Test
    fun theHeroBandSitsBetweenTheTitleAndTheInfoLineAndKeepsTheCardInsideTheFrame() {
        val band = com.wordocious.core.ShareHero.band(true)
        for (b in listOf(body(544f, 211f), body(950f, 900f), body(500f, 2400f))) {
            val plain = ShareCard.layout(170f, b, hasStats = true)
            val l = ShareCard.layout(170f, b, hasStats = true, heroBand = band)
            assertTrue(l.height in ShareCard.MIN_H..ShareCard.MAX_H)
            assertTrue("hero below the title", l.heroTop >= l.titleTop + 170f)
            assertTrue("hero above the info line", l.heroTop + band <= l.infoTop + 0.5f)
            // The band is paid for by the body / gaps, never by overflowing 9:16.
            assertTrue(l.bodyH <= plain.bodyH + 0.5f)
            assertTrue(l.urlTop + ShareCard.URL_H <= l.height + 1f)
        }
        // No band = exactly the long-standing layout.
        val a = ShareCard.layout(170f, body(544f, 211f), hasStats = true)
        val z = ShareCard.layout(170f, body(544f, 211f), hasStats = true, heroBand = 0f)
        assertEquals(a, z)
    }

    @Test
    fun chooserAndFileNames() {
        assertEquals("Share your QuadWord", ShareHelper.chooserTitle("QuadWord"))
        assertEquals("Wordocious-QuadWord.png", ShareHelper.fileName("QuadWord"))
        assertEquals("Wordocious-LetterLadder.png", ShareHelper.fileName("Letter Ladder"))
        assertEquals("Wordocious-Share.png", ShareHelper.fileName(" · "))
    }
}
