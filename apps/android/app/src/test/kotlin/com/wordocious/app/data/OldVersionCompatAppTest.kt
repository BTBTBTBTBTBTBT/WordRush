package com.wordocious.app.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Item 39 (the app half of the Android suite; the pure-core half is core OldVersionCompatTest): the stored age answer, the
 * rich push data map and the pocket game list, each fed shapes the other version can send. Same fixture file as web and iOS.
 */
class OldVersionCompatAppTest {
    private val root: JsonObject by lazy {
        Json.parseToJsonElement(javaClass.classLoader!!.getResource("fixtures/compat-fixtures.json")!!.readText()).jsonObject
    }

    private fun str(e: kotlinx.serialization.json.JsonElement?): String? =
        (e as? JsonPrimitive)?.takeUnless { it is JsonNull }?.takeIf { it.isString }?.contentOrNull

    @Test
    fun storedAgeAnswersFromAnyVersion() {
        val age = root["age"]!!.jsonObject
        val now = age["nowYear"]!!.jsonPrimitive.int
        for (c in age["stored"]!!.jsonArray.map { it.jsonObject }) {
            val raw = str(c["raw"])
            val got = AgeCheck.parse(raw, now)
            val want = c["expect"]?.takeUnless { it is JsonNull }?.jsonObject
            if (want == null) {
                assertNull("raw=$raw", got)
            } else {
                assertNotNull("raw=$raw", got)
                assertEquals("raw=$raw", str(want["state"]), got!!.state.name.lowercase())
                assertEquals("raw=$raw", want["year"]!!.jsonPrimitive.int, got.year)
            }
        }
    }

    @Test
    fun richPushDataFromNewerAndOlderServers() {
        for (c in root["push"]!!.jsonObject["rich"]!!.jsonArray.map { it.jsonObject }) {
            val name = str(c["name"])!!
            val data = c["fields"]!!.jsonObject.mapValues { it.value.jsonPrimitive.content }
            val f = RichPushNotifier.Fields.from(data)
            val want = c["expect"]?.takeUnless { it is JsonNull }?.jsonObject
            if (want == null) {
                // Not a rich payload the iOS reader accepts: Android still posts a plain notification, never throws.
                assertEquals(name, "Wordocious", f.title)
                continue
            }
            assertEquals(name, str(want["senderId"]), f.senderId)
            assertEquals(name, str(want["gameId"]), f.gameId)
            assertEquals(name, str(want["thread"]), f.thread)
            assertEquals(name, str(want["url"]), f.url)
            assertEquals(name, want["halloween"]!!.jsonPrimitive.content == "true", f.halloween)
            assertEquals(name, str(want["senderAvatar"]), f.senderAvatar)
            assertEquals(name, str(want["gameImage"]), f.gameImage)
            assertEquals(name, RichPushNotifier.Fields.parseHex(str(want["accent"])), f.accent)
        }
    }

    @Test
    fun aBrokenAccentIsTheBrandPurple() {
        for (bad in listOf("", "purple", "#12345", "#gggggg", "7c3aed7c")) {
            assertEquals(bad, RichPushNotifier.Fields.BRAND_PURPLE, RichPushNotifier.Fields.from(mapOf("accent" to bad)).accent)
        }
        assertEquals(0xFF16A34A.toInt(), RichPushNotifier.Fields.from(mapOf("accent" to "#16a34a")).accent)
        assertEquals(RichPushNotifier.Fields.BRAND_PURPLE, RichPushNotifier.Fields.from(emptyMap()).accent)
    }

    @Test
    fun aGameListWithRowsThisBuildCannotReadKeepsTheRest() {
        val list = root["games"]!!.jsonObject["list"]!!.jsonObject
        val kept = list["active"]!!.jsonArray.mapNotNull { FriendlyGamesService.decodeGame(it)?.id }
        assertEquals(list["keptIds"]!!.jsonArray.map { it.jsonPrimitive.content }, kept)
        assertTrue(list["recent"]!!.jsonArray.mapNotNull { FriendlyGamesService.decodeGame(it) }.isEmpty())
        // A non-object and a null are skipped, not thrown on.
        assertNull(FriendlyGamesService.decodeGame(JsonPrimitive("not-a-game")))
        assertNull(FriendlyGamesService.decodeGame(JsonNull))
        assertNull(FriendlyGamesService.decodeGame(null))
    }
}
