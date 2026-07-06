package com.wordocious.app.data

import com.wordocious.core.DictionaryLoader
import com.wordocious.core.GameDictionary
import com.wordocious.core.GameMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * BOT-DEDUPE guard: the bot must never submit the same word twice in a match,
 * and Six/Seven fillers must be REAL words from the length-keyed dictionaries
 * (the 5-letter master list has only ~2 seven-letter strays, which made the
 * bot spam one word — HACKERS x4 in a Seven match).
 */
class BotEngineDedupeTest {

    private fun assertPlanClean(mode: GameMode, seed: String, opts: BotEngine.BuildOpts) {
        val plan = BotEngine.buildPlan(seed, mode, BotDifficulty.EASY, opts)
        val words = plan.guessLog.map { it.guess.uppercase() }
        assertEquals("repeated word in $mode plan ($seed): $words", words.size, words.toSet().size)
        // Every non-solving guess must be a real dictionary word of the right length.
        val solutions = plan.solutions.toSet()
        for (w in words) {
            if (w in solutions) continue
            assertTrue("$mode filler '$w' is not a valid dictionary word", GameDictionary.isValidWord(w))
        }
    }

    @Test
    fun sevenAndSix_fullBudget_noRepeats_realWords() {
        DictionaryLoader.ensureLoaded()
        repeat(20) { i ->
            // Full 8-guess Seven plan (7 fillers + solve) — the HACKERS x4 repro shape.
            assertPlanClean(GameMode.DUEL_7, "seven-dedupe-$i", BotEngine.BuildOpts(targetGuesses = 8, forceSolve = true))
            // Failed Seven run burns the whole 8-guess budget with fillers.
            assertPlanClean(GameMode.DUEL_7, "seven-fail-$i", BotEngine.BuildOpts(targetGuesses = 8))
            assertPlanClean(GameMode.DUEL_6, "six-dedupe-$i", BotEngine.BuildOpts(targetGuesses = 7, forceSolve = true))
        }
    }

    @Test
    fun classicQuadSequence_noRepeats() {
        DictionaryLoader.ensureLoaded()
        repeat(20) { i ->
            assertPlanClean(GameMode.DUEL, "classic-dedupe-$i", BotEngine.BuildOpts(targetGuesses = 6, forceSolve = true))
            assertPlanClean(GameMode.QUORDLE, "quad-dedupe-$i", BotEngine.BuildOpts(forceSolve = true))
            assertPlanClean(GameMode.SEQUENCE, "seq-dedupe-$i", BotEngine.BuildOpts(forceSolve = true))
        }
    }
}
