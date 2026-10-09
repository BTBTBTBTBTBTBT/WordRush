package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** 2.8 item 6 parity + no-clip guard: the bubble-text fit matches packages/core and never clips or truncates. */
class BubbleTextFixtureTest {
    private val root: JsonObject by lazy {
        Json.parseToJsonElement(
            javaClass.classLoader!!.getResource("fixtures/bubble-text-fixtures.json")!!.readText(Charsets.UTF_8),
        ).jsonObject
    }

    @Test
    fun widths_match() {
        for (r in root["widths"]!!.jsonArray.map { it.jsonObject }) {
            val text = r["text"]!!.jsonPrimitive.content
            assertEquals(text, r["em"]!!.jsonPrimitive.double, bubbleWidthEm(text), 1e-9)
        }
    }

    @Test
    fun fits_match() {
        for (r in root["fits"]!!.jsonArray.map { it.jsonObject }) {
            val text = r["text"]!!.jsonPrimitive.content
            val slot = r["slot"]!!.jsonPrimitive.double
            val f = r["fit"]!!.jsonObject
            val got = bubbleFit(text, slot, r["maxSize"]!!.jsonPrimitive.int, r["minSize"]!!.jsonPrimitive.int)
            assertEquals("$text @ $slot lines", f["lines"]!!.jsonArray.map { it.jsonPrimitive.content }, got.lines)
            assertEquals("$text @ $slot size", f["size"]!!.jsonPrimitive.int, got.size)
        }
    }

    @Test
    fun home_fits_match() {
        for (r in root["home"]!!.jsonArray.map { it.jsonObject }) {
            val text = r["text"]!!.jsonPrimitive.content
            val slot = r["slot"]!!.jsonPrimitive.double
            val f = r["fit"]!!.jsonObject
            val got = homeHeadlineFit(text, r["name"]!!.jsonPrimitive.content, slot)
            assertEquals("$text @ $slot lines", f["lines"]!!.jsonArray.map { it.jsonPrimitive.content }, got.lines)
            assertEquals("$text @ $slot size", f["size"]!!.jsonPrimitive.int, got.size)
            assertEquals("$text @ $slot nameLines", f["nameLines"]?.jsonArray?.map { it.jsonPrimitive.int } ?: emptyList<Int>(), got.nameLines)
        }
    }

    @Test
    fun glyph_names_match() {
        for (g in root["glyphs"]!!.jsonArray.map { it.jsonObject }) {
            val ch = g["ch"]!!.jsonPrimitive.content
            val name = g["name"]!!.jsonPrimitive.contentOrNull
            assertEquals(ch, name, bubbleGlyphName(ch))
        }
    }

    /** The no-clip guard: the longest headlines, narrowest to widest slots. */
    @Test
    fun never_clips_or_truncates() {
        val texts = listOf(
            "WORDOCIOUS FLAWLESS! 10 PUZZLES LEFT", "PUZZLES SWEPT! 10 PUZZLES LEFT", "ON A ROLL · 11 OF 18",
            "GOOD AFTERNOON, MAXIMILLIAN_THE_GREAT!", "SPOOKY SEASON · TRICK OR TREAT ★ 9,999 POINTS", "SATURDAY SUPERSTARS",
        )
        for (slot in listOf(220.0, 285.0, 334.0, 400.0, 520.0, 760.0)) {
            for (t in texts) {
                val f = bubbleFit(t, slot, maxSize = 38)
                assertEquals(t.replace(" ", ""), f.lines.joinToString("").replace(" ", ""))
                for (l in f.lines) {
                    assertFalse(l.contains("…"))
                    assertTrue("$t @ $slot", bubbleWidthEm(l) * f.size <= slot + 1e-6)
                }
            }
        }
    }
}
