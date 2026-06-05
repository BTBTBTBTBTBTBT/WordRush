package com.wordocious.core

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EvaluatorFixtureTest {

    private fun loadFixture(name: String): String =
        javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    private data class EvalCase(val solution: String, val guess: String, val result: GuessResult)

    @Test
    fun evaluateGuess_matches_shared_fixtures() {
        val type = object : TypeToken<List<EvalCase>>() {}.type
        val cases: List<EvalCase> = Gson().fromJson(loadFixture("evaluator-fixtures.json"), type)
        assertTrue("expected evaluator fixtures to load", cases.isNotEmpty())
        for (c in cases) {
            assertEquals("evaluateGuess(${c.solution}, ${c.guess})", c.result, evaluateGuess(c.solution, c.guess))
        }
    }
}
