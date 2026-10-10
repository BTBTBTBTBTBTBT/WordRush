package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

/** Parity guard for a player's own colors (packages/core/src/player-tint.ts, player-tint-fixtures.json). */
class PlayerTintFixtureTest {
    private val root: JsonObject by lazy {
        Json.parseToJsonElement(javaClass.classLoader!!.getResource("fixtures/player-tint-fixtures.json")!!.readText()).jsonObject
    }

    @Test
    fun plates_and_names_match_core() {
        val cases = root["cases"]!!.jsonArray
        assert(cases.size >= 12)
        for (c in cases) {
            val o = c.jsonObject
            val bg = o["bg"]!!.jsonPrimitive.content
            val frame = o["frame"]!!.jsonPrimitive.content
            val color = o["color"]!!.jsonPrimitive.content
            val body = o["bodyHex"]!!.jsonPrimitive.content
            val label = "$bg/$frame/$color"
            assertEquals(label, body, avatarColorHex(color))
            val plate = o["plate"]!!.jsonObject
            val got = PlayerTint.plateHexes(bg, frame, body)
            assertEquals(label, plate["fill"]!!.jsonArray.map { it.jsonPrimitive.content }, got.fill)
            assertEquals(label, plate["border"]!!.jsonArray.map { it.jsonPrimitive.content }, got.border)
            assertEquals(label, plate["borderWidth"]!!.jsonPrimitive.double, got.borderWidth, 1e-9)
            assertEquals(label, plate["lightInk"]!!.jsonPrimitive.boolean, got.lightInk)
            assertEquals(label, o["nameHex"]!!.jsonPrimitive.content, PlayerTint.nameHex(bg, body))
        }
    }
}
