package com.wordocious.core

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Validates the Kotlin engine against the SAME JSON fixtures the Swift port
 * passes (`apps/ios/Tests/Fixtures`, copied into `src/test/resources/fixtures`).
 * Green here == Kotlin engine is byte-identical to TS and Swift.
 */
class SeedFixtureTest {

    @Before fun setup() = DictionaryLoader.ensureLoaded()

    private fun loadFixture(name: String): String =
        javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    private data class HashCase(val input: String, val output: Long)

    @Test
    fun simpleHash_matches_shared_fixtures() {
        val type = object : TypeToken<List<HashCase>>() {}.type
        val cases: List<HashCase> = Gson().fromJson(loadFixture("hash-fixtures.json"), type)
        assertTrue("expected hash fixtures to load", cases.isNotEmpty())
        for (c in cases) {
            assertEquals("simpleHash(\"${c.input}\")", c.output, simpleHash(c.input).toLong())
        }
    }

    private data class SeedCase(val seed: String, val count: Int, val solutions: List<String>)
    private data class SeedFixtures(
        val standard: List<SeedCase>,
        val sixLetter: List<SeedCase>,
        val sevenLetter: List<SeedCase>,
    )

    @Test
    fun generateSolutionsFromSeed_matches_fixtures() {
        val f = Gson().fromJson(loadFixture("seed-fixtures.json"), SeedFixtures::class.java)
        for (c in f.standard) {
            assertEquals("standard ${c.seed}/${c.count}", c.solutions, generateSolutionsFromSeed(c.seed, c.count))
        }
        for (c in f.sixLetter) {
            assertEquals("six ${c.seed}/${c.count}", c.solutions, generateSolutionsFromSeedForLength(c.seed, c.count, 6))
        }
        for (c in f.sevenLetter) {
            assertEquals("seven ${c.seed}/${c.count}", c.solutions, generateSolutionsFromSeedForLength(c.seed, c.count, 7))
        }
    }

    private data class DailyGen(val date: String, val mode: String, val expected: String)
    private data class DailyIsDaily(val seed: String, val expected: Boolean)
    private data class DailyFixtures(val generate: List<DailyGen>, val isDaily: List<DailyIsDaily>)

    @Test
    fun dailySeed_matches_fixtures() {
        val f = Gson().fromJson(loadFixture("daily-seed-fixtures.json"), DailyFixtures::class.java)
        for (g in f.generate) assertEquals(g.expected, generateDailySeed(g.date, g.mode))
        for (i in f.isDaily) assertEquals("isDaily ${i.seed}", i.expected, isDailySeed(i.seed))
    }
}
