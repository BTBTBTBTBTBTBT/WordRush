package com.wordocious.app.data

import android.view.HapticFeedbackConstants
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC U: the event map, the tap pitch range and the count-up tick throttle. */
class FeedbackMapTest {

    @Test fun eventMapMatchesSpec() {
        val expected = mapOf(
            FeedbackEvent.KEY to (Sfx.TAP to Haptic.LIGHT),
            FeedbackEvent.DELETE to (Sfx.DELETE to Haptic.LIGHT),
            FeedbackEvent.FLIP to (Sfx.FLIP to Haptic.SELECTION),
            FeedbackEvent.ROW_LAND to (null to Haptic.LIGHT),
            FeedbackEvent.INVALID to (Sfx.INVALID to Haptic.WARNING),
            FeedbackEvent.PRESS to (Sfx.PRESS to Haptic.SOFT),
            FeedbackEvent.RELEASE to (Sfx.RELEASE to null),
            FeedbackEvent.HOP to (Sfx.HOP to null),
            FeedbackEvent.WIN to (Sfx.WIN to Haptic.SUCCESS),
            FeedbackEvent.LOSE to (Sfx.LOSE to Haptic.SOFT),
            FeedbackEvent.CELEBRATE to (Sfx.CELEBRATE to Haptic.SUCCESS_HEAVY),
            FeedbackEvent.STREAK to (Sfx.STREAK to Haptic.MEDIUM),
            FeedbackEvent.TICK to (Sfx.TICK to null),
            FeedbackEvent.NOTIFY to (Sfx.NOTIFY to Haptic.LIGHT),
            FeedbackEvent.UNLOCK to (Sfx.UNLOCK to Haptic.SUCCESS),
            FeedbackEvent.VS to (Sfx.VS to Haptic.MEDIUM),
            FeedbackEvent.WHOOSH to (Sfx.WHOOSH to null),
            FeedbackEvent.INTRO to (Sfx.INTRO to null),
        )
        assertEquals(FeedbackEvent.entries.toSet(), expected.keys)
        expected.forEach { (e, pair) ->
            assertEquals("$e sound", pair.first, e.sound)
            assertEquals("$e haptic", pair.second, e.haptic)
        }
    }

    @Test fun everySoundIsUsedAndNamedLikeItsFile() {
        assertEquals(17, Sfx.entries.size)
        Sfx.entries.forEach { assertEquals("sfx_" + it.name.lowercase(), it.file) }
        val used = FeedbackEvent.entries.mapNotNull { it.sound }.toSet()
        assertEquals(Sfx.entries.toSet(), used)
    }

    @Test fun introJingleMutesTheLandingHopOnly() {
        assertFalse(FeedbackRules.hopMutedByIntro(5_000L, 0L))          // no intro this process
        assertTrue(FeedbackRules.hopMutedByIntro(5_000L, 4_000L))       // the landing, inside the jingle
        assertFalse(FeedbackRules.hopMutedByIntro(7_000L, 4_000L))      // after the jingle
        assertEquals(5000L, FeedbackRules.minGapMs(FeedbackEvent.INTRO))
    }

    @Test fun tapPitchStaysWithinThreePercent() {
        assertEquals(0.97f, FeedbackRules.tapRate(0.0), 1e-6f)
        assertEquals(1.00f, FeedbackRules.tapRate(0.5), 1e-6f)
        assertEquals(1.03f, FeedbackRules.tapRate(1.0), 1e-6f)
        val r = kotlin.random.Random(7)
        repeat(1000) {
            val rate = FeedbackRules.tapRate(r.nextDouble())
            assertTrue(rate in 0.97f..1.03f)
        }
        // Out-of-range input is clamped.
        assertEquals(0.97f, FeedbackRules.tapRate(-3.0), 1e-6f)
        assertEquals(1.03f, FeedbackRules.tapRate(9.0), 1e-6f)
    }

    @Test fun tickThrottleAllowsAtMostTwelvePerSecond() {
        val t = FeedbackThrottle(FeedbackRules.TICK_MIN_GAP_MS)
        // A count-up updating every frame (≈16 ms) for one second.
        val allowed = (0 until 1000 step 16).count { t.allow(it.toLong()) }
        assertTrue("allowed $allowed", allowed in 10..12)
        // Any 1000 ms window lets through at most 12.
        val t2 = FeedbackThrottle(FeedbackRules.TICK_MIN_GAP_MS)
        val times = (0L until 5000L).filter { t2.allow(it) }
        times.forEach { start -> assertTrue(times.count { it >= start && it < start + 1000 } <= 12) }
        assertEquals(84L, FeedbackRules.TICK_MIN_GAP_MS)
    }

    @Test fun throttleBasics() {
        val t = FeedbackThrottle(100)
        assertTrue(t.allow(1000))
        assertFalse(t.allow(1050))
        assertTrue(t.allow(1100))
        assertTrue(FeedbackThrottle(100).allow(0))
    }

    @Test fun perEventGaps() {
        assertEquals(FeedbackRules.TICK_MIN_GAP_MS, FeedbackRules.minGapMs(FeedbackEvent.TICK))
        assertTrue(FeedbackRules.minGapMs(FeedbackEvent.FLIP) in 1..299) // under the 300 ms reveal stagger
        assertTrue(FeedbackRules.minGapMs(FeedbackEvent.ROW_LAND) > 0)
        assertEquals(0L, FeedbackRules.minGapMs(FeedbackEvent.KEY))
        assertEquals(0L, FeedbackRules.minGapMs(FeedbackEvent.WIN))
        assertNull(FeedbackEvent.ROW_LAND.sound)
    }

    @Test fun hapticConstantsAreApiGuarded() {
        assertEquals(HapticFeedbackConstants.LONG_PRESS, Haptics.constant(Haptic.WARNING, 26))
        assertEquals(HapticFeedbackConstants.REJECT, Haptics.constant(Haptic.WARNING, 30))
        assertEquals(HapticFeedbackConstants.CONTEXT_CLICK, Haptics.constant(Haptic.SUCCESS, 29))
        assertEquals(HapticFeedbackConstants.CONFIRM, Haptics.constant(Haptic.SUCCESS_HEAVY, 33))
        assertEquals(HapticFeedbackConstants.CLOCK_TICK, Haptics.constant(Haptic.SELECTION, 26))
        assertEquals(HapticFeedbackConstants.TEXT_HANDLE_MOVE, Haptics.constant(Haptic.SELECTION, 27))
        assertEquals(HapticFeedbackConstants.SEGMENT_TICK, Haptics.constant(Haptic.SOFT, 34))
        assertEquals(HapticFeedbackConstants.KEYBOARD_TAP, Haptics.constant(Haptic.LIGHT, 36))
        assertEquals(HapticFeedbackConstants.CONTEXT_CLICK, Haptics.constant(Haptic.MEDIUM, 26))
    }
}
