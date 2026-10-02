package com.wordocious.app.ui

import com.wordocious.app.ModeGen
import org.junit.Assert.assertEquals
import org.junit.Test

/** FINISH_SPEC C2: the result card's "how you solved it" line. */
class LeaderboardSolvedLineTest {
    @Test
    fun classicWinReadsSolvedInGuesses() {
        assertEquals("Solved in 4 guesses · 48s", solvedLine("DUEL", completed = true, guessCount = 4, timeSeconds = 48))
        assertEquals("Solved in 1 guess · 1m 5s", solvedLine("DUEL", completed = true, guessCount = 1, timeSeconds = 65))
    }

    @Test
    fun missedBoardReadsNotSolved() {
        assertEquals("Not solved · 6 guesses · 2m 10s", solvedLine("DUEL", completed = false, guessCount = 6, timeSeconds = 130))
    }

    @Test
    fun multiBoardMissCountsBoards() {
        assertEquals(
            "3/4 boards · 9 guesses · 3m",
            solvedLine("QUORDLE", completed = false, guessCount = 9, timeSeconds = 180, boardsSolved = 3, totalBoards = 4),
        )
    }

    @Test
    fun guessSemanticsReadThroughTheMode() {
        // Sudocious counts mistakes (guess_count 1 = a clean solve).
        assertEquals("Solved · 0 mistakes · 5m", solvedLine("SUDOKU", completed = true, guessCount = 1, timeSeconds = 300))
    }

    @Test
    fun sweepLine() {
        val day = "2026-10-02"
        val n = ModeGen.requiredSweepCount(day)
        assertEquals("Flawless sweep · 12m 4s", sweepSolvedLine(true, n, 724, day))
        assertEquals("Won 6 of $n · 12m 4s", sweepSolvedLine(false, 6, 724, day))
    }
}
