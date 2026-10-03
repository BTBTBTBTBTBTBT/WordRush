package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC BH: the compact Home game card + its candy cap trim (parity with web/iOS). */
class HomeCardTrimTest {
    @Test fun compactCardMeasures() {
        assertTrue(HomeCardSpec.HEIGHT in 72f..76f)
        assertTrue(HomeCardSpec.ICON in 40f..44f)
        assertEquals(17f, HomeCardSpec.NAME)
        assertEquals(13f, HomeCardSpec.DESC)
        assertTrue(CardTrimGeometry.BAND + HomeCardSpec.ICON + 16f <= HomeCardSpec.HEIGHT)
    }

    @Test fun trimIsOneRowOfDrips() {
        val segs = CardTrimGeometry.segments(176f)
        assertEquals(CardTrimGeometry.BUMPS, segs.size)
        // Right → left, the first drip ends at x = 154 on the band line, the last at the left edge.
        assertEquals(154f, segs.first()[2], 0.001f)
        assertEquals(0f, segs.last()[2], 0.001f)
        // Control 2·drip below the band → the curve peaks exactly `drip` below it.
        assertEquals(CardTrimGeometry.BAND + 2 * CardTrimGeometry.DRIP, segs[0][1], 0.001f)
        assertTrue(CardTrimGeometry.BAND + CardTrimGeometry.DRIP <= HomeCardSpec.HEIGHT / 5f)
    }
}
