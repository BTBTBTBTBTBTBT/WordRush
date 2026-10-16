package com.wordocious.core

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Share-sheet parity guard: the model for every fixture context, on every platform, must come out byte-equal to
 * packages/core/src/share-sheet.ts (share-sheet-fixtures.json), and the tables must match.
 */
class ShareSheetFixtureTest {
    private val root: JsonObject by lazy {
        Json.parseToJsonElement(javaClass.classLoader!!.getResource("fixtures/share-sheet-fixtures.json")!!.readText()).jsonObject
    }

    private val json = Json { encodeDefaults = true }

    private fun JsonElement?.str(): String = (this as JsonPrimitive).content
    private fun JsonElement?.strOrNull(): String? = (this as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull
    private fun JsonElement?.intOrNull(): Int? = (this as? JsonPrimitive)?.takeIf { it !is JsonNull }?.int
    private fun JsonElement?.strings(): List<String> = this!!.jsonArray.map { it.jsonPrimitive.content }

    private fun context(o: JsonObject): ShareSheetContext {
        val cap = (o["caption"] as? JsonObject)?.let { c ->
            ShareSheetCaption(
                kind = ShareCaptions.kindOf(c["kind"].str())!!, date = c["date"].str(), game = c["game"].str(),
                n = c["n"].strOrNull(), t = c["t"].strOrNull(), b = c["b"].strOrNull(), d = c["d"].intOrNull(), k = c["k"].strOrNull(), opp = c["opp"].strOrNull(),
            )
        }
        return ShareSheetContext(
            surface = ShareSurface.from(o["surface"].str())!!, mode = o["mode"].str(), play = SharePlay.from(o["play"].strOrNull()),
            cards = o["cards"].strings().map { ShareCardKind.from(it)!! }, hasSpoilerVariant = o["hasSpoilerVariant"]!!.jsonPrimitive.boolean,
            season = o["season"].strOrNull(), caption = cap,
        )
    }

    @Test
    fun tables_match() {
        assertEquals(root["platforms"].strings(), SharePlatform.entries.map { it.id })
        assertEquals(root["cardOrder"].strings(), ShareSheet.CARD_ORDER.map { it.id })
        assertEquals(root["channelOrder"].strings(), ShareSheet.CHANNEL_ORDER.map { it.id })
        assertEquals(root["linkBase"].str(), ShareSheet.LINK_BASE)
        assertEquals(root["webMobileOnly"].strings(), ShareSheet.WEB_MOBILE_ONLY.map { it.id })
        assertEquals(root["lookLabels"]!!.jsonObject.mapValues { it.value.str() }, ShareSheet.LOOK_LABELS)
        for ((k, v) in root["cardTitles"]!!.jsonObject) assertEquals(k, v.str(), ShareSheet.CARD_TITLES[ShareCardKind.from(k)!!])
        for ((k, v) in root["surfaceDefaultCard"]!!.jsonObject) assertEquals(k, v.str(), ShareSheet.SURFACE_DEFAULT_CARD[ShareSurface.from(k)!!]!!.id)
        for ((k, v) in root["channelLabels"]!!.jsonObject) assertEquals(k, v.str(), ShareSheet.CHANNEL_LABELS[ShareChannelId.from(k)!!])
        for ((k, v) in root["channelAvailability"]!!.jsonObject) assertEquals(k, v.str(), ShareSheet.CHANNEL_AVAILABILITY[ShareChannelId.from(k)!!]!!.id)
        for ((k, v) in root["channelSlugs"]!!.jsonObject) assertEquals(k, v.strOrNull(), ShareSheet.CHANNEL_SLUGS[ShareChannelId.from(k)!!])
        for ((k, row) in root["channelPayloads"]!!.jsonObject) {
            val id = ShareChannelId.from(k)!!
            for ((p, v) in row.jsonObject) assertEquals("$k $p", v.strOrNull(), ShareSheet.payload(id, SharePlatform.from(p)!!)?.id)
        }
        for (f in root["frames"]!!.jsonArray.map { it.jsonObject }) {
            assertEquals(f["id"].str(), f["frame"].str(), channelFrame(ShareChannelId.from(f["id"].str())!!).id)
        }
    }

    @Test
    fun cards_and_looks_match() {
        for (c in root["cards"]!!.jsonArray.map { it.jsonObject }) {
            val surface = ShareSurface.from(c["surface"].str())!!
            val available = c["available"].strings().mapNotNull { ShareCardKind.from(it) }
            val want = json.encodeToString(JsonElement.serializer(), c["cards"]!!)
            assertEquals(surface.id, want, json.encodeToString(ShareSheet.cards(surface, available)))
        }
        for (l in root["looks"]!!.jsonArray.map { it.jsonObject }) {
            val season = l["season"].strOrNull()
            val want = json.encodeToString(JsonElement.serializer(), l["looks"]!!)
            assertEquals(season ?: "null", want, json.encodeToString(ShareSheet.looks(season)))
        }
    }

    @Test
    fun models_match() {
        val models = root["models"]!!.jsonArray.map { it.jsonObject }
        assertTrue(models.isNotEmpty())
        for (m in models) {
            val name = m["name"].str()
            val ctx = context(m["context"]!!.jsonObject)
            for (platform in SharePlatform.entries) {
                val want = json.encodeToString(JsonElement.serializer(), m[platform.id]!!)
                val got = json.encodeToString(shareSheetModel(ctx, platform))
                assertEquals("$name ${platform.id}", want, got)
            }
        }
    }

    /** The rules the Compose sheet leans on, stated once more in plain Kotlin. */
    @Test
    fun rules() {
        val ctx = ShareSheetContext(
            ShareSurface.FINISHED, "regions", SharePlay.DAILY, listOf(ShareCardKind.RESULT), true, "halloween",
            ShareSheetCaption(ShareCaptions.Kind.WIN, "2026-10-16", "Starsweep", n = "1"),
        )
        val android = shareSheetModel(ctx, SharePlatform.ANDROID)
        assertEquals(
            listOf(ShareChannelId.COPY, ShareChannelId.MESSAGES, ShareChannelId.WHATSAPP, ShareChannelId.X, ShareChannelId.FACEBOOK, ShareChannelId.SAVE, ShareChannelId.MORE),
            android.channels.map { it.id },
        )
        assertEquals(listOf(ShareChannelId.STORIES, ShareChannelId.SNAPCHAT, ShareChannelId.TIKTOK), android.hiddenChannels.map { it.id })
        assertEquals("clean", android.variant.initial)
        assertTrue(android.variant.shown)
        assertEquals(listOf("halloween", "normal"), android.looks.options.map { it.id })
        for (ch in android.channels) if (ch.id in setOf(ShareChannelId.MESSAGES, ShareChannelId.WHATSAPP, ShareChannelId.MORE, ShareChannelId.SAVE)) {
            assertEquals(ch.id.id, ShareChannelPayload.IMAGE, ch.payload); assertNull(ch.link); assertNull(ch.text)
        }
        val x = android.channels.first { it.id == ShareChannelId.X }
        assertEquals(ShareChannelPayload.IMAGE_TEXT, x.payload)
        assertEquals("https://wordocious.com/go/x?s=finished&m=regions", x.link)
        assertTrue(x.text!!.endsWith(x.link!!))
        assertEquals("https://wordocious.com/go/copy?s=finished&m=regions", android.channels.first { it.id == ShareChannelId.COPY }.link)
        assertFalse(android.channels.any { it.mobileOnly })
        val web = shareSheetModel(ctx, SharePlatform.WEB)
        assertTrue(web.channels.first { it.id == ShareChannelId.MESSAGES }.mobileOnly)
        assertEquals(listOf(ShareChannelId.SNAPCHAT), web.hiddenChannels.map { it.id })
        assertFalse(ShareSheet.looks(null).shown)
    }
}
