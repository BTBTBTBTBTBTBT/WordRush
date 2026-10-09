package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Item 46: the moment shares are the same cards as the web builders (moment-share-fixtures.json). */
class MomentShareFixtureTest {
    private val root: JsonObject by lazy {
        Json.parseToJsonElement(javaClass.classLoader!!.getResource("fixtures/moment-share-fixtures.json")!!.readText()).jsonObject
    }

    private fun str(o: JsonObject, k: String): String? = o[k]?.takeUnless { it is JsonNull }?.jsonPrimitive?.content

    @Test
    fun buildersMatchTheSharedFixture() {
        val cases = root["cases"]!!.jsonArray.map { it.jsonObject }
        assertTrue(cases.size >= 12)
        for (c in cases) {
            val a = c["args"]!!.jsonObject
            val want = c["expect"]!!.jsonObject
            val label = "${str(c, "kind")} $a"
            val got = when (str(c, "kind")) {
                "levelUp" -> MomentShare.levelUp(
                    a["level"]!!.jsonPrimitive.int, str(a, "tier")!!,
                    accentHex = str(a, "accentHex") ?: MomentShare.PURPLE, xpToNext = a["xpToNext"]?.jsonPrimitive?.intOrNull,
                )
                "pocket" -> MomentShare.pocketResult(
                    str(a, "gameTitle")!!, a["won"]?.jsonPrimitive?.booleanOrNull, a["mine"]?.jsonPrimitive?.intOrNull,
                    a["theirs"]?.jsonPrimitive?.intOrNull, str(a, "opponent")!!,
                )
                else -> MomentShare.streak(
                    a["streak"]!!.jsonPrimitive.int, a["best"]!!.jsonPrimitive.int,
                    a["lastDays"]!!.jsonArray.map { it.jsonPrimitive.boolean },
                )
            }
            assertEquals(label, str(want, "title"), got.title)
            assertEquals(label, str(want, "accentHex"), got.accentHex)
            assertEquals(label, str(want, "big"), got.big)
            assertEquals(label, str(want, "bigLabel"), got.bigLabel)
            assertEquals(label, want["lines"]!!.jsonArray.map { it.jsonPrimitive.content }, got.lines)
            assertEquals(label, want["dots"]?.jsonArray?.map { it.jsonPrimitive.boolean } ?: emptyList<Boolean>(), got.dots)
            assertEquals(label, want["won"]?.jsonPrimitive?.booleanOrNull, got.won)
            assertEquals(label, str(want, "hero"), got.heroResult.id)
        }
    }
}
