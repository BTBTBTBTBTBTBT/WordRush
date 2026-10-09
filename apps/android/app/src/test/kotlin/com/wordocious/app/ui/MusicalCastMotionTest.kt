package com.wordocious.app.ui

import com.wordocious.core.MusicalCast
import com.wordocious.core.MusicalTiming
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The musical cast's header touches (MusicalCastKit.kt): the ripple, the instant swap, the hop and the floating notes. */
class MusicalCastMotionTest {
    @Test fun touchesRippleOutFromThePressedHero() {
        val at = 1_000L
        // W was pressed: W's glow is on first, S's last.
        val wOn = at + MusicalCastMotion.touchDelayMs(0, "w") + MusicalCastMotion.GLOW_FADE_MS
        assertEquals(1f, MusicalCastMotion.glow(0, true, "w", at, false, wOn), 1e-4f)
        assertEquals(0f, MusicalCastMotion.glow(9, true, "w", at, false, wOn), 1e-4f)
        val end = at + MusicalCastMotion.transformBusyMs("w")
        for (i in 0 until 10) {
            assertEquals(1f, MusicalCastMotion.glow(i, true, "w", at, false, end), 1e-4f)
            val (a, s) = MusicalCastMotion.badge(i, true, "w", at, false, end)
            assertEquals(1f, a, 1e-4f)
            assertEquals(1f, s, 1e-3f)
            // and back off
            assertEquals(0f, MusicalCastMotion.glow(i, false, "w", at, false, end), 1e-4f)
        }
        assertTrue(MusicalCastMotion.transformBusyMs("o2") >= MusicalCast.transformDuration("o2", false))
    }

    @Test fun popPlaysInsideEachHerosWindowOnly() {
        val at = 0L
        val delays = MusicalCast.transformDelays("c", false)
        for (i in 0 until 10) {
            assertNull(MusicalCastMotion.pop(i, "c", at, false, delays[i]))
            assertNotNull(MusicalCastMotion.pop(i, "c", at, false, delays[i] + MusicalTiming.popMs / 2))
            assertNull(MusicalCastMotion.pop(i, "c", at, false, delays[i] + MusicalTiming.popMs))
        }
    }

    @Test fun reduceMotionSwapsInstantly() {
        assertNull(MusicalCastMotion.pop(3, "w", 0L, true, 100L))
        assertEquals(1f, MusicalCastMotion.glow(9, true, "w", 0L, true, 0L), 0f)
        assertEquals(1f to 1f, MusicalCastMotion.badge(9, true, "w", 0L, true, 0L))
        assertEquals(0f, MusicalCastMotion.glow(9, false, "w", 0L, true, 0L), 0f)
        assertEquals(0f, MusicalCastMotion.glow(0, false, "w", null, false, 5L), 0f)
        // the floating note fades in place
        val p = MusicalCastMotion.float(120L, 30f, still = true)!!
        assertEquals(0f, p.x, 0f)
        assertEquals(0f, p.y, 0f)
        assertNull(MusicalCastMotion.float(MusicalCastMotion.FLOAT_STILL_MS, 30f, still = true))
    }

    @Test fun floatingNoteRisesAndFades() {
        val mid = MusicalCastMotion.float(MusicalCastMotion.FLOAT_MS / 2, 0f, still = false)!!
        assertTrue(mid.y < -0.6f)
        assertTrue(mid.alpha in 0f..1f)
        assertNull(MusicalCastMotion.float(MusicalCastMotion.FLOAT_MS, 0f, still = false))
        assertNull(MusicalCastMotion.hop(MusicalCastMotion.HOP_MS))
        assertNotNull(MusicalCastMotion.hop(MusicalCastMotion.HOP_MS / 2))
    }

    @Test fun noteFxAreCappedAndPruned() {
        val fx = MusicalCastFx()
        repeat(20) { fx.note("r", 0L, still = false) }
        assertEquals(MusicalCastMotion.MAX_FLOATS, fx.floats.size)
        assertTrue(fx.has("r"))
        assertTrue(fx.busy(10L))
        fx.prune(MusicalCastMotion.FLOAT_MS)
        assertFalse(fx.has("r"))
        assertFalse(fx.busy(MusicalCastMotion.FLOAT_MS))
        // Reduce Motion: a note but no hop.
        fx.note("s", 0L, still = true)
        assertFalse(fx.hops.containsKey("s"))
        assertEquals(1, fx.floats.size)
    }

    @Test fun flagIsOnInDebugOnly() {
        assertEquals(com.wordocious.app.BuildConfig.DEBUG, MusicalCastState.enabled)
    }
}
