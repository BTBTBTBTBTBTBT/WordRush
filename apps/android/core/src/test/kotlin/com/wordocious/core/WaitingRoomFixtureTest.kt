package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Parity guard for the waiting-room words (packages/core/src/waiting-room.ts, waiting-room-fixtures.json). */
class WaitingRoomFixtureTest {
    private val root: JsonObject by lazy {
        Json.parseToJsonElement(javaClass.classLoader!!.getResource("fixtures/waiting-room-fixtures.json")!!.readText()).jsonObject
    }

    private fun kotlinx.serialization.json.JsonElement?.strOrNull(): String? =
        (this as? JsonPrimitive)?.takeIf { this !is JsonNull }?.contentOrNull

    @Test
    fun status_lines_match() {
        val lines = root["lines"]!!.jsonArray
        assertTrue(lines.isNotEmpty())
        for (c in lines) {
            val o = c.jsonObject
            val kind = WaitingKind.from(o["kind"].strOrNull())!!
            assertEquals("line $o", o["text"].strOrNull(), WaitingRoom.waitingStatusLine(kind, o["name"].strOrNull()))
        }
    }

    @Test
    fun clocks_match() {
        for (c in root["clocks"]!!.jsonArray) {
            val o = c.jsonObject
            val seconds = (o["seconds"] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.doubleOrNull ?: Double.NaN
            assertEquals("clock $o", o["text"].strOrNull(), WaitingRoom.waitClock(seconds))
        }
    }

    @Test
    fun waited_seconds_match() {
        for (c in root["waited"]!!.jsonArray) {
            val o = c.jsonObject
            assertEquals("waited $o", o["seconds"]!!.jsonPrimitive.long, WaitingRoom.waitedSeconds(o["startMs"]!!.jsonPrimitive.long, o["nowMs"]!!.jsonPrimitive.long))
        }
    }

    @Test
    fun keepy_lines_match() {
        for (c in root["keepy"]!!.jsonArray) {
            val o = c.jsonObject
            assertEquals("keepy $o", o["text"].strOrNull(), WaitingRoom.keepyLine(o["count"]!!.jsonPrimitive.int, o["best"]!!.jsonPrimitive.int))
        }
    }

    @Test
    fun idle_bits_match() {
        for (c in root["idle"]!!.jsonArray) {
            val o = c.jsonObject
            assertEquals("idle $o", o["bit"].strOrNull(), WaitingRoom.idleBit(o["seconds"]!!.jsonPrimitive.int))
        }
    }
}
