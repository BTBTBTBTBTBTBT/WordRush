package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Cross-platform parity guard: [HeadlineTokens] must match packages/core/src/headline-tokens.ts. */
class HeadlineTokensFixtureTest {
    private data class Tok(val kind: String, val text: String)
    private data class Case(val text: String, val names: List<String>?, val tokens: List<Tok>)
    private data class Fixtures(val cases: List<Case>)

    private val f: Fixtures by lazy {
        Gson().fromJson(
            javaClass.classLoader!!.getResource("fixtures/headline-tokens-fixtures.json")!!.readText(Charsets.UTF_8),
            Fixtures::class.java,
        )
    }

    @Test
    fun tokens_match_the_web_splitter() {
        assertTrue(f.cases.isNotEmpty())
        for (c in f.cases) {
            val got = HeadlineTokens.split(c.text, c.names ?: emptyList()).map { Tok(it.kind.key, it.text) }
            assertEquals(c.text, c.tokens, got)
        }
    }

    @Test
    fun tokens_join_back_to_the_text() {
        for (c in f.cases) {
            assertEquals(c.text, HeadlineTokens.split(c.text, c.names ?: emptyList()).joinToString("") { it.text })
        }
    }
}
