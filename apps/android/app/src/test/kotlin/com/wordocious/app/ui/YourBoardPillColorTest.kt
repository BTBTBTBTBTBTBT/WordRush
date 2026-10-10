package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** Founder 10-09: Your board wears the game's color (parity with iOS YourBoardPill.castColor and web castColorForAccent). */
class YourBoardPillColorTest {
    private fun hex(rgb: Int) = castColorForAccent(((rgb shr 16) and 255) / 255f, ((rgb shr 8) and 255) / 255f, (rgb and 255) / 255f)

    @Test fun hueBandsMapToTheNearestCastColor() {
        assertEquals(CastColor.PINK, hex(0xFF0000))
        assertEquals(CastColor.PINK, hex(0xFF00AA))
        assertEquals(CastColor.ORANGE, hex(0xFF8000))
        assertEquals(CastColor.GOLD, hex(0xFFC800))
        assertEquals(CastColor.GREEN, hex(0x00FF00))
        assertEquals(CastColor.TEAL, hex(0x00FFCC))
        assertEquals(CastColor.BLUE, hex(0x0066FF))
        assertEquals(CastColor.PURPLE, hex(0x8800FF))
    }

    @Test fun lowSaturationIsSlate() {
        assertEquals(CastColor.SLATE, hex(0x888888))
        assertEquals(CastColor.SLATE, hex(0xFFFFFF))
    }
}
