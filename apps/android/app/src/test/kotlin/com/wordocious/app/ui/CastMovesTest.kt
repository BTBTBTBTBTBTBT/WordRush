package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/** FINISH_SPEC A5: the living cast header's move picker and keyframes. */
class CastMovesTest {
    @Test fun everyCharacterHasAMove() {
        assertEquals(MascotId.entries.toSet(), CastMoves.moves.keys)
        assertEquals(900, CastMoves.moves.getValue(MascotId.O1).durationMs)
        assertEquals(700, CastMoves.moves.getValue(MascotId.W).durationMs)
        assertEquals(1600, CastMoves.moves.getValue(MascotId.R).durationMs)
        assertEquals(760, CastMoves.moves.getValue(MascotId.D).durationMs)
        assertEquals(820, CastMoves.moves.getValue(MascotId.O2).durationMs)
        assertEquals(1200, CastMoves.moves.getValue(MascotId.C).durationMs)
        assertEquals(900, CastMoves.moves.getValue(MascotId.I).durationMs)
        assertEquals(760, CastMoves.moves.getValue(MascotId.O3).durationMs)
        assertEquals(1800, CastMoves.moves.getValue(MascotId.U).durationMs)
        assertEquals(700, CastMoves.moves.getValue(MascotId.S).durationMs)
    }

    @Test fun pickerNeverRepeatsTheLastPerformer() {
        val rnd = Random(42)
        var last: MascotId? = null
        val seen = mutableSetOf<MascotId>()
        repeat(2000) {
            val next = CastMoves.pickNext(last, rnd)
            assertNotEquals(last, next)
            seen += next
            last = next
        }
        // Over many ticks everyone gets a turn.
        assertEquals(MascotId.entries.toSet(), seen)
    }

    @Test fun pickerWithNoHistoryCanPickAnyone() {
        val seen = (0 until 500).map { CastMoves.pickNext(null, Random(it)) }.toSet()
        assertEquals(MascotId.entries.toSet(), seen)
    }

    @Test fun gapIsTwoPointSixToFiveSeconds() {
        val rnd = Random(7)
        repeat(1000) {
            val g = CastMoves.nextGapMs(rnd)
            assertTrue(g in 2600L..5000L)
        }
    }

    @Test fun movesStartAndEndAtRest() {
        for (move in CastMoves.moves.values) {
            assertEquals(CastXf.IDENTITY, CastMoves.sample(move, 0f))
            val end = CastMoves.sample(move, 1f)
            // O1's spin ends a full turn round (360° = at rest).
            if (move.id == MascotId.O1) assertEquals(360f, end.rot, 0.001f)
            else assertEquals(CastXf.IDENTITY, end)
        }
    }

    @Test fun keyframesLandOnTheirValues() {
        val w = CastMoves.moves.getValue(MascotId.W)
        assertEquals(-0.22f, CastMoves.sample(w, 0.45f).ty, 0.0001f)
        val u = CastMoves.moves.getValue(MascotId.U)
        assertEquals(-0.14f, CastMoves.sample(u, 0.5f).ty, 0.0001f)
        val c = CastMoves.moves.getValue(MascotId.C)
        // Held between 30% and 65%.
        assertEquals(9f, CastMoves.sample(c, 0.5f).rot, 0.0001f)
        val s = CastMoves.moves.getValue(MascotId.S)
        assertEquals(-10f, CastMoves.sample(s, 0.35f).skewX, 0.0001f)
    }

    @Test fun bezierEndpointsAndOvershoot() {
        val e = Bezier.EASE_IN_OUT
        assertEquals(0f, e.ease(0f), 0f)
        assertEquals(1f, e.ease(1f), 0f)
        assertEquals(0.5f, e.ease(0.5f), 0.01f)
        // The springy hop curve overshoots past 1 mid-way.
        val spring = Bezier(0.3f, 1.5f, 0.5f, 1f)
        assertTrue((1..99).any { spring.ease(it / 100f) > 1f })
    }

    @Test fun trimmedFiguresFillTheRowExactly() {
        val width = 390f
        val h = CastCrops.figureHeight(width)
        val total = MascotId.entries.sumOf { (CastCrops.crops.getValue(it).aspect * h).toDouble() }.toFloat() -
            CastCrops.OVERLAP * width * (MascotId.entries.size - 1)
        assertEquals(width, total, 0.01f)
        // The mockup's flex weights: W 1.09, I 0.47.
        assertEquals(1.088f, CastCrops.crops.getValue(MascotId.W).aspect, 0.005f)
        assertEquals(0.471f, CastCrops.crops.getValue(MascotId.I).aspect, 0.005f)
    }
}
