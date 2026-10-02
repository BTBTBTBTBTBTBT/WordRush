package com.wordocious.app.ui.game

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC H + L + B3 pure pieces: the Starsweep pastels, the tray states, the reject hold. */
class BoardPolishTest {
    @Test
    fun starsweep_has_nine_distinct_pastels_and_wraps() {
        val p = StarsweepPalette.PASTELS
        assertEquals(9, p.size)
        assertEquals(9, p.toSet().size)
        assertEquals(StarsweepPalette.pastel(0, false), StarsweepPalette.pastel(9, false))
        // Never plain white.
        assertTrue(p.none { it == Color.White })
        assertNotEquals(StarsweepPalette.pastel(2, false), StarsweepPalette.pastel(2, true))
    }

    @Test
    fun region_seams_are_wider_than_inner_gaps() {
        assertTrue(StarsweepPalette.halfGap(sameRegion = false, edge = false) > StarsweepPalette.halfGap(sameRegion = true, edge = false))
        assertEquals(StarsweepPalette.halfGap(true, false), StarsweepPalette.halfGap(false, true), 0f)
    }

    @Test
    fun the_tray_takes_purple_when_won_and_slate_when_lost() {
        val accent = Color(0xFFCA8A04)
        assertEquals(accent, GameTrayStyle.tint(accent, TrayState.PLAYING))
        assertEquals(accent, GameTrayStyle.tint(accent, TrayState.ACTIVE))
        assertEquals(GameTrayStyle.WON, GameTrayStyle.tint(accent, TrayState.WON))
        assertEquals(GameTrayStyle.LOST, GameTrayStyle.tint(accent, TrayState.LOST))
        // The wash is light (never the raw accent) and never plain white.
        val wash = GameTrayStyle.washArgb(accent, GameTrayStyle.WASH)
        assertNotEquals(0xFFFFFFFF.toInt(), wash)
        assertNotEquals(accent.hashCode(), Color(wash).hashCode())
    }

    @Test
    fun not_a_word_holds_one_second_then_clears_ninety_ms_apart() {
        assertEquals(1000, TileMotion.BAD_MS)
        assertEquals(90, TileMotion.CLEAR_STAGGER_MS)
    }
}

class RejectHoldTest {
    @Test
    fun reject_hold_is_a_second_unless_reduced() {
        assertEquals(1000, com.wordocious.app.rejectHoldMs(false))
        assertEquals(600, com.wordocious.app.rejectHoldMs(true))
    }
}
