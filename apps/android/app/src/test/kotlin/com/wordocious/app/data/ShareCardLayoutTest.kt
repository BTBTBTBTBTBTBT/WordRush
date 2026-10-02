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

    @Test
    fun chooserAndFileNames() {
        assertEquals("Share your QuadWord", ShareHelper.chooserTitle("QuadWord"))
        assertEquals("Wordocious-QuadWord.png", ShareHelper.fileName("QuadWord"))
        assertEquals("Wordocious-LetterLadder.png", ShareHelper.fileName("Letter Ladder"))
        assertEquals("Wordocious-Share.png", ShareHelper.fileName(" · "))
    }
}
