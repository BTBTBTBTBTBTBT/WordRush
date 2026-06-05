package com.wordocious.core

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class PrefillFixtureTest {

    @Before fun setup() = DictionaryLoader.ensureLoaded()

    private fun loadFixture(name: String): String =
        javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    private data class BoardPrefill(val solution: String, val prefillGuesses: List<PrefilledGuess>)
    private data class PrefillCase(
        val seed: String,
        val solutions: List<String>,
        val prefillWords: List<String>,
        val boardPrefills: List<BoardPrefill>,
    )

    @Test
    fun prefill_matches_shared_fixtures() {
        val type = object : TypeToken<List<PrefillCase>>() {}.type
        val cases: List<PrefillCase> = Gson().fromJson(loadFixture("prefill-fixtures.json"), type)
        assertTrue("expected prefill fixtures to load", cases.isNotEmpty())
        val allowed = GameDictionary.getAllowedWords()
        for (c in cases) {
            assertEquals("prefillWords ${c.seed}", c.prefillWords, generatePrefillWords(c.seed, c.solutions, allowed))
            for (bp in c.boardPrefills) {
                assertEquals("prefillGuesses ${bp.solution}", bp.prefillGuesses, generatePrefillGuesses(c.prefillWords, bp.solution))
            }
        }
    }
}
