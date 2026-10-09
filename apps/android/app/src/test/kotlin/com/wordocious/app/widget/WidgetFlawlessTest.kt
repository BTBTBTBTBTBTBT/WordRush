package com.wordocious.app.widget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Items 28 + 48: the widget snapshot's flawless flag + run (parity with the iOS WSnapshot.isFlawless / flawlessRun). */
class WidgetFlawlessTest {
    private fun mode(key: String, won: Boolean, played: Boolean = true) =
        WidgetBridge.ModeEntry(key = key, title = key, glyph = key.take(1), colorHex = "#7c3aed", played = played, won = won)

    private fun snap(modes: List<WidgetBridge.ModeEntry>, flawless: Boolean? = null, run: Int? = null) =
        WidgetBridge.Snapshot(day = "2026-10-09", streak = 4, modes = modes, flawless = flawless, flawlessStreak = run)

    @Test fun `all won derives flawless when the app wrote no flag`() {
        assertTrue(snap(List(8) { mode("m$it", true) }).isFlawless)
        assertFalse(snap(List(7) { mode("m$it", true) } + mode("x", false)).isFlawless)
        assertFalse(snap(emptyList()).isFlawless)
    }

    @Test fun `the written flag wins over the chips`() {
        assertTrue(snap(List(8) { mode("m$it", false) }, flawless = true).isFlawless)
        assertFalse(snap(List(8) { mode("m$it", true) }, flawless = false).isFlawless)
    }

    @Test fun `the run counts today's flawless as at least one`() {
        val all = List(8) { mode("m$it", true) }
        assertEquals(1, snap(all).flawlessRun)
        assertEquals(3, snap(all, run = 3).flawlessRun)
        assertEquals(0, snap(List(8) { mode("m$it", false) }).flawlessRun)
        assertEquals(2, snap(List(8) { mode("m$it", false) }, run = 2).flawlessRun)
    }
}
