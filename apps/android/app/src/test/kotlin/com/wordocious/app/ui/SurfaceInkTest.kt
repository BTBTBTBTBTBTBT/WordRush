package com.wordocious.app.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// Founder 10-10 (readability): the lifted label ink (iOS Color.bubbleInk) reads on a dark surface, is idempotent, and
// leaves the light theme's ink untouched.
class SurfaceInkTest {
    private val inks = listOf(0xFF7C3AED, 0xFF6D28D9, 0xFF5B21B6, 0xFFB45309, 0xFF0F766E, 0xFFDC2626, 0xFF1E3A8A, 0xFFF59E0B, 0xFFFFFFFF)
        .map { Color(it) }

    @Test fun lightSurfacesKeepTheInk() {
        for (c in inks) assertEquals(c, SurfaceInk.lift(c, dark = false))
    }

    @Test fun darkSurfacesLiftEveryInkToReadable() {
        for (c in inks) {
            val lifted = SurfaceInk.lift(c, dark = true)
            val luma = InkContrast.luminance(lifted.toArgb())
            // Either it cleared the bar, or it is the 90% cap (a near-black ink still gets as light as the cap allows).
            assertTrue("${c.toArgb().toString(16)} -> $luma", luma >= SurfaceInk.LIFTED_LUMA - 0.001)
            assertTrue(InkContrast.ratio(lifted.toArgb(), 0xFF1C0F30.toInt()) >= InkContrast.AA)
        }
    }

    @Test fun liftIsIdempotent() {
        for (c in inks) {
            val once = SurfaceInk.lift(c, dark = true)
            assertEquals(once, SurfaceInk.lift(once, dark = true))
        }
    }
}
