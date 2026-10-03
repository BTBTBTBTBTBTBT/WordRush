package com.wordocious.app.widget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Test

/** FINISH_SPEC AV: the widget's peeking trio — never the host, a different trio each day. */
class WidgetCastTest {
    private val cast = ('A'..'J').toList()

    @Test fun neverTheHostAndAlwaysThree() {
        for (day in 0L..30L) for (host in cast) {
            val trio = WidgetCast.peekers(cast, host, day)
            assertEquals(3, trio.size)
            assertFalse(host in trio)
            assertEquals(3, trio.toSet().size)
        }
    }

    @Test fun consecutiveDaysShowDifferentTrios() {
        for (day in 0L..60L) assertNotEquals(WidgetCast.peekers(cast, 'W', day).toSet(), WidgetCast.peekers(cast, 'W', day + 1).toSet())
    }

    @Test fun emptyCastHasNoPeekers() {
        assertEquals(emptyList<Char>(), WidgetCast.peekers(listOf('W'), 'W', 3))
    }
}

/** BI13b: the one peeking cast member — mood by state, pose by day (iOS testPeekPose twin). */
class WidgetPeekTest {
    private fun day(s: String) = java.time.LocalDate.parse(s).toEpochDay()

    @Test fun moodByState() {
        assertEquals(WidgetCast.PeekMood.FRESH, WidgetCast.peekMood(0, 8, 14))
        assertEquals(WidgetCast.PeekMood.SWEPT, WidgetCast.peekMood(8, 8, 14))
        assertEquals(WidgetCast.PeekMood.MILESTONE, WidgetCast.peekMood(5, 8, 14))
        assertEquals(WidgetCast.PeekMood.PLAYING, WidgetCast.peekMood(5, 8, 12))
        assertEquals(WidgetCast.PeekMood.PLAYING, WidgetCast.peekMood(5, 8, 0))
        assertEquals(true, WidgetCast.isMilestone(7)); assertEquals(true, WidgetCast.isMilestone(50))
        assertFalse(WidgetCast.isMilestone(0)); assertFalse(WidgetCast.isMilestone(13))
    }

    @Test fun poseByDayMatchesIos() {
        assertEquals("r-cocoa", WidgetCast.peekPose(0, 8, 12, day("2026-10-03")))
        assertEquals("r-wake", WidgetCast.peekPose(0, 8, 12, day("2026-10-04")))
        assertEquals("o3-ready", WidgetCast.peekPose(5, 8, 12, day("2026-10-03")))
        assertEquals("o1-ready", WidgetCast.peekPose(5, 8, 12, day("2026-10-04")))
        assertEquals("s-victory", WidgetCast.peekPose(5, 8, 14, day("2026-10-03")))
        assertEquals("o1-cheer", WidgetCast.peekPose(8, 8, 14, day("2026-10-03")))
        assertEquals("i-cheer", WidgetCast.peekPose(8, 8, 14, day("2026-10-05")))
    }

    @Test fun neverW() {
        for (pool in WidgetCast.PEEK_POSES.values) assertFalse(pool.any { it.startsWith("w-") })
    }
}

/** FINISH_SPEC BC: the points never truncate — full number first, compact only as a last resort. */
class WidgetPointsFitTest {
    @Test fun fullNumberWheneverItFits() {
        assertEquals("10,779", WidgetStats.pointsLabelFit(10_779))
        assertEquals("999,999", WidgetStats.pointsLabelFit(999_999))
        assertEquals("0", WidgetStats.pointsLabelFit(0))
    }

    @Test fun compactOnlyWhenTheFullNumberCannotFit() {
        assertEquals("1.2M", WidgetStats.pointsLabelFit(1_234_567))
        assertEquals("10.8K", WidgetStats.pointsLabelFit(10_779, maxChars = 5))
    }
}
