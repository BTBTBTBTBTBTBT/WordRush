package com.wordocious.app.ui.game

import com.wordocious.app.ui.CandyColor
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC R1 the win popup's pure bits: the count-up, chip selection, tiles and the CONTINUE color. */
class WinPopupTest {
    @Test fun pointsCountUpEasesOutFromZeroToTheTarget() {
        assertEquals(0, WinPopupMath.countUpValue(1234, 0f))
        assertEquals(1234, WinPopupMath.countUpValue(1234, 1f))
        // Clamped outside [0, 1].
        assertEquals(0, WinPopupMath.countUpValue(1234, -0.5f))
        assertEquals(1234, WinPopupMath.countUpValue(1234, 2f))
        // Ease-out cubic: halfway through the time is 87.5% of the way (web countUpValue).
        assertEquals(875, WinPopupMath.countUpValue(1000, 0.5f))
        // Over 700 ms: 350 ms in = the same point; monotonic along the way.
        assertEquals(875, WinPopupMath.countUpAt(1000, 350L))
        var last = -1
        for (ms in 0..700 step 35) {
            val v = WinPopupMath.countUpAt(1000, ms.toLong())
            assertTrue(v >= last)
            last = v
        }
        assertEquals(1000, last)
        assertEquals(1000, WinPopupMath.countUpAt(1000, 5_000L))
    }

    @Test fun chipsPickTheirGlyphFromTheLabel() {
        assertEquals(WinStatKind.TIME, WinPopupMath.kindFor("TIME"))
        assertEquals(WinStatKind.POINTS, WinPopupMath.kindFor("Points"))
        assertEquals(WinStatKind.BOARDS, WinPopupMath.kindFor("boards"))
        for (l in listOf("GUESSES", "CHECKS", "MISTAKES", "MOVES", "MISSES", "FOUND", "WORDS")) {
            assertEquals(l, WinStatKind.GUESSES, WinPopupMath.kindFor(l))
        }
    }

    @Test fun wordGamesShowBoardsOnlyWhenMultiAndPointsOnlyWhenKnown() {
        val single = WinPopupMath.wordGameStats(false, 1, 1, 4, 6, 95, 1234)
        assertEquals(listOf(WinStatKind.GUESSES, WinStatKind.TIME, WinStatKind.POINTS), single.map { it.kind })
        assertEquals(listOf("4/6", "1:35", "1,234"), single.map { it.value })
        val quad = WinPopupMath.wordGameStats(true, 3, 4, 9, 9, 48, null)
        assertEquals(listOf(WinStatKind.BOARDS, WinStatKind.GUESSES, WinStatKind.TIME), quad.map { it.kind })
        assertEquals(listOf("3/4", "9/9", "48s"), quad.map { it.value })
        // No max: the bare count.
        assertEquals("7", WinPopupMath.wordGameStats(false, 0, 1, 7, 0, 10, null)[0].value)
    }

    @Test fun pointsParseOnlyFromNumbers() {
        assertEquals(1234, WinPopupMath.parsePoints("1,234"))
        assertEquals(0, WinPopupMath.parsePoints("0"))
        assertNull(WinPopupMath.parsePoints("—"))
        assertNull(WinPopupMath.parsePoints("1:35"))
        assertNull(WinPopupMath.parsePoints(""))
    }

    @Test fun valueSizeIsFixedByTheFinalText() {
        assertEquals(18f, WinPopupMath.valueFontSp("4/6"), 0f)
        assertEquals(16f, WinPopupMath.valueFontSp("1,234"), 0f)
        assertTrue(WinPopupMath.valueFontSp("12,345") < WinPopupMath.valueFontSp("1,234"))
    }

