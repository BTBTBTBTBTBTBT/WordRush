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

    // ---- Batch 2 (profanity — FUCKER, BLOWJOB…), its own later cutover.
    // Store builds carrying batch 1 are already out, so batch 1 never grows.

    private fun fixture(name: String): List<String> {
        val text = javaClass.classLoader!!.getResource("fixtures/$name.json")!!.readText()
        return kotlinx.serialization.json.Json.decodeFromString<List<String>>(text).map { it.uppercase() }
    }

    @Test fun batch2TableShape() {
        assertEquals("2026-11-16", SOLUTION_SWAP_2_CUTOVER_DATE)
        assertTrue(SOLUTION_SWAP_2_CUTOVER_DATE > SOLUTION_SWAP_CUTOVER_DATE)
        assertEquals("batch 1 must not grow", 23, SOLUTION_SWAPS.size)
        assertEquals(13, SOLUTION_SWAPS_2.size)
        assertEquals(13, SOLUTION_SWAPS_2.values.toSet().size)
        assertEquals("CASHEW", SOLUTION_SWAPS_2["FUCKER"])
        assertEquals("APRICOT", SOLUTION_SWAPS_2["BLOWJOB"])
        assertEquals("CROWBAR", SOLUTION_SWAPS_2["BONDAGE"])
        val batch1Replacements = SOLUTION_SWAPS.values.toSet()
        SOLUTION_SWAPS_2.forEach { (o, n) ->
            assertEquals("$o→$n", o.length, n.length)
            assertFalse("$n is already a batch-1 replacement", batch1Replacements.contains(n))
            assertFalse("$o is in both batches", SOLUTION_SWAPS.containsKey(o))
        }
    }

    @Test fun batch2WordsLeaveCurrentPool_enterFromAllowed_notLegacy() {
        for ((len, file) in listOf(6 to "solutions-6", 7 to "solutions-7")) {
            val pool = fixture(file).toSet()
            val legacy = fixture("$file-legacy").toSet()
            val allowed = fixture("allowed-$len").toSet()
            SOLUTION_SWAPS_2.filterKeys { it.length == len }.forEach { (o, n) ->
                assertTrue(o, pool.contains(o))
                assertFalse("$n must not already be an answer", pool.contains(n))
                assertFalse("$n must not be a legacy answer", legacy.contains(n))
                assertTrue("$n must be guessable", allowed.contains(n))
            }
        }
        assertTrue(SOLUTION_SWAPS_2.keys.all { it.length == 6 || it.length == 7 })
    }

    @Test fun onlyBatch1BetweenCutovers_bothFromSecondCutover() {
        val bothOld = SOLUTION_SWAPS.keys + SOLUTION_SWAPS_2.keys
        for (len in listOf(5, 6, 7)) {
            val raw = if (len == 5) GameDictionary.solutionPool("2026-10-04") else GameDictionary.solutionPoolForLength(len, "2026-10-04")
            val between = if (len == 5) GameDictionary.solutionPool("2026-11-15") else GameDictionary.solutionPoolForLength(len, "2026-11-15")
            val after = if (len == 5) GameDictionary.solutionPool("2026-11-16") else GameDictionary.solutionPoolForLength(len, "2026-11-16")
            assertEquals(applySolutionSwaps(raw), between)
            // Batch 3 shares this date while SOLUTION_SWAP_3_CUTOVER_DATE == SOLUTION_SWAP_2_CUTOVER_DATE.
            val sameDay3 = SOLUTION_SWAP_3_CUTOVER_DATE == SOLUTION_SWAP_2_CUTOVER_DATE
            assertEquals(applySolutionSwapBatches(raw, if (sameDay3) 3 else 2), after)
            assertEquals(raw.size, after.size)
            bothOld.forEach { assertFalse(it, after.contains(it)) }
            val moved = raw.indices.filter { raw[it] != after[it] }.map { raw[it] }.sorted()
            val expected = (bothOld + if (sameDay3) SOLUTION_SWAPS_3.keys else emptySet()).filter { it.length == len && raw.contains(it) }
            assertEquals(expected.sorted(), moved)
        }
        assertTrue(GameDictionary.solutionPoolForLength(6, "2026-11-15").contains("FUCKER"))
        assertTrue(GameDictionary.solutionPoolForLength(6, "2026-11-16").contains("CASHEW"))
    }

    @Test fun batch2UndatedSeedsGateOnWallClock() {
        GameDictionary.todayOverrideForTests = "2026-11-15"
        assertTrue(GameDictionary.solutionPoolForLength(6, null).contains("FUCKER"))
        GameDictionary.todayOverrideForTests = "2026-11-16"
        assertFalse(GameDictionary.solutionPoolForLength(6, null).contains("FUCKER"))
        assertTrue(GameDictionary.solutionPoolForLength(6, null).contains("CASHEW"))
        assertTrue(GameDictionary.solutionPoolForLength(7, null).contains("APRICOT"))
    }

    @Test fun batch2SwappedOutWordsStayValidGuesses() {
        SOLUTION_SWAPS_2.keys.forEach { assertTrue(it, GameDictionary.isValidWord(it)) }
    }

    @Test fun batch2PinnedDeals() {
        // Between the cutovers the original still deals; from the second cutover the replacement takes the slot.
        assertEquals(listOf("PRESSED", "DENOTED", "PALETTE", "FAILING", "LUNATIC", "BREEDER", "WAITING", "VAGINAL"),
            generateSolutionsFromSeedForLength("daily-2026-10-28-DUEL_7", 8, 7))
        assertEquals(listOf("JAGGED", "OPENER", "FESTER", "QUARTZ", "MARVEL", "SALUTE", "FONDUE", "ONWARD"),
            generateSolutionsFromSeedForLength("daily-2026-11-27-DUEL_6", 8, 6))
        assertEquals(listOf("CROWBAR"), generateSolutionsFromSeedForLength("daily-2027-02-23-DUEL_7", 1, 7))
    }

    // ---- Batch 3 (British answers — COLOUR, THEATRE, YOGHURT, BLOKE…, plus batch 2's CRUMPET),
    // applied AFTER batch 2, its own cutover constant. Batches 1 and 2 never grow.

    @Test fun batch3TableShapeAndGate() {
        assertEquals("2026-11-16", SOLUTION_SWAP_3_CUTOVER_DATE)
        assertTrue(SOLUTION_SWAP_3_CUTOVER_DATE >= SOLUTION_SWAP_2_CUTOVER_DATE)
        assertEquals(23, SOLUTION_SWAPS.size)
        assertEquals(13, SOLUTION_SWAPS_2.size)
        assertEquals(46, SOLUTION_SWAPS_3.size)
        assertEquals(46, SOLUTION_SWAPS_3.values.toSet().size)
        assertEquals("SORBET", SOLUTION_SWAPS_3["COLOUR"])
        assertEquals("WALLABY", SOLUTION_SWAPS_3["CRUMPET"])
        assertEquals(0, solutionSwapBatchesFor("2026-10-04"))
        assertEquals(1, solutionSwapBatchesFor("2026-11-15"))
        assertEquals(3, solutionSwapBatchesFor("2026-11-16"))
        val earlier = SOLUTION_SWAPS.values.toSet() + SOLUTION_SWAPS_2.values.toSet()
        SOLUTION_SWAPS_3.forEach { (o, n) ->
            assertEquals("$o→$n", o.length, n.length)
            assertFalse("$n is already a batch-1/2 replacement", earlier.contains(n))
            assertFalse("$o is in an earlier batch", SOLUTION_SWAPS.containsKey(o) || SOLUTION_SWAPS_2.containsKey(o))
        }
    }

    @Test fun batch3WordsLeaveDealtPool_enterFromAllowed() {
        for ((len, file) in listOf(5 to "solutions", 6 to "solutions-6", 7 to "solutions-7")) {
            val dealt = applySolutionSwapBatches(fixture(file), 2).toSet()
            val allowed = fixture(if (len == 5) "allowed" else "allowed-$len").toSet()
            SOLUTION_SWAPS_3.filterKeys { it.length == len }.forEach { (o, n) ->
                assertTrue(o, dealt.contains(o))
                assertFalse("$n must not already be an answer", dealt.contains(n))
                assertTrue("$n must be guessable", allowed.contains(n))
            }
        }
    }

    @Test fun batch3InPlaceFromItsCutover() {
        val allOld = SOLUTION_SWAPS.keys + SOLUTION_SWAPS_2.keys + SOLUTION_SWAPS_3.keys
        for (len in listOf(5, 6, 7)) {
            val raw = if (len == 5) GameDictionary.solutionPool("2026-10-04") else GameDictionary.solutionPoolForLength(len, "2026-10-04")
            val after = if (len == 5) GameDictionary.solutionPool(SOLUTION_SWAP_3_CUTOVER_DATE) else GameDictionary.solutionPoolForLength(len, SOLUTION_SWAP_3_CUTOVER_DATE)
            assertEquals(applyAllSolutionSwaps(raw), after)
            allOld.forEach { assertFalse(it, after.contains(it)) }
        }
        assertTrue(GameDictionary.solutionPoolForLength(6, "2026-11-15").contains("COLOUR"))
        GameDictionary.todayOverrideForTests = "2026-11-15"
        assertTrue(GameDictionary.solutionPool(null).contains("BLOKE"))
        GameDictionary.todayOverrideForTests = "2026-11-16"
        assertFalse(GameDictionary.solutionPool(null).contains("BLOKE"))
        assertTrue(GameDictionary.solutionPool(null).contains("LLAMA"))
        assertTrue(GameDictionary.solutionPoolForLength(7, null).contains("WALLABY"))
        assertFalse(GameDictionary.solutionPoolForLength(7, null).contains("CRUMPET"))
        SOLUTION_SWAPS_3.keys.forEach { assertTrue(it, GameDictionary.isValidWord(it)) }
    }

    @Test fun batch3PinnedDeals() {
        assertEquals(listOf("ADORE", "LITRE", "RIDGE", "CUMIN", "ETHIC", "VALID", "THICK", "STORY"),
            generateSolutionsFromSeed("daily-2026-10-15-DUEL", 8))
        assertEquals(listOf("OVARIAN", "DEFLECT", "IGNORED", "ALGEBRA", "MARACAS", "CLIPPER", "LAUGHED", "EMPATHY"),
            generateSolutionsFromSeedForLength("daily-2026-11-16-DUEL_7", 8, 7))
        assertEquals(listOf("FILMED", "SMILED", "WIGGLE", "OPENLY", "SITTER", "SORBET", "SPRITE", "SUNSET"),
            generateSolutionsFromSeedForLength("daily-2027-01-22-DUEL_6", 8, 6))
    }
}
