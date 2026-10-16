package com.wordocious.app.data

import com.wordocious.app.ui.CastCrops
import com.wordocious.app.ui.Mascots
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Share cards, night style: the card fits its content inside 4:5 ... 3:4 (1440), the cast spans ~92%, the stat chips sit above the board. */
class ShareCardLayoutTest {
    private fun body(w: Float, h: Float, frac: Float = ShareCard.BODY_FRAC) = ShareCard.Body(w, h, frac) {}

    private fun assertOrdered(l: ShareCard.Layout, hasStats: Boolean) {
        assertTrue(l.titleTop < l.infoTop)
        assertTrue(l.infoTop < l.bodyTop)
        // The stat chips ride between the info line and the board.
        if (hasStats) {
            assertTrue(l.infoTop + ShareCard.INFO_H <= l.statsTop + 0.5f)
            assertTrue(l.statsTop + ShareFinish.STATS_H <= l.bodyTop + 0.5f)
        }
        assertTrue(l.bodyTop + l.bodyH <= l.castBaseline - l.castFigH)
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
        assertTrue(l.height - (l.urlTop + ShareCard.URL_H) < 140f)
    }

    @Test
    fun fittingContentIsItsOwnHeight() {
        // A body that fits at full width inside 3:4: the card is exactly the sum of its blocks (no slack spread).
        val probe = ShareCard.layout(titleH = 170f, body = body(950f, 4000f), hasStats = true)
        val fixed = ShareCard.MAX_H - probe.bodyH
        val bodyH = 1400f - fixed
        val l = ShareCard.layout(titleH = 170f, body = body(950f, bodyH), hasStats = true)
        assertTrue(l.height in ShareCard.MIN_H..ShareCard.MAX_H)
        assertEquals(ShareCard.W * ShareCard.BODY_FRAC, l.bodyW, 0.5f)
        assertEquals(950f / bodyH, l.bodyW / l.bodyH, 0.01f)
        assertEquals(l.height.toFloat(), l.urlTop + ShareCard.URL_H + ShareCard.BOTTOM, 1f)
        assertOrdered(l, true)
    }

    @Test
    fun tallBoardsScaleByHeightToStayInside3by4() {
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
    fun theCastWordmarkSpans92PercentWithTheTuck() {
        assertEquals(0.92f, ShareCard.CAST_FRAC, 0f)
        val span = ShareCard.W * ShareCard.CAST_FRAC
        val h = ShareCard.castFigureHeight(span)
        val widths = Mascots.cast.sumOf { (CastCrops.crops.getValue(it).aspect * h).toDouble() }.toFloat()
        val drawn = widths - ShareCard.CAST_OVERLAP * h * (Mascots.cast.size - 1)
        assertEquals(span, drawn, 0.5f)
        // Big enough to read: each figure is about a tenth of the card wide.
        assertTrue(h > ShareCard.W * 0.10f)
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
                    assertTrue(name, r.bottom - r.top <= 150.5f)
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
    fun theLeaderboardDayTitleSitsAboveTheGameTitleAndTheStatusAndPanelStayInside() {
        val panel = 300f
        for (b in listOf(body(544f, 211f), body(950f, 900f), body(500f, 2400f))) {
            val plain = ShareCard.layout(150f, b, hasStats = true)
            val l = ShareCard.layout(150f, b, hasStats = true, dayH = 210f, statusH = ShareCard.STATUS_H, panelH = panel)
            assertTrue(l.height in ShareCard.MIN_H..ShareCard.MAX_H)
            assertTrue("day above the title", l.dayTop + 210f <= l.titleTop + 0.5f)
            assertTrue("status under the info line", l.statusTop >= l.infoTop + ShareCard.INFO_H)
            assertTrue("chips under the status", l.statsTop >= l.statusTop + ShareCard.STATUS_H - 0.5f)
            assertTrue("panel under the board", l.panelTop >= l.bodyTop + l.bodyH - 0.5f)
            assertTrue("panel above the cast", l.panelTop + panel <= l.castBaseline - l.castFigH)
            // The extras are paid for by the body / gaps, never by overflowing 3:4.
            assertTrue(l.bodyH <= plain.bodyH + 0.5f)
            assertTrue(l.urlTop + ShareCard.URL_H <= l.height + 1f)
        }
    }

    @Test
    fun everyCardIsAtMost3by4WithTheStatBlockInside() {
        // Founder 10-12: iMessage center-crops an image taller than ~3:4 (the CLASSIC title and the stat chips were cut off).
        assertEquals(1440, ShareCard.MAX_H)
        // Classic, Six, QuadWord / Succession, OctoWord (8 boards), Gauntlet, Sudoku, a tiny board, a column of 4000.
        val bodies = listOf(
            body(544f, 680f), body(700f, 880f), body(742f, 1240f), body(934f, 1160f), body(960f, 560f),
            body(950f, 950f), body(120f, 60f), body(300f, 2600f), body(950f, 4000f),
        )
        for ((name, a) in titles) for (day in listOf(0f, 210f)) for (panel in listOf(0f, 310f)) for (b in bodies) for (stats in listOf(true, false)) {
            val l = ShareCard.layout(ShareCard.titleHeight(a), b, hasStats = stats, dayH = day, statusH = ShareCard.STATUS_H, panelH = panel)
            val tag = "$name day=$day panel=$panel ${b.w}x${b.h} stats=$stats"
            assertTrue(tag, l.height <= 1440)
            assertTrue(tag, l.height >= ShareCard.MIN_H)
            // Title, status, chips, board, panel, the cast and the url line all end inside the card.
            if (stats) assertTrue(tag, l.statsTop + ShareFinish.STATS_H <= l.bodyTop + 0.5f)
            assertTrue(tag, l.bodyTop + l.bodyH <= l.height)
            if (panel > 0f) assertTrue(tag, l.panelTop + panel <= l.height)
            assertTrue(tag, l.urlTop + ShareCard.URL_H + ShareCard.BOTTOM <= l.height + 1f)
        }
    }

    @Test
    fun anOctoBodyWithItsPanelStaysReadable() {
        val l = ShareCard.layout(ShareCard.titleHeight(1200f / 255), body(934f, 1160f), hasStats = true, statusH = ShareCard.STATUS_H, panelH = 310f)
        assertEquals(1440, l.height)
        assertTrue("board height ${l.bodyH}", l.bodyH >= 380f)
    }

    @Test
    fun theSiteLineIsAtLeastAsLargeAsBefore() {
        // Old: 9 x 3 = 27 px; the night card draws it 34 px black weight.
        assertTrue(ShareCard.URL_SIZE >= 34f)
        assertTrue(ShareCard.URL_H >= ShareCard.URL_SIZE)
    }

    @Test
    fun chooserAndFileNames() {
        assertEquals("Share your QuadWord", ShareHelper.chooserTitle("QuadWord"))
        assertEquals("Wordocious-QuadWord.png", ShareHelper.fileName("QuadWord"))
        assertEquals("Wordocious-LetterLadder.png", ShareHelper.fileName("Letter Ladder"))
        assertEquals("Wordocious-Share.png", ShareHelper.fileName(" · "))
    }
}