    @Test fun tilesFlipLeftToRight40msApart() {
        assertEquals(WinPopupMath.TRAY_DELAY_MS, WinPopupMath.tileDelayMs(0, 0))
        assertEquals(40, WinPopupMath.tileDelayMs(0, 3) - WinPopupMath.tileDelayMs(0, 2))
        assertEquals(120, WinPopupMath.tileDelayMs(1, 0) - WinPopupMath.tileDelayMs(0, 0))
        assertEquals(0f, WinPopupMath.flipProgress(199f, 200), 0f)
        assertEquals(0.5f, WinPopupMath.flipProgress(350f, 200), 0.0001f)
        assertEquals(1f, WinPopupMath.flipProgress(10_000f, 200), 0f)
        // The clock covers the last letter of the last word.
        val words = listOf("CRANE", "SLATE", "PIOUS", "MOTHS")
        assertEquals(WinPopupMath.tileDelayMs(3, 4) + WinPopupMath.FLIP_MS, WinPopupMath.trayDurationMs(words))
    }

    @Test fun answerTilesShrinkWithBoardsAndLength() {
        assertEquals(26f, WinPopupMath.answerTileSize(listOf("CRANE")), 0f)
        assertTrue(WinPopupMath.answerTileSize(List(4) { "CRANE" }) < 26f)
        assertTrue(WinPopupMath.answerTileSize(List(8) { "CRANE" }) < WinPopupMath.answerTileSize(List(4) { "CRANE" }))
        assertTrue(WinPopupMath.answerTileSize(listOf("CRANEFLY")) < 26f)
        assertEquals(1, WinPopupMath.answerColumns(1))
        assertEquals(2, WinPopupMath.answerColumns(4))
        assertEquals(2, WinPopupMath.answerColumns(8))
        assertEquals(3, WinPopupMath.answerColumns(16))
    }

    @Test fun continueTakesTheNearestCandyToTheGameAccent() {
        assertEquals(CandyColor.PURPLE, WinPopupMath.candyFor(0xFF7C3AED.toInt()))   // brand purple
        assertEquals(CandyColor.AMBER, WinPopupMath.candyFor(0xFFF97316.toInt()))    // Muddle orange
        assertEquals(CandyColor.AMBER, WinPopupMath.candyFor(0xFFCA8A04.toInt()))    // Starsweep gold
        assertEquals(CandyColor.TEAL, WinPopupMath.candyFor(0xFF0D9488.toInt()))     // teal
        assertEquals(CandyColor.TEAL, WinPopupMath.candyFor(0xFF4D7C0F.toInt()))     // Spyglass green
        assertEquals(CandyColor.PURPLE, WinPopupMath.candyFor(0xFF1E40AF.toInt()))   // Sudoku blue
        assertEquals(CandyColor.PINK, WinPopupMath.candyFor(0xFFEC4899.toInt()))     // pink
        assertEquals(CandyColor.PINK, WinPopupMath.candyFor(0xFF9F1239.toInt()))     // Kindred rose
        assertEquals(CandyColor.PURPLE, WinPopupMath.candyFor(0xFF6B7280.toInt()))   // slate → purple
        // Beside the pink Play again, CONTINUE is never pink too.
        assertEquals(CandyColor.PURPLE, WinPopupMath.candyFor(0xFFEC4899.toInt(), avoidPink = true))
    }

    @Test fun answersDefaultToSolvedOnAWin() {
        val a = WinAnswers(listOf("TAYLOR", "SWIFT"))
        assertTrue(a.isSolved(1, won = true))
        assertFalse(a.isSolved(0, won = false))
        val m = WinAnswers(listOf("A", "B"), listOf(true, false))
        assertTrue(m.isSolved(0, won = false))
        assertFalse(m.isSolved(1, won = true))
    }

    @Test fun theCardWashSitsOnTheWarmCream() {
        assertEquals(WinPopupMath.CREAM, WinPopupMath.cardWash(0xFF7C3AED.toInt(), 0f))
        // 10% purple over cream is darker than the cream and never white.
        val top = WinPopupMath.cardWash(0xFF7C3AED.toInt(), 0.10f)
        assertTrue(top != 0xFFFFFFFF.toInt())
        assertTrue(((top shr 16) and 0xFF) < 0xFF)
    }
}
