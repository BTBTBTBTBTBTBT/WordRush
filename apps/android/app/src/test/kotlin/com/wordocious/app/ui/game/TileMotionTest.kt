package com.wordocious.app.ui.game

import com.wordocious.core.TileState
import org.junit.Assert.assertEquals
import org.junit.Test

/** FINISH_SPEC B1 / B3: the tile faces and the motion kit's timings. */
class TileMotionTest {
    @Test fun revealIs720msTurnsThreeHundredApart() {
        assertEquals(0, TileMotion.revealMs(0))
        assertEquals(720, TileMotion.revealMs(1))
        assertEquals(4 * 300 + 720, TileMotion.revealMs(5))
    }

    @Test fun hopWaveAndClearStagger() {
        assertEquals(4 * 90 + 560, TileMotion.hopWaveMs(5))
        assertEquals(4 * 90 + 300, TileMotion.clearMs(5))
    }

    @Test fun finishHoldCoversTheRevealAndTheCelebration() {
        assertEquals(TileMotion.revealMs(5) + TileMotion.hopWaveMs(5) + 250, TileMotion.finishHoldMs(5, won = true, multiBoard = false, reduced = false))
        assertEquals(TileMotion.revealMs(5) + TileMotion.SINK_MS + 250, TileMotion.finishHoldMs(5, won = false, multiBoard = false, reduced = false))
        assertEquals(350, TileMotion.finishHoldMs(5, won = true, multiBoard = false, reduced = true))
    }

    @Test fun facesFollowTheBoardState() {
        assertEquals(TileFace.CORRECT, TileLooks.faceFor(TileState.CORRECT, hasLetter = true, invalid = false, masked = false))
        assertEquals(TileFace.PRESENT, TileLooks.faceFor(TileState.PRESENT, true, false, false))
        assertEquals(TileFace.ABSENT, TileLooks.faceFor(TileState.ABSENT, true, false, false))
        assertEquals(TileFace.TYPED, TileLooks.faceFor(TileState.EMPTY, true, false, false))
        assertEquals(TileFace.EMPTY, TileLooks.faceFor(TileState.EMPTY, false, false, false))
        assertEquals(TileFace.BAD, TileLooks.faceFor(TileState.EMPTY, true, true, false))
        assertEquals(TileFace.MASKED, TileLooks.faceFor(TileState.ABSENT, true, false, true))
    }

    @Test fun rightSpotIsPurpleWrongSpotGoldNotInWordSlate() {
        assertEquals(0xFF7C3AED.toInt(), argb(TileLooks.of(TileFace.CORRECT).faceMid))
        assertEquals(0xFFF5A524.toInt(), argb(TileLooks.of(TileFace.PRESENT).faceMid))
        assertEquals(0xFF6B7891.toInt(), argb(TileLooks.of(TileFace.ABSENT).faceMid))
        // The empty tile is frosted glass, never solid white.
        assertEquals(true, TileLooks.of(TileFace.EMPTY).faceMid.alpha < 1f)
    }

    private fun argb(c: androidx.compose.ui.graphics.Color): Int {
        val a = (c.alpha * 255 + 0.5f).toInt()
        val r = (c.red * 255 + 0.5f).toInt()
        val g = (c.green * 255 + 0.5f).toInt()
        val b = (c.blue * 255 + 0.5f).toInt()
        return (a shl 24) or (r shl 16) or (g shl 8) or b
    }
}
