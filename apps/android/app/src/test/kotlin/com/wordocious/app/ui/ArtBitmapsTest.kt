package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC AQ2: art decodes at about its display size, never below it. */
class ArtBitmapsTest {
    @Test fun sampleKeepsTheLongerSideAtLeastTheTarget() {
        assertEquals(1, ArtBitmaps.sampleSizeFor(256, 256, 200))
        assertEquals(4, ArtBitmaps.sampleSizeFor(900, 900, 200))   // 225 px ≥ 200
        assertEquals(8, ArtBitmaps.sampleSizeFor(1200, 774, 144))  // 150 px ≥ 144
        assertEquals(1, ArtBitmaps.sampleSizeFor(0, 0, 100))
        for (target in listOf(48, 72, 108, 162, 243, 364)) {
            val s = ArtBitmaps.sampleSizeFor(1179, 900, target)
            assertTrue(1179 / s >= target)
        }
    }

    @Test fun bucketsRoundUpSoNearbySizesShare() {
        assertEquals(48, ArtBitmaps.bucketPx(10))
        assertEquals(ArtBitmaps.bucketPx(110), ArtBitmaps.bucketPx(120))
        for (px in 1..2000 step 37) assertTrue(ArtBitmaps.bucketPx(px) >= px)
    }
}
