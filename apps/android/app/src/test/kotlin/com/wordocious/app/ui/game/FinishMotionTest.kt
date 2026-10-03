package com.wordocious.app.ui.game

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC BJ2: one big thing at a time, in step with iOS FinishMotion / web FINISH_MOTION. */
class FinishMotionTest {
    @Test fun winCardBeatsAreOrdered() {
        assertTrue(FinishMotion.TILES_START_MS < FinishMotion.COUNT_START_MS)
        assertTrue(FinishMotion.COUNT_START_MS < FinishMotion.SWEEP_START_MS)
        assertTrue(FinishMotion.SWEEP_START_MS < FinishMotion.SPARKLE_START_MS)
        assertTrue(FinishMotion.SPARKLE_START_MS <= FinishMotion.BOB_START_MS)
    }

    @Test fun afterContinueTheToastThenThePopups() {
        assertTrue(FinishMotion.XP_AFTER_HOLD_MS > FinishMotion.AFTER_CARD_MS)
        assertTrue(FinishMotion.ACHIEVEMENTS_AFTER_HOLD_MS > FinishMotion.XP_AFTER_HOLD_MS + 300)
    }

    @Test fun matchesTheOtherPlatforms() {
        assertEquals(300L, FinishMotion.AFTER_CARD_MS)
        assertEquals(450L, FinishMotion.XP_AFTER_HOLD_MS)
        assertEquals(850L, FinishMotion.ACHIEVEMENTS_AFTER_HOLD_MS)
        assertEquals(250, FinishMotion.TILES_START_MS)
        assertEquals(450L, FinishMotion.COUNT_START_MS)
        assertEquals(900L, FinishMotion.SWEEP_START_MS)
        assertEquals(1150L, FinishMotion.SPARKLE_START_MS)
        assertEquals(1200L, FinishMotion.BOB_START_MS)
        // The win card's tray starts its flips on the shared beat.
        assertEquals(FinishMotion.TILES_START_MS, WinPopupMath.TRAY_DELAY_MS)
    }
}
