package com.wordocious.app.ui.game

import com.wordocious.core.BoardState
import com.wordocious.core.GameStatus
import com.wordocious.core.PrefilledGuess
import com.wordocious.core.evaluateGuess
import org.junit.Assert.assertEquals
import org.junit.Test

/** FINISH_SPEC AT2: every multi-board recap board shares one tile size and one height. */
class RecapGeometryTest {
    private fun prefill(sol: String, word: String) = PrefilledGuess(word, evaluateGuess(sol, word))

    @Test fun deliveranceLossBoardsShareTheLargestBoardsHeight() {
        // A solved board with 2 prefills, a lost board with 3 prefills (Deliverance-style).
        val solved = BoardState("CRANE", listOf("SLATE", "CRANE"), 6, GameStatus.WON, prefilledGuesses = listOf(prefill("CRANE", "MOUSE"), prefill("CRANE", "PLANT")))
        val lost = BoardState("GHOST", List(6) { "SLATE" }, 6, GameStatus.LOST, prefilledGuesses = listOf(prefill("GHOST", "MOUSE"), prefill("GHOST", "PLANT"), prefill("GHOST", "TIGER")))
        val boards = listOf(solved, lost)
        assertEquals(9, RecapGeometry.sharedRows(boards))
        assertEquals(5, RecapGeometry.sharedCols(boards))
        assertEquals(1, RecapGeometry.padRows(solved, boards))
        assertEquals(0, RecapGeometry.padRows(lost, boards))
        // Same width and aspect → the same tile size and height for both boards.
        for (b in boards) assertEquals(9, RecapGeometry.rowsOf(b) + RecapGeometry.padRows(b, boards))
        assertEquals(5f / 9f, RecapGeometry.aspect(boards), 1e-6f)
    }

    @Test fun playedRowsBeyondTheBudgetCountAndWinsMatchLosses() {
        val quad = listOf(
            BoardState("CRANE", listOf("CRANE"), 9, GameStatus.WON),
            BoardState("GHOST", List(9) { "SLATE" }, 9, GameStatus.LOST),
            BoardState("PLANT", List(10) { "SLATE" }, 9, GameStatus.LOST),
        )
        assertEquals(10, RecapGeometry.sharedRows(quad))
        // A board solved in one guess still draws its full row budget, padded to the shared height.
        assertEquals(1, RecapGeometry.padRows(quad[0], quad))
        assertEquals(0, RecapGeometry.padRows(quad[2], quad))
        assertEquals(1, RecapGeometry.padRows(quad[1], quad))
        assertEquals(1, RecapGeometry.sharedRows(emptyList()))
    }
}
