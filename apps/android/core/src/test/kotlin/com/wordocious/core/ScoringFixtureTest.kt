package com.wordocious.core

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ScoringFixtureTest {

    private fun loadFixture(name: String): String =
        javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    // `input` carries an extra `playerWon` field that calculateScore doesn't use;
    // Gson ignores unknown JSON fields, so MatchResult parses cleanly.
    private data class ScoreCase(val input: MatchResult, val output: ScoreBreakdown)

    @Test
    fun calculateScore_matches_shared_fixtures() {
        val type = object : TypeToken<List<ScoreCase>>() {}.type
        val cases: List<ScoreCase> = Gson().fromJson(loadFixture("scoring-fixtures.json"), type)
        assertTrue("expected scoring fixtures to load", cases.isNotEmpty())
        for (c in cases) {
            assertEquals("calculateScore $c", c.output, calculateScore(c.input))
        }
    }
}
