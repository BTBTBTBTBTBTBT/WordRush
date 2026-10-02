package com.wordocious.app.ui.game

import com.wordocious.core.BoardState
import com.wordocious.core.GameStatus
import com.wordocious.core.TileState
import org.junit.Assert.assertEquals
import org.junit.Test

/** FINISH_SPEC AQ1: keyboard keys take their colors tile by tile as the row lands. */
class KeyRevealTest {
    private val C = TileState.CORRECT
    private val P = TileState.PRESENT
    private val A = TileState.ABSENT

    private fun row(vararg t: Pair<String, TileState>) = t.toList()

    @Test fun nothingLandedShowsTheSettledKeys() {
        val base = mapOf("Q" to A)
        val target = mapOf("Q" to A, "C" to C, "R" to P)
        assertEquals(base, KeyReveal.during(base, target, listOf(row("C" to C, "R" to P)), 0))
    }

    @Test fun eachLandedTileColorsItsKeyAndOnlyThat() {
        val base = emptyMap<String, TileState>()
        val r = row("C" to C, "R" to P, "A" to A, "N" to A, "E" to C)
        val target = mapOf("C" to C, "R" to P, "A" to A, "N" to A, "E" to C)
        assertEquals(mapOf("C" to C), KeyReveal.during(base, target, listOf(r), 1))
        assertEquals(mapOf("C" to C, "R" to P, "A" to A), KeyReveal.during(base, target, listOf(r), 3))
        assertEquals(target, KeyReveal.during(base, target, listOf(r), 5))
    }

    @Test fun aKeyNeverDowngradesMidReveal() {
        // E was already CORRECT; this row's first E is only PRESENT.
        val base = mapOf("E" to C)
        val r = row("E" to P, "E" to A, "R" to A)
        assertEquals(mapOf("E" to C), KeyReveal.during(base, mapOf("E" to C, "R" to A), listOf(r), 2))
    }

    @Test fun aDuplicateLetterUpgradesWhenItsBetterTileLands() {
        val r = row("E" to P, "E" to C, "R" to A)
        assertEquals(mapOf("E" to P), KeyReveal.during(emptyMap(), mapOf("E" to C, "R" to A), listOf(r), 1))
        assertEquals(mapOf("E" to C), KeyReveal.during(emptyMap(), mapOf("E" to C, "R" to A), listOf(r), 2))
    }

    @Test fun multiBoardTilesLandTogetherBestStateWins() {
        val b1 = row("C" to A, "R" to A)
        val b2 = row("C" to C, "R" to P)
        assertEquals(mapOf("C" to C), KeyReveal.during(emptyMap(), mapOf("C" to C, "R" to P), listOf(b1, b2), 1))
    }

    @Test fun newestRowsAreTheLatestGuessOnEveryBoardItHit() {
        val boards = listOf(
            BoardState("CRANE", listOf("SLATE"), 9, GameStatus.PLAYING),
            BoardState("SLATE", listOf("SLATE"), 9, GameStatus.WON),
        )
        val rows = KeyReveal.newestRows(boards, sequential = false)
        assertEquals(2, rows.size)
        assertEquals(listOf("S", "L", "A", "T", "E"), rows[0].map { it.first })
        assertEquals(listOf(C, C, C, C, C), rows[1].map { it.second })
        assertEquals(1, KeyReveal.newestRows(boards, sequential = true).size)
        assertEquals(0, KeyReveal.newestRows(listOf(BoardState("CRANE", emptyList(), 6, GameStatus.PLAYING)), false).size)
    }
}
