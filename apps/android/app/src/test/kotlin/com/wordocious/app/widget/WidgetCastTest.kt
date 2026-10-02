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
