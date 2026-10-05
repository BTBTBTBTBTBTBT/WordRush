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

    // BI18 Crosswordocious fits one screen in play (founder 10-03). Chrome: tray padding + border
    // each side (23 dp) across; that plus the lip and the cursor ring's room (33 dp) down.
    private fun xw(w: Float, h: Float?, cols: Int = 10, rows: Int = 11) =
        BoardSizing.crosswordCell(w, h, cols, rows, gap = 3f, chromeX = 23f, chromeY = 33f)

    @Test fun crosswordTenByElevenFitsByHeightOnEveryPhone() {
        // Bands left between the compact header and the clue bar / pills / keyboard:
        // 360×640 (44 dp keys) ≈ 340×258; 411×891 ≈ 391×485.
        assertEquals(17f, xw(340f, 258f), eps)
        assertEquals(34f, xw(391f, 485f), eps)
        // Width alone would have given 29 dp on the small phone — eleven rows of those scrolled.
        assertEquals(29f, xw(340f, null), eps)
        for ((w, h) in listOf(340f to 258f, 391f to 485f)) {
            val c = xw(w, h)
            assertTrue(c * 10 + 27 + 23 <= w && c * 11 + 30 + 33 <= h)
        }
    }

    @Test fun crosswordCapsFloorsAndSmallerGrids() {
        assertEquals(BoardSizing.CROSSWORD_MAX_CELL, xw(1000f, 1000f), eps)
        assertEquals(BoardSizing.CROSSWORD_MIN_CELL, xw(340f, 100f), eps)
        assertTrue(xw(340f, 258f, cols = 7, rows = 7) > xw(340f, 258f))
    }

    // ProperNoundle long answers (founder 2026-10-05: no dead bands): width-bound rows spend the spare height.
    @Test fun fillRows_tenTilesAcrossAPhone_tallerTilesThenRoomierRows() {
        val f = BoardSizing.fillRows(tileW = 31f, availH = 340f, rows = 6, gap = 5f)
        assertEquals(31f, f.tileW, 0.01f)
        assertEquals(kotlin.math.floor(31f * 1.25f), f.tileH, 0.01f)
        assertTrue(f.rowGap > 5f)
        assertTrue(f.rowGap <= kotlin.math.floor(f.tileH * 0.5f))
        assertTrue(6 * f.tileH + 5 * f.rowGap >= 340f * BoardSizing.HEIGHT_FRACTION - 20f)
    }

    @Test fun fillRows_heightBound_staysSquare() {
        val f = BoardSizing.fillRows(tileW = 64f, availH = 300f, rows = 6, gap = 5f)
        assertEquals(f.tileW, f.tileH, 0.01f)
        assertEquals(5f, f.rowGap, 0.01f)
    }
}
