package com.wordocious.app.ui.game

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Doug 10-05: the live ladder (start → typing → REACH → target) always fits its slot. */
class LadderFitTest {
    /** The tray's height for a fit, as LadderPlayBoard lays it out. */
    private fun height(f: LadderFit.Fit, rungs: Int, showEnd: Boolean, label: Float): Float {
        val rows = rungs + 1 + (if (showEnd) 1 else 0)
        val children = rows + (if (showEnd) 1 else 0)
        return LadderFit.PAD * 2 + GameTrayStyle.LIP.value + rows * f.tile + (if (showEnd) label else 0f) + (children - 1) * f.gap
    }

    @Test
    fun tall_phone_keeps_the_full_tile() {
        val f = LadderFit.tile(availH = 500f, rungs = 4, showEnd = true, labelLine = 15f)
        assertEquals(LadderFit.MAX_TILE, f.tile, 0.001f)
        assertFalse(f.scrolls)
    }

    @Test
    fun dougs_ladder_shrinks_to_fit_a_short_slot() {
        // START + 3 rungs, the typing row, REACH, the target in ~280 dp.
        val f = LadderFit.tile(availH = 280f, rungs = 4, showEnd = true, labelLine = 15f * 1.3f)
        assertFalse(f.scrolls)
        assertTrue(f.tile < LadderFit.MAX_TILE)
        assertTrue(height(f, 4, true, 15f * 1.3f) <= 280f)
    }

    @Test
    fun every_ladder_length_fits_or_scrolls_only_the_rungs() {
        for (h in 160..700 step 20) for (rungs in 1..14) {
            val f = LadderFit.tile(h.toFloat(), rungs, showEnd = true, labelLine = 20f)
            assertTrue(f.tile >= LadderFit.MIN_TILE && f.tile <= LadderFit.MAX_TILE)
            if (!f.scrolls) assertTrue("h=$h rungs=$rungs", height(f, rungs, true, 20f) <= h + 0.001f)
        }
    }
}
