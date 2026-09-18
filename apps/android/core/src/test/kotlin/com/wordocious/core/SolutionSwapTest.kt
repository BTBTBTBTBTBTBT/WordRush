package com.wordocious.core

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * §265: proper-noun-reading answers are swapped IN PLACE from a dated cutover.
 * Mirrors packages/core/src/solution-swaps.test.ts and iOS SolutionSwapTests.
 */
class SolutionSwapTest {
    @Before fun setup() {
        DictionaryLoader.ensureLoaded()
        GameDictionary.todayOverrideForTests = "2026-09-01"
    }
    @After fun tearDown() { GameDictionary.todayOverrideForTests = "2026-09-01" }

    @Test fun tableShape() {
        assertEquals("2026-10-05", SOLUTION_SWAP_CUTOVER_DATE)
        assertEquals(23, SOLUTION_SWAPS.size)
        assertEquals(23, SOLUTION_SWAPS.values.toSet().size)
        assertEquals("ALOOF", SOLUTION_SWAPS["JAPAN"])
        assertEquals("DUVET", SOLUTION_SWAPS["ASPEN"])
        assertEquals("ENTWINE", SOLUTION_SWAPS["MOROCCO"])
        SOLUTION_SWAPS.forEach { (o, n) -> assertEquals("$o→$n", o.length, n.length) }
    }

    @Test fun poolsUntouchedBeforeCutover_swappedInPlaceAfter() {
        for (len in listOf(5, 6, 7)) {
            val before = if (len == 5) GameDictionary.solutionPool("2026-10-04") else GameDictionary.solutionPoolForLength(len, "2026-10-04")
            val after = if (len == 5) GameDictionary.solutionPool("2026-10-05") else GameDictionary.solutionPoolForLength(len, "2026-10-05")
            assertEquals(applySolutionSwaps(before), after)
            assertEquals(before.size, after.size)
            val moved = before.indices.filter { before[it] != after[it] }.map { before[it] }.sorted()
            assertEquals(SOLUTION_SWAPS.keys.filter { it.length == len }.sorted(), moved)
            SOLUTION_SWAPS.keys.forEach { assertFalse(it, after.contains(it)) }
        }
    }

    @Test fun undatedSeedsGateOnWallClock() {
        GameDictionary.todayOverrideForTests = "2026-10-04"
        assertTrue(GameDictionary.solutionPool(null).contains("JAPAN"))
        GameDictionary.todayOverrideForTests = "2026-10-05"
        assertFalse(GameDictionary.solutionPool(null).contains("JAPAN"))
        assertTrue(GameDictionary.solutionPool(null).contains("ALOOF"))
    }

    @Test fun pinnedPostCutoverDeals() {
        assertEquals(listOf("SLUSH", "WHOSE", "RULER", "HORSE"), generateSolutionsFromSeed("daily-2026-10-07-SEQUENCE", 4))
        assertEquals(listOf("VOWEL", "DUVET", "TENTH"), generateSolutionsFromSeed("daily-2026-10-06-GAUNTLET", 21).take(3))
    }
}
