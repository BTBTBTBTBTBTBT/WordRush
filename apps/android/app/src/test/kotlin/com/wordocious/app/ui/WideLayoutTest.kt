package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC AG: the tablet / foldable content column rule. */
class WideLayoutTest {
    @Test fun phonesKeepTheFullWidth() {
        listOf(320f, 360f, 393f, 412f, 480f, 599f).forEach { w ->
            assertFalse(WideLayout.isWide(w))
            assertEquals(w, WideLayout.columnWidth(w, WideLayout.GAME_COLUMN_DP), 0.001f)
            assertEquals(w, WideLayout.columnWidth(w, WideLayout.PAGE_COLUMN_DP), 0.001f)
            assertEquals(0f, WideLayout.sideGutter(w, WideLayout.GAME_COLUMN_DP), 0.001f)
        }
    }

    @Test fun tabletsGetACenteredColumn() {
        assertTrue(WideLayout.isWide(600f))
        // A small tablet / unfolded foldable in portrait.
        assertEquals(560f, WideLayout.columnWidth(600f, WideLayout.GAME_COLUMN_DP), 0.001f)
        assertEquals(20f, WideLayout.sideGutter(600f, WideLayout.GAME_COLUMN_DP), 0.001f)
        assertEquals(600f, WideLayout.columnWidth(600f, WideLayout.PAGE_COLUMN_DP), 0.001f)
        // A 10" tablet in landscape.
        assertEquals(560f, WideLayout.columnWidth(1280f, WideLayout.GAME_COLUMN_DP), 0.001f)
        assertEquals(600f, WideLayout.columnWidth(1280f, WideLayout.PAGE_COLUMN_DP), 0.001f)
        assertEquals(340f, WideLayout.sideGutter(1280f, WideLayout.PAGE_COLUMN_DP), 0.001f)
    }

    @Test fun theColumnNeverExceedsTheWindow() {
        listOf(600f, 700f, 840f, 1024f, 1600f).forEach { w ->
            assertTrue(WideLayout.columnWidth(w, 2000f) <= w)
        }
    }

    @Test fun popupsAreCapped() {
        assertTrue(WideLayout.POPUP_CARD_DP <= WideLayout.POPUP_MAX_DP)
        assertEquals(440f, WideLayout.POPUP_MAX_DP, 0.001f)
    }
}
