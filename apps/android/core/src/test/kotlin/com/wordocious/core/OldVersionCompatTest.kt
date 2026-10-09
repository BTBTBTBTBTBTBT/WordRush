package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Item 39: 2.7.1 and 2.8 players together. Reads fixtures/compat-fixtures.json, the same file packages/core
 * (compat-2-7-1.test.ts) and iOS (OldVersionCompatTests) read. Every shape another version can send must be read
 * without throwing: unknown ids are skipped, unknown keys are ignored, missing newer keys fall back.
 */
class OldVersionCompatTest {
    private val root: JsonObject by lazy {
        Json.parseToJsonElement(javaClass.classLoader!!.getResource("fixtures/compat-fixtures.json")!!.readText()).jsonObject
    }

    private fun str(e: JsonElement?): String? = (e as? JsonPrimitive)?.takeUnless { it is JsonNull }?.takeIf { it.isString }?.contentOrNull

    private fun parsedJson(p: BrandedInvite.Parsed?): JsonElement =
        if (p == null) JsonNull else JsonObject(mapOf(
            "kind" to JsonPrimitive(if (p.kind == BrandedInvite.Kind.VS) "vs" else "friend"),
            "code" to JsonPrimitive(p.code),
        ))

    @Test
    fun inviteLinksOfBothVersionsParseToTheSameInvite() {
        val cases = root["invites"]!!.jsonArray.map { it.jsonObject }
        assertTrue(cases.size > 10)
        for (c in cases) {
            val input = str(c["input"])!!
            assertEquals("parse $input", c["parse"], parsedJson(BrandedInvite.parse(input)))
            assertEquals("typed $input", c["typed"], parsedJson(BrandedInvite.parseTyped(input)))
        }
    }

    @Test
    fun unknownAvatarIdsAreSkippedNeverCrash() {
        val cases = root["avatars"]!!.jsonArray.map { it.jsonObject }
        assertTrue(cases.size > 8)
        for (c in cases) {
            val name = str(c["name"])!!
            val s = c["source"]!!.jsonObject
            val username = str(s["username"])
            val seeded = avatarToJson(resolveAvatar(AvatarSource(username = username)).config)
            val got = resolveAvatar(AvatarSource(
                username = username, avatarUrl = str(s["avatarUrl"]), config = s["config"]?.takeUnless { it is JsonNull },
                castId = str(s["castId"]), frame = str(s["frame"]), accentHex = str(s["accentHex"]),
            ))
            assertEquals(name, str(c["kind"]), got.kind.id)
            assertEquals(name, str(c["photoUrl"]), got.photoUrl)
            val cfg = avatarToJson(got.config)
            for ((k, v) in c["config"]?.jsonObject ?: JsonObject(emptyMap())) assertEquals("$name: $k", v, cfg[k])
            for (k in c["seeded"]?.jsonArray?.map { it.jsonPrimitive.content } ?: emptyList()) assertEquals("$name: $k = seeded", seeded[k], cfg[k])
            for (k in c["absent"]?.jsonArray?.map { it.jsonPrimitive.content } ?: emptyList()) {
                val v = cfg[k]
                assertTrue("$name: $k absent", v == null || v is JsonNull || (v as? JsonPrimitive)?.contentOrNull == "none")
            }
        }
    }

    @Test
    fun liveChannelNamesAndReactions() {
        val live = root["live"]!!.jsonObject
        val topic = live["topic"]!!.jsonObject
        assertEquals(str(topic["topic"]), FriendlyLive.topic(str(topic["gameId"])!!))
        assertEquals(str(live["events"]!!.jsonObject["move"]), FriendlyLive.EVENT_MOVE)
        assertEquals(str(live["events"]!!.jsonObject["react"]), FriendlyLive.EVENT_REACT)
        val reactions = live["reactions"]!!.jsonObject
        assertEquals(reactions["known"]!!.jsonArray.map { it.jsonPrimitive.content }, FriendlyLive.REACTIONS)
        for (r in reactions["known"]!!.jsonArray) assertTrue(r.jsonPrimitive.content, FriendlyLive.isReaction(r.jsonPrimitive.content))
        for (r in reactions["unknown"]!!.jsonArray) assertFalse(r.jsonPrimitive.content, FriendlyLive.isReaction(r.jsonPrimitive.content))
        assertFalse(FriendlyLive.isReaction(null))
    }

    @Test
    fun gameStatesAndKindsFromANewerServerAreSkipped() {
        val list = root["games"]!!.jsonObject["list"]!!.jsonObject
        // The app's list decoder keeps a row only when its kind AND state decode (FriendlyGamesService.decodeGame).
        val readable = list["active"]!!.jsonArray.mapNotNull { el ->
            val o = el as? JsonObject ?: return@mapNotNull null
            if (FriendlyKind.from(str(o["kind"])) == null) return@mapNotNull null
            if (decodeFriendlyState(o["state"]) == null) return@mapNotNull null
            str(o["id"])
        }
        assertEquals(list["keptIds"]!!.jsonArray.map { it.jsonPrimitive.content }, readable)
    }

    @Test
    fun movesFromEitherVersion() {
        for (m in root["games"]!!.jsonObject["moves"]!!.jsonArray.map { it.jsonObject }) {
            val name = str(m["name"])!!
            val state = decodeFriendlyState(m["state"])!!
            val by = Side.from(str(m["by"]))!!
            // A move this build cannot even decode is a refusal, never a crash.
            val move = FriendlyMove.fromJson(m["move"])
            val ok = move != null && applyFriendlyMove(state, by, move) is MoveResult.Ok
            assertEquals(name, m["ok"]!!.jsonPrimitive.booleanOrNull, ok)
        }
    }

    @Test
    fun theFixtureCoversWhatTheOtherPlatformsRead() {
        for (k in listOf("invites", "avatars", "live", "games", "age", "push")) assertTrue(k, root.containsKey(k))
        assertNull((root["push"]!!.jsonObject["rich"] as JsonArray).last().jsonObject["expect"]?.takeUnless { it is JsonNull })
    }
}
