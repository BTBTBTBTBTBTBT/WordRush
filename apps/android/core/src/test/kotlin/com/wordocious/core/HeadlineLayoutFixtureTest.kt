package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

/** FINISH_SPEC BJ6 parity guard: the greeting's widths, sizes and line layouts match packages/core. */
class HeadlineLayoutFixtureTest {
    private val root: JsonObject by lazy {
        Json.parseToJsonElement(
            javaClass.classLoader!!.getResource("fixtures/headline-tokens-fixtures.json")!!.readText(Charsets.UTF_8),
        ).jsonObject
    }

    @Test
    fun sizing_line_matches() {
        assertEquals(root["sizingLine"]!!.jsonPrimitive.content, HEADLINE_SIZING_LINE)
    }

    @Test
    fun widths_match() {
        for (r in root["widths"]!!.jsonArray.map { it.jsonObject }) {
            val text = r["text"]!!.jsonPrimitive.content
            assertEquals(text, r["em"]!!.jsonPrimitive.double, headlineWidthEm(text), 1e-9)
        }
    }

    @Test
    fun sizes_match() {
        for (r in root["sizes"]!!.jsonArray.map { it.jsonObject }) {
            val w = r["width"]!!.jsonPrimitive.double
            assertEquals("width $w", r["size"]!!.jsonPrimitive.int, headlineFontSize(w))
        }
    }

    @Test
    fun layouts_match() {
        for (r in root["layouts"]!!.jsonArray.map { it.jsonObject }) {
            val text = r["text"]!!.jsonPrimitive.content
            val name = r["name"]!!.jsonPrimitive.content
            val maxEm = r["maxEm"]!!.jsonPrimitive.double
            val l = r["layout"]!!.jsonObject
            val got = headlineLayout(text, name, maxEm)
            assertEquals("$text @ $maxEm lines", l["lines"]!!.jsonArray.map { it.jsonPrimitive.content }, got.lines)
            assertEquals("$text @ $maxEm nameLines", l["nameLines"]!!.jsonArray.map { it.jsonPrimitive.int }, got.nameLines)
        }
    }
}
