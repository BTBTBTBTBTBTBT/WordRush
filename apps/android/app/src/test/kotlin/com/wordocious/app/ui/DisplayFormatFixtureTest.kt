package com.wordocious.app.ui

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Display-format parity guard (Android side). Asserts the same JSON that web
 * (display-format.test.ts) and iOS (DisplayFormatFixtureTests.swift) assert,
 * so a formatter change that isn't regenerated + ported fails on every
 * platform. Regenerate: node apps/web/scripts/gen-display-format-fixtures.mjs
 */
class DisplayFormatFixtureTest {

    @Serializable
    private data class ScoreCase(val score: Double, val expected: String)

    @Serializable
    private data class TimeCase(val seconds: Int, val expected: String)

    @Serializable
    private data class PercentileCase(
        val rank: Int, val totalPlayers: Int,
        val expectedLabel: String, val expectedGold: Boolean,
    )

    @Serializable
    private data class Fixtures(
        val formatScore: List<ScoreCase>,
        val formatShortTime: List<TimeCase>,
        val topPercentLabel: List<PercentileCase>,
    )

    private fun load(): Fixtures {
        val text = javaClass.classLoader!!
            .getResource("fixtures/display-format-fixtures.json")!!.readText()
        return Json { ignoreUnknownKeys = true }.decodeFromString(text)
    }

    @Test
    fun formatScore_matches_shared_fixtures() {
        val cases = load().formatScore
        assertTrue(cases.isNotEmpty())
        for (c in cases) assertEquals("formatScore(${c.score})", c.expected, formatScore(c.score))
    }

    @Test
    fun formatShortTime_matches_shared_fixtures() {
        val cases = load().formatShortTime
        assertTrue(cases.isNotEmpty())
        for (c in cases) assertEquals("formatShortTime(${c.seconds})", c.expected, formatShortTime(c.seconds))
    }

    @Test
    fun topPercentLabel_matches_shared_fixtures_round_semantics() {
        val cases = load().topPercentLabel
        assertTrue(cases.isNotEmpty())
        for (c in cases) {
            val got = topPercentLabel(c.rank, c.totalPlayers)
            assertEquals("topPercentLabel(${c.rank}, ${c.totalPlayers})", c.expectedLabel, got.label)
            assertEquals("gold(${c.rank}, ${c.totalPlayers})", c.expectedGold, got.gold)
        }
    }
}
