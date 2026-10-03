package com.wordocious.app.ui.game

import com.wordocious.core.TileState
import org.junit.Assert.assertEquals
import org.junit.Test

/** FINISH_SPEC B1 / B3: the tile faces and the motion kit's timings. */
class TileMotionTest {
    @Test fun revealIsThePreOverhaulPacing() {
        // BI5: single board 500 ms turns, 150 ms apart (a 5-letter row ≈ 1.1 s);
        // multi-board mini boards 300 ms, 80 ms apart.
        assertEquals(500, TileMotion.FLIP_MS)
        assertEquals(150, TileMotion.FLIP_STAGGER_MS)
        assertEquals(300, TileMotion.MINI_FLIP_MS)
        assertEquals(80, TileMotion.MINI_FLIP_STAGGER_MS)
        assertEquals(500, TileMotion.flipMs())
        assertEquals(300, TileMotion.flipMs(mini = true))
        assertEquals(150, TileMotion.staggerMs())
        assertEquals(80, TileMotion.staggerMs(mini = true))
        assertEquals(0, TileMotion.revealMs(0))
        assertEquals(500, TileMotion.revealMs(1))
        assertEquals(1100, TileMotion.revealMs(5))
        assertEquals(4 * 80 + 300, TileMotion.revealMs(5, mini = true))
    }

    @Test fun tileLandsAtItsStaggerPlusOneFlip() {
        assertEquals(500, TileMotion.tileLandsMs(0))
        assertEquals(500 + 3 * 150, TileMotion.tileLandsMs(3))
        assertEquals(300 + 3 * 80, TileMotion.tileLandsMs(3, mini = true))
        assertEquals(0, TileMotion.tilesLanded(499, 5))
        assertEquals(1, TileMotion.tilesLanded(500, 5))
        assertEquals(2, TileMotion.tilesLanded(650, 5))
        assertEquals(5, TileMotion.tilesLanded(TileMotion.revealMs(5), 5))
        assertEquals(5, TileMotion.tilesLanded(10_000, 5))
        assertEquals(0, TileMotion.tilesLanded(299, 5, mini = true))
        assertEquals(2, TileMotion.tilesLanded(380, 5, mini = true))
        assertEquals(5, TileMotion.tilesLanded(TileMotion.revealMs(5, mini = true), 5, mini = true))
    }

    @Test fun hopWaveAndClearStagger() {
        assertEquals(4 * 60 + 400, TileMotion.hopWaveMs(5))
        assertEquals(4 * 60 + 160, TileMotion.clearMs(5))
    }

    @Test fun finishHoldWaitsForTheWholeRowThenTheHopThenABeat() {
        // BI5: never cut short — the popup waits for the slower row (and a win's hop wave).
        assertEquals(1100 + TileMotion.hopWaveMs(5) + 200, TileMotion.finishHoldMs(5, won = true, multiBoard = false, reduced = false))
        assertEquals(1100 + 200, TileMotion.finishHoldMs(5, won = false, multiBoard = false, reduced = false))
        assertEquals(TileMotion.revealMs(5, mini = true) + TileMotion.hopWaveMs(5) + 200, TileMotion.finishHoldMs(5, won = true, multiBoard = true, reduced = false))
        assertEquals(TileMotion.revealMs(5, mini = true) + 200, TileMotion.finishHoldMs(5, won = false, multiBoard = true, reduced = false))
        assertEquals(350, TileMotion.finishHoldMs(5, won = true, multiBoard = false, reduced = true))
        for (tiles in 1..8) for (won in listOf(true, false)) for (multi in listOf(true, false)) {
            assertEquals(true, TileMotion.finishHoldMs(tiles, won, multiBoard = multi, reduced = false) >= TileMotion.revealMs(tiles, multi))
        }
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
