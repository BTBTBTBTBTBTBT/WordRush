package com.wordocious.core

import kotlinx.serialization.json.Json
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
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * FINISH_SPEC BJ5 parity guard: resolveAvatar's precedence (custom photo → saved
 * mascot → worn cast hero → seeded mascot, avatar_frame filling a frameless config)
 * must match packages/core/src/avatar-config.ts (avatar-resolve-fixtures.json).
 */
class AvatarResolveFixtureTest {
    private val root: JsonObject by lazy {
        Json.parseToJsonElement(javaClass.classLoader!!.getResource("fixtures/avatar-resolve-fixtures.json")!!.readText()).jsonObject
    }

    private fun str(e: JsonElement?): String? = (e as? JsonPrimitive)?.takeUnless { it is JsonNull }?.takeIf { it.isString }?.contentOrNull

    @Test
    fun resolve_cases_match() {
        val cases = root["cases"]!!.jsonArray.map { it.jsonObject }
        for ((i, c) in cases.withIndex()) {
            val s = c["source"]!!.jsonObject
            val src = AvatarSource(
                username = str(s["username"]),
                avatarUrl = str(s["avatarUrl"]),
                config = s["config"]?.takeUnless { it is JsonNull },
                castId = str(s["castId"]),
                frame = str(s["frame"]),
                accentHex = str(s["accentHex"]),
            )
            val expected = c["result"]!!.jsonObject
            val got = resolveAvatar(src)
            assertEquals("case[$i].kind", str(expected["kind"]), got.kind.id)
            assertEquals("case[$i].photoUrl", str(expected["photoUrl"]), got.photoUrl)
            val gotJson = avatarToJson(got.config)
            for ((k, v) in expected["config"]!!.jsonObject) assertEquals("case[$i].config.$k", v, gotJson[k])
        }
    }

    @Test
    fun custom_photo_urls_match() {
        for (r in root["custom"]!!.jsonArray.map { it.jsonObject }) {
            val url = str(r["url"])
            assertEquals(url.toString(), r["custom"]!!.jsonPrimitive.booleanOrNull, isCustomPhotoUrl(url))
        }
    }

    @Test
    fun oauth_picture_without_saved_choice_is_never_drawn() {
        val r = resolveAvatar(AvatarSource(username = "Ukrainian Cyclone", avatarUrl = "https://lh3.googleusercontent.com/a/x=s96-c"))
        assertEquals(AvatarSourceKind.SEEDED, r.kind)
        assertNull(r.photoUrl)
    }
}
