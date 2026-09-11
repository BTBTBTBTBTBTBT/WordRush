package com.wordocious.app.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Sense-ranker parity guard (Android side). Asserts the same JSON that web
 * (lib/sense-rank.test.ts) and iOS (SenseRankFixtureTests.swift) assert, so a
 * rule change that isn't regenerated + ported fails on every platform.
 * Regenerate: node apps/web/scripts/gen-sense-rank-fixtures.mjs
 */
class SenseRankFixtureTest {
    @Serializable private data class Sense(val pos: String, val def: String)
    @Serializable private data class Case(val word: String, val senses: List<Sense>, val expectedFirst: String, val scores: List<Int>)
    @Serializable private data class Fixtures(val cases: List<Case>)

    private fun load(): Fixtures {
        val text = javaClass.classLoader!!.getResource("fixtures/sense-rank-fixtures.json")!!.readText()
        return Json { ignoreUnknownKeys = true }.decodeFromString(text)
    }

    @Test
    fun firstSense_and_scores_match_shared_fixtures() {
        val f = load()
        assertTrue(f.cases.size > 100)
        for (c in f.cases) {
            assertEquals(c.word, c.expectedFirst, SenseRank.rank(c.word, c.senses) { it.def }.first().def)
            assertEquals("${c.word} scores", c.scores, c.senses.map { SenseRank.score(c.word, it.def) })
        }
    }

    @Test
    fun decided_semantics() {
        assertTrue(SenseRank.isCircular("nasty", "Something nasty."))
        assertFalse(SenseRank.isCircular("blade", "The sharp cutting edge of a knife, chisel, or other tool, a razor blade/sword blade."))
        assertFalse(SenseRank.isCircular("bible", "An exemplar of the Bible."))
        assertTrue(SenseRank.isStub("Alternative spelling of braze."))
        assertFalse(SenseRank.isStub("plural of calf"))
        assertTrue(SenseRank.isDerived("dizzy", "To make dizzy, to bewilder."))
        assertTrue(Plausibility.isPlausibleDailyResult(true, 1, 3, 1))
        assertFalse(Plausibility.isPlausibleDailyResult(true, 6, 3, 1))
        assertFalse(Plausibility.isPlausibleDailyResult(true, 0, 30, 1))
    }
}
