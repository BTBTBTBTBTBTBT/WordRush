package com.wordocious.app.ui.game

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.sqrt

/** FINISH_SPEC J1 + J3 + L pure pieces: the Hubbub honeycomb, the finished tray, the chip looks. */
class PiecesKitTest {
    @Test
    fun honeycomb_has_six_neighbors_all_one_step_from_the_center() {
        val o = Honeycomb.outerOffsets()
        assertEquals(6, o.size)
        val d = Honeycomb.step()
        for ((x, y) in o) assertEquals(d, hypot(x, y), 1e-4f)
        // Symmetric around the center: the offsets cancel out.
        assertEquals(0f, o.sumOf { it.first.toDouble() }.toFloat(), 1e-4f)
        assertEquals(0f, o.sumOf { it.second.toDouble() }.toFloat(), 1e-4f)
    }

    @Test
    fun honeycomb_is_flat_top_top_first_then_clockwise() {
        val o = Honeycomb.outerOffsets()
        // Top, straight above the center; bottom straight below.
        assertEquals(0f, o[0].first, 0f)
        assertTrue(o[0].second < 0f)
        assertEquals(0f, o[3].first, 0f)
        assertTrue(o[3].second > 0f)
        // Clockwise: upper right, lower right, …, upper left.
        assertTrue(o[1].first > 0f && o[1].second < 0f)
        assertTrue(o[2].first > 0f && o[2].second > 0f)
        assertTrue(o[4].first < 0f && o[4].second > 0f)
        assertTrue(o[5].first < 0f && o[5].second < 0f)
    }

    @Test
    fun honeycomb_neighbors_never_overlap() {
        // Flat-top hexes touch flat-to-flat at √3·R; every pair of hexes keeps at least that.
        val centers = listOf(0f to 0f) + Honeycomb.outerOffsets()
        val minGap = sqrt(3f) * Honeycomb.RADIUS
        for (i in centers.indices) for (j in i + 1 until centers.size) {
            val (ax, ay) = centers[i]; val (bx, by) = centers[j]
            assertTrue("hex $i and $j overlap", hypot(ax - bx, ay - by) >= minGap - 1e-4f)
        }
    }

    @Test
    fun honeycomb_side_fits_the_box_it_is_given() {
        val side = Honeycomb.sideFor(360f, 400f)
        assertTrue(side * Honeycomb.width() <= 360f + 1e-3f)
        assertTrue(side * Honeycomb.height() <= 400f + 1e-3f)
        // Width-bound in a short wide box, height-bound in a tall narrow one.
        assertEquals(300f / Honeycomb.height(), Honeycomb.sideFor(1000f, 300f), 1e-3f)
        assertEquals(300f / Honeycomb.width(), Honeycomb.sideFor(300f, 1000f), 1e-3f)
        assertTrue(Honeycomb.height() > Honeycomb.width())
        assertTrue(abs(Honeycomb.width() - Honeycomb.height()) < 0.5f)
    }

    @Test
    fun hex_ink_is_amber_on_gold_and_white_on_lilac() {
        assertEquals(Color(0xFF7A3D00), hexInk(center = true))
        assertEquals(Color.White, hexInk(center = false))
    }

    @Test
    fun finished_boards_wash_purple_or_slate() {
        assertEquals(TrayState.PLAYING, finishTray(finished = false, won = true))
        assertEquals(TrayState.PLAYING, finishTray(finished = false, won = false))
        assertEquals(TrayState.WON, finishTray(finished = true, won = true))
        assertEquals(TrayState.LOST, finishTray(finished = true, won = false))
    }

    @Test
    fun tinted_chips_are_never_plain_white() {
        val look = tintedChipLook(Color(0xFF9F1239), dark = false)
        assertNotEquals(Color.White, look.faceMid)
        assertNotEquals(Color.White, look.faceBottom)
        // The lip is darker than the face.
        assertTrue(look.edge.red + look.edge.green + look.edge.blue < look.faceMid.red + look.faceMid.green + look.faceMid.blue)
        val solid = solidChipLook(Color(0xFF0284C7))
        assertEquals(Color(0xFF0284C7), solid.faceMid)
        assertEquals(Color.White, solid.glyph)
    }

    @Test
    fun hints_note_counts_or_stays_quiet() {
        assertNull(hintsNote(0))
        assertEquals("1 hint", hintsNote(1))
        assertEquals("3 hints", hintsNote(3))
    }
}
