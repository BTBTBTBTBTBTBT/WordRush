package com.wordocious.app.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-platform parity guard: asserts Android's [DailyScoring.compositeScore]
 * produces byte-identical totals to the shared fixtures generated from the web
 * source of truth (apps/web/scripts/gen-composite-scoring-fixtures.mjs). The iOS
 * suite (WordociousScoringTests) and the web check script validate the same JSON.
 */
class CompositeScoringFixtureTest {

    @Serializable
    private data class FixtureInput(
        val gameMode: String,
        val completed: Boolean,
        val guessCount: Int,
        val timeSeconds: Int,
        val boardsSolved: Int,
        val totalBoards: Int,
        val hintsUsed: Int,
        val stagesCompleted: Int? = null,
        val bestCorrectLetters: Int? = null,
        val dateKey: String? = null,
    )

    @Serializable
    private data class Fixture(val name: String, val input: FixtureInput, val expectedTotal: Double)

    @Test
    fun compositeScore_matches_shared_fixtures() {
        val text = javaClass.classLoader!!
            .getResource("fixtures/composite-scoring-fixtures.json")!!.readText()
        val cases = Json { ignoreUnknownKeys = true }.decodeFromString<List<Fixture>>(text)
        assertTrue("expected composite-scoring fixtures to load", cases.isNotEmpty())
        for (c in cases) {
            val got = DailyScoring.compositeScore(
                c.input.gameMode, c.input.completed, c.input.guessCount, c.input.timeSeconds,
                c.input.boardsSolved, c.input.totalBoards, c.input.hintsUsed,
                c.input.stagesCompleted, c.input.bestCorrectLetters, c.input.dateKey,
            )
            assertEquals(c.name, c.expectedTotal, got, 0.001)
        }
    }
}
