package com.wordocious.core

import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue

/** Item 35: parity with packages/core/src/game-order.test.ts. */
class GameOrderTest {
    private val d = GameOrder.DEFAULT_DAILIES

    @Test fun founderDefault() {
        assertEquals(listOf("practice", "quordle", "octordle", "sequence", "six", "seven", "rescue", "gauntlet"), d)
        assertEquals("scramble", GameOrder.DEFAULT_PUZZLES.last())
    }

    @Test fun noSavedOrderIsDefault() {
        assertEquals(d, GameOrder.apply(d, null, "practice"))
        assertEquals(d, GameOrder.apply(d, emptyList(), "practice"))
    }

    @Test fun classicStaysFirst() {
        val out = GameOrder.apply(d, listOf("gauntlet", "practice", "six"), "practice")
        assertEquals(listOf("practice", "gauntlet", "six"), out.take(3))
    }

    @Test fun unknownDroppedDuplicatesCollapsedNewAppended() {
        val out = GameOrder.apply(d, listOf("seven", "ghost", "seven", "six"), "practice")
        assertEquals(listOf("practice", "seven", "six", "quordle", "octordle", "sequence", "rescue", "gauntlet"), out)
    }

    @Test fun puzzlesHaveNoPin() {
        assertEquals("scramble", GameOrder.apply(GameOrder.DEFAULT_PUZZLES, listOf("scramble"), null).first())
    }

    @Test fun moveCannotMoveOrDisplacePinned() {
        assertEquals(d, GameOrder.move(d, 0, 3, "practice"))
        assertEquals("practice", GameOrder.move(d, 3, 0, "practice").first())
        assertEquals(
            listOf("practice", "gauntlet", "quordle", "octordle", "sequence", "six", "seven", "rescue"),
            GameOrder.move(d, 7, 1, "practice"),
        )
        assertEquals(d, GameOrder.move(d, 2, 2, "practice"))
        assertEquals(d, GameOrder.move(d, 2, 99, "practice"))
    }

    @Test fun isDefault() {
        assertTrue(GameOrder.isDefault(d, d, "practice"))
        assertFalse(GameOrder.isDefault(d, listOf("practice", "six"), "practice"))
        assertTrue(GameOrder.isDefault(d, null, "practice"))
    }

    @Test fun sortByKeepsUnknownAtEnd() {
        assertEquals(listOf("a", "b", "x", "y"), GameOrder.sortBy(listOf("x", "b", "y", "a"), listOf("a", "b")) { it })
    }

    @Test fun nextUnplayedWalksYourOrder() {
        val order = listOf("practice", "six", "seven", "quordle")
        assertEquals("six", GameOrder.nextUnplayed(order, "practice", setOf("practice")))
        assertEquals("quordle", GameOrder.nextUnplayed(order, "six", setOf("practice", "six", "seven")))
        assertEquals("practice", GameOrder.nextUnplayed(order, "quordle", setOf("quordle", "six")))
        assertNull(GameOrder.nextUnplayed(order, "quordle", order.toSet()))
        assertEquals("practice", GameOrder.nextUnplayed(order, "unknown", emptySet()))
    }

    @Test fun parse() {
        assertNull(GameOrder.parse(null, null))
        assertEquals(GameOrderPrefs(listOf("six"), emptyList()), GameOrder.parse(listOf("six"), emptyList()))
    }
}
