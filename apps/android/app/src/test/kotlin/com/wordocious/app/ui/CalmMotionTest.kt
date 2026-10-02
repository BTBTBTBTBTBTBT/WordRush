package com.wordocious.app.ui

import com.wordocious.app.ui.theme.CalmMotion
import com.wordocious.app.ui.theme.Palettes
import com.wordocious.app.ui.theme.WTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC AD: Battery Saver + Reduce Motion calm the app; dark-theme inks pass ≥ 4.5:1. */
class CalmMotionTest {
    @Test fun calmWhenEitherSettingIsOn() {
        assertFalse(CalmMotion.calm(reducedMotion = false, powerSave = false))
        assertTrue(CalmMotion.calm(reducedMotion = true, powerSave = false))
        assertTrue(CalmMotion.calm(reducedMotion = false, powerSave = true))
        assertTrue(CalmMotion.calm(reducedMotion = true, powerSave = true))
    }

    @Test fun confettiHalvesOnlyWhenCalm() {
        assertEquals(64, CalmMotion.confettiCount(64, calm = false))
        assertEquals(32, CalmMotion.confettiCount(64, calm = true))
        assertEquals(25, CalmMotion.confettiCount(50, calm = true))
        assertEquals(18, CalmMotion.confettiCount(36, calm = true))
        assertEquals(24, CalmMotion.confettiCount(48, calm = true))
        assertEquals(4, CalmMotion.confettiCount(7, calm = true))
        assertEquals(1, CalmMotion.confettiCount(1, calm = true))
        assertEquals(0, CalmMotion.confettiCount(0, calm = true))
    }

    @Test fun powerSaveFlagFeedsCalmMotionButNotReducedMotion() {
        val pref = WTheme.reducedMotionPref
        val os = WTheme.osReducedMotion
        val ps = WTheme.powerSave
        try {
            WTheme.reducedMotionPref = false
            WTheme.osReducedMotion = false
            WTheme.powerSave = true
            assertTrue(WTheme.calmMotion)
            // One-shot springs follow Reduce Motion alone, so Battery Saver keeps them.
            assertFalse(WTheme.reducedMotion)
            WTheme.powerSave = false
            assertFalse(WTheme.calmMotion)
        } finally {
            WTheme.reducedMotionPref = pref
            WTheme.osReducedMotion = os
            WTheme.powerSave = ps
        }
    }

    @Test fun darkInksPassTheInkRuleOnTheDarkSurfaces() {
        val dark = Palettes.Dark
        (DarkInk.all + listOf(dark.text, dark.textSecondary, dark.textMuted)).forEach { ink ->
            listOf(dark.surface, dark.bg, dark.surfaceAlt).forEach { bg ->
                val r = InkContrast.ratio(ink.toArgbInt(), bg.toArgbInt())
                assertTrue("ink ${ink.hex()} on ${bg.hex()} is ${"%.2f".format(r)}:1", r >= InkContrast.AA)
            }
        }
    }

    @Test fun theLightInksTheyReplaceFailOnDarkButPassOnTheLightWash() {
        val dark = Palettes.Dark.surface.toArgbInt()
        val lavender = Palettes.Light.surface.toArgbInt()
        listOf(0xFF7C3AED.toInt(), 0xFF6D28D9.toInt(), 0xFF4B5563.toInt()).forEach { light ->
            assertTrue(InkContrast.ratio(light, dark) < InkContrast.AA)
            assertTrue(InkContrast.ratio(light, lavender) >= InkContrast.AA)
        }
        assertTrue(InkContrast.ratio(0xFFB45309.toInt(), dark) < InkContrast.AA)
    }

    @Test fun contrastMathMatchesWcag() {
        assertEquals(21.0, InkContrast.ratio(0xFF000000.toInt(), 0xFFFFFFFF.toInt()), 0.01)
        assertEquals(1.0, InkContrast.ratio(0xFF7C3AED.toInt(), 0xFF7C3AED.toInt()), 0.0001)
    }

    private fun androidx.compose.ui.graphics.Color.toArgbInt(): Int =
        ((alpha * 255f + 0.5f).toInt() shl 24) or ((red * 255f + 0.5f).toInt() shl 16) or
            ((green * 255f + 0.5f).toInt() shl 8) or (blue * 255f + 0.5f).toInt()

    private fun androidx.compose.ui.graphics.Color.hex(): String = "#%08X".format(toArgbInt())
}
