package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

/** FINISH_SPEC BJ4 parity guard: podiumLayout / podiumOpenSpot match packages/core/src/podium-layout.ts. */
class PodiumLayoutFixtureTest {
    private val root: JsonObject by lazy {
        Json.parseToJsonElement(javaClass.classLoader!!.getResource("fixtures/podium-layout-fixtures.json")!!.readText()).jsonObject
    }

    @Test
    fun layout_cases_match() {
        for (c in root["cases"]!!.jsonArray.map { it.jsonObject }) {
            val ranks = c["ranks"]!!.jsonArray.map { it.jsonPrimitive.int }
            val layout = c["layout"]!!.jsonObject
            val got = podiumLayout(ranks)
            assertEquals("filled $ranks", layout["filled"]!!.jsonPrimitive.int, got.filled)
            assertEquals("open $ranks", layout["open"]!!.jsonArray.map { it.jsonPrimitive.int }, got.open)
        }
    }

    @Test
    fun open_spot_copy_matches() {
        for (o in root["open"]!!.jsonArray.map { it.jsonObject }) {
            val place = o["place"]!!.jsonPrimitive.int
            val spot = podiumOpenSpot(place)
            assertEquals(o["title"]!!.jsonPrimitive.content, spot.title)
            assertEquals(o["line"]!!.jsonPrimitive.content, spot.line)
        }
    }

    @Test
    fun podium_for_n_results() {
        assertEquals(PodiumLayout(0, emptyList()), podiumLayout(emptyList()))
        assertEquals(PodiumLayout(1, listOf(2, 3)), podiumLayout(listOf(1)))
        assertEquals(PodiumLayout(2, listOf(3)), podiumLayout(listOf(1, 2)))
        assertEquals(PodiumLayout(3, emptyList()), podiumLayout(listOf(1, 2, 3)))
        assertEquals(PodiumLayout(3, emptyList()), podiumLayout(listOf(1, 2, 3, 4, 5)))
        assertEquals(PodiumLayout(3, emptyList()), podiumLayout(listOf(1, 1, 1, 1)))
    }
}
