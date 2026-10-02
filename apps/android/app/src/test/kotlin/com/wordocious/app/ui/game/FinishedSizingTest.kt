package com.wordocious.app.ui.game

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC R2: the finished screen's dock-first height budget and board fits. */
class FinishedSizingTest {
    private val eps = 0.001f

    @Test
    fun board_gets_what_the_header_strip_and_dock_leave() {
        val b = FinishedSizing.budget(viewport = 700f, header = 160f, strip = 32f, dock = 140f, gaps = 24f)
        assertEquals(344f, b.board, eps)
        assertFalse(b.scrolls)
    }

    @Test
    fun a_taller_dock_shrinks_the_board_not_the_buttons() {
        val short = FinishedSizing.budget(700f, 160f, 32f, 60f, 24f)
        val tall = FinishedSizing.budget(700f, 160f, 32f, 200f, 24f)
        assertEquals(140f, short.board - tall.board, eps)
    }

    @Test
    fun below_the_floor_the_board_keeps_its_floor_and_the_page_scrolls() {
        val b = FinishedSizing.budget(viewport = 400f, header = 160f, strip = 32f, dock = 140f, gaps = 24f)
        assertEquals(FinishedSizing.MIN_BOARD, b.board, eps)
        assertTrue(b.scrolls)
    }

    @Test
    fun iphone_se_class_phone_fits_a_pro_dock_without_scrolling() {
        // 667 tall minus a 24 status bar and a 48 three-button nav bar; header with the
        // 84 dp short-screen title art cap + controls row + meta line; strip; Pro dock
        // (share row 44 + gap + Unlimited card ~84 + padding).
        val viewport = FinishedSizing.MIN_PHONE_HEIGHT - 24f - 48f
        val b = FinishedSizing.budget(viewport, header = 6f + 48f + 84f + 4f + 16f, strip = 30f, dock = 2f + 44f + 8f + 86f + 8f, gaps = 24f)
        assertFalse(b.scrolls)
        assertTrue(b.board >= FinishedSizing.MIN_BOARD)
    }

    @Test
    fun square_board_takes_the_tighter_side_capped() {
        assertEquals(300f, FinishedSizing.squareSide(360f, 300f, 420f), eps)
        assertEquals(340f, FinishedSizing.squareSide(340f, 600f, 420f), eps)
        assertEquals(420f, FinishedSizing.squareSide(800f, 900f, 420f), eps)
        assertEquals(0f, FinishedSizing.squareSide(-5f, 100f, 420f), eps)
    }

    @Test
    fun quadword_mini_grid_fits_height_with_square_tiles() {
        // 2×2 boards of 5 × 9 tiles in 340 × 250: height-bound.
        val w = FinishedSizing.miniBoardWidth(340f, 250f, cols = 2, rows = 2, tileCols = 5, tileRows = 9, gap = 6f, chromeW = 8f, chromeH = 12f)
        val boardH = (w - 8f) * 9f / 5f + 12f
        assertTrue(boardH * 2 + 6f <= 250f + eps)
        assertTrue(w * 2 + 6f <= 340f + eps)
        // Width-bound when the slot is tall.
        val wide = FinishedSizing.miniBoardWidth(340f, 2000f, 2, 2, 5, 9, 6f, 8f, 12f)
        assertEquals(167f, wide, eps)
    }

    @Test
    fun mini_grid_shapes() {
        assertEquals(1, FinishedSizing.miniGridCols(1))
        assertEquals(2, FinishedSizing.miniGridCols(2))
        assertEquals(2, FinishedSizing.miniGridCols(4))
        assertEquals(4, FinishedSizing.miniGridCols(8))
    }

    @Test
    fun ladder_rows_shrink_then_collapse() {
        assertEquals(44f, FinishedSizing.rowTile(800f, 6, 6f, 30f, 44f, 22f)!!, eps)
        val t = FinishedSizing.rowTile(240f, 6, 4f, 20f, 44f, 22f)!!
        assertEquals((240f - 20f - 20f) / 6f, t, eps)
        assertNull(FinishedSizing.rowTile(150f, 12, 4f, 20f, 44f, 22f))
    }

    @Test
    fun strip_sentence_reads_every_chip() {
        val s = stripSentence(true, listOf(stripCount("4", "guesses"), stripTime(83), stripPoints(1250)))
        assertEquals("Won, 4 guesses, 1:23 time, 1,250 points", s)
        assertEquals("45s", stripTime(45).value)
    }
}
