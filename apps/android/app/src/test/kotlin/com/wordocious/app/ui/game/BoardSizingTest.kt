package com.wordocious.app.ui.game

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC B5: the ONE board-sizing rule every game shares. */
class BoardSizingTest {
    private val eps = 0.01f

    @Test fun classicOnATypicalPhoneIsHeightBound() {
        // 360 × 420 dp between the status line and the keyboard, 5 × 6 tiles, 5 dp gaps.
        val f = BoardSizing.fitSquare(360f, 420f, cols = 5, rows = 6, gap = 5f)
        // Height side: (420 × .98 − 25) / 6 = 64.43; width side: (345.6 − 20) / 5 = 65.12.
        assertEquals((420f * 0.98f - 25f) / 6f, f.cellW, eps)
        assertEquals(f.cellW, f.cellH, 0f)
        assertEquals(420f * 0.98f, f.height, eps)
        assertTrue(f.width <= 360f * BoardSizing.WIDTH_FRACTION + eps)
    }

    @Test fun aTallSpaceFillsTheWidthWithASmallMargin() {
        val f = BoardSizing.fitSquare(390f, 700f, cols = 5, rows = 6, gap = 5f)
        assertEquals(390f * 0.96f, f.width, eps)
        assertTrue(f.height < 700f * 0.98f)
        // Square tiles: height follows the width.
        assertEquals(f.cellW * 6 + 25f, f.height, eps)
    }

    @Test fun matchesTheMockupRuleWithoutGaps() {
        // game-kit.html: w = min(width × .96, height × .98 × 5 / 6).
        for ((w, h) in listOf(360f to 420f, 412f to 500f, 320f to 300f, 600f to 900f)) {
            val f = BoardSizing.fitSquare(w, h, cols = 5, rows = 6, gap = 0f)
            assertEquals(minOf(w * 0.96f, h * 0.98f * 5f / 6f, BoardSizing.MAX_WIDTH), f.width, eps)
        }
    }

    @Test fun tabletsCapTheBoardWidth() {
        val f = BoardSizing.fitSquare(1200f, 2000f, cols = 5, rows = 6, gap = 5f)
        assertEquals(BoardSizing.MAX_WIDTH, f.width, eps)
    }

    @Test fun extraWidthIsKeptOutsideTheTiles() {
        // ProperNoundle "TAYLOR SWIFT": 11 tiles, one wider word gap (+9 dp).
        val f = BoardSizing.fitSquare(360f, 900f, cols = 11, rows = 6, gap = 5f, extraWidth = 9f)
        assertEquals(360f * 0.96f, f.width, eps)
        assertEquals((360f * 0.96f - 9f - 50f) / 11f, f.cellW, eps)
    }

    @Test fun neverNegative() {
        val f = BoardSizing.fitSquare(10f, 10f, cols = 7, rows = 6, gap = 5f)
        assertTrue(f.cellW >= 0f && f.width >= 0f && f.height >= 0f)
    }

    @Test fun multiBoardGridFillsTheWidthAndCentersSquareTilesWhenTall() {
        // QuadWord on a tall space: 2 × 2 boards of 5 × 9 tiles.
        val f = BoardSizing.fitGrid(380f, 900f, boardCols = 2, boardRows = 2, tileCols = 5, tileRows = 9, tileGap = 2f, boardChrome = 20f)
        assertEquals(380f * 0.96f, f.width, eps)
        assertEquals(f.cellW, f.cellH, 0.01f)
        assertTrue(f.height < 900f * 0.98f)
    }

    @Test fun multiBoardGridOnAShortSpaceKeepsTheWidthAndCapsTheHeight() {
        // OctoWord: 4 × 2 boards of 5 × 13 tiles in a short space → tiles go wide, grid fills it.
        val f = BoardSizing.fitGrid(380f, 300f, boardCols = 4, boardRows = 2, tileCols = 5, tileRows = 13, tileGap = 2f, boardChrome = 20f)
        assertEquals(380f * 0.96f, f.width, eps)
        assertEquals(300f * 0.98f, f.height, eps)
        assertTrue(f.cellW > f.cellH)
    }
}
